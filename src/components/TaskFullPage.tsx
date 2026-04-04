import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  ArrowLeft,
  Bot,
  Clock,
  Loader2,
  Play,
  Square,
  Trash2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ANTHROPIC_MODEL_OPTIONS,
  DEFAULT_ANTHROPIC_MODEL,
} from "@/lib/model-options";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type {
  ClaudeEventRow,
  ClaudeResultRow,
  ClaudeRunCompletedPayload,
  ClaudeRunErrorPayload,
  ClaudeRunEventPayload,
  ClaudeRunStartedPayload,
  ClaudeSessionRow,
  ClaudeTaskRunSnapshot,
  ClaudeTaskRunStatus,
  Project,
  Task,
} from "@/types";
import { TaskKindBadge, TaskPriorityBadge, TaskStatusBadge } from "./task-badges";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLAUDE_MODEL_OPTIONS = ANTHROPIC_MODEL_OPTIONS;

const DEFAULT_MODEL = DEFAULT_ANTHROPIC_MODEL;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Props {
  task: Task;
  project: Project | null;
  onBack: () => void;
  onTaskSaved: (task: Task) => Promise<void> | void;
  onTaskDeleted: (taskId: number) => Promise<void> | void;
  onRefreshData: () => Promise<void> | void;
}

function formatRunTime(value: number | null | undefined) {
  if (!value) return "\u2014";
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms: number | null | undefined) {
  if (!ms) return "\u2014";
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `${mins}m ${remSecs}s`;
}

function formatTokens(n: number | null | undefined) {
  if (n == null) return "\u2014";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function getModelPricing(model: string | null | undefined): { input: number; output: number } | null {
  if (!model) return null;
  if (model.startsWith("claude-haiku-4-5")) return { input: 1, output: 5 };
  if (model.startsWith("claude-sonnet-4-6")) return { input: 3, output: 15 };
  if (model.startsWith("claude-opus-4-6")) return { input: 5, output: 25 };
  return null;
}

function estimateCostUsd(
  model: string | null | undefined,
  inputTokens: number | null | undefined,
  outputTokens: number | null | undefined,
) {
  const pricing = getModelPricing(model);
  if (!pricing) return null;
  const input = inputTokens ?? 0;
  const output = outputTokens ?? 0;
  return (input / 1_000_000) * pricing.input + (output / 1_000_000) * pricing.output;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </div>
  );
}

function StatusBadgeColor(status: string) {
  switch (status) {
    case "completed":
      return "bg-green-500/10 text-green-600 border-green-500/20";
    case "failed":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "cancelled":
      return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
    case "running":
    case "starting":
      return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TaskFullPage({
  task,
  project,
  onBack,
  onTaskSaved,
  onTaskDeleted,
  onRefreshData,
}: Props) {
  // -- Task editing state --
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [status, setStatus] = useState(task.status);
  const [kind, setKind] = useState(task.kind);
  const [priority, setPriority] = useState(task.priority ?? "medium");
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  // -- Model selection --
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const selectedModelLabel =
    CLAUDE_MODEL_OPTIONS.find((o) => o.value === selectedModel)?.label ?? "Model";

  // -- Live run state --
  const runIdRef = useRef<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<ClaudeTaskRunStatus>("idle");
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [runFinishedAt, setRunFinishedAt] = useState<number | null>(null);
  const [runPid, setRunPid] = useState<number | null>(null);
  const [runExitCode, setRunExitCode] = useState<number | null>(null);
  const [runCwd, setRunCwd] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [runSummary, setRunSummary] = useState<string | null>(null);
  const [runEvents, setRunEvents] = useState<ClaudeRunEventPayload[]>([]);
  const [runResult, setRunResult] = useState<ClaudeResultRow | null>(null);

  // -- Run history --
  const [runHistory, setRunHistory] = useState<ClaudeSessionRow[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [historyEvents, setHistoryEvents] = useState<ClaudeEventRow[]>([]);
  const [historyResult, setHistoryResult] = useState<ClaudeResultRow | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Keep ref in sync for use inside event listeners
  useEffect(() => {
    runIdRef.current = runId;
  }, [runId]);

  // Sync task prop changes
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? "");
    setStatus(task.status);
    setKind(task.kind);
    setPriority(task.priority ?? "medium");
    setError("");
  }, [task]);

  // -- Load run history --
  const loadRunHistory = useCallback(async () => {
    try {
      const sessions = await invoke<ClaudeSessionRow[]>("get_claude_sessions_for_task", {
        taskId: task.id,
      });
      setRunHistory(sessions);
    } catch {
      // ignore
    }
  }, [task.id]);

  useEffect(() => {
    void loadRunHistory();
  }, [loadRunHistory]);

  // -- Event listeners (use ref to avoid stale closure) --
  useEffect(() => {
    let cancelled = false;

    const attachListeners = async () => {
      const unlistenStarted = await listen<ClaudeRunStartedPayload>("claude-run:started", (event) => {
        const payload = event.payload;
        if (payload.task_id !== task.id) return;
        const currentRunId = runIdRef.current;
        if (currentRunId && payload.run_id !== currentRunId) return;
        runIdRef.current = payload.run_id;
        setRunId(payload.run_id);
        setRunStatus("running");
        setRunStartedAt(payload.started_at);
        setRunFinishedAt(null);
        setRunPid(payload.pid);
        setRunCwd(payload.cwd);
        setRunError(null);
        setRunResult(null);
      });

      const unlistenEvent = await listen<ClaudeRunEventPayload>("claude-run:event", (event) => {
        const payload = event.payload;
        const currentRunId = runIdRef.current;
        if (!currentRunId || payload.run_id !== currentRunId) return;
        setRunEvents((prev) => {
          // Cap at 2000 events to prevent memory issues
          if (prev.length >= 2000) {
            return [...prev.slice(-1500), payload];
          }
          return [...prev, payload];
        });
      });

      const unlistenCompleted = await listen<ClaudeRunCompletedPayload>("claude-run:completed", async (event) => {
        const payload = event.payload;
        if (payload.task_id !== task.id) return;
        const currentRunId = runIdRef.current;
        if (currentRunId && payload.run_id !== currentRunId) return;
        runIdRef.current = payload.run_id;
        setRunId(payload.run_id);
        setRunStatus(payload.status);
        setRunFinishedAt(payload.finished_at);
        setRunExitCode(payload.exit_code);
        setRunPid(null);
        setRunSummary(payload.final_text);

        // Fetch the persisted result for token/cost display
        try {
          const result = await invoke<ClaudeResultRow | null>("get_claude_session_result", {
            runId: payload.run_id,
          });
          setRunResult(result);
        } catch {
          // ignore
        }

        await loadRunHistory();
        await Promise.resolve(onRefreshData());
      });

      const unlistenError = await listen<ClaudeRunErrorPayload>("claude-run:error", (event) => {
        const payload = event.payload;
        if (payload.task_id !== task.id) return;
        const currentRunId = runIdRef.current;
        if (payload.run_id && currentRunId && payload.run_id !== currentRunId) return;
        setRunStatus("failed");
        setRunError(payload.message);
      });

      if (cancelled) {
        unlistenStarted();
        unlistenEvent();
        unlistenCompleted();
        unlistenError();
        return;
      }

      return () => {
        unlistenStarted();
        unlistenEvent();
        unlistenCompleted();
        unlistenError();
      };
    };

    let cleanup: (() => void) | undefined;
    void attachListeners().then((result) => {
      cleanup = result;
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [task.id, loadRunHistory, onRefreshData]);

  // -- Computed values --
  const assistantTranscript = useMemo(
    () =>
      runEvents
        .filter((event) => event.kind === "assistant-text" && event.text)
        .map((event) => event.text)
        .join(""),
    [runEvents],
  );

  const activityEvents = useMemo(
    () =>
      runEvents.filter(
        (event) => event.kind !== "assistant-text" && (event.text || event.kind === "stderr"),
      ),
    [runEvents],
  );

  const isRunActive = runStatus === "starting" || runStatus === "running";
  const hasTaskChanges =
    title.trim() !== task.title ||
    description !== (task.description ?? "") ||
    status !== task.status ||
    kind !== task.kind ||
    priority !== (task.priority ?? "medium");

  // -- Handlers --
  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const updated = await invoke<Task>("update_task", {
        id: task.id,
        title: title.trim() || null,
        description: description.trim() || null,
        status,
        kind,
        priority,
      });
      await Promise.resolve(onTaskSaved(updated));
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
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

  const handleStartRun = async () => {
    setSelectedHistoryId(null);
    setRunStatus("starting");
    setRunError(null);
    setRunSummary(null);
    setRunFinishedAt(null);
    setRunExitCode(null);
    setRunEvents([]);
    setRunResult(null);
    try {
      const started = await invoke<ClaudeRunStartedPayload>("start_claude_task_run", {
        taskId: task.id,
        model: selectedModel,
      });
      runIdRef.current = started.run_id;
      setRunId(started.run_id);
      setRunStatus("running");
      setRunStartedAt(started.started_at);
      setRunPid(started.pid);
      setRunCwd(started.cwd);
    } catch (err) {
      setRunStatus("failed");
      setRunError(String(err));
    }
  };

  const handleCancelRun = async () => {
    if (!runId) return;
    try {
      await invoke("cancel_claude_task_run", { runId });
    } catch (err) {
      setRunError(String(err));
    }
  };

  const handleRefreshRunState = async () => {
    if (!runId) return;
    try {
      const snapshot = await invoke<ClaudeTaskRunSnapshot>("get_claude_task_run_state", { runId });
      setRunStatus(snapshot.status);
      setRunStartedAt(snapshot.started_at);
      setRunFinishedAt(snapshot.finished_at);
      setRunExitCode(snapshot.exit_code);
      setRunPid(snapshot.pid);
      setRunCwd(snapshot.cwd);
    } catch (err) {
      setRunError(String(err));
    }
  };

  const handleSelectHistory = async (histRunId: string) => {
    if (selectedHistoryId === histRunId) {
      setSelectedHistoryId(null);
      setHistoryEvents([]);
      setHistoryResult(null);
      return;
    }
    setSelectedHistoryId(histRunId);
    setLoadingHistory(true);
    try {
      const [events, result] = await Promise.all([
        invoke<ClaudeEventRow[]>("get_claude_session_events", { runId: histRunId }),
        invoke<ClaudeResultRow | null>("get_claude_session_result", { runId: histRunId }),
      ]);
      setHistoryEvents(events);
      setHistoryResult(result);
    } catch {
      setHistoryEvents([]);
      setHistoryResult(null);
    } finally {
      setLoadingHistory(false);
    }
  };

  const historyTranscript = useMemo(
    () =>
      historyEvents
        .filter((e) => e.kind === "assistant-text" && e.text)
        .map((e) => e.text)
        .join(""),
    [historyEvents],
  );

  const selectedHistorySession = useMemo(
    () => runHistory.find((session) => session.run_id === selectedHistoryId) ?? null,
    [runHistory, selectedHistoryId],
  );

  const selectedHistoryActivityEvents = useMemo(
    () => historyEvents.filter((event) => event.kind !== "assistant-text" && (event.text || event.kind === "stderr")),
    [historyEvents],
  );

  const viewingHistory = selectedHistorySession != null;
  const visibleTranscript = viewingHistory
    ? historyTranscript || selectedHistorySession?.final_text || ""
    : assistantTranscript;
  const visibleResult = viewingHistory ? historyResult : runResult;
  const visibleActivityEvents = viewingHistory ? selectedHistoryActivityEvents : activityEvents;
  const visibleStartedAt = viewingHistory ? selectedHistorySession?.started_at ?? null : runStartedAt;
  const visibleFinishedAt = viewingHistory ? selectedHistorySession?.finished_at ?? null : runFinishedAt;
  const visibleExitCode = viewingHistory ? selectedHistorySession?.exit_code ?? null : runExitCode;
  const visibleModel =
    viewingHistory
      ? historyResult?.model ?? selectedHistorySession?.model ?? null
      : runResult?.model ?? selectedModel;
  const visibleCostUsd =
    visibleResult?.cost_usd ??
    estimateCostUsd(visibleModel, visibleResult?.input_tokens, visibleResult?.output_tokens);
  const visibleFinalSummary = viewingHistory ? selectedHistorySession?.final_text ?? null : runSummary;

  // -- Render --
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-6 py-3 shrink-0">
        <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
        <div className="h-4 w-px bg-border" />
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold">{task.title}</h1>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>#{task.id}</span>
            <span>{task.folder_key}</span>
            {project && <span>{project.folder_name}</span>}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <TaskStatusBadge status={status} />
          <TaskKindBadge kind={kind} />
          <TaskPriorityBadge priority={priority} />
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1">
        <div className="grid h-full min-h-0 gap-4 p-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          {/* Left panel: Task editing */}
          <ScrollArea className="min-h-0 rounded-lg border">
            <div className="space-y-5 p-5">
              <div className="flex items-center justify-between">
                <SectionLabel>Task</SectionLabel>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
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
                    rows={6}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="mt-1 resize-none text-xs"
                    placeholder="Describe the implementation task for Claude or a human."
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Status</label>
                    <Select value={status} onValueChange={(value) => value && setStatus(value)}>
                      <SelectTrigger className="mt-1 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Kind</label>
                    <Select value={kind} onValueChange={(value) => value && setKind(value)}>
                      <SelectTrigger className="mt-1 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="task">Task</SelectItem>
                        <SelectItem value="issue">Issue</SelectItem>
                        <SelectItem value="request">Request</SelectItem>
                        <SelectItem value="next-step">Next Step</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Priority</label>
                    <Select value={priority} onValueChange={(value) => value && setPriority(value)}>
                      <SelectTrigger className="mt-1 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <SectionLabel>Project Context</SectionLabel>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">Project:</span>{" "}
                    {project?.folder_name ?? task.folder_name ?? task.folder_key}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Folder key:</span> {task.folder_key}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Repo:</span>{" "}
                    {project?.repo ?? "Unknown"}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={handleSave}
                  disabled={saving || !title.trim() || !hasTaskChanges}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={onBack}>
                  Close
                </Button>
              </div>

              {/* Run History */}
              {runHistory.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <SectionLabel>Run History</SectionLabel>
                    <div className="space-y-2">
                      {runHistory.map((session) => (
                        <button
                          key={session.run_id}
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50",
                            selectedHistoryId === session.run_id && "border-foreground/30 bg-muted/50",
                          )}
                          onClick={() => handleSelectHistory(session.run_id)}
                        >
                          <Badge
                            variant="outline"
                            className={cn("capitalize text-[10px] px-1.5 py-0", StatusBadgeColor(session.status))}
                          >
                            {session.status}
                          </Badge>
                          <span className="truncate text-muted-foreground">{session.model ?? "default"}</span>
                          <span className="ml-auto text-muted-foreground">
                            {new Date(session.started_at).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            {formatRunTime(session.started_at)}
                          </span>
                          {session.finished_at && session.started_at && (
                            <span className="text-muted-foreground/60">
                              {formatDuration(session.finished_at - session.started_at)}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>

          {/* Right panel: Claude run */}
          <div className="min-h-0 flex flex-col gap-4">
            {/* Run control card */}
            <Card className="shrink-0">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Bot className="h-4 w-4" />
                      Claude Run
                    </CardTitle>
                    <CardDescription>
                      Run Claude Code directly in <span className="font-mono text-[11px]">{task.folder_key}</span>.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className={cn("capitalize", StatusBadgeColor(runStatus))}>
                    {runStatus}
                  </Badge>
                </div>
                {viewingHistory && selectedHistorySession && (
                  <div className="flex items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
                    <span>
                      Viewing {selectedHistorySession.status} run from {formatRunTime(selectedHistorySession.started_at)}
                    </span>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setSelectedHistoryId(null)}>
                      Current run
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Model selector */}
                  <Select
                    value={selectedModel}
                    onValueChange={(v) => { if (v) setSelectedModel(v); }}
                    disabled={isRunActive}
                  >
                    <SelectTrigger className="w-fit h-8 border text-xs text-muted-foreground">
                      <SelectValue placeholder="Model">{selectedModelLabel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {CLAUDE_MODEL_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="text-xs">
                          {option.menuLabel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button size="sm" className="gap-1.5" onClick={handleStartRun} disabled={isRunActive}>
                    {runStatus === "starting" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    Implement
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCancelRun} disabled={!isRunActive}>
                    <Square className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleRefreshRunState} disabled={!runId}>
                    Refresh
                  </Button>
                </div>

                {/* Run metadata */}
                <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <p><span className="font-medium text-foreground">Started:</span> {formatRunTime(visibleStartedAt)}</p>
                  <p><span className="font-medium text-foreground">Finished:</span> {formatRunTime(visibleFinishedAt)}</p>
                  <p><span className="font-medium text-foreground">PID:</span> {viewingHistory ? "\u2014" : (runPid ?? "\u2014")}</p>
                  <p><span className="font-medium text-foreground">Exit code:</span> {visibleExitCode ?? "\u2014"}</p>
                </div>

                {/* Token / cost display after completion */}
                {visibleResult && (
                  <div className="flex flex-wrap gap-3 rounded-md border bg-muted/30 px-3 py-2 text-xs">
                    {visibleResult.input_tokens != null && (
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">In:</span>
                        <span className="font-medium">{formatTokens(visibleResult.input_tokens)}</span>
                      </div>
                    )}
                    {visibleResult.output_tokens != null && (
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Out:</span>
                        <span className="font-medium">{formatTokens(visibleResult.output_tokens)}</span>
                      </div>
                    )}
                    {visibleCostUsd != null && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Cost:</span>
                        <span className="font-medium">${visibleCostUsd.toFixed(4)}</span>
                      </div>
                    )}
                    {visibleResult.duration_ms != null && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{formatDuration(visibleResult.duration_ms)}</span>
                      </div>
                    )}
                    {visibleResult.num_turns != null && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Turns:</span>
                        <span className="font-medium">{visibleResult.num_turns}</span>
                      </div>
                    )}
                    {visibleModel && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Model:</span>
                        <span className="font-medium font-mono">{visibleModel}</span>
                      </div>
                    )}
                  </div>
                )}

                {!viewingHistory && runCwd && (
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                    <div className="mb-1 font-medium text-foreground">Working directory</div>
                    <div className="font-mono break-all">{runCwd}</div>
                  </div>
                )}

                {!viewingHistory && runError && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    {runError}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Live output card */}
            <Card className="min-h-0 flex-1 overflow-y-auto">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{viewingHistory ? "Selected Run Output" : "Live Output"}</CardTitle>
                <CardDescription>
                  {viewingHistory
                    ? "Selected history entries open here on the right."
                    : "Assistant text is grouped above the event timeline. Raw NDJSON stays hidden."}
                </CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 flex h-full flex-col gap-4">
                <div className="rounded-md border bg-black px-4 py-3 text-sm text-green-300 max-h-[50vh] overflow-y-auto">
                  {loadingHistory && viewingHistory ? (
                    <p className="font-mono text-xs text-zinc-500">Loading selected run...</p>
                  ) : visibleTranscript ? (
                    <pre className="whitespace-pre-wrap font-mono leading-relaxed">{visibleTranscript}</pre>
                  ) : (
                    <p className="font-mono text-xs text-zinc-500">
                      {viewingHistory ? "No output recorded for this run." : "No streamed assistant text yet."}
                    </p>
                  )}
                </div>

                {visibleFinalSummary && !visibleTranscript && (
                  <div className="rounded-md border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
                    <div className="mb-1 font-medium text-foreground">Final summary</div>
                    <pre className="whitespace-pre-wrap font-mono">{visibleFinalSummary}</pre>
                  </div>
                )}

                <div className="min-h-0 flex-1 rounded-md border">
                  <div className="space-y-2 p-3">
                    {loadingHistory && viewingHistory ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading events...
                      </div>
                    ) : visibleActivityEvents.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {viewingHistory ? "No activity events recorded." : "No activity events yet."}
                      </p>
                    ) : (
                      visibleActivityEvents.map((event) => (
                        <div
                          key={`${event.run_id}-${event.seq}-${event.kind}`}
                          className={cn(
                            "rounded-md border px-3 py-2 text-xs",
                            event.kind === "stderr"
                              ? "border-destructive/30 bg-destructive/5 text-destructive"
                              : "bg-muted/30 text-muted-foreground",
                          )}
                        >
                          <div className="mb-1 flex items-center gap-2">
                            <Badge variant="outline" className="capitalize">
                              {event.kind.replace("-", " ")}
                            </Badge>
                            <span className="text-[11px]">{formatRunTime(event.ts)}</span>
                          </div>
                          <div className="whitespace-pre-wrap font-mono leading-relaxed">
                            {event.text ?? event.raw_subtype ?? event.raw_type ?? "Event"}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
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
