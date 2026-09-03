import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  initialNotifications,
  initialTasks,
  type ActivityEntry,
  type Candidate,
  type Meeting,
  type KanbanColumn,
  type Member,
  type Notification,
  type Priority,
  type Project,
  type Status,
  type Task,
  type TranscriptSegment,
} from "./relay-data";
import { apiErrorMessage, apiRequest, getAccessToken } from "./api-client";
import { createRelaySocket, type MeetingProgressEvent } from "./relay-socket";

type NewTask = {
  title: string;
  description: string;
  assigneeId: string | null;
  due: string | null;
  priority: Priority;
  columnId: string;
};

type NewKanbanColumn = Pick<KanbanColumn, "name" | "color" | "category">;

type ApiTask = {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  assigneeId?: string;
  dueDate?: string;
  priority: Priority;
  columnId: string;
  source?: { meetingId: string; segmentId?: string; quote?: string; timestampMs?: number };
};

type ApiMeeting = {
  id: string;
  projectId: string;
  title: string;
  type: "transcript" | "audio";
  status: "created" | "processing" | "ready_for_review" | "completed" | "failed";
  segmentCount: number;
  errorMessage?: string;
  createdBy: string;
  createdAt: string;
};

type ApiProjectMember = {
  userId: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  teamRole: string;
};

/** Separates a member's editable team title from their security access role. */
function mapApiProjectMember(member: ApiProjectMember): Member {
  return {
    id: member.userId,
    name: member.name,
    email: member.email,
    role: member.teamRole,
    accessRole: member.role,
  };
}

type ApiTranscriptSegment = {
  id: string;
  index: number;
  speaker?: string;
  text: string;
  startMs?: number;
};

type ApiCandidate = {
  id: string;
  meetingId: string;
  title: string;
  description?: string;
  suggestedAssigneeId?: string;
  suggestedDueDate?: string;
  suggestedPriority: Priority;
  sourceQuote: string;
  sourceTimestampMs?: number;
  status: Candidate["state"];
  createdTaskId?: string;
};

function mapApiCandidate(candidate: ApiCandidate): Candidate {
  return {
    id: candidate.id,
    meetingId: candidate.meetingId,
    title: candidate.title,
    description: candidate.description ?? "",
    assigneeId: candidate.suggestedAssigneeId ?? null,
    due: candidate.suggestedDueDate ? candidate.suggestedDueDate.slice(0, 10) : null,
    priority: candidate.suggestedPriority,
    timestamp:
      candidate.sourceTimestampMs === undefined
        ? "Transcript"
        : formatTimestamp(candidate.sourceTimestampMs),
    quote: candidate.sourceQuote,
    state: candidate.status,
    ...(candidate.createdTaskId ? { createdTaskId: candidate.createdTaskId } : {}),
  };
}

function groupCandidatesByMeeting(
  candidates: Candidate[],
  ids: string[],
): Map<string, Candidate[]> {
  const selected = new Set(ids);
  const grouped = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    if (!selected.has(candidate.id)) continue;
    grouped.set(candidate.meetingId, [...(grouped.get(candidate.meetingId) ?? []), candidate]);
  }
  if ([...grouped.values()].reduce((count, group) => count + group.length, 0) !== selected.size) {
    throw new Error("One or more selected candidates are no longer available.");
  }
  return grouped;
}

/** Converts milliseconds into a short transcript timestamp. */
function formatTimestamp(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1_000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

/** Converts backend meeting metadata into the existing presentation model. */
function mapApiMeeting(meeting: ApiMeeting): Meeting {
  return {
    id: meeting.id,
    projectId: meeting.projectId,
    title: meeting.title,
    date: meeting.createdAt.slice(0, 10),
    durationMin: 0,
    participantIds: [],
    status: meeting.status,
    transcript: [],
    type: meeting.type,
    segmentCount: meeting.segmentCount,
    ...(meeting.errorMessage ? { errorMessage: meeting.errorMessage } : {}),
    createdBy: meeting.createdBy,
  };
}

/** Converts an ordered backend segment into a transcript row for the UI. */
function mapApiSegment(segment: ApiTranscriptSegment): TranscriptSegment {
  return {
    id: segment.id,
    time:
      segment.startMs === undefined ? `#${segment.index + 1}` : formatTimestamp(segment.startMs),
    ...(segment.speaker ? { speakerName: segment.speaker } : {}),
    text: segment.text,
  };
}

type ApiTaskActivity = {
  id: string;
  type:
    | "created"
    | "extracted"
    | "approved"
    | "column_changed"
    | "assignee_changed"
    | "priority_changed"
    | "deadline_changed"
    | "duplicate_resolved";
  fromValue?: unknown;
  toValue?: unknown;
  createdAt: string;
};

/** Converts a backend task into the presentation model shared by Relay screens. */
function mapApiTask(
  task: ApiTask,
  columns: NonNullable<Project["kanbanColumns"]>,
  members: Member[],
): Task {
  const category = columns.find((column) => column.id === task.columnId)?.category ?? "todo";
  const assignee = members.find((member) => member.id === task.assigneeId);
  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    description: task.description ?? "",
    assigneeId: task.assigneeId ?? null,
    ...(assignee ? { assigneeName: assignee.name } : {}),
    due: task.dueDate ? task.dueDate.slice(0, 10) : null,
    priority: task.priority,
    status: category,
    columnId: task.columnId,
    ...(task.source
      ? {
          sourceMeetingId: task.source.meetingId,
          ...(task.source.segmentId ? { sourceSegmentId: task.source.segmentId } : {}),
          ...(task.source.quote ? { sourceQuote: task.source.quote } : {}),
          ...(task.source.timestampMs !== undefined
            ? {
                sourceTimestamp: `${Math.floor(task.source.timestampMs / 60_000)}:${String(Math.floor(task.source.timestampMs / 1_000) % 60).padStart(2, "0")}`,
              }
            : {}),
        }
      : {}),
    activity: [],
  };
}

type Ctx = {
  projects: Project[];
  projectsLoading: boolean;
  projectsError: string | null;
  activeProject: Project | null;
  setActiveProjectId: (id: string) => void;
  createProject: (name: string, description: string) => Promise<Project>;
  createKanbanColumn: (column: NewKanbanColumn) => Promise<KanbanColumn>;
  inviteProjectMember: (email: string, teamRole: string) => Promise<Member>;
  updateProjectMemberTeamRole: (userId: string, teamRole: string) => Promise<Member>;
  transferProjectOwnership: (userId: string) => Promise<void>;
  members: Member[];
  tasks: Task[];
  tasksLoading: boolean;
  tasksError: string | null;
  meetings: Meeting[];
  meetingsLoading: boolean;
  meetingsError: string | null;
  candidates: Candidate[];
  candidatesLoading: boolean;
  candidatesError: string | null;
  notifications: Notification[];
  addTask: (task: NewTask) => Promise<Task>;
  updateTask: (id: string, patch: Partial<Task>, activityText?: string) => Promise<Task>;
  moveTask: (id: string, columnId: string) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  loadTaskActivity: (id: string) => Promise<ActivityEntry[]>;
  createTranscriptMeeting: (title: string, transcript: string) => Promise<Meeting>;
  createAudioMeeting: (title: string, audio: File) => Promise<Meeting>;
  loadMeeting: (meetingId: string) => Promise<Meeting>;
  loadMeetingTranscript: (meetingId: string) => Promise<TranscriptSegment[]>;
  loadMeetingTasks: (meetingId: string) => Promise<Task[]>;
  reprocessMeeting: (meetingId: string) => Promise<Meeting>;
  updateCandidate: (id: string, patch: Partial<Candidate>) => Promise<Candidate>;
  approveCandidate: (id: string) => Promise<void>;
  rejectCandidate: (id: string) => Promise<void>;
  bulkApproveCandidates: (ids: string[]) => Promise<void>;
  bulkRejectCandidates: (ids: string[]) => Promise<void>;
  resolveDuplicate: (id: string, action: "update" | "separate" | "ignore") => void;
  markAllRead: () => void;
  toggleRead: (id: string) => void;
  unreadCount: number;
};

const RelayContext = createContext<Ctx | null>(null);

let seq = 100;
const nid = (p: string) => `${p}${++seq}`;

export function RelayProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectMembers, setProjectMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [meetingsError, setMeetingsError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  useEffect(() => {
    let active = true;

    /** Loads only projects the authenticated backend says this user belongs to. */
    async function loadProjects() {
      try {
        const response = await apiRequest<
          Array<{
            id: string;
            name: string;
            description?: string;
            kanbanColumns: NonNullable<Project["kanbanColumns"]>;
            role: NonNullable<Project["role"]>;
          }>
        >("/projects");
        if (!active) return;
        const loaded = response.map((project) => ({
          id: project.id,
          name: project.name,
          description: project.description ?? "",
          kanbanColumns: project.kanbanColumns,
          role: project.role,
        }));
        setProjects(loaded);
        setActiveProjectId((current) =>
          current && loaded.some((project) => project.id === current)
            ? current
            : (loaded[0]?.id ?? null),
        );
        setProjectsError(null);
      } catch {
        if (active) setProjectsError("Projects could not be loaded from the API.");
      } finally {
        if (active) setProjectsLoading(false);
      }
    }

    void loadProjects();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!activeProjectId || !activeProject) {
      setProjectMembers([]);
      setTasks([]);
      setTasksLoading(false);
      return;
    }
    const projectId = activeProjectId;
    const columns = activeProject.kanbanColumns ?? [];

    /** Loads project members and tasks together so assignee labels match authorized IDs. */
    async function loadBoard() {
      setTasksLoading(true);
      try {
        const [memberResponse, taskResponse] = await Promise.all([
          apiRequest<ApiProjectMember[]>(`/projects/${projectId}/members`),
          apiRequest<ApiTask[]>(`/projects/${projectId}/tasks`),
        ]);
        if (!active) return;
        const loadedMembers = memberResponse.map(mapApiProjectMember);
        setProjectMembers(loadedMembers);
        setTasks(taskResponse.map((task) => mapApiTask(task, columns, loadedMembers)));
        setTasksError(null);
      } catch {
        if (active) setTasksError("The task board could not be loaded from the API.");
      } finally {
        if (active) setTasksLoading(false);
      }
    }

    void loadBoard();
    return () => {
      active = false;
    };
  }, [activeProject, activeProjectId]);

  useEffect(() => {
    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let firstLoad = true;
    if (!activeProjectId) {
      setMeetings([]);
      setCandidates([]);
      setMeetingsLoading(false);
      setCandidatesLoading(false);
      return;
    }
    const projectId = activeProjectId;

    /** Loads only meetings belonging to the currently authorized project. */
    async function loadMeetings() {
      let processing = false;
      if (firstLoad) {
        setMeetingsLoading(true);
        setCandidatesLoading(true);
      }
      try {
        const response = await apiRequest<ApiMeeting[]>(`/projects/${projectId}/meetings`);
        if (!active) return;
        const loadedMeetings = response.map(mapApiMeeting);
        processing = loadedMeetings.some(
          (meeting) => meeting.status === "created" || meeting.status === "processing",
        );
        setMeetings(loadedMeetings);
        setMeetingsError(null);
        const candidateGroups = await Promise.all(
          loadedMeetings.map((meeting) =>
            apiRequest<ApiCandidate[]>(`/projects/${projectId}/meetings/${meeting.id}/candidates`),
          ),
        );
        if (!active) return;
        setCandidates(candidateGroups.flat().map(mapApiCandidate));
        setCandidatesError(null);
      } catch (error) {
        if (active) {
          const message = apiErrorMessage(error);
          setMeetingsError(message);
          setCandidatesError(message);
        }
      } finally {
        if (active) {
          setMeetingsLoading(false);
          setCandidatesLoading(false);
          firstLoad = false;
          if (processing) refreshTimer = setTimeout(() => void loadMeetings(), 3_000);
        }
      }
    }

    const token = getAccessToken();
    const socket = token ? createRelaySocket(token) : undefined;
    socket?.on("connect", () => socket.emit("project:join", projectId));
    socket?.on("meeting.progress", (event: MeetingProgressEvent) => {
      if (!active || event.projectId !== projectId) return;
      setMeetings((previous) =>
        previous.map((meeting) =>
          meeting.id === event.meetingId
            ? {
                ...meeting,
                status: event.status,
                ...(event.errorMessage
                  ? { errorMessage: event.errorMessage }
                  : { errorMessage: undefined }),
              }
            : meeting,
        ),
      );
      if (event.status === "ready_for_review") {
        if (refreshTimer) clearTimeout(refreshTimer);
        void loadMeetings();
      }
    });

    void loadMeetings();
    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      socket?.emit("project:leave", projectId);
      socket?.disconnect();
    };
  }, [activeProjectId]);

  const addTask = useCallback(
    async (task: NewTask) => {
      if (!activeProjectId) throw new Error("Create a project before adding tasks.");
      const created = await apiRequest<ApiTask>(`/projects/${activeProjectId}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          title: task.title,
          ...(task.description ? { description: task.description } : {}),
          ...(task.assigneeId ? { assigneeId: task.assigneeId } : {}),
          ...(task.due ? { dueDate: task.due } : {}),
          priority: task.priority,
          columnId: task.columnId,
        }),
      });
      const mapped = mapApiTask(created, activeProject?.kanbanColumns ?? [], projectMembers);
      mapped.activity = [{ id: nid("a"), text: "Task created manually", at: "Just now" }];
      setTasks((previous) => [mapped, ...previous]);
      return mapped;
    },
    [activeProject?.kanbanColumns, activeProjectId, projectMembers],
  );

  const updateTask = useCallback(
    async (id: string, patch: Partial<Task>, activityText?: string) => {
      if (!activeProjectId) throw new Error("Select a project before editing tasks.");
      const current = tasks.find((task) => task.id === id);
      const updated = await apiRequest<ApiTask>(`/projects/${activeProjectId}/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.description !== undefined ? { description: patch.description || null } : {}),
          ...(patch.assigneeId !== undefined ? { assigneeId: patch.assigneeId } : {}),
          ...(patch.due !== undefined ? { dueDate: patch.due } : {}),
          ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
          ...(patch.columnId !== undefined ? { columnId: patch.columnId } : {}),
        }),
      });
      const mapped = mapApiTask(updated, activeProject?.kanbanColumns ?? [], projectMembers);
      mapped.activity = [
        ...(current?.activity ?? []),
        ...(activityText ? [{ id: nid("a"), text: activityText, at: "Just now" }] : []),
      ];
      setTasks((previous) => previous.map((task) => (task.id === id ? mapped : task)));
      return mapped;
    },
    [activeProject?.kanbanColumns, activeProjectId, projectMembers, tasks],
  );

  const moveTask = useCallback(
    async (id: string, columnId: string) => {
      const destination = activeProject?.kanbanColumns?.find((column) => column.id === columnId);
      return updateTask(id, { columnId }, `Moved to ${destination?.name ?? "another column"}`);
    },
    [activeProject?.kanbanColumns, updateTask],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      if (!activeProjectId) throw new Error("Select a project before deleting tasks.");
      await apiRequest<{ deleted: boolean }>(`/projects/${activeProjectId}/tasks/${id}`, {
        method: "DELETE",
      });
      setTasks((previous) => previous.filter((task) => task.id !== id));
    },
    [activeProjectId],
  );

  const loadTaskActivity = useCallback(
    async (id: string) => {
      if (!activeProjectId) return [];
      const response = await apiRequest<ApiTaskActivity[]>(
        `/projects/${activeProjectId}/tasks/${id}/activity`,
      );
      const columns = activeProject?.kanbanColumns ?? [];
      const columnName = (value: unknown) =>
        columns.find((column) => column.id === value)?.name ?? String(value ?? "unknown");
      const activity = response.map((entry): ActivityEntry => {
        let text = "Task updated";
        if (entry.type === "created") text = "Task created";
        if (entry.type === "extracted") text = "Task extracted from a meeting";
        if (entry.type === "approved") text = "Task approved for the board";
        if (entry.type === "column_changed") {
          text = `Moved from ${columnName(entry.fromValue)} to ${columnName(entry.toValue)}`;
        }
        if (entry.type === "assignee_changed") text = "Assignee changed";
        if (entry.type === "priority_changed") {
          text = `Priority changed from ${String(entry.fromValue)} to ${String(entry.toValue)}`;
        }
        if (entry.type === "deadline_changed") text = "Deadline changed";
        if (entry.type === "duplicate_resolved") text = "Possible duplicate resolved";
        return { id: entry.id, text, at: new Date(entry.createdAt).toLocaleString() };
      });
      setTasks((previous) =>
        previous.map((task) => (task.id === id ? { ...task, activity } : task)),
      );
      return activity;
    },
    [activeProject?.kanbanColumns, activeProjectId],
  );

  /** Creates and immediately adds a pasted-transcript meeting to the active project. */
  const createTranscriptMeeting = useCallback(
    async (title: string, transcript: string) => {
      if (!activeProjectId) throw new Error("Create a project before adding a meeting.");
      const response = await apiRequest<ApiMeeting>(`/projects/${activeProjectId}/meetings`, {
        method: "POST",
        body: JSON.stringify({ title, transcript }),
      });
      const meeting = mapApiMeeting(response);
      setMeetings((previous) => [meeting, ...previous]);
      return meeting;
    },
    [activeProjectId],
  );

  /** Uploads a bounded audio file through the multipart meeting endpoint. */
  const createAudioMeeting = useCallback(
    async (title: string, audio: File) => {
      if (!activeProjectId) throw new Error("Create a project before adding a meeting.");
      const form = new FormData();
      form.set("title", title);
      form.set("audio", audio);
      const response = await apiRequest<ApiMeeting>(`/projects/${activeProjectId}/meetings/audio`, {
        method: "POST",
        body: form,
      });
      const meeting = mapApiMeeting(response);
      setMeetings((previous) => [meeting, ...previous]);
      return meeting;
    },
    [activeProjectId],
  );

  /** Loads one meeting's current metadata through the project-scoped detail endpoint. */
  const loadMeeting = useCallback(
    async (meetingId: string) => {
      if (!activeProjectId) throw new Error("Select a project before loading a meeting.");
      const response = await apiRequest<ApiMeeting>(
        `/projects/${activeProjectId}/meetings/${meetingId}`,
      );
      const meeting = mapApiMeeting(response);
      setMeetings((previous) => [
        meeting,
        ...previous.filter((current) => current.id !== meetingId),
      ]);
      return meeting;
    },
    [activeProjectId],
  );

  /** Fetches ordered parsed segments without exposing the stored raw transcript. */
  const loadMeetingTranscript = useCallback(
    async (meetingId: string) => {
      if (!activeProjectId) return [];
      const response = await apiRequest<ApiTranscriptSegment[]>(
        `/projects/${activeProjectId}/meetings/${meetingId}/transcript`,
      );
      const transcript = response.map(mapApiSegment);
      setMeetings((previous) =>
        previous.map((meeting) =>
          meeting.id === meetingId ? { ...meeting, transcript } : meeting,
        ),
      );
      return transcript;
    },
    [activeProjectId],
  );

  /** Loads tasks through the meeting-scoped traceability endpoint. */
  const loadMeetingTasks = useCallback(
    async (meetingId: string) => {
      if (!activeProjectId) return [];
      const response = await apiRequest<ApiTask[]>(
        `/projects/${activeProjectId}/meetings/${meetingId}/tasks`,
      );
      return response.map((task) =>
        mapApiTask(task, activeProject?.kanbanColumns ?? [], projectMembers),
      );
    },
    [activeProject?.kanbanColumns, activeProjectId, projectMembers],
  );

  /** Retries a failed meeting through the owner/admin-only backend action. */
  const reprocessMeeting = useCallback(
    async (meetingId: string) => {
      if (!activeProjectId) throw new Error("Select a project before retrying a meeting.");
      const response = await apiRequest<ApiMeeting>(
        `/projects/${activeProjectId}/meetings/${meetingId}/reprocess`,
        { method: "POST" },
      );
      const meeting = mapApiMeeting(response);
      setMeetings((previous) =>
        previous.map((current) => (current.id === meetingId ? meeting : current)),
      );
      return meeting;
    },
    [activeProjectId],
  );

  const updateCandidate = useCallback(
    async (id: string, patch: Partial<Candidate>) => {
      if (!activeProjectId) throw new Error("Select a project before editing candidates.");
      const candidate = candidates.find((item) => item.id === id);
      if (!candidate) throw new Error("The task candidate is no longer available.");
      const response = await apiRequest<ApiCandidate>(
        `/projects/${activeProjectId}/meetings/${candidate.meetingId}/candidates/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            ...(patch.title !== undefined ? { title: patch.title } : {}),
            ...(patch.description !== undefined ? { description: patch.description || null } : {}),
            ...(patch.assigneeId !== undefined ? { suggestedAssigneeId: patch.assigneeId } : {}),
            ...(patch.due !== undefined ? { suggestedDueDate: patch.due } : {}),
            ...(patch.priority !== undefined ? { suggestedPriority: patch.priority } : {}),
          }),
        },
      );
      const updated = mapApiCandidate(response);
      setCandidates((previous) =>
        previous.map((current) => (current.id === id ? updated : current)),
      );
      return updated;
    },
    [activeProjectId, candidates],
  );

  const approveCandidate = useCallback(
    async (id: string) => {
      if (!activeProjectId) throw new Error("Select a project before approving candidates.");
      const candidate = candidates.find((item) => item.id === id);
      if (!candidate) throw new Error("The task candidate is no longer available.");
      const response = await apiRequest<{ candidate: ApiCandidate; task: ApiTask }>(
        `/projects/${activeProjectId}/meetings/${candidate.meetingId}/candidates/${id}/approve`,
        { method: "POST" },
      );
      const approved = mapApiCandidate(response.candidate);
      const task = mapApiTask(response.task, activeProject?.kanbanColumns ?? [], projectMembers);
      task.activity = [
        { id: nid("a"), text: "Task extracted from meeting", at: "Just now" },
        { id: nid("a"), text: "Approved in review", at: "Just now" },
      ];
      setCandidates((previous) =>
        previous.map((current) => (current.id === id ? approved : current)),
      );
      setTasks((previous) => [task, ...previous.filter((current) => current.id !== task.id)]);
    },
    [activeProject?.kanbanColumns, activeProjectId, candidates, projectMembers],
  );

  const rejectCandidate = useCallback(
    async (id: string) => {
      if (!activeProjectId) throw new Error("Select a project before rejecting candidates.");
      const candidate = candidates.find((item) => item.id === id);
      if (!candidate) throw new Error("The task candidate is no longer available.");
      const response = await apiRequest<ApiCandidate>(
        `/projects/${activeProjectId}/meetings/${candidate.meetingId}/candidates/${id}/reject`,
        { method: "POST" },
      );
      const rejected = mapApiCandidate(response);
      setCandidates((previous) =>
        previous.map((current) => (current.id === id ? rejected : current)),
      );
    },
    [activeProjectId, candidates],
  );

  const bulkApproveCandidates = useCallback(
    async (ids: string[]) => {
      if (!activeProjectId) throw new Error("Select a project before approving candidates.");
      const grouped = groupCandidatesByMeeting(candidates, ids);
      const responses = await Promise.all(
        [...grouped.entries()].map(([meetingId, group]) =>
          apiRequest<{ candidates: ApiCandidate[]; tasks: ApiTask[] }>(
            `/projects/${activeProjectId}/meetings/${meetingId}/candidates/bulk-approve`,
            {
              method: "POST",
              body: JSON.stringify({ candidateIds: group.map((candidate) => candidate.id) }),
            },
          ),
        ),
      );
      const approved = responses.flatMap((response) => response.candidates).map(mapApiCandidate);
      const approvedById = new Map(approved.map((candidate) => [candidate.id, candidate]));
      const createdTasks = responses
        .flatMap((response) => response.tasks)
        .map((task) => mapApiTask(task, activeProject?.kanbanColumns ?? [], projectMembers));
      setCandidates((previous) =>
        previous.map((candidate) => approvedById.get(candidate.id) ?? candidate),
      );
      setTasks((previous) => [
        ...createdTasks,
        ...previous.filter((task) => !createdTasks.some((created) => created.id === task.id)),
      ]);
    },
    [activeProject?.kanbanColumns, activeProjectId, candidates, projectMembers],
  );

  const bulkRejectCandidates = useCallback(
    async (ids: string[]) => {
      if (!activeProjectId) throw new Error("Select a project before rejecting candidates.");
      const grouped = groupCandidatesByMeeting(candidates, ids);
      const responses = await Promise.all(
        [...grouped.entries()].map(([meetingId, group]) =>
          apiRequest<ApiCandidate[]>(
            `/projects/${activeProjectId}/meetings/${meetingId}/candidates/bulk-reject`,
            {
              method: "POST",
              body: JSON.stringify({ candidateIds: group.map((candidate) => candidate.id) }),
            },
          ),
        ),
      );
      const rejected = responses.flat().map(mapApiCandidate);
      const rejectedById = new Map(rejected.map((candidate) => [candidate.id, candidate]));
      setCandidates((previous) =>
        previous.map((candidate) => rejectedById.get(candidate.id) ?? candidate),
      );
    },
    [activeProjectId, candidates],
  );

  const resolveDuplicate = useCallback(
    (id: string, action: "update" | "separate" | "ignore") => {
      const c = candidates.find((x) => x.id === id);
      if (!c) return;
      if (action === "update" && c.duplicateOf) {
        void updateTask(
          c.duplicateOf.taskId,
          { due: c.due },
          `Deadline updated from a later meeting to ${c.due}`,
        );
        setCandidates((previous) =>
          previous.map((candidate) =>
            candidate.id === id ? { ...candidate, state: "approved" } : candidate,
          ),
        );
      } else if (action === "separate") {
        setCandidates((prev) =>
          prev.map((x) => {
            if (x.id !== id) return x;
            const { duplicateOf: _drop, ...rest } = x;
            return rest;
          }),
        );
      } else {
        void rejectCandidate(id);
      }
    },
    [candidates, rejectCandidate, updateTask],
  );

  const createProject = useCallback(async (name: string, description: string) => {
    const response = await apiRequest<{
      id: string;
      name: string;
      description?: string;
      kanbanColumns: NonNullable<Project["kanbanColumns"]>;
      role: NonNullable<Project["role"]>;
    }>("/projects", {
      method: "POST",
      body: JSON.stringify({ name, ...(description ? { description } : {}) }),
    });
    const project: Project = {
      id: response.id,
      name: response.name,
      description: response.description ?? "",
      kanbanColumns: response.kanbanColumns,
      role: response.role,
    };
    setProjects((previous) => [...previous, project]);
    setActiveProjectId(project.id);
    return project;
  }, []);

  /** Adds a server-validated column and synchronizes the active project definition. */
  const createKanbanColumn = useCallback(
    async (input: NewKanbanColumn) => {
      if (!activeProjectId) throw new Error("Select a project before adding a column.");
      const column = await apiRequest<KanbanColumn>(`/projects/${activeProjectId}/kanban/columns`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      setProjects((previous) =>
        previous.map((project) =>
          project.id === activeProjectId
            ? {
                ...project,
                kanbanColumns: [...(project.kanbanColumns ?? []), column].sort(
                  (left, right) => left.order - right.order,
                ),
              }
            : project,
        ),
      );
      return column;
    },
    [activeProjectId],
  );

  /** Adds an existing Relay user by email with a descriptive, non-security team role. */
  const inviteProjectMember = useCallback(
    async (email: string, teamRole: string) => {
      if (!activeProjectId) throw new Error("Select a project before adding a member.");
      const response = await apiRequest<ApiProjectMember>(
        `/projects/${activeProjectId}/members/invite`,
        {
          method: "POST",
          body: JSON.stringify({ email, teamRole, role: "member" }),
        },
      );
      const member = mapApiProjectMember(response);
      setProjectMembers((previous) => [...previous, member]);
      return member;
    },
    [activeProjectId],
  );

  /** Edits a member's team role while leaving owner/admin/member access unchanged. */
  const updateProjectMemberTeamRole = useCallback(
    async (userId: string, teamRole: string) => {
      if (!activeProjectId) throw new Error("Select a project before editing a member.");
      const response = await apiRequest<ApiProjectMember>(
        `/projects/${activeProjectId}/members/${userId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ teamRole }),
        },
      );
      const member = mapApiProjectMember(response);
      setProjectMembers((previous) =>
        previous.map((current) => (current.id === userId ? member : current)),
      );
      return member;
    },
    [activeProjectId],
  );

  /** Transfers ownership to one existing member and reflects the caller's new admin role. */
  const transferProjectOwnership = useCallback(
    async (userId: string) => {
      if (!activeProjectId) throw new Error("Select a project before transferring ownership.");
      await apiRequest<{ transferred: boolean }>(
        `/projects/${activeProjectId}/transfer-ownership`,
        { method: "POST", body: JSON.stringify({ userId }) },
      );
      setProjects((previous) =>
        previous.map((project) =>
          project.id === activeProjectId ? { ...project, role: "admin" } : project,
        ),
      );
      setProjectMembers((previous) =>
        previous.map((member) => {
          if (member.id === userId) return { ...member, accessRole: "owner" };
          if (member.accessRole === "owner") return { ...member, accessRole: "admin" };
          return member;
        }),
      );
    },
    [activeProjectId],
  );

  const markAllRead = useCallback(
    () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))),
    [],
  );
  const toggleRead = useCallback(
    (id: string) =>
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))),
    [],
  );

  const value = useMemo<Ctx>(
    () => ({
      projects,
      projectsLoading,
      projectsError,
      activeProject,
      setActiveProjectId,
      createProject,
      createKanbanColumn,
      inviteProjectMember,
      updateProjectMemberTeamRole,
      transferProjectOwnership,
      members: projectMembers,
      tasks: tasks.filter((t) => t.projectId === activeProjectId),
      tasksLoading,
      tasksError,
      meetings: meetings.filter((m) => m.projectId === activeProjectId),
      meetingsLoading,
      meetingsError,
      candidates,
      candidatesLoading,
      candidatesError,
      notifications,
      addTask,
      updateTask,
      moveTask,
      deleteTask,
      loadTaskActivity,
      createTranscriptMeeting,
      createAudioMeeting,
      loadMeeting,
      loadMeetingTranscript,
      loadMeetingTasks,
      reprocessMeeting,
      updateCandidate,
      approveCandidate,
      rejectCandidate,
      bulkApproveCandidates,
      bulkRejectCandidates,
      resolveDuplicate,
      markAllRead,
      toggleRead,
      unreadCount: notifications.filter((n) => !n.read).length,
    }),
    [
      projects,
      projectsLoading,
      projectsError,
      activeProject,
      activeProjectId,
      projectMembers,
      tasks,
      tasksLoading,
      tasksError,
      meetings,
      meetingsLoading,
      meetingsError,
      candidates,
      candidatesLoading,
      candidatesError,
      notifications,
      addTask,
      updateTask,
      moveTask,
      deleteTask,
      loadTaskActivity,
      createTranscriptMeeting,
      createAudioMeeting,
      loadMeeting,
      loadMeetingTranscript,
      loadMeetingTasks,
      reprocessMeeting,
      updateCandidate,
      approveCandidate,
      rejectCandidate,
      bulkApproveCandidates,
      bulkRejectCandidates,
      resolveDuplicate,
      createProject,
      createKanbanColumn,
      inviteProjectMember,
      updateProjectMemberTeamRole,
      transferProjectOwnership,
      markAllRead,
      toggleRead,
    ],
  );

  return <RelayContext.Provider value={value}>{children}</RelayContext.Provider>;
}

export function useRelay() {
  const ctx = useContext(RelayContext);
  if (!ctx) throw new Error("useRelay must be used inside RelayProvider");
  return ctx;
}

export function useTheme() {
  const [theme, setThemeState] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = localStorage.getItem("relay-theme");
    const initial =
      stored === "dark" || stored === "light"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setThemeState(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  const setTheme = useCallback((next: "light" | "dark") => {
    setThemeState(next);
    localStorage.setItem("relay-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }, []);

  return { theme, setTheme };
}
