import { Zap, Inbox, Archive, FolderKanban, BookOpen, Wrench, Globe, Server, Home } from "lucide-react";
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

const STATUS_CONFIG: Record<string, { variant: BadgeVariant; icon: React.ElementType }> = {
  active:   { variant: "green",  icon: Zap     },
  inbox:    { variant: "yellow", icon: Inbox   },
  archived: { variant: "gray",   icon: Archive },
  archive:  { variant: "gray",   icon: Archive },
};

const CATEGORY_CONFIG: Record<string, { variant: BadgeVariant; icon: React.ElementType }> = {
  project:   { variant: "indigo", icon: FolderKanban },
  reference: { variant: "blue",   icon: BookOpen     },
  tooling:   { variant: "purple", icon: Wrench       },
};

const DEPLOY_CONFIG: Record<string, { variant: BadgeVariant; icon: React.ElementType }> = {
  vercel:  { variant: "purple", icon: Globe  },
  hetzner: { variant: "blue",   icon: Server },
  homelab: { variant: "indigo", icon: Home   },
  local:   { variant: "gray",   icon: Server },
};

export function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return (
    <Badge variant="gray" className="text-[11px] font-medium">
      {status}
    </Badge>
  );
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} className="gap-1 text-[11px] font-medium">
      <Icon className="h-2.5 w-2.5" />
      {status}
    </Badge>
  );
}

export function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  const cfg = CATEGORY_CONFIG[category];
  if (!cfg) return (
    <Badge variant="gray" className="text-[11px] font-medium">
      {category}
    </Badge>
  );
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} className="gap-1 text-[11px] font-medium">
      <Icon className="h-2.5 w-2.5" />
      {category}
    </Badge>
  );
}

export function DeployBadge({ platform }: { platform: string | null }) {
  if (!platform) return null;
  const cfg = DEPLOY_CONFIG[platform];
  if (!cfg) return (
    <Badge variant="gray" className="text-[11px] font-medium">
      {platform}
    </Badge>
  );
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} className="gap-1 text-[11px] font-medium">
      <Icon className="h-2.5 w-2.5" />
      {platform}
    </Badge>
  );
}
