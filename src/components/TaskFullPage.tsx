import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ArrowLeft, Folder, Hash, Kanban, Loader2, Trash2 } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { Project, Task } from "@/types";
import { TaskKindBadge, TaskPriorityBadge, TaskStatusBadge } from "./task-badges";

interface Props {
  task: Task;
  project: Project | null;
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

export default function TaskFullPage({
  task,
  project,
  onBack,
  onTaskSaved,
  onTaskDeleted,
}: Props) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [status, setStatus] = useState(task.status);
  const [kind, setKind] = useState(task.kind);
  const [priority, setPriority] = useState(task.priority ?? "medium");
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? "");
    setStatus(task.status);
    setKind(task.kind);
    setPriority(task.priority ?? "medium");
    setError("");
  }, [task]);

  const hasTaskChanges =
    title.trim() !== task.title ||
    description !== (task.description ?? "") ||
    status !== task.status ||
    kind !== task.kind ||
    priority !== (task.priority ?? "medium");

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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center p-1">
        <SidebarTrigger className="-ml-1 shrink-0" />
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
        <div className="mr-2 h-4 w-px bg-border" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">
              Task
              <Hash className="h-4 w-4" />
              {task.id}
            </Badge>
            in
            {project && (
              <Badge variant="outline">
                <Kanban className="h-4 w-4" />
                {project.folder_name}
              </Badge>
            )}
            <Badge variant="outline">
              <Folder className="h-4 w-4" />
              {task.folder_key}
            </Badge>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <TaskStatusBadge status={status} />
          <TaskKindBadge kind={kind} />
          <TaskPriorityBadge priority={priority} />
        </div>
      </div>

      <div className="min-h-0 flex-1 px-2 pb-2">
        <ScrollArea className="h-full min-h-0 rounded-lg border">
          <div className="mx-auto max-w-2xl space-y-5 p-5">
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
                  rows={8}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="mt-1 resize-none text-xs"
                  placeholder="Describe the work for this task."
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
              <SectionLabel>Project context</SectionLabel>
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
          </div>
        </ScrollArea>
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
