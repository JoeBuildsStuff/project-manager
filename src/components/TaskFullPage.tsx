import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ArrowLeft, ChevronDown, Loader2, Play, RefreshCw, Trash } from "lucide-react";
import { toast } from "sonner";
import Terminal from "./Terminal";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AgentRun, Project, Task, TaskAssignmentOptions, TerminalEvent } from "@/types";
import { TaskKindBadge, TaskPriorityBadge, TaskStatusBadge } from "./task-badges";
import { TaskAssigneeBadge } from "./task-assignee";
import { buildAgentLaunchCommand, buildTaskAgentPrompt } from "@/lib/agent-launch";

const TASK_STATUS_OPTIONS = ["open", "in-progress", "done", "closed"] as const;
const TASK_KIND_OPTIONS = ["task", "issue", "request", "next-step"] as const;
const TASK_PRIORITY_OPTIONS = ["urgent", "high", "medium", "low"] as const;

interface Props {
  task: Task;
  project: Project | null;
  workspacePath: string | null;
  onBack: () => void;
  onTaskSaved: (task: Task) => Promise<void> | void;
  onTaskDeleted: (taskId: number) => Promise<void> | void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </div>
  );
}

function formatRunTime(value: number | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function replayText(events: TerminalEvent[]) {
  return events
    .filter((event) =>
      event.direction === "input" || event.direction === "output" || event.direction === "exit"
    )
    .map((event) => event.data ?? "")
    .join("");
}

/** Same interaction pattern as `EditableField` in `ProjectDetailContent`. */
function TaskPickField<T extends string>({
  label,
  value,
  options,
  renderBadge,
  onSelect,
}: {
  label: string;
  value: T;
  options: readonly T[];
  renderBadge: (v: T) => React.ReactNode;
  onSelect: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 text-xs">
      <dt className="w-20 shrink-0 text-muted-foreground/60">{label}</dt>
      <dd className="min-w-0">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger className="flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-muted">
            {renderBadge(value)}
            <ChevronDown className="h-3 w-3 text-muted-foreground/40" />
          </PopoverTrigger>
          <PopoverContent className="w-44 p-1" align="start">
            <div className="flex flex-col">
              {options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted ${
                    opt === value ? "bg-muted font-medium" : ""
                  }`}
                  onClick={() => {
                    onSelect(opt);
                    setOpen(false);
                  }}
                >
                  {renderBadge(opt)}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </dd>
    </div>
  );
}

export default function TaskFullPage({
  task,
  project,
  workspacePath,
  onBack,
  onTaskSaved,
  onTaskDeleted,
}: Props) {
  const taskCwd = workspacePath ? `${workspacePath}/${task.folder_key}` : undefined;

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [status, setStatus] = useState(task.status);
  const [kind, setKind] = useState(task.kind);
  const [priority, setPriority] = useState(task.priority ?? "medium");
  const [assigneeKind, setAssigneeKind] = useState<Task["assignee_kind"]>(task.assignee_kind);
  const [assigneeId, setAssigneeId] = useState<number | null>(task.assignee_id);
  const [assignmentOptions, setAssignmentOptions] = useState<TaskAssignmentOptions>({
    llm_agents: [],
  });
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [commandRequest, setCommandRequest] = useState<{
    nonce: number;
    command: string;
    agentRunId?: string | null;
  } | null>(null);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [terminalEvents, setTerminalEvents] = useState<TerminalEvent[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);

  const stateRef = useRef({
    title,
    description,
    status,
    kind,
    priority,
    assigneeKind,
    assigneeId,
  });
  stateRef.current = { title, description, status, kind, priority, assigneeKind, assigneeId };

  const textSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const TEXT_SAVE_DEBOUNCE_MS = 500;
  const assigneeValue =
    assigneeKind && assigneeId != null ? `${assigneeKind}:${assigneeId}` : "__unassigned__";
  const currentAssigneeName =
    assigneeKind === "llm_agent"
        ? assignmentOptions.llm_agents.find((agent) => agent.id === assigneeId)?.name ?? task.assignee_name
        : null;
  const assignedAgent =
    assigneeKind === "llm_agent"
      ? assignmentOptions.llm_agents.find((agent) => agent.id === assigneeId) ?? null
      : null;

  const persistTask = useCallback(
    async (overrides?: Partial<typeof stateRef.current>) => {
      const s = { ...stateRef.current, ...overrides };
      if (!s.title.trim()) return;

      setSaving(true);
      setError("");
      try {
        const updated = await invoke<Task>("update_task", {
          id: task.id,
          title: s.title.trim() || null,
          description: s.description.trim() || null,
          status: s.status,
          kind: s.kind,
          priority: s.priority,
          assigneeKind: s.assigneeKind,
          assigneeId: s.assigneeId,
        });
        await Promise.resolve(onTaskSaved(updated));
      } catch (err) {
        setError(String(err));
      } finally {
        setSaving(false);
      }
    },
    [task.id, onTaskSaved],
  );

  useEffect(() => {
    invoke<TaskAssignmentOptions>("get_task_assignment_options")
      .then(setAssignmentOptions)
      .catch(() => {
        setAssignmentOptions({ llm_agents: [] });
      });
  }, []);

  const loadAgentRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const runs = await invoke<AgentRun[]>("get_agent_runs_for_task", { taskId: task.id });
      setAgentRuns(runs);
      setSelectedRunId((current) => current ?? runs[0]?.id ?? null);
    } catch (err) {
      toast.error("Unable to load agent runs", { description: String(err) });
    } finally {
      setRunsLoading(false);
    }
  }, [task.id]);

  const refreshRunCodexLink = useCallback(async (runId: string) => {
    try {
      await invoke<AgentRun>("refresh_agent_run_codex_link", { runId });
      await loadAgentRuns();
    } catch {
      await loadAgentRuns();
    }
  }, [loadAgentRuns]);

  useEffect(() => {
    void loadAgentRuns();
  }, [loadAgentRuns]);

  useEffect(() => {
    if (!selectedRunId) {
      setTerminalEvents([]);
      return;
    }
    invoke<TerminalEvent[]>("get_terminal_events", { runId: selectedRunId })
      .then(setTerminalEvents)
      .catch(() => setTerminalEvents([]));
  }, [selectedRunId, agentRuns]);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? "");
    setStatus(task.status);
    setKind(task.kind);
    setPriority(task.priority ?? "medium");
    setAssigneeKind(task.assignee_kind);
    setAssigneeId(task.assignee_id);
    setError("");
    setSelectedRunId(null);
    setTerminalEvents([]);
  }, [task]);

  useEffect(() => {
    if (textSaveTimerRef.current) {
      clearTimeout(textSaveTimerRef.current);
      textSaveTimerRef.current = null;
    }

    const textDirty =
      title.trim() !== task.title || description !== (task.description ?? "");

    if (!textDirty || !title.trim()) {
      return;
    }

    textSaveTimerRef.current = setTimeout(() => {
      textSaveTimerRef.current = null;
      void persistTask();
    }, TEXT_SAVE_DEBOUNCE_MS);

    return () => {
      if (textSaveTimerRef.current) {
        clearTimeout(textSaveTimerRef.current);
        textSaveTimerRef.current = null;
      }
    };
  }, [
    title,
    description,
    task.title,
    task.description,
    task.id,
    persistTask,
  ]);

  const clearTextSaveDebounce = () => {
    if (textSaveTimerRef.current) {
      clearTimeout(textSaveTimerRef.current);
      textSaveTimerRef.current = null;
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      await invoke("delete_task", { id: task.id });
      await Promise.resolve(onTaskDeleted(task.id));
      onBack();
    } catch (err) {
      setError(String(err));
    } finally {
      setDeleting(false);
    }
  };

  const handleExecuteAgent = async () => {
    if (!taskCwd) {
      toast.error("Task terminal has no working directory");
      return;
    }

    if (!assignedAgent) {
      toast.error("Assign an agent before launching");
      return;
    }

    const prompt = buildTaskAgentPrompt(title, description);
    const launch = buildAgentLaunchCommand(assignedAgent, prompt, taskCwd);

    if (!launch.command) {
      toast.error("Unable to build agent launch command", {
        description: launch.reason,
      });
      return;
    }

    try {
      const terminalSessionId = `task-pty-${task.id}`;
      const run = await invoke<AgentRun>("create_agent_run", {
        taskId: task.id,
        agentId: assignedAgent.id,
        provider: assignedAgent.provider,
        prompt,
        command: launch.command,
        cwd: taskCwd,
        terminalSessionId,
      });

      setCurrentRunId(run.id);
      await loadAgentRuns();
      setSelectedRunId(run.id);

      setCommandRequest({
        nonce: Date.now(),
        command: launch.command,
        agentRunId: run.id,
      });

      window.setTimeout(() => {
        void refreshRunCodexLink(run.id);
      }, 2500);
    } catch (err) {
      toast.error("Unable to create agent run", { description: String(err) });
      return;
    }

    toast.success(`Launching ${assignedAgent.name} in the task terminal`);
  };

  const handleTerminalExit = useCallback(() => {
    const runId = currentRunId;
    if (!runId) {
      void loadAgentRuns();
      return;
    }
    window.setTimeout(() => {
      void refreshRunCodexLink(runId);
    }, 500);
  }, [currentRunId, loadAgentRuns, refreshRunCodexLink]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 p-1">
        <SidebarTrigger className="-ml-1 shrink-0" />
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
        <div className="h-4 w-px shrink-0 bg-border" />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h1 className="truncate text-base font-semibold">{title.trim() || "Untitled task"}</h1>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            #{task.id} · {task.folder_key}
            {project?.folder_name ? ` · ${project.folder_name}` : ""}
          </span>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <TaskAssigneeBadge kind={assigneeKind} name={currentAssigneeName} />
          <TaskStatusBadge status={status} appearance="inline" />
          <TaskKindBadge kind={kind} appearance="inline" />
          <TaskPriorityBadge priority={priority} appearance="inline" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 pb-2 lg:flex-row lg:gap-3">
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col lg:w-[min(420px,42vw)] lg:flex-none">
          <ScrollArea className="h-full min-h-0 rounded-lg border">
            <div className="space-y-5 p-2">
              <div className="flex items-center justify-between gap-2">
                <SectionLabel>Task</SectionLabel>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExecuteAgent}
                    disabled={!taskCwd || !assignedAgent}
                  >
                    <Play className="h-3.5 w-3.5" />
                    Execute
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className=""
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Title</label>
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                  <Textarea
                    rows={8}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="mt-1 resize-none text-xs"
                    placeholder="Describe the work for this task."
                  />
                </div>
                <div>
                  <SectionLabel>Details</SectionLabel>
                  <dl className="space-y-1.5">
                    <TaskPickField
                      label="Status"
                      value={status}
                      options={Array.from(TASK_STATUS_OPTIONS)}
                      renderBadge={(v) => <TaskStatusBadge status={v} appearance="inline" />}
                      onSelect={(v) => {
                        clearTextSaveDebounce();
                        setStatus(v);
                        void persistTask({ status: v });
                      }}
                    />
                    <TaskPickField
                      label="Kind"
                      value={kind}
                      options={Array.from(TASK_KIND_OPTIONS)}
                      renderBadge={(v) => <TaskKindBadge kind={v} appearance="inline" />}
                      onSelect={(v) => {
                        clearTextSaveDebounce();
                        setKind(v);
                        void persistTask({ kind: v });
                      }}
                    />
                    <TaskPickField
                      label="Priority"
                      value={priority}
                      options={Array.from(TASK_PRIORITY_OPTIONS)}
                      renderBadge={(v) => <TaskPriorityBadge priority={v} appearance="inline" />}
                      onSelect={(v) => {
                        clearTextSaveDebounce();
                        setPriority(v);
                        void persistTask({ priority: v });
                      }}
                    />
                  </dl>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Assign</label>
                  <Select
                    value={assigneeValue}
                    onValueChange={(value) => {
                      if (!value) return;
                      clearTextSaveDebounce();
                      if (value === "__unassigned__") {
                        setAssigneeKind(null);
                        setAssigneeId(null);
                        void persistTask({ assigneeKind: null, assigneeId: null });
                        return;
                      }

                      const [kindValue, idValue] = value.split(":");
                      const parsedId = Number(idValue);
                      const nextKind: "llm_agent" | null = kindValue === "llm_agent" ? "llm_agent" : null;
                      if (!nextKind || Number.isNaN(parsedId)) return;
                      setAssigneeKind(nextKind);
                      setAssigneeId(parsedId);
                      void persistTask({ assigneeKind: nextKind, assigneeId: parsedId });
                    }}
                  >
                    <SelectTrigger className="mt-1 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unassigned__">Unassigned</SelectItem>
                      {assignmentOptions.llm_agents.map((agent) => (
                        <SelectItem key={`llm_agent:${agent.id}`} value={`llm_agent:${agent.id}`}>
                          AI · {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <SectionLabel>Runs</SectionLabel>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => void loadAgentRuns()}
                    disabled={runsLoading}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${runsLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>

                {agentRuns.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No agent runs yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {agentRuns.map((run) => (
                      <button
                        key={run.id}
                        type="button"
                        className={`w-full rounded-md border p-2 text-left text-xs transition-colors hover:bg-muted ${
                          selectedRunId === run.id ? "border-primary bg-muted" : ""
                        }`}
                        onClick={() => setSelectedRunId(run.id)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">
                            {run.external_title || run.provider}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {run.status}
                            {run.exit_code != null ? ` · ${run.exit_code}` : ""}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                          <span>{formatRunTime(run.started_at)}</span>
                          <span className="truncate">
                            {run.external_model || run.external_model_provider || run.provider}
                            {run.external_tokens_used != null ? ` · ${run.external_tokens_used} tok` : ""}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedRunId && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Terminal replay</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          const runId = selectedRunId;
                          void refreshRunCodexLink(runId);
                        }}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Link
                      </Button>
                    </div>
                    <pre className="max-h-56 overflow-auto rounded-md bg-black p-2 font-mono text-[11px] leading-5 text-zinc-100">
                      {replayText(terminalEvents) || "No terminal events captured yet."}
                    </pre>
                    {agentRuns.find((run) => run.id === selectedRunId)?.external_rollout_path && (
                      <p className="break-all font-mono text-[10px] text-muted-foreground">
                        {agentRuns.find((run) => run.id === selectedRunId)?.external_rollout_path}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {saving && (
                <>
                  <Separator />
                  <p className="flex items-center gap-1.5 pt-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving…
                  </p>
                </>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="flex min-h-[280px] flex-1 flex-col lg:min-h-0">
          <Terminal
            workingDirectory={taskCwd}
            hideHeader
            sessionId={`task-pty-${task.id}`}
            commandRequest={commandRequest}
            onProcessExit={handleTerminalExit}
          />
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete task</DialogTitle>
            <DialogDescription className="text-xs">
              Delete &quot;{task.title}&quot;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
