import {
  ArrowRightCircle,
  Bug,
  CheckCircle2,
  ChevronDown,
  ChevronsUp,
  Circle,
  Flame,
  HelpCircle,
  ListTodo,
  Loader2,
  MessageSquarePlus,
  Minus,
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

/** Soft outer glow to match pill chips on task / project detail */
const VARIANT_GLOW: Partial<Record<BadgeVariant, string>> = {
  gray: "shadow-[0_0_14px_-6px_rgba(156,163,175,0.45)] dark:shadow-[0_0_16px_-6px_rgba(156,163,175,0.35)]",
  red: "shadow-[0_0_14px_-6px_rgba(248,113,113,0.45)] dark:shadow-[0_0_16px_-6px_rgba(248,113,113,0.35)]",
  yellow: "shadow-[0_0_14px_-6px_rgba(250,204,21,0.4)] dark:shadow-[0_0_16px_-6px_rgba(250,204,21,0.32)]",
  orange: "shadow-[0_0_14px_-6px_rgba(251,146,60,0.42)] dark:shadow-[0_0_16px_-6px_rgba(251,146,60,0.32)]",
  amber: "shadow-[0_0_14px_-6px_rgba(251,191,36,0.42)] dark:shadow-[0_0_16px_-6px_rgba(251,191,36,0.32)]",
  green: "shadow-[0_0_14px_-6px_rgba(74,222,128,0.42)] dark:shadow-[0_0_16px_-6px_rgba(74,222,128,0.32)]",
  blue: "shadow-[0_0_14px_-6px_rgba(96,165,250,0.5)] dark:shadow-[0_0_16px_-6px_rgba(96,165,250,0.38)]",
  indigo: "shadow-[0_0_14px_-6px_rgba(129,140,248,0.45)] dark:shadow-[0_0_16px_-6px_rgba(129,140,248,0.32)]",
  purple: "shadow-[0_0_14px_-6px_rgba(192,132,252,0.42)] dark:shadow-[0_0_16px_-6px_rgba(192,132,252,0.32)]",
  pink: "shadow-[0_0_14px_-6px_rgba(244,114,182,0.42)] dark:shadow-[0_0_16px_-6px_rgba(244,114,182,0.32)]",
};

function pillClass(variant: BadgeVariant) {
  return cn("rounded-full px-2.5", VARIANT_GLOW[variant]);
}

/** Matches `StatusBadge` / project header chips (no pill glow). */
function chipClass(variant: BadgeVariant, appearance: "pill" | "inline") {
  if (appearance === "inline") return "gap-1 text-[11px] font-medium";
  return cn("gap-1 text-[11px] font-medium", pillClass(variant));
}

/** Select trigger on task forms: badge row + chevron, same idea as ProjectDetailContent EditableField */
export const taskFieldSelectTriggerClass =
  "mt-1 h-auto min-h-0 w-full min-w-0 border-0 bg-transparent py-0.5 pl-1 pr-0 shadow-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/40 data-[size=sm]:h-auto data-[size=sm]:rounded-md";

const STATUS_BADGE: Record<string, { variant: BadgeVariant; icon: React.ElementType }> = {
  open: { variant: "blue", icon: Circle },
  "in-progress": { variant: "yellow", icon: Loader2 },
  done: { variant: "green", icon: CheckCircle2 },
  closed: { variant: "gray", icon: XCircle },
};

const PRIORITY_BADGE: Record<string, { variant: BadgeVariant; label: string; icon: React.ElementType }> = {
  urgent: { variant: "red", label: "Urgent", icon: Flame },
  high: { variant: "orange", label: "High", icon: ChevronsUp },
  medium: { variant: "yellow", label: "Medium", icon: Minus },
  low: { variant: "gray", label: "Low", icon: ChevronDown },
};

const KIND_BADGE: Record<string, { variant: BadgeVariant; label: string; icon: React.ElementType }> = {
  task: { variant: "blue", label: "Task", icon: ListTodo },
  issue: { variant: "red", label: "Issue", icon: Bug },
  request: { variant: "purple", label: "Request", icon: MessageSquarePlus },
  "next-step": { variant: "green", label: "Next Step", icon: ArrowRightCircle },
};

export function TaskStatusBadge({
  status,
  appearance = "pill",
}: {
  status: string;
  appearance?: "pill" | "inline";
}) {
  const cfg = STATUS_BADGE[status];
  if (!cfg)
    return (
      <Badge variant="gray" className={chipClass("gray", appearance)}>
        <HelpCircle className="h-2.5 w-2.5 shrink-0" />
        {status}
      </Badge>
    );
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} className={chipClass(cfg.variant, appearance)}>
      <Icon className={cn("h-2.5 w-2.5 shrink-0", status === "in-progress" && "animate-spin")} />
      {status}
    </Badge>
  );
}

export function TaskPriorityBadge({
  priority,
  appearance = "pill",
}: {
  priority: string | null;
  appearance?: "pill" | "inline";
}) {
  if (!priority) return null;
  const cfg = PRIORITY_BADGE[priority];
  if (!cfg)
    return (
      <Badge variant="gray" className={chipClass("gray", appearance)}>
        <HelpCircle className="h-2.5 w-2.5 shrink-0" />
        {priority}
      </Badge>
    );
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} className={chipClass(cfg.variant, appearance)}>
      <Icon className="h-2.5 w-2.5 shrink-0" />
      {cfg.label}
    </Badge>
  );
}

export function TaskKindBadge({ kind, appearance = "pill" }: { kind: string; appearance?: "pill" | "inline" }) {
  const cfg = KIND_BADGE[kind];
  if (!cfg)
    return (
      <Badge variant="gray" className={chipClass("gray", appearance)}>
        <HelpCircle className="h-2.5 w-2.5 shrink-0" />
        {kind}
      </Badge>
    );
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} className={chipClass(cfg.variant, appearance)}>
      <Icon className="h-2.5 w-2.5 shrink-0" />
      {cfg.label}
    </Badge>
  );
}
