import { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { Project, StatusFilter, CategoryFilter, DeployFilter, HostFilter, TaskCount } from "./types";
import AppSidebar from "./components/Sidebar";
import ProjectTable from "./components/ProjectTable";
import ProjectDetail from "./components/ProjectDetail";
import NewProjectDialog from "./components/NewProjectDialog";
import WorkspaceSetup from "./components/WorkspaceSetup";
import Settings from "./components/Settings";
import TaskTable from "./components/TaskTable";
import { perfStart, perfEnd } from "./lib/perf";

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

type View = "projects" | "settings" | "tasks";

export default function App() {
  const [workspaceReady, setWorkspaceReady] = useState<boolean | null>(null);
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [view, setView] = useState<View>("projects");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [installing, setInstalling] = useState(false);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [deployFilter, setDeployFilter] = useState<DeployFilter>("all");
  const [hostFilter, setHostFilter] = useState<HostFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [syncIsError, setSyncIsError] = useState(false);

  // Task view state
  const [taskProject, setTaskProject] = useState<Project | null>(null);
  const [taskCounts, setTaskCounts] = useState<Map<string, TaskCount>>(new Map());

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

  const handleInstallUpdate = async () => {
    setInstalling(true);
    try {
      await invoke("install_update");
    } catch {
      setInstalling(false);
    }
  };

  // Load task counts
  const loadTaskCounts = useCallback(async () => {
    try {
      const counts = await invoke<TaskCount[]>("get_task_counts");
      setTaskCounts(new Map(counts.map((c) => [c.folder_key, c])));
    } catch {
      // silently fail
    }
  }, []);

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
      if (selected) {
        const updated = rows.find((p) => p.folder_key === selected.folder_key);
        setSelected(updated ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [selected?.folder_key]);

  // Only fetch from DB when workspace becomes ready (not on filter changes)
  useEffect(() => {
    if (workspaceReady) {
      load();
      loadTaskCounts();
    }
  }, [workspaceReady]);

  // Client-side filtering — instant, no IPC round-trip
  const projects = useMemo(() => {
    let filtered = allProjects;
    if (statusFilter !== "all") {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }
    if (categoryFilter !== "all") {
      filtered = filtered.filter((p) => p.category === categoryFilter);
    }
    if (deployFilter !== "all") {
      filtered = filtered.filter((p) => p.deploy_platform === deployFilter);
    }
    if (hostFilter !== "all") {
      filtered = filtered.filter((p) => p.host === hostFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.folder_key.toLowerCase().includes(q) ||
          p.folder_name.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [allProjects, statusFilter, categoryFilter, deployFilter, hostFilter, search]);

  // Derive filter options from in-memory data (no extra DB query needed)
  const filterOptions = useMemo(() => {
    const deploySet = new Set<string>();
    const hostSet = new Set<string>();
    for (const p of allProjects) {
      if (p.deploy_platform) deploySet.add(p.deploy_platform);
      if (p.host) hostSet.add(p.host);
    }
    return {
      deploy_platforms: [...deploySet].sort(),
      hosts: [...hostSet].sort(),
    };
  }, [allProjects]);

  // Fetch diff stats after projects load (non-blocking)
  useEffect(() => {
    // if (allProjects.length > 0 && allProjects.every((p) => p.lines_added == null)) {
    //   loadDiffStats();
    // }
  }, [allProjects.length]);

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
    setSheetOpen(true);
  };

  const handleStatusChange = async (folder_key: string, status: string) => {
    await invoke("update_project_status", { folderKey: folder_key, status });
    await load();
  };

  const handleDeleteSelected = async (folderKeys: string[]) => {
    await invoke("delete_projects", { folderKeys });
    if (selected && folderKeys.includes(selected.folder_key)) {
      setSelected(null);
      setSheetOpen(false);
    }
    await load();
    loadTaskCounts();
  };

  const handleOpenTasks = (project: Project) => {
    setTaskProject(project);
    setView("tasks");
    setSheetOpen(false);
  };

  const handleBackFromTasks = () => {
    setView("projects");
    setTaskProject(null);
    loadTaskCounts(); // Refresh counts when coming back
  };

  const handleWorkspaceChanged = async () => {
    const config = await invoke<WorkspaceConfig>("get_workspace_config");
    setWorkspaceReady(config.is_configured);
    setWorkspacePath(config.workspace_path);
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
    <div className="h-screen overflow-hidden">
      <SidebarProvider className="h-full overflow-hidden">
        <AppSidebar
          statusFilter={statusFilter}
          categoryFilter={categoryFilter}
          deployFilter={deployFilter}
          hostFilter={hostFilter}
          onStatusFilter={(s) => { setView("projects"); setStatusFilter(s); }}
          onCategoryFilter={(b) => { setView("projects"); setCategoryFilter(b); }}
          onDeployFilter={(d) => { setView("projects"); setDeployFilter(d); }}
          onHostFilter={(h) => { setView("projects"); setHostFilter(h); }}
          filterOptions={filterOptions}
          updateInfo={updateInfo}
          onInstallUpdate={handleInstallUpdate}
          installing={installing}
          onOpenSettings={() => setView("settings")}
          activeView={view}
          taskProject={taskProject}
        />

        <SidebarInset className="min-h-0 min-w-0 flex flex-1 flex-col overflow-hidden">
          {view === "settings" ? (
            <Settings
              workspacePath={workspacePath}
              onWorkspaceChanged={handleWorkspaceChanged}
              onBack={() => setView("projects")}
            />
          ) : view === "tasks" && taskProject ? (
            <div className="m-2 min-h-0 flex-1">
              <TaskTable
                project={taskProject}
                onBack={handleBackFromTasks}
              />
            </div>
          ) : (
            <div className="m-2 min-h-0 flex-1">
              <ProjectTable
                projects={projects}
                selected={selected}
                onSelect={handleSelect}
                search={search}
                onSearch={setSearch}
                onSync={handleSync}
                onNewProject={() => setNewProjectOpen(true)}
                syncing={syncing}
                loading={loading}
                syncMsg={syncMsg}
                syncIsError={syncIsError}
                onStatusChange={handleStatusChange}
                onDeleteSelected={handleDeleteSelected}
                taskCounts={taskCounts}
                onOpenTasks={handleOpenTasks}
              />
            </div>
          )}
        </SidebarInset>

        <ProjectDetail
          project={selected}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onStatusChange={handleStatusChange}
          onRename={async (folderKey, nextName) => {
            const nextKey = await invoke<string>("rename_project_folder", {
              folderKey,
              newName: nextName,
            });
            await load();
            const updated = await invoke<Project | null>("get_project", { folderKey: nextKey });
            setSelected(updated);
          }}
          onDelete={async (folderKey) => {
            await invoke("delete_project_folder", { folderKey });
            if (selected?.folder_key === folderKey) {
              setSelected(null);
              setSheetOpen(false);
            }
            await load();
          }}
        />

        <NewProjectDialog
          open={newProjectOpen}
          onOpenChange={setNewProjectOpen}
          onCreated={load}
        />
      </SidebarProvider>
    </div>
  );
}
