import { createFileRoute } from "@tanstack/react-router";
import { History } from "lucide-react";
import { EmptyState, PageHeader, UserAvatar } from "@/components/relay/primitives";
import { useRelay } from "@/lib/relay-store";

export const Route = createFileRoute("/app/activity")({
  head: () => ({
    meta: [
      { title: "Activity | Relay" },
      {
        name: "description",
        content: "Recent task activity for the selected Relay project.",
      },
    ],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const { recentActivity, activeProject } = useRelay();

  return (
    <>
      <PageHeader
        title="Activity"
        description={`Recent changes in ${activeProject?.name ?? "this project"}.`}
      />

      <div className="px-6 py-6 md:px-8">
        {recentActivity.length === 0 ? (
          <EmptyState
            icon={History}
            title="No activity yet"
            description="Task updates and meeting actions will appear here."
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {recentActivity.map((activity) => (
              <li key={activity.id} className="flex gap-3 px-4 py-3.5">
                <UserAvatar memberId={activity.actorId} memberName={activity.actorName} size={26} />
                <span className="min-w-0">
                  <span className="block text-[13.5px]">
                    <span className="font-medium">{activity.actorName ?? "Relay"}</span>{" "}
                    {activity.text}
                  </span>
                  <span className="meta-text mt-0.5 block">{activity.at}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
