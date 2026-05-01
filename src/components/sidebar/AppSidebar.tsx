import { Bot, Check, File, FolderOpen, Kanban, Settings, Star, Terminal } from "lucide-react";
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
import { starIconPinnedClass } from "@/lib/star-ui";
import { cn } from "@/lib/utils";
import type { Project } from "../../types";
import { NotesSidebarContent } from "./NotesSidebarContent";
import type { NotesDocumentSummary } from "@/types";

export interface AppSidebarProps {
  onOpenSettings?: () => void;
  onJumpToProjects?: () => void;
  onJumpToTasks?: () => void;
  onJumpToNotes?: () => void;
  onJumpToTerminal?: () => void;
  onJumpToAgent?: () => void;
  activeView?: string;
  taskProject?: Project | null;
  notesList?: NotesDocumentSummary[];
  selectedNoteId?: string | null;
  onSelectNoteId?: (id: string) => void;
  onCreateNote?: () => void;
  notesListLoading?: boolean;
  pinnedProjects?: Project[];
  recentProjects?: Project[];
  activeProjectKey?: string | null;
  onOpenPinnedProject?: (folderKey: string) => void;
  onOpenRecentProject?: (folderKey: string) => void;
}

export default function AppSidebar({
  onOpenSettings,
  onJumpToProjects,
  onJumpToTasks,
  onJumpToNotes,
  onJumpToTerminal,
  onJumpToAgent,
  activeView,
  taskProject = null,
  notesList = [],
  selectedNoteId = null,
  onSelectNoteId,
  onCreateNote,
  notesListLoading = false,
  pinnedProjects = [],
  recentProjects = [],
  activeProjectKey = null,
  onOpenPinnedProject,
  onOpenRecentProject,
}: AppSidebarProps) {
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
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeView === "agent"}
                  onClick={onJumpToAgent}
                  className="w-full"
                  tooltip="Agents"
                >
                  <Bot className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>Agents</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeView === "terminal"}
                  onClick={onJumpToTerminal}
                  className="w-full"
                  tooltip="Terminal"
                >
                  <Terminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>Terminal</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {pinnedProjects.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Pinned</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {pinnedProjects.map((p) => (
                  <SidebarMenuItem key={p.folder_key}>
                    <SidebarMenuButton
                      isActive={
                        (activeView === "project-detail" && activeProjectKey === p.folder_key) ||
                        (activeView === "tasks" && taskProject?.folder_key === p.folder_key)
                      }
                      onClick={() => onOpenPinnedProject?.(p.folder_key)}
                      className="w-full"
                      tooltip={p.folder_name}
                    >
                      <Star
                        className={cn("h-3.5 w-3.5 shrink-0", starIconPinnedClass)}
                        fill="currentColor"
                        strokeWidth={0}
                        aria-hidden
                      />
                      <span>{p.folder_name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {recentProjects.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Recent</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {recentProjects.map((p) => (
                  <SidebarMenuItem key={p.folder_key}>
                    <SidebarMenuButton
                      isActive={
                        (activeView === "project-detail" && activeProjectKey === p.folder_key) ||
                        (activeView === "tasks" && taskProject?.folder_key === p.folder_key)
                      }
                      onClick={() => onOpenRecentProject?.(p.folder_key)}
                      className="w-full"
                      tooltip={p.folder_name}
                    >
                      <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span>{p.folder_name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isNotesView && (
          <NotesSidebarContent
            notes={notesList}
            selectedId={selectedNoteId}
            onSelect={onSelectNoteId ?? (() => {})}
            onCreate={onCreateNote ?? (() => {})}
            loading={notesListLoading}
          />
        )}
      </SidebarContent>

      <SidebarFooter className="px-2 py-2 space-y-1">
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
