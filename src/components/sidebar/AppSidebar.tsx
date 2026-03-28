import { Settings } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { SidebarLogo } from "@/components/app-sidebar-logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { StatusFilter, CategoryFilter, DeployFilter, HostFilter, Project } from "../../types";
import { ProjectSidebarContent } from "./ProjectSidebarContent";
import { TaskSidebarContent } from "./TaskSidebarContent";

interface UpdateInfo {
  version: string;
  body?: string;
}

export interface AppSidebarProps {
  statusFilter: StatusFilter;
  categoryFilter: CategoryFilter;
  deployFilter: DeployFilter;
  hostFilter: HostFilter;
  onStatusFilter: (s: StatusFilter) => void;
  onCategoryFilter: (b: CategoryFilter) => void;
  onDeployFilter: (d: DeployFilter) => void;
  onHostFilter: (h: HostFilter) => void;
  filterOptions: { deploy_platforms: string[]; hosts: string[] };
  updateInfo?: UpdateInfo | null;
  onInstallUpdate?: () => void;
  installing?: boolean;
  onOpenSettings?: () => void;
  activeView?: string;
  taskProject?: Project | null;
}

export default function AppSidebar({
  statusFilter,
  categoryFilter,
  deployFilter,
  hostFilter,
  onStatusFilter,
  onCategoryFilter,
  onDeployFilter,
  onHostFilter,
  filterOptions,
  updateInfo,
  onInstallUpdate,
  installing,
  onOpenSettings,
  activeView,
  taskProject,
}: AppSidebarProps) {
  const isTaskView = activeView === "tasks" && taskProject;

  return (
    <Sidebar
      collapsible="icon"
      className="data-[side=left]:border-r-muted data-[side=right]:border-l-muted"
    >
      <SidebarHeader className="gap-0 px-2 py-2">
        <SidebarLogo />
      </SidebarHeader>

      <SidebarContent>
        {isTaskView ? (
          <TaskSidebarContent project={taskProject} />
        ) : (
          <ProjectSidebarContent
            statusFilter={statusFilter}
            categoryFilter={categoryFilter}
            deployFilter={deployFilter}
            hostFilter={hostFilter}
            onStatusFilter={onStatusFilter}
            onCategoryFilter={onCategoryFilter}
            onDeployFilter={onDeployFilter}
            onHostFilter={onHostFilter}
            filterOptions={filterOptions}
          />
        )}
      </SidebarContent>

      <SidebarFooter className="px-2 py-2 space-y-1">
        {updateInfo && (
          <Card className="w-full items-center justify-center text-center">
            <CardHeader className=" w-full">
              <CardTitle className=" w-full">
                <span>Update to v{updateInfo.version}</span>
              </CardTitle>
              <CardDescription className=" w-full">Relaunch to apply</CardDescription>
            </CardHeader>
            <CardContent className=" w-full">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={onInstallUpdate}
                disabled={installing}
              >
                Update
              </Button>
            </CardContent>
          </Card>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={activeView === "settings"}
              onClick={onOpenSettings}
              tooltip="Settings"
            >
              <Settings className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
