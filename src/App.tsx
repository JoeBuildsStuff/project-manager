import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { Project, StatusFilter, CategoryFilter, DeployFilter, HostFilter } from "./types";
import AppSidebar from "./components/Sidebar";
import ProjectTable from "./components/ProjectTable";
import ProjectDetail from "./components/ProjectDetail";
import NewProjectDialog from "./components/NewProjectDialog";
import WorkspaceSetup from "./components/WorkspaceSetup";
import Settings from "./components/Settings";
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

type View = "projects" | "settings";

export default function App() {
  const [workspaceReady, setWorkspaceReady] = useState<boolean | null>(null);
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [view, setView] = useState<View>("projects");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [installing, setInstalling] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [deployFilter, setDeployFilter] = useState<DeployFilter>("all");
  const [hostFilter, setHostFilter] = useState<HostFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [filterOptions, setFilterOptions] = useState<{ deploy_platforms: string[]; hosts: string[] }>({ deploy_platforms: [], hosts: [] });

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

  // Lazy-load diff stats after projects render
  const loadDiffStats = useCallback(async () => {
    const t = perfStart("get_diff_stats");
    try {
      const stats = await invoke<DiffStat[]>("get_diff_stats");
      perfEnd(`get_diff_stats (${stats.length} entries)`, t);
      const map = new Map(stats.map((s) => [s.folder_key, s]));
      setProjects((prev) =>
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

  const load = useCallback(async () => {
    setLoading(true);
    const t = perfStart("get_projects");
    try {
      const rows = await invoke<Project[]>("get_projects", {
        statusFilter: statusFilter === "all" ? null : statusFilter,
        categoryFilter: categoryFilter === "all" ? null : categoryFilter,
        deployFilter: deployFilter === "all" ? null : deployFilter,
        hostFilter: hostFilter === "all" ? null : hostFilter,
        search: search || null,
      });
      perfEnd(`get_projects (${rows.length} rows)`, t);
      setProjects(rows);
      if (selected) {
        const updated = rows.find((p) => p.folder_key === selected.folder_key);
        setSelected(updated ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, deployFilter, hostFilter, search, selected?.folder_key]);

  useEffect(() => {
    if (workspaceReady) load();
  }, [workspaceReady, statusFilter, categoryFilter, deployFilter, hostFilter, search]);

  // Fetch diff stats after projects load (non-blocking)
  useEffect(() => {
    if (projects.length > 0 && projects.every((p) => p.lines_added == null)) {
      loadDiffStats();
    }
  }, [projects.length]);

  useEffect(() => {
    if (workspaceReady) {
      const t = perfStart("get_filter_options");
      invoke<{ deploy_platforms: string[]; hosts: string[] }>("get_filter_options").then((opts) => {
        perfEnd("get_filter_options", t);
        setFilterOptions(opts);
      });
    }
  }, [workspaceReady, projects]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await invoke<string>("run_sync_scripts");
    } catch {
    } finally {
      setSyncing(false);
      await load();
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
          counts={projects}
          filterOptions={filterOptions}
          updateInfo={updateInfo}
          onInstallUpdate={handleInstallUpdate}
          installing={installing}
          onOpenSettings={() => setView("settings")}
          activeView={view}
        />

        <SidebarInset className="min-h-0 min-w-0 flex flex-1 flex-col overflow-hidden">
          {view === "settings" ? (
            <Settings
              workspacePath={workspacePath}
              onWorkspaceChanged={handleWorkspaceChanged}
              onBack={() => setView("projects")}
            />
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
                onStatusChange={handleStatusChange}
                onDeleteSelected={handleDeleteSelected}
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
