import {
  Circle,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "gray"
  | "red"
  | "yellow"
  | "orange"
  | "amber"
  | "green"
  | "blue"
  | "indigo"
  | "purple"
  | "pink";

const STATUS_BADGE: Record<string, { variant: BadgeVariant; icon: React.ElementType }> = {
  open: { variant: "blue", icon: Circle },
  "in-progress": { variant: "yellow", icon: Loader2 },
  done: { variant: "green", icon: CheckCircle2 },
  closed: { variant: "gray", icon: XCircle },
};

const PRIORITY_BADGE: Record<string, { variant: BadgeVariant; label: string }> = {
  urgent: { variant: "red", label: "Urgent" },
  high: { variant: "orange", label: "High" },
  medium: { variant: "yellow", label: "Medium" },
  low: { variant: "gray", label: "Low" },
};

const KIND_BADGE: Record<string, { variant: BadgeVariant; label: string }> = {
  task: { variant: "blue", label: "Task" },
  issue: { variant: "red", label: "Issue" },
  request: { variant: "purple", label: "Request" },
  "next-step": { variant: "green", label: "Next Step" },
};

export function TaskStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status];
  if (!cfg)
    return (
      <Badge variant="gray" className="text-[11px] font-medium">
        {status}
      </Badge>
    );
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} className="gap-1 text-[11px] font-medium">
      <Icon className={cn("h-2.5 w-2.5", status === "in-progress" && "animate-spin")} />
      {status}
    </Badge>
  );
}

export function TaskPriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return null;
  const cfg = PRIORITY_BADGE[priority];
  if (!cfg)
    return (
      <Badge variant="gray" className="text-[11px] font-medium">
        {priority}
      </Badge>
    );
  return (
    <Badge variant={cfg.variant} className="text-[11px] font-medium">
      {cfg.label}
    </Badge>
  );
}

export function TaskKindBadge({ kind }: { kind: string }) {
  const cfg = KIND_BADGE[kind];
  if (!cfg)
    return (
      <Badge variant="gray" className="text-[11px] font-medium">
        {kind}
      </Badge>
    );
  return (
    <Badge variant={cfg.variant} className="text-[11px] font-medium">
      {cfg.label}
    </Badge>
  );
}
