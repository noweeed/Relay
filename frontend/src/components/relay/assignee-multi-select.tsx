import { Check, ChevronsUpDown, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Member } from "@/lib/relay-data";

export function AssigneeMultiSelect({
  members,
  selectedIds,
  onChange,
  disabled = false,
}: {
  members: Member[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const selected = new Set(selectedIds);
  const label =
    selectedIds.length === 0
      ? "Unassigned"
      : selectedIds.length === 1
        ? (members.find((member) => member.id === selectedIds[0])?.name ?? "1 assignee")
        : `${selectedIds.length} assignees`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-8 w-full justify-between px-3 text-[13px] font-normal"
          disabled={disabled}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <UserRound className="size-3.5 shrink-0 text-subtle" />
            <span className="truncate">{label}</span>
          </span>
          <ChevronsUpDown className="size-3.5 text-subtle" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1.5">
        <div className="max-h-64 space-y-0.5 overflow-y-auto">
          {members.map((member) => {
            const checked = selected.has(member.id);
            return (
              <button
                type="button"
                key={member.id}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] hover:bg-secondary"
                onClick={() =>
                  onChange(
                    checked
                      ? selectedIds.filter((id) => id !== member.id)
                      : [...selectedIds, member.id],
                  )
                }
              >
                <Checkbox checked={checked} tabIndex={-1} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{member.name}</span>
                {checked ? <Check className="size-3.5 text-primary" /> : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
