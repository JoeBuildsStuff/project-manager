import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Trash2, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Task } from "../types";
import {
  TaskStatusBadge,
  TaskKindBadge,
  TaskPriorityBadge,
  taskFieldSelectTriggerClass,
} from "./task-badges";

interface Props {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After a successful save (task row is updated from the server). */
  onTaskSaved: (task: Task) => void;
  /** After delete completes; parent should close sheet and refresh the table. */
  onTaskDeleted: () => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <dt className="w-20 shrink-0 text-muted-foreground/60">{label}</dt>
      <dd className="min-w-0 break-all text-muted-foreground">{value}</dd>
    </div>
  );
}

export default function TaskDetail({
  task,
  open,
  onOpenChange,
  onTaskSaved,
  onTaskDeleted,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [priority, setPriority] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!task || !open) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setStatus(task.status);
    setKind(task.kind);
    setPriority(task.priority ?? "medium");
    setError("");
    setDeleteOpen(false);
  }, [task?.id, open]);

  if (!task) return null;

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const updated = await invoke<Task>("update_task", {
        id: task.id,
        title: title.trim() || null,
        description: description.trim() || null,
        status: status || null,
        kind: kind || null,
        priority: priority || null,
      });
      onTaskSaved(updated);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      await invoke("delete_task", { id: task.id });
      setDeleteOpen(false);
      onOpenChange(false);
      onTaskDeleted();
    } catch (e) {
      setError(String(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-[360px] flex-col p-0 sm:max-w-[360px]">
        <SheetHeader className="px-5 pb-2 pt-5">
          <SheetTitle className="line-clamp-2 text-base">
            {title.trim() || task.title}
          </SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
            <span>#{task.id}</span>
            <span className="text-muted-foreground">·</span>
            <span className="truncate">{task.folder_key}</span>
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-5 px-5 pb-4">
            <div>
              <SectionLabel>Quick actions</SectionLabel>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  setError("");
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete task
              </Button>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <Separator />

            <div>
              <SectionLabel>Details</SectionLabel>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Title</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional…"
                    rows={3}
                    className="mt-1 resize-none text-xs"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="min-w-0">
                    <label className="text-xs font-medium text-muted-foreground">Status</label>
                    <Select value={status} onValueChange={(v) => v && setStatus(v)}>
                      <SelectTrigger size="sm" className={taskFieldSelectTriggerClass}>
                        <SelectValue>
                          <TaskStatusBadge status={status} />
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open" className="py-1.5 text-xs">
                          <TaskStatusBadge status="open" />
                        </SelectItem>
                        <SelectItem value="in-progress" className="py-1.5 text-xs">
                          <TaskStatusBadge status="in-progress" />
                        </SelectItem>
                        <SelectItem value="done" className="py-1.5 text-xs">
                          <TaskStatusBadge status="done" />
                        </SelectItem>
                        <SelectItem value="closed" className="py-1.5 text-xs">
                          <TaskStatusBadge status="closed" />
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0">
                    <label className="text-xs font-medium text-muted-foreground">Kind</label>
                    <Select value={kind} onValueChange={(v) => v && setKind(v)}>
                      <SelectTrigger size="sm" className={taskFieldSelectTriggerClass}>
                        <SelectValue>
                          <TaskKindBadge kind={kind} />
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="task" className="py-1.5 text-xs">
                          <TaskKindBadge kind="task" />
                        </SelectItem>
                        <SelectItem value="issue" className="py-1.5 text-xs">
                          <TaskKindBadge kind="issue" />
                        </SelectItem>
                        <SelectItem value="request" className="py-1.5 text-xs">
                          <TaskKindBadge kind="request" />
                        </SelectItem>
                        <SelectItem value="next-step" className="py-1.5 text-xs">
                          <TaskKindBadge kind="next-step" />
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0">
                    <label className="text-xs font-medium text-muted-foreground">Priority</label>
                    <Select value={priority} onValueChange={(v) => v && setPriority(v)}>
                      <SelectTrigger size="sm" className={taskFieldSelectTriggerClass}>
                        <SelectValue>
                          <TaskPriorityBadge priority={priority} />
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="urgent" className="py-1.5 text-xs">
                          <TaskPriorityBadge priority="urgent" />
                        </SelectItem>
                        <SelectItem value="high" className="py-1.5 text-xs">
                          <TaskPriorityBadge priority="high" />
                        </SelectItem>
                        <SelectItem value="medium" className="py-1.5 text-xs">
                          <TaskPriorityBadge priority="medium" />
                        </SelectItem>
                        <SelectItem value="low" className="py-1.5 text-xs">
                          <TaskPriorityBadge priority="low" />
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <SectionLabel>Project</SectionLabel>
              <dl className="space-y-1.5">
                <Field label="Name" value={task.folder_name ?? null} />
                <Field label="Key" value={task.folder_key} />
              </dl>
            </div>

            <Separator />

            <div>
              <SectionLabel>Activity</SectionLabel>
              <dl className="space-y-1.5">
                <Field label="Created" value={task.created_at?.split("T")[0]} />
                <Field label="Updated" value={task.updated_at?.split("T")[0]} />
              </dl>
            </div>
          </div>
        </ScrollArea>

        <div className="flex shrink-0 gap-2 border-t border-border px-5 py-4">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={handleSave}
            disabled={saving || !title.trim()}
          >
            {saving ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </SheetContent>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete task</DialogTitle>
            <DialogDescription className="text-xs">
              Delete &quot;{task.title}&quot;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
