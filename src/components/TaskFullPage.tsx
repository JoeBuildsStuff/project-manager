import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ArrowLeft, ChevronDown, Loader2, Trash } from "lucide-react";
import Terminal from "./Terminal";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
import type { Project, Task } from "@/types";
import { TaskKindBadge, TaskPriorityBadge, TaskStatusBadge } from "./task-badges";

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
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const stateRef = useRef({
    title,
    description,
    status,
    kind,
    priority,
  });
  stateRef.current = { title, description, status, kind, priority };

  const textSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const TEXT_SAVE_DEBOUNCE_MS = 500;

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
    setTitle(task.title);
    setDescription(task.description ?? "");
    setStatus(task.status);
    setKind(task.kind);
    setPriority(task.priority ?? "medium");
    setError("");
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
          <TaskStatusBadge status={status} appearance="inline" />
          <TaskKindBadge kind={kind} appearance="inline" />
          <TaskPriorityBadge priority={priority} appearance="inline" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 pb-2 lg:flex-row lg:gap-3">
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col lg:w-[min(420px,42vw)] lg:flex-none">
          <ScrollArea className="h-full min-h-0 rounded-lg border">
            <div className="space-y-5 p-2">
              <div className="flex items-center justify-between">
                <SectionLabel>Task</SectionLabel>
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
