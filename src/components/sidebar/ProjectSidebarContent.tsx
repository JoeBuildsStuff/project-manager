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
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { StatusFilter, CategoryFilter, DeployFilter, HostFilter } from "../../types";

export interface ProjectSidebarContentProps {
  statusFilter: StatusFilter;
  categoryFilter: CategoryFilter;
  deployFilter: DeployFilter;
  hostFilter: HostFilter;
  onStatusFilter: (s: StatusFilter) => void;
  onCategoryFilter: (b: CategoryFilter) => void;
  onDeployFilter: (d: DeployFilter) => void;
  onHostFilter: (h: HostFilter) => void;
  filterOptions: { deploy_platforms: string[]; hosts: string[] };
}

const STATUS_OPTIONS: {
  value: StatusFilter;
  label: string;
  dot: string;
  icon: React.ElementType;
}[] = [
  { value: "all", label: "All", dot: "bg-zinc-500", icon: CircleDot },
  { value: "active", label: "Active", dot: "bg-green-500", icon: Zap },
  { value: "inbox", label: "Inbox", dot: "bg-yellow-500", icon: Inbox },
  { value: "archived", label: "Archived", dot: "bg-zinc-600", icon: Archive },
];

const CATEGORY_OPTIONS: {
  value: CategoryFilter;
  label: string;
  icon: React.ElementType;
}[] = [
  { value: "all", label: "All categories", icon: Database },
  { value: "project", label: "Projects", icon: FolderKanban },
  { value: "reference", label: "Reference", icon: BookOpen },
  { value: "tooling", label: "Tooling", icon: Wrench },
];

const DEPLOY_ICONS: Record<string, React.ElementType> = {
  vercel: Globe,
  hetzner: Server,
  homelab: Home,
  local: Server,
  none: Minus,
};

const DEPLOY_COLORS: Record<string, string> = {
  vercel: "text-purple-400",
  hetzner: "text-blue-400",
  homelab: "text-indigo-400",
  local: "text-zinc-400",
  none: "text-zinc-500",
};

export function ProjectSidebarContent({
  statusFilter,
  categoryFilter,
  deployFilter,
  hostFilter,
  onStatusFilter,
  onCategoryFilter,
  onDeployFilter,
  onHostFilter,
  filterOptions,
}: ProjectSidebarContentProps) {
  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Status</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {STATUS_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <SidebarMenuItem key={opt.value}>
                  <SidebarMenuButton
                    isActive={statusFilter === opt.value}
                    onClick={() => onStatusFilter(opt.value)}
                    className="w-full"
                    tooltip={opt.label}
                  >
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        opt.value === "all" && "text-zinc-400",
                        opt.value === "active" && "text-green-400",
                        opt.value === "inbox" && "text-yellow-400",
                        opt.value === "archived" && "text-zinc-500",
                      )}
                    />
                    <span>{opt.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

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
            </SidebarMenuItem>
            {filterOptions.deploy_platforms.map((d) => {
              const Icon = DEPLOY_ICONS[d] ?? Server;
              const color = DEPLOY_COLORS[d] ?? "text-muted-foreground";
              return (
                <SidebarMenuItem key={d}>
                  <SidebarMenuButton
                    isActive={deployFilter === d}
                    onClick={() => onDeployFilter(d)}
                    className="w-full"
                    tooltip={d}
                  >
                    <Icon className={cn("h-3.5 w-3.5 shrink-0", color)} />
                    <span className="capitalize">{d}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

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
            </SidebarMenuItem>
            {filterOptions.hosts.map((h) => {
              return (
                <SidebarMenuItem key={h}>
                  <SidebarMenuButton
                    isActive={hostFilter === h}
                    onClick={() => onHostFilter(h)}
                    className="w-full"
                    tooltip={h}
                  >
                    <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="capitalize">{h}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}
