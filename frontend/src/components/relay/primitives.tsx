import { cn } from "@/lib/utils";
import {
  initials,
  memberById,
  priorityLabel,
  statusLabel,
  type Priority,
  type Status,
} from "@/lib/relay-data";

export function UserAvatar({
  memberId,
  size = 24,
  className,
}: {
  memberId: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const m = memberById(memberId);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-secondary font-medium text-foreground/80 select-none",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.4) }}
      aria-hidden="true"
    >
      {m ? initials(m.name) : "?"}
    </span>
  );
}

export function AssigneeChip({
  memberId,
  memberName,
  size = 20,
}: {
  memberId: string | null;
  memberName?: string;
  size?: number;
}) {
  const m = memberById(memberId);
  const name = memberName ?? m?.name;
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
      {name ? (
        <span
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-secondary font-medium text-foreground/80"
          style={{ width: size, height: size, fontSize: Math.max(10, size * 0.4) }}
        >
          {initials(name)}
        </span>
      ) : (
        <UserAvatar memberId={memberId} size={size} />
      )}
      {name ? name.split(" ")[0] : "Unassigned"}
    </span>
  );
}

const priorityDot: Record<Priority, string> = {
  high: "bg-destructive",
  medium: "bg-warning",
  low: "bg-subtle",
};

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", priorityDot[priority])} />
      {priorityLabel[priority]}
    </span>
  );
}

const statusDot: Record<Status, string> = {
  todo: "bg-subtle",
  in_progress: "bg-primary",
  done: "bg-success",
};

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2 py-0.5 text-[12.5px] text-muted-foreground">
      <span className={cn("size-1.5 rounded-full", statusDot[status])} />
      {statusLabel[status]}
    </span>
  );
}

export function StatusDot({ status }: { status: Status }) {
  return <span className={cn("size-2 rounded-full", statusDot[status])} />;
}

export function Tag({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "warning" | "danger" | "brand";
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "border-border bg-secondary text-muted-foreground",
    success: "border-success/30 bg-success/10 text-success",
    warning: "border-warning/30 bg-warning/10 text-warning",
    danger: "border-destructive/30 bg-destructive/10 text-destructive",
    brand: "border-primary/30 bg-primary-soft text-primary",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[12px] font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  actions,
  icon: Icon,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      {Icon ? (
        <span className="mb-4 flex size-9 items-center justify-center rounded-lg border border-border bg-secondary">
          <Icon className="size-[18px] text-muted-foreground" />
        </span>
      ) : null}
      <h3 className="text-[15px] font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[13.5px] text-muted-foreground">{description}</p>
      {actions ? <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-5 md:px-8">
      <div>
        <h1 className="page-title">{title}</h1>
        {description ? (
          <p className="mt-1 text-[13.5px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
