import { Check, File, Kanban, Settings } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { SidebarLogo } from "@/components/app-sidebar-logo";
import { ModeToggle } from "@/components/mode-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { StatusFilter, CategoryFilter, DeployFilter, HostFilter, StageFilter, Project } from "../../types";
import { ProjectSidebarContent } from "./ProjectSidebarContent";
import { TaskSidebarContent } from "./TaskSidebarContent";
import { NotesSidebarContent } from "./NotesSidebarContent";
import type { NotesDocumentSummary } from "@/types";

interface UpdateInfo {
  version: string;
  body?: string;
}

export interface AppSidebarProps {
  statusFilter: StatusFilter;
  categoryFilter: CategoryFilter;
  deployFilter: DeployFilter;
  hostFilter: HostFilter;
  stageFilter: StageFilter;
  onStatusFilter: (s: StatusFilter) => void;
  onCategoryFilter: (b: CategoryFilter) => void;
  onDeployFilter: (d: DeployFilter) => void;
  onHostFilter: (h: HostFilter) => void;
  onStageFilter: (s: StageFilter) => void;
  filterOptions: { deploy_platforms: string[]; hosts: string[]; stages: string[] };
  updateInfo?: UpdateInfo | null;
  onInstallUpdate?: () => void;
  installing?: boolean;
  onOpenSettings?: () => void;
  onJumpToProjects?: () => void;
  onJumpToTasks?: () => void;
  onJumpToNotes?: () => void;
  activeView?: string;
  taskProject?: Project | null;
  notesList?: NotesDocumentSummary[];
  selectedNoteId?: string | null;
  onSelectNoteId?: (id: string) => void;
  onCreateNote?: () => void;
  notesListLoading?: boolean;
}

export default function AppSidebar({
  statusFilter,
  categoryFilter,
  deployFilter,
  hostFilter,
  stageFilter,
  onStatusFilter,
  onCategoryFilter,
  onDeployFilter,
  onHostFilter,
  onStageFilter,
  filterOptions,
  updateInfo,
  onInstallUpdate,
  installing,
  onOpenSettings,
  onJumpToProjects,
  onJumpToTasks,
  onJumpToNotes,
  activeView,
  taskProject,
  notesList = [],
  selectedNoteId = null,
  onSelectNoteId,
  onCreateNote,
  notesListLoading = false,
}: AppSidebarProps) {
  const isTaskView = activeView === "tasks";
  const isNotesView = activeView === "notes";

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
          <SidebarGroupLabel>Jump To</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeView === "projects"}
                  onClick={onJumpToProjects}
                  className="w-full"
                  tooltip="Project table"
                >
                  <Kanban className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>Project Table</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeView === "notes"}
                  onClick={onJumpToNotes}
                  className="w-full"
                  tooltip="Notes"
                >
                  <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>Notes</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeView === "tasks"}
                  onClick={onJumpToTasks}
                  className="w-full"
                  tooltip="Task table"
                >
                  <Check className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>Task Table</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isTaskView ? (
          <TaskSidebarContent project={taskProject ?? null} />
        ) : isNotesView ? (
          <NotesSidebarContent
            notes={notesList}
            selectedId={selectedNoteId}
            onSelect={onSelectNoteId ?? (() => {})}
            onCreate={onCreateNote ?? (() => {})}
            loading={notesListLoading}
          />
        ) : (
          <ProjectSidebarContent
            statusFilter={statusFilter}
            categoryFilter={categoryFilter}
            deployFilter={deployFilter}
            hostFilter={hostFilter}
            stageFilter={stageFilter}
            onStatusFilter={onStatusFilter}
            onCategoryFilter={onCategoryFilter}
            onDeployFilter={onDeployFilter}
            onHostFilter={onHostFilter}
            onStageFilter={onStageFilter}
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
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col">
          <SidebarMenu className="min-w-0 flex-1">
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
          <ModeToggle align="end" />
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
