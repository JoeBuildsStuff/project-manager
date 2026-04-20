import { Bot, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/types";

export function getTaskAssigneeLabel(task: Pick<Task, "assignee_kind" | "assignee_name">): string {
  if (!task.assignee_kind || !task.assignee_name) return "Unassigned";
  return task.assignee_kind === "llm_agent" ? `AI · ${task.assignee_name}` : task.assignee_name;
}

export function TaskAssigneeBadge({
  kind,
  name,
  className,
}: {
  kind: Task["assignee_kind"];
  name: string | null;
  className?: string;
}) {
  if (!kind || !name) {
    return <span className={cn("text-xs text-muted-foreground", className)}>Unassigned</span>;
  }

  const Icon = kind === "llm_agent" ? Bot : UserRound;
  const label = kind === "llm_agent" ? `AI · ${name}` : name;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs text-foreground",
        className,
      )}
    >
      <Icon className="h-3 w-3 text-muted-foreground" />
      <span className="truncate">{label}</span>
    </span>
  );
}
