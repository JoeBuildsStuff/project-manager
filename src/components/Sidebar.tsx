import {
  CircleDot,
  Zap,
  Inbox,
  BookOpen,
  Archive,
  FolderKanban,
  Wrench,
  Database,
  Globe,
  Server,
  Home,
  Minus,
  GitBranch,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { SidebarLogo } from "@/components/app-sidebar-logo";
import { cn } from "@/lib/utils";
import type { Project, StatusFilter, CategoryFilter, DeployFilter, HostFilter } from "../types";

interface Props {
  statusFilter: StatusFilter;
  categoryFilter: CategoryFilter;
  deployFilter: DeployFilter;
  hostFilter: HostFilter;
  onStatusFilter: (s: StatusFilter) => void;
  onCategoryFilter: (b: CategoryFilter) => void;
  onDeployFilter: (d: DeployFilter) => void;
  onHostFilter: (h: HostFilter) => void;
  counts: Project[];
  filterOptions: { deploy_platforms: string[]; hosts: string[] };
}

const STATUS_OPTIONS: {
  value: StatusFilter;
  label: string;
  dot: string;
  icon: React.ElementType;
}[] = [
  { value: "all",       label: "All",       dot: "bg-zinc-500",   icon: CircleDot  },
  { value: "active",    label: "Active",    dot: "bg-green-500",  icon: Zap        },
  { value: "inbox",     label: "Inbox",     dot: "bg-yellow-500", icon: Inbox      },
  { value: "archived",  label: "Archived",  dot: "bg-zinc-600",   icon: Archive    },
];

const CATEGORY_OPTIONS: {
  value: CategoryFilter;
  label: string;
  icon: React.ElementType;
}[] = [
  { value: "all",       label: "All categories", icon: Database     },
  { value: "project",   label: "Projects",       icon: FolderKanban },
  { value: "reference", label: "Reference",      icon: BookOpen     },
  { value: "tooling",   label: "Tooling",        icon: Wrench       },
];

const DEPLOY_ICONS: Record<string, React.ElementType> = {
  vercel:  Globe,
  hetzner: Server,
  homelab: Home,
  local:   Server,
  none:    Minus,
};

const DEPLOY_COLORS: Record<string, string> = {
  vercel:  "text-purple-400",
  hetzner: "text-blue-400",
  homelab: "text-indigo-400",
  local:   "text-zinc-400",
  none:    "text-zinc-500",
};

export default function AppSidebar({
  statusFilter,
  categoryFilter,
  deployFilter,
  hostFilter,
  onStatusFilter,
  onCategoryFilter,
  onDeployFilter,
  onHostFilter,
  counts,
  filterOptions,
}: Props) {
  const countFor = (s: StatusFilter) =>
    s === "all" ? counts.length : counts.filter((p) => p.status === s).length;

  const countForDeploy = (d: string) =>
    d === "all" ? counts.length : counts.filter((p) => p.deploy_platform === d).length;

  const countForHost = (h: string) =>
    h === "all" ? counts.length : counts.filter((p) => p.host === h).length;

  return (
    <Sidebar
      collapsible="icon"
      className="data-[side=left]:border-r-muted data-[side=right]:border-l-muted"
    >
      <SidebarHeader className="gap-0 px-2 py-2">
        <SidebarLogo />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Status</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {STATUS_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const n = countFor(opt.value);
                return (
                  <SidebarMenuItem key={opt.value}>
                    <SidebarMenuButton
                      isActive={statusFilter === opt.value}
                      onClick={() => onStatusFilter(opt.value)}
                      className="w-full"
                      tooltip={`${opt.label} (${n})`}
                    >
                      <Icon
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          opt.value === "all"       && "text-zinc-400",
                          opt.value === "active"    && "text-green-400",
                          opt.value === "inbox"     && "text-yellow-400",
                          opt.value === "archived"  && "text-zinc-500",
                        )}
                      />
                      <span>{opt.label}</span>
                    </SidebarMenuButton>
                    <SidebarMenuBadge className="bg-sidebar-accent text-[10px] text-muted-foreground">
                      {n}
                    </SidebarMenuBadge>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="mx-2 my-1" />

        <SidebarGroup>
          <SidebarGroupLabel>Category</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {CATEGORY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <SidebarMenuItem key={opt.value}>
                    <SidebarMenuButton
                      isActive={categoryFilter === opt.value}
                      onClick={() => onCategoryFilter(opt.value)}
                      className="w-full"
                      tooltip={opt.label}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span>{opt.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="mx-2 my-1" />

        <SidebarGroup>
          <SidebarGroupLabel>Deploy</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={deployFilter === "all"}
                  onClick={() => onDeployFilter("all")}
                  className="w-full"
                  tooltip="All platforms"
                >
                  <CircleDot className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  <span>All platforms</span>
                </SidebarMenuButton>
                <SidebarMenuBadge className="bg-sidebar-accent text-[10px] text-muted-foreground">
                  {countForDeploy("all")}
                </SidebarMenuBadge>
              </SidebarMenuItem>
              {filterOptions.deploy_platforms.map((d) => {
                const Icon = DEPLOY_ICONS[d] ?? Server;
                const color = DEPLOY_COLORS[d] ?? "text-muted-foreground";
                const n = countForDeploy(d);
                return (
                  <SidebarMenuItem key={d}>
                    <SidebarMenuButton
                      isActive={deployFilter === d}
                      onClick={() => onDeployFilter(d)}
                      className="w-full"
                      tooltip={`${d} (${n})`}
                    >
                      <Icon className={cn("h-3.5 w-3.5 shrink-0", color)} />
                      <span className="capitalize">{d}</span>
                    </SidebarMenuButton>
                    <SidebarMenuBadge className="bg-sidebar-accent text-[10px] text-muted-foreground">
                      {n}
                    </SidebarMenuBadge>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="mx-2 my-1" />

        <SidebarGroup>
          <SidebarGroupLabel>Host</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={hostFilter === "all"}
                  onClick={() => onHostFilter("all")}
                  className="w-full"
                  tooltip="All hosts"
                >
                  <CircleDot className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  <span>All hosts</span>
                </SidebarMenuButton>
                <SidebarMenuBadge className="bg-sidebar-accent text-[10px] text-muted-foreground">
                  {countForHost("all")}
                </SidebarMenuBadge>
              </SidebarMenuItem>
              {filterOptions.hosts.map((h) => {
                const n = countForHost(h);
                return (
                  <SidebarMenuItem key={h}>
                    <SidebarMenuButton
                      isActive={hostFilter === h}
                      onClick={() => onHostFilter(h)}
                      className="w-full"
                      tooltip={`${h} (${n})`}
                    >
                      <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="capitalize">{h}</span>
                    </SidebarMenuButton>
                    <SidebarMenuBadge className="bg-sidebar-accent text-[10px] text-muted-foreground">
                      {n}
                    </SidebarMenuBadge>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
