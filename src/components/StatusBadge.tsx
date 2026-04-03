import {
  Zap, Inbox, Archive, Kanban, BookOpen, Wrench, Globe, Server, Home,
  Lightbulb, Hammer, Target, TrendingUp, Layers, LayoutGrid, Expand, PauseCircle, TrendingDown, Skull, RotateCcw,
  Cloud,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

function makeClickProps(onClick?: () => void) {
  if (!onClick) return { className: "gap-1 text-[11px] font-medium" };
  return {
    className: "gap-1 text-[11px] font-medium cursor-pointer hover:opacity-80 transition-opacity",
    onClick: (e: React.MouseEvent) => { e.stopPropagation(); onClick(); },
  };
}

const STATUS_CONFIG: Record<string, { variant: BadgeVariant; icon: React.ElementType }> = {
  active:   { variant: "green",  icon: Zap     },
  inbox:    { variant: "yellow", icon: Inbox   },
  archived: { variant: "gray",   icon: Archive },
  archive:  { variant: "gray",   icon: Archive },
};

const CATEGORY_CONFIG: Record<string, { variant: BadgeVariant; icon: React.ElementType }> = {
  project:   { variant: "indigo", icon: Kanban },
  reference: { variant: "blue",   icon: BookOpen     },
  tooling:   { variant: "purple", icon: Wrench       },
};

const DEPLOY_CONFIG: Record<string, { variant: BadgeVariant; icon: React.ElementType }> = {
  vercel:  { variant: "purple", icon: Globe  },
  hetzner: { variant: "blue",   icon: Server },
  homelab: { variant: "indigo", icon: Home   },
  local:   { variant: "gray",   icon: Server },
};

const HOST_CONFIG: Record<string, { variant: BadgeVariant; icon: React.ElementType }> = {
  github:    { variant: "gray",   icon: Cloud  },
  gitlab:    { variant: "orange", icon: Cloud  },
  bitbucket: { variant: "blue",   icon: Cloud  },
  local:     { variant: "gray",   icon: Server },
};

const STAGE_CONFIG: Record<string, { variant: BadgeVariant; icon: React.ElementType }> = {
  idea:     { variant: "gray",    icon: Lightbulb   },
  mvp:      { variant: "blue",    icon: Hammer      },
  pmf:      { variant: "indigo",  icon: Target      },
  growth:   { variant: "green",   icon: TrendingUp  },
  scale:    { variant: "green",   icon: Layers      },
  platform: { variant: "purple",  icon: LayoutGrid  },
  expand:   { variant: "purple",  icon: Expand      },
  plateau:  { variant: "yellow",  icon: PauseCircle },
  erode:    { variant: "orange",  icon: TrendingDown },
  dead:     { variant: "red",     icon: Skull       },
  reborn:   { variant: "amber",   icon: RotateCcw   },
};

export function StatusBadge({ status, onClick }: { status: string | null; onClick?: () => void }) {
  if (!status) return null;
  const cfg = STATUS_CONFIG[status];
  const clickProps = makeClickProps(onClick);
  if (!cfg) return <Badge variant="gray" {...clickProps}>{status}</Badge>;
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} {...clickProps}>
      <Icon className="h-2.5 w-2.5" />
      {status}
    </Badge>
  );
}

export function CategoryBadge({ category, onClick }: { category: string | null; onClick?: () => void }) {
  if (!category) return null;
  const cfg = CATEGORY_CONFIG[category];
  const clickProps = makeClickProps(onClick);
  if (!cfg) return <Badge variant="gray" {...clickProps}>{category}</Badge>;
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} {...clickProps}>
      <Icon className="h-2.5 w-2.5" />
      {category}
    </Badge>
  );
}

export function StageBadge({ stage, onClick }: { stage: string | null; onClick?: () => void }) {
  if (!stage) return null;
  const cfg = STAGE_CONFIG[stage];
  const clickProps = makeClickProps(onClick);
  if (!cfg) return <Badge variant="gray" {...clickProps}>{stage}</Badge>;
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} {...clickProps}>
      <Icon className="h-2.5 w-2.5" />
      {stage}
    </Badge>
  );
}

export function DeployBadge({ platform, onClick }: { platform: string | null; onClick?: () => void }) {
  if (!platform) return null;
  const cfg = DEPLOY_CONFIG[platform];
  const clickProps = makeClickProps(onClick);
  if (!cfg) return <Badge variant="gray" {...clickProps}>{platform}</Badge>;
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} {...clickProps}>
      <Icon className="h-2.5 w-2.5" />
      {platform}
    </Badge>
  );
}

export function HostBadge({ host, onClick }: { host: string | null; onClick?: () => void }) {
  if (!host) return null;
  const cfg = HOST_CONFIG[host];
  const clickProps = makeClickProps(onClick);
  if (!cfg) return <Badge variant="gray" {...clickProps}>{host}</Badge>;
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} {...clickProps}>
      <Icon className="h-2.5 w-2.5" />
      {host}
    </Badge>
  );
}
