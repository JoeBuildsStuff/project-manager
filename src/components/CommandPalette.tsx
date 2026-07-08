import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Bot,
  Check,
  FileText,
  FolderOpen,
  Kanban,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Star,
  Terminal,
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { starIconPinnedClass } from "@/lib/star-ui";
import type { LlmAgent, NotesDocumentSummary, Project, Task } from "@/types";

type PaletteAction = {
  id: string;
  label: string;
  keywords?: string;
  icon: ComponentType<{ className?: string }>;
  onSelect: () => void;
};

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  pinnedProjects: Project[];
  recentProjects: Project[];
  notes: NotesDocumentSummary[];
  activeView: string;
  onOpenSettings: () => void;
  onJumpToProjects: () => void;
  onJumpToTasks: () => void;
  onJumpToNotes: () => void;
  onJumpToTerminal: () => void;
  onJumpToAgent: () => void;
  onNewProject: () => void;
  onSync: () => void;
  onOpenProject: (project: Project) => void;
  onOpenTask: (task: Task) => void;
  onOpenNote: (id: string) => void;
  onOpenAgent: (agent: LlmAgent | null) => void;
}

const itemIconClass = "size-4 shrink-0 text-muted-foreground";
const metaTextClass = "truncate text-[11px] text-muted-foreground";

function uniqueProjects(projects: Project[]) {
  const seen = new Set<string>();
  return projects.filter((project) => {
    if (seen.has(project.folder_key)) return false;
    seen.add(project.folder_key);
    return true;
  });
}

function projectValue(project: Project, prefix: string) {
  return [
    prefix,
    project.folder_name,
    project.folder_key,
    project.description,
    project.status,
    project.category,
    project.repo,
    project.production_url,
  ]
    .filter(Boolean)
    .join(" ");
}

export default function CommandPalette({
  open,
  onOpenChange,
  projects,
  pinnedProjects,
  recentProjects,
  notes,
  activeView,
  onOpenSettings,
  onJumpToProjects,
  onJumpToTasks,
  onJumpToNotes,
  onJumpToTerminal,
  onJumpToAgent,
  onNewProject,
  onSync,
  onOpenProject,
  onOpenTask,
  onOpenNote,
  onOpenAgent,
}: CommandPaletteProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<LlmAgent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || (!event.metaKey && !event.ctrlKey)) return;
      event.preventDefault();
      onOpenChange(!open);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    Promise.all([
      invoke<Task[]>("get_tasks", { folderKey: null }).catch(() => []),
      invoke<LlmAgent[]>("get_llm_agents").catch(() => []),
    ])
      .then(([nextTasks, nextAgents]) => {
        if (cancelled) return;
        setTasks(nextTasks);
        setAgents(nextAgents);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const run = useCallback(
    (action: () => void) => {
      onOpenChange(false);
      action();
    },
    [onOpenChange],
  );

  const actions = useMemo<PaletteAction[]>(
    () => [
      {
        id: "new-project",
        label: "New project",
        keywords: "create add folder",
        icon: Plus,
        onSelect: () => run(onNewProject),
      },
      {
        id: "sync-workspace",
        label: "Sync workspace",
        keywords: "refresh reload projects",
        icon: RefreshCw,
        onSelect: () => run(onSync),
      },
      {
        id: "projects",
        label: "Project table",
        keywords: "workspace folders repos",
        icon: Kanban,
        onSelect: () => run(onJumpToProjects),
      },
      {
        id: "tasks",
        label: "Task table",
        keywords: "issues requests next steps",
        icon: Check,
        onSelect: () => run(onJumpToTasks),
      },
      {
        id: "notes",
        label: "Notes",
        keywords: "documents writing",
        icon: FileText,
        onSelect: () => run(onJumpToNotes),
      },
      {
        id: "agents",
        label: "Agents",
        keywords: "llm codex claude cursor",
        icon: Bot,
        onSelect: () => run(onJumpToAgent),
      },
      {
        id: "terminal",
        label: "Terminal sessions",
        keywords: "shell pty command runs",
        icon: Terminal,
        onSelect: () => run(onJumpToTerminal),
      },
      {
        id: "settings",
        label: "Settings",
        keywords: "preferences workspace config",
        icon: Settings,
        onSelect: () => run(onOpenSettings),
      },
    ],
    [
      onJumpToAgent,
      onJumpToNotes,
      onJumpToProjects,
      onJumpToTasks,
      onJumpToTerminal,
      onNewProject,
      onOpenSettings,
      onSync,
      run,
    ],
  );

  const projectSections = useMemo(() => {
    const pinnedKeys = new Set(pinnedProjects.map((project) => project.folder_key));
    const recentKeys = new Set(recentProjects.map((project) => project.folder_key));
    return {
      pinned: uniqueProjects(pinnedProjects).slice(0, 8),
      recent: uniqueProjects(recentProjects.filter((project) => !pinnedKeys.has(project.folder_key))).slice(0, 8),
      all: projects
        .filter((project) => !pinnedKeys.has(project.folder_key) && !recentKeys.has(project.folder_key))
        .slice(0, 40),
    };
  }, [pinnedProjects, projects, recentProjects]);

  const visibleTasks = useMemo(() => tasks.slice(0, 25), [tasks]);
  const visibleAgents = useMemo(() => agents.slice(0, 12), [agents]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command Menu"
      description="Search actions, projects, tasks, notes, and agents."
      className="w-[min(760px,calc(100vw-2rem))] border-border/70 bg-popover/98 shadow-2xl"
    >
      <Command shouldFilter loop className="rounded-xl border-0 bg-transparent">
        <div className="border-b border-border/60 px-2 pb-2 pt-2">
          <div className="flex items-center gap-2 px-2 pb-1.5 text-[11px] text-muted-foreground">
            <Search className="size-3.5" />
            <span className="font-medium text-foreground">Command Menu</span>
            <span className="ml-auto">{activeView.replace("-", " ")}</span>
          </div>
          <CommandInput placeholder="Search projects, tasks, notes, agents, or actions..." />
        </div>

        <CommandList className="max-h-[min(68vh,620px)] scroll-py-2 p-1">
          <CommandEmpty className="py-10">
            <div className="text-sm font-medium text-foreground">No matches</div>
            <div className="mt-1 text-xs text-muted-foreground">Try a project name, task title, note, or action.</div>
          </CommandEmpty>

          <CommandGroup heading="Actions">
            {actions.map((action) => (
              <CommandItem
                key={action.id}
                value={`${action.label} ${action.keywords ?? ""}`}
                onSelect={action.onSelect}
                className="min-h-10 px-2.5"
              >
                <action.icon className={itemIconClass} />
                <span className="font-medium">{action.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          {projectSections.pinned.length > 0 && (
            <CommandGroup heading="Pinned Projects">
              {projectSections.pinned.map((project) => (
                <ProjectItem
                  key={`pinned-${project.folder_key}`}
                  project={project}
                  value={projectValue(project, "pinned star favorite")}
                  icon={<Star className={cn(itemIconClass, starIconPinnedClass)} fill="currentColor" strokeWidth={0} />}
                  onSelect={() => run(() => onOpenProject(project))}
                />
              ))}
            </CommandGroup>
          )}

          {projectSections.recent.length > 0 && (
            <CommandGroup heading="Recent Projects">
              {projectSections.recent.map((project) => (
                <ProjectItem
                  key={`recent-${project.folder_key}`}
                  project={project}
                  value={projectValue(project, "recent")}
                  icon={<FolderOpen className={itemIconClass} />}
                  onSelect={() => run(() => onOpenProject(project))}
                />
              ))}
            </CommandGroup>
          )}

          {projectSections.all.length > 0 && (
            <CommandGroup heading="Projects">
              {projectSections.all.map((project) => (
                <ProjectItem
                  key={project.folder_key}
                  project={project}
                  value={projectValue(project, "project folder repo")}
                  icon={<FolderOpen className={itemIconClass} />}
                  onSelect={() => run(() => onOpenProject(project))}
                />
              ))}
            </CommandGroup>
          )}

          <CommandSeparator />

          <CommandGroup
            heading={
              <span className="inline-flex items-center gap-1.5">
                Tasks
                {loading ? <Loader2 className="size-3 animate-spin" /> : null}
              </span>
            }
          >
            {visibleTasks.map((task) => (
              <CommandItem
                key={`task-${task.id}`}
                value={[
                  "task",
                  task.title,
                  task.description,
                  task.folder_name,
                  task.folder_key,
                  task.status,
                  task.priority,
                  task.kind,
                ]
                  .filter(Boolean)
                  .join(" ")}
                onSelect={() => run(() => onOpenTask(task))}
                className="min-h-12 px-2.5"
              >
                <Check className={itemIconClass} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{task.title}</div>
                  <div className={metaTextClass}>{task.folder_name ?? task.folder_key}</div>
                </div>
                <Badge variant="secondary" className="h-5 shrink-0 rounded-sm px-1.5 text-[10px] capitalize">
                  {task.status}
                </Badge>
              </CommandItem>
            ))}
          </CommandGroup>

          {notes.length > 0 && (
            <CommandGroup heading="Notes">
              {notes.slice(0, 20).map((note) => (
                <CommandItem
                  key={`note-${note.id}`}
                  value={["note document", note.title, note.icon_name, note.is_favorite ? "favorite" : ""]
                    .filter(Boolean)
                    .join(" ")}
                  onSelect={() => run(() => onOpenNote(note.id))}
                  className="min-h-10 px-2.5"
                >
                  <FileText className={itemIconClass} />
                  <span className="min-w-0 flex-1 truncate font-medium">{note.title}</span>
                  {note.is_favorite ? <Star className={cn("size-3.5 shrink-0", starIconPinnedClass)} fill="currentColor" strokeWidth={0} /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {visibleAgents.length > 0 && (
            <CommandGroup heading="Agents">
              {visibleAgents.map((agent) => (
                <CommandItem
                  key={`agent-${agent.id}`}
                  value={["agent llm", agent.name, agent.provider, agent.model, agent.reasoning, agent.permission_mode]
                    .filter(Boolean)
                    .join(" ")}
                  onSelect={() => run(() => onOpenAgent(agent))}
                  className="min-h-12 px-2.5"
                >
                  <Bot className={itemIconClass} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{agent.name}</div>
                    <div className={metaTextClass}>
                      {[agent.provider, agent.model].filter(Boolean).join(" · ") || "No provider configured"}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>

        <div className="flex items-center gap-3 border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
          <span>Enter opens</span>
          <span>Esc closes</span>
          <span className="ml-auto">⌘K</span>
        </div>
      </Command>
    </CommandDialog>
  );
}

function ProjectItem({
  project,
  value,
  icon,
  onSelect,
}: {
  project: Project;
  value: string;
  icon: ReactNode;
  onSelect: () => void;
}) {
  return (
    <CommandItem value={value} onSelect={onSelect} className="min-h-12 px-2.5">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{project.folder_name}</div>
        <div className={metaTextClass}>
          {[project.status, project.category, project.repo].filter(Boolean).join(" · ") || project.folder_key}
        </div>
      </div>
    </CommandItem>
  );
}
