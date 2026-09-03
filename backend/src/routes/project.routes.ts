import { Router } from "express";
import * as kanbanController from "../controllers/kanban.controller";
import * as meetingController from "../controllers/meeting.controller";
import * as overviewController from "../controllers/overview.controller";
import * as projectController from "../controllers/project.controller";
import * as taskController from "../controllers/task.controller";
import * as taskCandidateController from "../controllers/task-candidate.controller";
import { authenticate } from "../middleware/auth.middleware";
import { parseAudioUpload } from "../middleware/audio-upload.middleware";
import {
  requireProjectMembership,
  requireProjectRole,
} from "../middleware/project-access.middleware";
import { validateRequest } from "../middleware/validate.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import {
  createKanbanColumnSchema,
  deleteKanbanColumnQuerySchema,
  kanbanColumnParamsSchema,
  kanbanProjectParamsSchema,
  reorderKanbanColumnsSchema,
  updateKanbanColumnSchema,
} from "../validators/kanban.validator";
import {
  createAudioMeetingSchema,
  createMeetingSchema,
  listMeetingsQuerySchema,
  meetingParamsSchema,
  updateMeetingStatusSchema,
} from "../validators/meeting.validator";
import {
  createProjectSchema,
  inviteProjectMemberSchema,
  projectMemberParamsSchema,
  projectParamsSchema,
  transferProjectOwnershipSchema,
  updateProjectMemberSchema,
  updateProjectSchema,
} from "../validators/project.validator";
import {
  bulkCandidateActionSchema,
  candidateCollectionParamsSchema,
  candidateParamsSchema,
  listCandidatesQuerySchema,
  updateCandidateSchema,
} from "../validators/task-candidate.validator";
import {
  createTaskSchema,
  listTasksQuerySchema,
  taskParamsSchema,
  updateTaskSchema,
} from "../validators/task.validator";

export const projectRouter = Router();

projectRouter.use(authenticate);

projectRouter.post(
  "/",
  validateRequest({ body: createProjectSchema }),
  asyncHandler(projectController.createProject),
);
projectRouter.get("/", asyncHandler(projectController.listProjects));

projectRouter.get(
  "/:projectId/kanban/columns",
  validateRequest({ params: kanbanProjectParamsSchema }),
  requireProjectMembership,
  asyncHandler(kanbanController.listColumns),
);
projectRouter.post(
  "/:projectId/kanban/columns",
  validateRequest({
    params: kanbanProjectParamsSchema,
    body: createKanbanColumnSchema,
  }),
  requireProjectMembership,
  requireProjectRole("owner", "admin"),
  asyncHandler(kanbanController.createColumn),
);
projectRouter.put(
  "/:projectId/kanban/columns/order",
  validateRequest({
    params: kanbanProjectParamsSchema,
    body: reorderKanbanColumnsSchema,
  }),
  requireProjectMembership,
  requireProjectRole("owner", "admin"),
  asyncHandler(kanbanController.reorderColumns),
);
projectRouter.patch(
  "/:projectId/kanban/columns/:columnId",
  validateRequest({
    params: kanbanColumnParamsSchema,
    body: updateKanbanColumnSchema,
  }),
  requireProjectMembership,
  requireProjectRole("owner", "admin"),
  asyncHandler(kanbanController.updateColumn),
);
projectRouter.delete(
  "/:projectId/kanban/columns/:columnId",
  validateRequest({
    params: kanbanColumnParamsSchema,
    query: deleteKanbanColumnQuerySchema,
  }),
  requireProjectMembership,
  requireProjectRole("owner", "admin"),
  asyncHandler(kanbanController.deleteColumn),
);
projectRouter.patch(
  "/:projectId/members/:userId",
  validateRequest({
    params: projectMemberParamsSchema,
    body: updateProjectMemberSchema,
  }),
  requireProjectMembership,
  requireProjectRole("owner", "admin"),
  asyncHandler(projectController.updateProjectMember),
);

projectRouter.get(
  "/:projectId/tasks",
  validateRequest({ params: projectParamsSchema, query: listTasksQuerySchema }),
  requireProjectMembership,
  asyncHandler(taskController.listTasks),
);
projectRouter.post(
  "/:projectId/tasks",
  validateRequest({ params: projectParamsSchema, body: createTaskSchema }),
  requireProjectMembership,
  asyncHandler(taskController.createTask),
);
projectRouter.get(
  "/:projectId/tasks/:taskId",
  validateRequest({ params: taskParamsSchema }),
  requireProjectMembership,
  asyncHandler(taskController.getTask),
);
projectRouter.patch(
  "/:projectId/tasks/:taskId",
  validateRequest({ params: taskParamsSchema, body: updateTaskSchema }),
  requireProjectMembership,
  asyncHandler(taskController.updateTask),
);
projectRouter.delete(
  "/:projectId/tasks/:taskId",
  validateRequest({ params: taskParamsSchema }),
  requireProjectMembership,
  requireProjectRole("owner", "admin"),
  asyncHandler(taskController.deleteTask),
);
projectRouter.get(
  "/:projectId/tasks/:taskId/activity",
  validateRequest({ params: taskParamsSchema }),
  requireProjectMembership,
  asyncHandler(taskController.listTaskActivity),
);

projectRouter.post(
  "/:projectId/meetings/audio",
  validateRequest({ params: projectParamsSchema }),
  requireProjectMembership,
  parseAudioUpload,
  validateRequest({ body: createAudioMeetingSchema }),
  asyncHandler(meetingController.createAudioMeeting),
);
projectRouter.post(
  "/:projectId/meetings/transcript",
  validateRequest({ params: projectParamsSchema, body: createMeetingSchema }),
  requireProjectMembership,
  asyncHandler(meetingController.createMeeting),
);
projectRouter.post(
  "/:projectId/meetings",
  validateRequest({ params: projectParamsSchema, body: createMeetingSchema }),
  requireProjectMembership,
  asyncHandler(meetingController.createMeeting),
);
projectRouter.get(
  "/:projectId/meetings",
  validateRequest({
    params: projectParamsSchema,
    query: listMeetingsQuerySchema,
  }),
  requireProjectMembership,
  asyncHandler(meetingController.listMeetings),
);
projectRouter.get(
  "/:projectId/meetings/:meetingId",
  validateRequest({ params: meetingParamsSchema }),
  requireProjectMembership,
  asyncHandler(meetingController.getMeeting),
);
projectRouter.get(
  "/:projectId/meetings/:meetingId/audio",
  validateRequest({ params: meetingParamsSchema }),
  requireProjectMembership,
  asyncHandler(meetingController.getMeetingAudio),
);
projectRouter.get(
  "/:projectId/meetings/:meetingId/transcript",
  validateRequest({ params: meetingParamsSchema }),
  requireProjectMembership,
  asyncHandler(meetingController.getMeetingTranscript),
);
projectRouter.get(
  "/:projectId/meetings/:meetingId/tasks",
  validateRequest({ params: meetingParamsSchema }),
  requireProjectMembership,
  asyncHandler(meetingController.getMeetingTasks),
);
projectRouter.patch(
  "/:projectId/meetings/:meetingId/status",
  validateRequest({
    params: meetingParamsSchema,
    body: updateMeetingStatusSchema,
  }),
  requireProjectMembership,
  requireProjectRole("owner", "admin"),
  asyncHandler(meetingController.updateMeetingStatus),
);
projectRouter.post(
  "/:projectId/meetings/:meetingId/reprocess",
  validateRequest({ params: meetingParamsSchema }),
  requireProjectMembership,
  requireProjectRole("owner", "admin"),
  asyncHandler(meetingController.requestReprocess),
);
projectRouter.get(
  "/:projectId/meetings/:meetingId/candidates",
  validateRequest({ params: candidateCollectionParamsSchema, query: listCandidatesQuerySchema }),
  requireProjectMembership,
  asyncHandler(taskCandidateController.listCandidates),
);
projectRouter.patch(
  "/:projectId/meetings/:meetingId/candidates/:candidateId",
  validateRequest({ params: candidateParamsSchema, body: updateCandidateSchema }),
  requireProjectMembership,
  asyncHandler(taskCandidateController.updateCandidate),
);
projectRouter.post(
  "/:projectId/meetings/:meetingId/candidates/:candidateId/approve",
  validateRequest({ params: candidateParamsSchema }),
  requireProjectMembership,
  asyncHandler(taskCandidateController.approveCandidate),
);
projectRouter.post(
  "/:projectId/meetings/:meetingId/candidates/:candidateId/reject",
  validateRequest({ params: candidateParamsSchema }),
  requireProjectMembership,
  asyncHandler(taskCandidateController.rejectCandidate),
);
projectRouter.post(
  "/:projectId/meetings/:meetingId/candidates/bulk-approve",
  validateRequest({ params: candidateCollectionParamsSchema, body: bulkCandidateActionSchema }),
  requireProjectMembership,
  asyncHandler(taskCandidateController.bulkApproveCandidates),
);
projectRouter.post(
  "/:projectId/meetings/:meetingId/candidates/bulk-reject",
  validateRequest({ params: candidateCollectionParamsSchema, body: bulkCandidateActionSchema }),
  requireProjectMembership,
  asyncHandler(taskCandidateController.bulkRejectCandidates),
);

projectRouter.get(
  "/:projectId/overview",
  validateRequest({ params: projectParamsSchema }),
  requireProjectMembership,
  asyncHandler(overviewController.getProjectOverview),
);

projectRouter.get(
  "/:projectId",
  validateRequest({ params: projectParamsSchema }),
  requireProjectMembership,
  asyncHandler(projectController.getProject),
);
projectRouter.patch(
  "/:projectId",
  validateRequest({ params: projectParamsSchema, body: updateProjectSchema }),
  requireProjectMembership,
  requireProjectRole("owner", "admin"),
  asyncHandler(projectController.updateProject),
);
projectRouter.delete(
  "/:projectId",
  validateRequest({ params: projectParamsSchema }),
  requireProjectMembership,
  requireProjectRole("owner"),
  asyncHandler(projectController.deleteProject),
);
projectRouter.get(
  "/:projectId/members",
  validateRequest({ params: projectParamsSchema }),
  requireProjectMembership,
  asyncHandler(projectController.listProjectMembers),
);
projectRouter.post(
  "/:projectId/members/invite",
  validateRequest({
    params: projectParamsSchema,
    body: inviteProjectMemberSchema,
  }),
  requireProjectMembership,
  requireProjectRole("owner", "admin"),
  asyncHandler(projectController.inviteProjectMember),
);
projectRouter.post(
  "/:projectId/transfer-ownership",
  validateRequest({
    params: projectParamsSchema,
    body: transferProjectOwnershipSchema,
  }),
  requireProjectMembership,
  requireProjectRole("owner"),
  asyncHandler(projectController.transferProjectOwnership),
);
projectRouter.delete(
  "/:projectId/members/:userId",
  validateRequest({ params: projectMemberParamsSchema }),
  requireProjectMembership,
  requireProjectRole("owner", "admin"),
  asyncHandler(projectController.removeProjectMember),
);
