import { AlertTriangle, CalendarClock, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRelay } from "@/lib/relay-store";

const icons = {
  deadline: CalendarClock,
  overdue: AlertTriangle,
  review: ClipboardCheck,
} as const;

const tones = {
  deadline: "text-warning",
  overdue: "text-destructive",
  review: "text-primary",
} as const;

export function NotificationPanel() {
  const { notifications, markAllRead, toggleRead, unreadCount } = useRelay();

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-[13.5px] font-semibold">Notifications</h2>
        <button
          onClick={markAllRead}
          disabled={unreadCount === 0}
          className="text-[12.5px] text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:opacity-50"
        >
          Mark all read
        </button>
      </div>
      <ul className="max-h-96 divide-y divide-border overflow-y-auto">
        {notifications.map((n) => {
          const Icon = icons[n.kind];
          return (
            <li key={n.id}>
              <button
                onClick={() => toggleRead(n.id)}
                className="flex w-full gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-secondary"
              >
                <Icon className={cn("mt-0.5 size-4 shrink-0", tones[n.kind])} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-[13.5px]",
                        n.read ? "text-muted-foreground" : "font-medium",
                      )}
                    >
                      {n.title}
                    </span>
                    {!n.read ? <span className="size-1.5 rounded-full bg-primary" /> : null}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-muted-foreground">{n.body}</span>
                  <span className="meta-text mt-1 block">{n.at}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
