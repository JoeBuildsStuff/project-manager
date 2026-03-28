import { useState, useCallback, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  flexRender,
  type SortingState,
  type ColumnDef,
  type ColumnFiltersState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowLeft,
  Plus,
  Search,
  Text,
  Activity,
  Flag,
  Tag,
  Clock,
  Trash2,
  Check,
  Circle,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
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
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { DataTableViewOptions } from "@/components/ui/data-table-view-options";
import { cn } from "@/lib/utils";
import type { Task, Project } from "@/types";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ModeToggle } from "@/components/mode-toggle";

interface Props {
  project: Project;
  onBack: () => void;
}

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "gray"
  | "red"
  | "yellow"
  | "orange"
  | "amber"
  | "green"
  | "blue"
  | "indigo"
  | "purple"
  | "pink";

const STATUS_BADGE: Record<string, { variant: BadgeVariant; icon: React.ElementType }> = {
  open:          { variant: "blue",   icon: Circle },
  "in-progress": { variant: "yellow", icon: Loader2 },
  done:          { variant: "green",  icon: CheckCircle2 },
  closed:        { variant: "gray",   icon: XCircle },
};

const PRIORITY_BADGE: Record<string, { variant: BadgeVariant; label: string }> = {
  urgent: { variant: "red",    label: "Urgent" },
  high:   { variant: "orange", label: "High" },
  medium: { variant: "yellow", label: "Medium" },
  low:    { variant: "gray",   label: "Low" },
};

const KIND_BADGE: Record<string, { variant: BadgeVariant; label: string }> = {
  task:        { variant: "blue",   label: "Task" },
  issue:       { variant: "red",    label: "Issue" },
  request:     { variant: "purple", label: "Request" },
  "next-step": { variant: "green",  label: "Next Step" },
};

function TaskStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status];
  if (!cfg) return <Badge variant="gray" className="text-[11px] font-medium">{status}</Badge>;
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} className="gap-1 text-[11px] font-medium">
      <Icon className={cn("h-2.5 w-2.5", status === "in-progress" && "animate-spin")} />
      {status}
    </Badge>
  );
}

function TaskPriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return null;
  const cfg = PRIORITY_BADGE[priority];
  if (!cfg) return <Badge variant="gray" className="text-[11px] font-medium">{priority}</Badge>;
  return <Badge variant={cfg.variant} className="text-[11px] font-medium">{cfg.label}</Badge>;
}

function TaskKindBadge({ kind }: { kind: string }) {
  const cfg = KIND_BADGE[kind];
  if (!cfg) return <Badge variant="gray" className="text-[11px] font-medium">{kind}</Badge>;
  return <Badge variant={cfg.variant} className="text-[11px] font-medium">{cfg.label}</Badge>;
}

function relativeDate(iso: string | null): string {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff === 0) return "today";
  if (diff === 1) return "1d ago";
  if (diff < 30) return `${diff}d ago`;
  if (diff < 365) return `${Math.floor(diff / 30)}mo ago`;
  return `${Math.floor(diff / 365)}y ago`;
}

const iconProps = "h-3.5 w-3.5 shrink-0 text-muted-foreground";

const arrIncludesFilter = (
  row: { getValue: (id: string) => unknown },
  columnId: string,
  filterValue: string[],
) => {
  const cellValue = row.getValue(columnId);
  const normalized = cellValue == null ? "__null__" : String(cellValue);
  return filterValue.includes(normalized);
};

const coreRowModel = getCoreRowModel<Task>();
const filteredRowModel = getFilteredRowModel<Task>();
const sortedRowModel = getSortedRowModel<Task>();
const facetedRowModel = getFacetedRowModel<Task>();
const facetedUniqueValues = getFacetedUniqueValues<Task>();

const columns: ColumnDef<Task>[] = [
  {
    accessorKey: "title",
    enableSorting: true,
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Title"
        icon={<Text className={iconProps} strokeWidth={1.5} />}
      />
    ),
    cell: ({ getValue }) => (
      <div className="text-xs font-medium">{getValue() as string}</div>
    ),
  },
  {
    accessorKey: "kind",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: arrIncludesFilter,
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Kind"
        icon={<Tag className={iconProps} strokeWidth={1.5} />}
      />
    ),
    cell: ({ getValue }) => <TaskKindBadge kind={getValue() as string} />,
  },
  {
    accessorKey: "status",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: arrIncludesFilter,
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Status"
        icon={<Activity className={iconProps} strokeWidth={1.5} />}
      />
    ),
    cell: ({ getValue }) => <TaskStatusBadge status={getValue() as string} />,
  },
  {
    accessorKey: "priority",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: arrIncludesFilter,
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Priority"
        icon={<Flag className={iconProps} strokeWidth={1.5} />}
      />
    ),
    cell: ({ getValue }) => <TaskPriorityBadge priority={getValue() as string | null} />,
  },
  {
    accessorKey: "description",
    enableSorting: false,
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Description"
        icon={<Text className={iconProps} strokeWidth={1.5} />}
      />
    ),
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return v ? (
        <span className="block max-w-[300px] truncate text-xs text-muted-foreground">{v}</span>
      ) : null;
    },
  },
  {
    accessorKey: "created_at",
    enableSorting: true,
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Created"
        icon={<Clock className={iconProps} strokeWidth={1.5} />}
      />
    ),
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return v ? (
        <span className="text-xs text-muted-foreground">{relativeDate(v)}</span>
      ) : null;
    },
  },
];

export default function TaskTable({ project, onBack }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // New task dialog + form state
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newKind, setNewKind] = useState("task");
  const [newPriority, setNewPriority] = useState("medium");
  const [creating, setCreating] = useState(false);

  const [taskSearch, setTaskSearch] = useState("");

  // Edit dialog
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editKind, setEditKind] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteTask, setDeleteTask] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await invoke<Task[]>("get_tasks", { folderKey: project.folder_key });
      setTasks(rows);
    } finally {
      setLoading(false);
    }
  }, [project.folder_key]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await invoke<Task>("create_task", {
        folderKey: project.folder_key,
        title: newTitle.trim(),
        kind: newKind,
        description: null,
        priority: newPriority,
      });
      setNewTitle("");
      setNewTaskOpen(false);
      await loadTasks();
    } finally {
      setCreating(false);
    }
  };

  const handleQuickToggle = async (task: Task) => {
    const newStatus = task.status === "done" ? "open" : "done";
    await invoke<Task>("update_task", {
      id: task.id,
      title: null,
      description: null,
      status: newStatus,
      kind: null,
      priority: null,
    });
    await loadTasks();
  };

  const handleEditSave = async () => {
    if (!editTask) return;
    setSaving(true);
    try {
      await invoke<Task>("update_task", {
        id: editTask.id,
        title: editTitle.trim() || null,
        description: editDescription.trim() || null,
        status: editStatus || null,
        kind: editKind || null,
        priority: editPriority || null,
      });
      setEditTask(null);
      await loadTasks();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTask) return;
    setDeleting(true);
    try {
      await invoke("delete_task", { id: deleteTask.id });
      setDeleteTask(null);
      await loadTasks();
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (task: Task) => {
    setEditTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description ?? "");
    setEditStatus(task.status);
    setEditKind(task.kind);
    setEditPriority(task.priority ?? "medium");
  };

  const filteredTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q) ||
        t.kind.toLowerCase().includes(q) ||
        t.status.toLowerCase().includes(q) ||
        (t.priority ?? "").toLowerCase().includes(q),
    );
  }, [tasks, taskSearch]);

  const table = useReactTable({
    data: filteredTasks,
    columns,
    getRowId: (row) => String(row.id),
    state: { sorting, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: coreRowModel,
    getFilteredRowModel: filteredRowModel,
    getSortedRowModel: sortedRowModel,
    getFacetedRowModel: facetedRowModel,
    getFacetedUniqueValues: facetedUniqueValues,
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Toolbar (aligned with project table: plus → search) */}
      <div className="flex items-center gap-1">
        <SidebarTrigger className="-ml-1" />
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 h-7 shrink-0">
          <ArrowLeft className="h-3.5 w-3.5" />
          Projects
        </Button>
        <Button
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => setNewTaskOpen(true)}
        >
          <Plus />
        </Button>
        <InputGroup className="h-7 min-w-0 flex-1">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search tasks…"
            value={taskSearch}
            onChange={(e) => setTaskSearch(e.target.value)}
          />
        </InputGroup>
        <div className="flex shrink-0 items-center gap-1">
          {loading && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
          <DataTableViewOptions table={table} />
          <ModeToggle align="end" />
        </div>
      </div>

      {/* Table */}
      {loading && tasks.length === 0 ? (
        <div className="mt-2 flex-1 rounded-md border border-border">
          <div className="flex items-center gap-3 border-b border-border px-3 py-2.5">
            <Skeleton className="h-3.5 w-[200px]" />
            <Skeleton className="h-3.5 w-[80px]" />
            <Skeleton className="h-3.5 w-[80px]" />
            <Skeleton className="h-3.5 w-[80px]" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-border/50 px-3 py-2.5">
              <Skeleton className="h-3.5 w-[200px]" />
              <Skeleton className="h-3.5 w-[80px]" />
              <Skeleton className="h-3.5 w-[80px]" />
              <Skeleton className="h-3.5 w-[80px]" />
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="mt-2 flex flex-1 items-center justify-center text-sm text-muted-foreground">
          No tasks yet. Use the plus button to add one.
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="mt-2 flex flex-1 items-center justify-center text-sm text-muted-foreground">
          No tasks match your search.
        </div>
      ) : (
        <ScrollArea className="mt-2 min-h-0 flex-1 rounded-md border border-border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="hover:bg-transparent">
                  {/* Quick-toggle column header */}
                  <TableHead className="w-10 pl-3" />
                  {hg.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        header.column.id === "title"       && "w-[240px] pl-2",
                        header.column.id === "kind"        && "w-[100px]",
                        header.column.id === "status"      && "w-[120px]",
                        header.column.id === "priority"    && "w-[100px]",
                        header.column.id === "description" && "w-[300px]",
                        header.column.id === "created_at"  && "w-[100px]",
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                  {/* Actions column header */}
                  <TableHead className="w-16 pr-3" />
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => {
                const task = row.original;
                const isDone = task.status === "done" || task.status === "closed";
                return (
                  <TableRow
                    key={row.id}
                    className={cn("cursor-pointer", isDone && "opacity-50")}
                    onClick={() => openEdit(task)}
                  >
                    <TableCell className="pl-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickToggle(task);
                        }}
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded-full border transition-colors",
                          isDone
                            ? "border-green-500 bg-green-500 text-white"
                            : "border-muted-foreground/40 hover:border-green-500"
                        )}
                      >
                        {isDone && <Check className="h-2.5 w-2.5" />}
                      </button>
                    </TableCell>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          cell.column.id === "title" && "pl-2",
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                    <TableCell className="pr-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTask(task);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      )}

      {/* New task dialog */}
      <Dialog
        open={newTaskOpen}
        onOpenChange={(open) => {
          setNewTaskOpen(open);
          if (!open) {
            setNewTitle("");
            setNewKind("task");
            setNewPriority("medium");
          }
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription className="text-xs">
              Add a task for {project.folder_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Title</label>
              <Input
                placeholder="Task title…"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
                className="mt-1 h-8 text-xs"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground">Kind</label>
                <Select value={newKind} onValueChange={(v) => v && setNewKind(v)}>
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
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground">Priority</label>
                <Select value={newPriority} onValueChange={(v) => v && setNewPriority(v)}>
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
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNewTitle("");
                setNewKind("task");
                setNewPriority("medium");
                setNewTaskOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!newTitle.trim() || creating}
            >
              {creating ? "Adding…" : "Add task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTask} onOpenChange={(open) => !open && setEditTask(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Title</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Optional description..."
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Select value={editStatus} onValueChange={(v) => v && setEditStatus(v)}>
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
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground">Kind</label>
                <Select value={editKind} onValueChange={(v) => v && setEditKind(v)}>
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
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground">Priority</label>
                <Select value={editPriority} onValueChange={(v) => v && setEditPriority(v)}>
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
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditTask(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleEditSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTask} onOpenChange={(open) => !open && setDeleteTask(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to delete "{deleteTask?.title}"? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTask(null)}>
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
