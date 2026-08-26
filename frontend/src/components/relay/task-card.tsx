import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, isOverdue, memberById, type Meeting, type Task } from "@/lib/relay-data";
import { AssigneeChip, PriorityBadge } from "./primitives";

export function TaskCard({
  task,
  meetings,
  onOpen,
  dragging,
}: {
  task: Task;
  meetings: Meeting[];
  onOpen: () => void;
  dragging?: boolean;
}) {
  const source = meetings.find((m) => m.id === task.sourceMeetingId);
  const overdue = isOverdue(task);
  void memberById;

  return (
    <button
      onClick={onOpen}
      className={cn(
        "w-full cursor-grab rounded-lg border border-border bg-card p-3 text-left transition-[transform,border-color,box-shadow] duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-0.5 hover:border-border-strong hover:shadow-raise active:cursor-grabbing",
        dragging && "opacity-50",
      )}
    >
      <p className="text-[13.5px] font-medium leading-snug">{task.title}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <AssigneeChip
          memberId={task.assigneeId}
          {...(task.assigneeName ? { memberName: task.assigneeName } : {})}
        />
        <span
          className={cn(
            "text-[12.5px]",
            overdue ? "font-medium text-destructive" : "text-muted-foreground",
          )}
        >
          {overdue ? "Overdue " : "Due "}
          {formatDate(task.due)}
        </span>
        <PriorityBadge priority={task.priority} />
      </div>
      {source ? (
        <div className="mt-2.5 flex items-center gap-1.5 border-t border-border pt-2.5 text-[12px] text-subtle">
          <Mic className="size-3.5" />
          <span className="truncate">{source.title}</span>
        </div>
      ) : null}
    </button>
  );
}
