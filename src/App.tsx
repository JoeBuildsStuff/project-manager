import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { toast } from "sonner";
import { Download } from "lucide-react";
import type { LlmAgent, NotesDocument, NotesDocumentSummary, Project, Task, TaskCount } from "./types";
import AppSidebar from "./components/Sidebar";
import ProjectTable from "./components/ProjectTable";
import NewProjectDialog from "./components/NewProjectDialog";
import WorkspaceSetup from "./components/WorkspaceSetup";
import Settings from "./components/Settings";
import TaskTable from "./components/TaskTable";
import Notes from "./components/Notes";
import Terminal from "./components/Terminal";
import AgentTable from "./components/AgentTable";
import AgentFullPage from "./components/AgentFullPage";
import ProjectFullPage from "./components/ProjectFullPage";
import TaskFullPage from "./components/TaskFullPage";
import { perfStart, perfEnd } from "./lib/perf";
import { ChatProvider, ChatFooterBar, ChatPanel } from "@/components/chat";
import { useChatStore } from "@/lib/chat/chat-store";
import { cn } from "@/lib/utils";
import {
  clearPinnedProjects,
  readPinnedProjectKeys,
  writePinnedProjectKeys,
} from "@/lib/pinned-projects";
import {
  clearRecentProjects,
  readRecentProjectKeys,
  recordRecentProjectAccess,
} from "@/lib/recent-projects";

interface WorkspaceConfig {
  workspace_path: string | null;
  is_configured: boolean;
}

interface UpdateInfo {
  version: string;
  body?: string;
}

interface DiffStat {
  folder_key: string;
  lines_added: number | null;
  lines_removed: number | null;
}

type View = "projects" | "settings" | "tasks" | "notes" | "terminal" | "agent" | "agent-detail" | "project-detail" | "task-detail";

const NOTES_SELECTED_KEY = "pm-selected-note-id";

export default function App() {
  const isChatInset = useChatStore((s) => s.isMaximized);
  const [pendingJumpTarget, setPendingJumpTarget] = useState<"project-table" | "task-table" | null>(null);
  const [workspaceReady, setWorkspaceReady] = useState<boolean | null>(null);
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [view, setView] = useState<View>("projects");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectInitialName, setNewProjectInitialName] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [syncIsError, setSyncIsError] = useState(false);

  // Task view state
  const [taskProject, setTaskProject] = useState<Project | null>(null);
  const [fullPageProject, setFullPageProject] = useState<Project | null>(null);
  const [fullPageTask, setFullPageTask] = useState<Task | null>(null);
  const [fullPageAgent, setFullPageAgent] = useState<LlmAgent | null>(null);
  const [taskDetailReturnView, setTaskDetailReturnView] = useState<"tasks" | "project-detail">("tasks");
  const [taskCounts, setTaskCounts] = useState<Map<string, TaskCount>>(new Map());

  const [notesList, setNotesList] = useState<NotesDocumentSummary[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(NOTES_SELECTED_KEY);
    } catch {
      return null;
    }
  });
  const [notesListLoading, setNotesListLoading] = useState(false);
  const [recentProjectKeys, setRecentProjectKeys] = useState<string[]>(() => readRecentProjectKeys());
  const [pinnedProjectKeys, setPinnedProjectKeys] = useState<string[]>(() => readPinnedProjectKeys());

  // Check workspace config on mount
  useEffect(() => {
    const t = perfStart("get_workspace_config");
    invoke<WorkspaceConfig>("get_workspace_config").then((config) => {
      perfEnd("get_workspace_config", t);
      setWorkspaceReady(config.is_configured);
      setWorkspacePath(config.workspace_path);
    });
  }, []);

  // Check for updates silently on launch
  useEffect(() => {
    const t = perfStart("check_for_update");
    invoke<UpdateInfo | null>("check_for_update").then((info) => {
      perfEnd("check_for_update", t);
      if (info) setUpdateInfo(info);
    }).catch(() => { perfEnd("check_for_update (failed)", t); });
  }, []);

  // Listen for update-available events from the native menu "Check for Updates..."
  useEffect(() => {
    const unlisten = listen<string>("update-available", (event) => {
      setUpdateInfo({ version: event.payload });
    });
    return () => { unlisten.then((f) => f()); };
  }, []);

  const handleInstallUpdate = useCallback(async () => {
    try {
      await invoke("install_update");
    } catch {
      toast.error("Update failed", { description: "Could not install the update. Please try again." });
    }
  }, []);

  const handleInstallUpdateRef = useRef(handleInstallUpdate);
  handleInstallUpdateRef.current = handleInstallUpdate;

  // Show persistent update toast on launch when update is available
  useEffect(() => {
    if (!updateInfo) return;
    const TOAST_ID = "update-available";
    toast.info("Update available", {
      id: TOAST_ID,
      duration: Infinity,
      closeButton: true,
      description: "A new version of Project Manager is available. The app will relaunch automatically after installing.",
      action: {
        label: (
          <span className="inline-flex items-center gap-1.5">
            <Download className="size-3.5 shrink-0" aria-hidden />
            Install
          </span>
        ),
        onClick: () => handleInstallUpdateRef.current(),
      },
    });
  }, [updateInfo]);

  // Load task counts
  const loadTaskCounts = useCallback(async () => {
    try {
      const counts = await invoke<TaskCount[]>("get_task_counts");
      setTaskCounts(new Map(counts.map((c) => [c.folder_key, c])));
    } catch {
      // silently fail
    }
  }, []);

  const refreshNotesList = useCallback(
    async (options?: { selectId?: string }) => {
      if (!workspaceReady) return;
      setNotesListLoading(true);
      try {
        const list = await invoke<NotesDocumentSummary[]>("list_notes_documents");
        setNotesList(list);
        setSelectedNoteId((prev) => {
          const force = options?.selectId;
          if (force !== undefined && list.some((n) => n.id === force)) {
            return force;
          }
          if (list.length === 0) return null;
          if (prev && list.some((n) => n.id === prev)) return prev;
          return list[0]!.id;
        });
      } catch {
        setNotesList([]);
      } finally {
        setNotesListLoading(false);
      }
    },
    [workspaceReady]
  );

  const handleSelectNoteId = useCallback((id: string) => {
    setSelectedNoteId(id);
  }, []);

  const handleCreateNote = useCallback(async () => {
    try {
      const doc = await invoke<NotesDocument>("create_notes_document");
      await refreshNotesList({ selectId: doc.id });
    } catch {
      // ignore
    }
  }, [refreshNotesList]);

  // Lazy-load diff stats after projects render
  const loadDiffStats = useCallback(async () => {
    const t = perfStart("get_diff_stats");
    try {
      const stats = await invoke<DiffStat[]>("get_diff_stats");
      perfEnd(`get_diff_stats (${stats.length} entries)`, t);
      const map = new Map(stats.map((s) => [s.folder_key, s]));
      setAllProjects((prev) =>
        prev.map((p) => {
          const s = map.get(p.folder_key);
          return s
            ? { ...p, lines_added: s.lines_added, lines_removed: s.lines_removed }
            : p;
        })
      );
    } catch {
      perfEnd("get_diff_stats (failed)", t);
    }
  }, []);

  // Load ALL projects from DB once (no filters — filtering is done client-side)
  const load = useCallback(async () => {
    setLoading(true);
    const t = perfStart("get_projects");
    try {
      const rows = await invoke<Project[]>("get_projects", {
        statusFilter: null,
        categoryFilter: null,
        deployFilter: null,
        hostFilter: null,
        search: null,
      });
      perfEnd(`get_projects (${rows.length} rows)`, t);
      setAllProjects(rows);
      if (fullPageProject) {
        const updated = rows.find((p) => p.folder_key === fullPageProject.folder_key);
        setFullPageProject(updated ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [fullPageProject?.folder_key]);

  // Only fetch from DB when workspace becomes ready (not on filter changes)
  useEffect(() => {
    if (workspaceReady) {
      load();
      loadTaskCounts();
    }
  }, [workspaceReady]);

  useEffect(() => {
    try {
      if (selectedNoteId) {
        localStorage.setItem(NOTES_SELECTED_KEY, selectedNoteId);
      } else {
        localStorage.removeItem(NOTES_SELECTED_KEY);
      }
    } catch {
      // ignore
    }
  }, [selectedNoteId]);

  useEffect(() => {
    if (view === "notes" && workspaceReady) {
      void refreshNotesList();
    }
  }, [view, workspaceReady, refreshNotesList]);

  // Client-side filtering — instant, no IPC round-trip
  const projects = useMemo(() => {
    if (!search) return allProjects;
    const q = search.toLowerCase();
    return allProjects.filter(
      (p) =>
        p.folder_key.toLowerCase().includes(q) ||
        p.folder_name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q)
    );
  }, [allProjects, search]);

  const recentProjects = useMemo(() => {
    const keySet = new Set(allProjects.map((p) => p.folder_key));
    return recentProjectKeys
      .filter((k) => keySet.has(k))
      .map((k) => allProjects.find((p) => p.folder_key === k))
      .filter((p): p is Project => p != null);
  }, [allProjects, recentProjectKeys]);

  const pinnedFolderKeys = useMemo(() => new Set(pinnedProjectKeys), [pinnedProjectKeys]);

  const pinnedProjects = useMemo(() => {
    const keySet = new Set(allProjects.map((p) => p.folder_key));
    return pinnedProjectKeys
      .filter((k) => keySet.has(k))
      .map((k) => allProjects.find((p) => p.folder_key === k))
      .filter((p): p is Project => p != null);
  }, [allProjects, pinnedProjectKeys]);

  const handleToggleProjectPin = useCallback((folderKey: string) => {
    setPinnedProjectKeys((prev) => {
      const has = prev.includes(folderKey);
      const next = has
        ? prev.filter((k) => k !== folderKey)
        : [folderKey, ...prev.filter((k) => k !== folderKey)];
      writePinnedProjectKeys(next);
      return next;
    });
  }, []);

  const prunePinnedKeys = useCallback((removedKeys: string[]) => {
    const remove = new Set(removedKeys);
    setPinnedProjectKeys((prev) => {
      const next = prev.filter((k) => !remove.has(k));
      if (next.length === prev.length) return prev;
      writePinnedProjectKeys(next);
      return next;
    });
  }, []);

  // Diff stats are now persisted in SQLite and loaded with projects.
  // They are refreshed automatically after each Sync.

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg("");
    setSyncIsError(false);
    try {
      const result = await invoke<{ projects_synced: number; projects_pruned: number }>("sync_workspace");
      setSyncMsg(`Synced ${result.projects_synced} projects`);
    } catch (e) {
      setSyncMsg(String(e));
      setSyncIsError(true);
    } finally {
      setSyncing(false);
      await load();
      loadDiffStats();
      loadTaskCounts();
    }
  };

  const handleSelect = (p: Project) => {
    setSelected(p);
    handleOpenFullPage(p);
  };

  const handleStatusChange = async (folder_key: string, status: string) => {
    await invoke("update_project_status", { folderKey: folder_key, status });
    await load();
  };

  const handleFieldChange = async (folder_key: string, field: string, value: string | null) => {
    await invoke("update_project_field", { folderKey: folder_key, field, value });
    await load();
    if (fullPageProject?.folder_key === folder_key) {
      const updated = await invoke<Project | null>("get_project", { folderKey: folder_key });
      setFullPageProject(updated);
    }
  };

  const handleDeleteSelected = async (folderKeys: string[]) => {
    await invoke("delete_projects", { folderKeys });
    if (selected && folderKeys.includes(selected.folder_key)) {
      setSelected(null);
    }
    prunePinnedKeys(folderKeys);
    await load();
    loadTaskCounts();
  };

  const handleOpenTasks = (project: Project) => {
    setRecentProjectKeys(recordRecentProjectAccess(project.folder_key));
    setTaskProject(project);
    setView("tasks");
  };

  const handleOpenTaskDetail = (task: Task, source: "tasks" | "project-detail") => {
    setFullPageTask(task);
    setTaskDetailReturnView(source);
    if (source === "project-detail") {
      const project = allProjects.find((candidate) => candidate.folder_key === task.folder_key) ?? null;
      if (project) {
        setFullPageProject(project);
      }
    }
    setView("task-detail");
  };

  const handleBackFromTasks = () => {
    setView("projects");
    setTaskProject(null);
    loadTaskCounts(); // Refresh counts when coming back
  };

  const handleBackFromTaskDetail = () => {
    if (taskDetailReturnView === "project-detail" && fullPageProject) {
      setView("project-detail");
    } else {
      setView("tasks");
    }
    setFullPageTask(null);
  };

  const handleJumpToProjects = () => {
    setView("projects");
    setPendingJumpTarget("project-table");
  };

  const handleJumpToTasks = () => {
    const scope = fullPageProject ?? taskProject;
    setTaskProject(scope ?? null);
    setView("tasks");
    setPendingJumpTarget("task-table");
  };

  const handleJumpToNotes = () => {
    setView("notes");
  };

  const handleJumpToTerminal = () => {
    setView("terminal");
  };

  const handleJumpToAgent = () => {
    setView("agent");
  };

  const handleOpenAgentDetail = (agent: LlmAgent | null) => {
    setFullPageAgent(agent);
    setView("agent-detail");
  };

  const handleBackFromAgentDetail = () => {
    setFullPageAgent(null);
    setView("agent");
  };

  const handleOpenFullPage = (project: Project) => {
    setRecentProjectKeys(recordRecentProjectAccess(project.folder_key));
    setSelected(project);
    setFullPageProject(project);
    setView("project-detail");
  };

  const handleOpenRecentProject = (folderKey: string) => {
    const p = allProjects.find((x) => x.folder_key === folderKey);
    if (p) handleOpenFullPage(p);
  };

  const handleBackFromFullPage = () => {
    setView("projects");
    setFullPageProject(null);
  };

  useEffect(() => {
    if (!pendingJumpTarget) return;

    const frame = window.requestAnimationFrame(() => {
      const element = document.getElementById(pendingJumpTarget);
      if (!element) return;

      element.scrollIntoView({ behavior: "smooth", block: "start" });
      if (element instanceof HTMLElement) {
        element.focus({ preventScroll: true });
      }
      setPendingJumpTarget(null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pendingJumpTarget, view, taskProject]);

  const handleWorkspaceChanged = async () => {
    const config = await invoke<WorkspaceConfig>("get_workspace_config");
    setWorkspaceReady(config.is_configured);
    setWorkspacePath(config.workspace_path);
    setNotesList([]);
    setSelectedNoteId(null);
    try {
      localStorage.removeItem(NOTES_SELECTED_KEY);
    } catch {
      // ignore
    }
    clearRecentProjects();
    setRecentProjectKeys([]);
    clearPinnedProjects();
    setPinnedProjectKeys([]);
    setView("projects");
  };

  // Loading state while checking config
  if (workspaceReady === null) {
    return <div className="h-screen bg-background" />;
  }

  // Onboarding
  if (!workspaceReady) {
    return (
      <WorkspaceSetup
        onConfigured={() => setWorkspaceReady(true)}
      />
    );
  }

  return (
    <ChatProvider>
    <div className={cn(
      "h-screen overflow-hidden transition-all duration-300 ease-in-out flex flex-col",
      isChatInset && "pr-96"
    )}>
      <SidebarProvider
        className="flex-1 min-h-0 overflow-hidden"
      >
        <AppSidebar
          onOpenSettings={() => setView("settings")}
          onJumpToProjects={handleJumpToProjects}
          onJumpToTasks={handleJumpToTasks}
          onJumpToNotes={handleJumpToNotes}
          onJumpToTerminal={handleJumpToTerminal}
          onJumpToAgent={handleJumpToAgent}
          activeView={view}
          taskProject={taskProject}
          notesList={notesList}
          selectedNoteId={selectedNoteId}
          onSelectNoteId={handleSelectNoteId}
          onCreateNote={handleCreateNote}
          notesListLoading={notesListLoading}
          pinnedProjects={pinnedProjects}
          recentProjects={recentProjects}
          activeProjectKey={fullPageProject?.folder_key ?? null}
          onOpenPinnedProject={handleOpenRecentProject}
          onOpenRecentProject={handleOpenRecentProject}
        />

        <SidebarInset className="min-h-0 min-w-0 flex flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
            {view === "settings" ? (
              <Settings
                workspacePath={workspacePath}
                onWorkspaceChanged={handleWorkspaceChanged}
                onBack={() => setView("projects")}
              />
            ) : view === "tasks" ? (
              <div id="task-table" tabIndex={-1} className="m-2 mb-0 min-h-0 flex-1 outline-none">
                <TaskTable
                  project={taskProject}
                  allProjects={allProjects}
                  onBack={handleBackFromTasks}
                  onOpenTask={(task) => handleOpenTaskDetail(task, "tasks")}
                />
              </div>
            ) : view === "notes" ? (
              <div id="notes" tabIndex={-1} className="m-2 mb-0 min-h-0 flex-1 outline-none">
                <Notes
                  selectedNoteId={selectedNoteId}
                  onRefreshNotesList={refreshNotesList}
                />
              </div>
            ) : view === "terminal" ? (
              <div id="terminal" tabIndex={-1} className="m-2 mb-0 min-h-0 flex-1 outline-none">
                <Terminal />
              </div>
            ) : view === "agent" ? (
              <div id="agent" tabIndex={-1} className="m-2 mb-0 min-h-0 flex-1 outline-none">
                <AgentTable onOpenAgent={handleOpenAgentDetail} />
              </div>
            ) : view === "agent-detail" ? (
              <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
                <AgentFullPage
                  agent={fullPageAgent}
                  onBack={handleBackFromAgentDetail}
                  onSaved={(saved) => { setFullPageAgent(saved); }}
                  onDeleted={handleBackFromAgentDetail}
                />
              </div>
            ) : view === "project-detail" && fullPageProject ? (
              <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
                <ProjectFullPage
                  project={fullPageProject}
                  allProjects={allProjects}
                  workspacePath={workspacePath}
                  onBack={handleBackFromFullPage}
                  onFieldChange={handleFieldChange}
                  onRename={async (folderKey, nextName) => {
                    const nextKey = await invoke<string>("rename_project_folder", {
                      folderKey,
                      newName: nextName,
                    });
                    setPinnedProjectKeys((prev) => {
                      if (!prev.includes(folderKey)) return prev;
                      const replaced = prev.map((k) => (k === folderKey ? nextKey : k));
                      const next = replaced.filter((k, i, a) => a.indexOf(k) === i);
                      writePinnedProjectKeys(next);
                      return next;
                    });
                    await load();
                    const updated = await invoke<Project | null>("get_project", { folderKey: nextKey });
                    setFullPageProject(updated);
                  }}
                  onDelete={async (folderKey) => {
                    await invoke("delete_project_folder", { folderKey });
                    prunePinnedKeys([folderKey]);
                    await load();
                  }}
                  onOpenTask={(task) => handleOpenTaskDetail(task, "project-detail")}
                />
              </div>
            ) : view === "task-detail" && fullPageTask ? (
              <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
                <TaskFullPage
                  task={fullPageTask}
                  project={allProjects.find((project) => project.folder_key === fullPageTask.folder_key) ?? null}
                  workspacePath={workspacePath}
                  onBack={handleBackFromTaskDetail}
                  onTaskSaved={async (updated) => {
                    setFullPageTask(updated);
                    await load();
                    loadTaskCounts();
                  }}
                  onTaskDeleted={async () => {
                    setFullPageTask(null);
                    await load();
                    loadTaskCounts();
                  }}
                />
              </div>
            ) : (
              <div id="project-table" tabIndex={-1} className="m-2 mb-0 min-h-0 flex-1 outline-none">
                <ProjectTable
                  projects={projects}
                  selected={selected}
                  onSelect={handleSelect}
                  search={search}
                  onSearch={setSearch}
                  onSync={handleSync}
                  onNewProject={(initialName) => {
                    setNewProjectInitialName(initialName ?? "");
                    setNewProjectOpen(true);
                  }}
                  syncing={syncing}
                  loading={loading}
                  syncMsg={syncMsg}
                  syncIsError={syncIsError}
                  onStatusChange={handleStatusChange}
                  onDeleteSelected={handleDeleteSelected}
                  taskCounts={taskCounts}
                  onOpenTasks={handleOpenTasks}
                  pinnedFolderKeys={pinnedFolderKeys}
                  onTogglePin={handleToggleProjectPin}
                />
              </div>
            )}
          </div>
          <ChatFooterBar />
        </SidebarInset>

        <NewProjectDialog
          open={newProjectOpen}
          onOpenChange={(open) => {
            setNewProjectOpen(open);
            if (!open) {
              setNewProjectInitialName("");
            }
          }}
          initialName={newProjectInitialName}
          projects={allProjects}
          workspacePath={workspacePath}
          onOpenSettings={() => setView("settings")}
          onCreated={async (folderKey) => {
            await load();
            loadTaskCounts();
            const created = await invoke<Project | null>("get_project", { folderKey });
            if (created) {
              handleOpenFullPage(created);
            }
          }}
        />
      </SidebarProvider>

      <ChatPanel />
    </div>
    </ChatProvider>
  );
}
