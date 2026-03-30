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
  type RowSelectionState,
} from "@tanstack/react-table";
import {
  ArrowLeft,
  Plus,
  Search,
  Type,
  Text,
  Activity,
  Flag,
  Tag,
  Clock,
  Trash2,
  Loader2,
  Kanban,
  Pencil,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
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
import ActiveFilters from "./ActiveFilters";
import SavedViewPicker from "./SavedViewPicker";
import TaskDetail from "./TaskDetail";
import { TaskKindBadge, TaskPriorityBadge, TaskStatusBadge } from "./task-badges";
import type { SavedView } from "@/types";

interface Props {
  /** When set, lists and new tasks are scoped to this project; when null, all tasks in the workspace. */
  project: Project | null;
  allProjects: Project[];
  onBack: () => void;
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
    id: "select",
    enableSorting: false,
    enableHiding: false,
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked === true)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(checked) => row.toggleSelected(checked === true)}
        aria-label="Select row"
        onClick={(e) => e.stopPropagation()}
      />
    ),
  },
  {
    accessorKey: "title",
    enableSorting: true,
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Title"
        icon={<Type className={iconProps} strokeWidth={1.5} />}
      />
    ),
    cell: ({ getValue }) => (
      <div className="text-xs font-medium">{getValue() as string}</div>
    ),
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
    id: "project",
    accessorFn: (row) => row.folder_name ?? row.folder_key,
    enableSorting: true,
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Project"
        icon={<Kanban className={iconProps} strokeWidth={1.5} />}
      />
    ),
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {row.original.folder_name ?? row.original.folder_key}
      </span>
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

export default function TaskTable({ project, allProjects, onBack }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const [sheetTask, setSheetTask] = useState<Task | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [singleDeleteOpen, setSingleDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // New task dialog + form state
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTaskFolderKey, setNewTaskFolderKey] = useState("");
  const [newKind, setNewKind] = useState("task");
  const [newPriority, setNewPriority] = useState("medium");
  const [creating, setCreating] = useState(false);

  const canAddTask = project != null || allProjects.length > 0;

  const [taskSearch, setTaskSearch] = useState("");

  // Saved views (scoped to tasks context)
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  const loadViews = useCallback(async () => {
    try {
      const views = await invoke<SavedView[]>("get_table_views", { context: "tasks" });
      setSavedViews(views);
    } catch {
      // silently ignore if workspace not configured yet
    }
  }, []);

  useEffect(() => {
    loadViews();
  }, [loadViews]);

  const handleLoadView = useCallback((view: SavedView) => {
    setSorting(JSON.parse(view.sorting));
    setColumnFilters(JSON.parse(view.filters));
    setColumnVisibility(JSON.parse(view.visibility));
    setActiveViewId(view.id);
  }, []);

  const activeView = useMemo(
    () => savedViews.find((v) => v.id === activeViewId) ?? null,
    [savedViews, activeViewId],
  );

  const isDirty = useMemo(() => {
    if (!activeView) return false;
    return (
      JSON.stringify(sorting) !== activeView.sorting ||
      JSON.stringify(columnFilters) !== activeView.filters ||
      JSON.stringify(columnVisibility) !== activeView.visibility
    );
  }, [activeView, sorting, columnFilters, columnVisibility]);

  const handleSaveView = useCallback(async () => {
    if (!activeView) return;
    await invoke("save_table_view", {
      id: activeView.id,
      name: activeView.name,
      context: "tasks",
      sorting: JSON.stringify(sorting),
      filters: JSON.stringify(columnFilters),
      visibility: JSON.stringify(columnVisibility),
    });
    loadViews();
  }, [activeView, sorting, columnFilters, columnVisibility, loadViews]);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await invoke<Task[]>("get_tasks", {
        folderKey: project?.folder_key ?? null,
      });
      setTasks(rows);
    } finally {
      setLoading(false);
    }
  }, [project?.folder_key]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    const folderKey = project?.folder_key ?? newTaskFolderKey;
    if (!folderKey) return;
    setCreating(true);
    try {
      await invoke<Task>("create_task", {
        folderKey,
        title: newTitle.trim(),
        kind: newKind,
        description: null,
        priority: newPriority,
      });
      setNewTitle("");
      setNewTaskFolderKey("");
      setNewTaskOpen(false);
      await loadTasks();
    } finally {
      setCreating(false);
    }
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
        (t.priority ?? "").toLowerCase().includes(q) ||
        (t.folder_name ?? "").toLowerCase().includes(q) ||
        t.folder_key.toLowerCase().includes(q),
    );
  }, [tasks, taskSearch]);

  const table = useReactTable({
    data: filteredTasks,
    columns,
    getRowId: (row) => String(row.id),
    state: { sorting, columnFilters, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: coreRowModel,
    getFilteredRowModel: filteredRowModel,
    getSortedRowModel: sortedRowModel,
    getFacetedRowModel: facetedRowModel,
    getFacetedUniqueValues: facetedUniqueValues,
    enableRowSelection: true,
  });

  const selectedKeys = Object.keys(rowSelection).filter((k) => rowSelection[k]);
  const selectedCount = selectedKeys.length;
  const selectedOneTask =
    selectedCount === 1
      ? filteredTasks.find((t) => String(t.id) === selectedKeys[0]) ?? null
      : null;

  const openTaskSheet = (task: Task) => {
    setSheetTask(task);
    setSheetOpen(true);
  };

  const handleEditSelection = () => {
    if (!selectedOneTask) return;
    openTaskSheet(selectedOneTask);
  };

  const deleteTasksByIds = async (ids: number[]) => {
    setDeleting(true);
    setDeleteError("");
    try {
      await Promise.all(ids.map((id) => invoke("delete_task", { id })));
      setRowSelection({});
      setBulkDeleteOpen(false);
      setSingleDeleteOpen(false);
      if (sheetTask && ids.includes(sheetTask.id)) {
        setSheetOpen(false);
        setSheetTask(null);
      }
      await loadTasks();
    } catch (e) {
      setDeleteError(String(e));
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCount === 0) return;
    const ids = selectedKeys.map((k) => Number(k));
    await deleteTasksByIds(ids);
  };

  const handleSingleDeleteFromBar = async () => {
    if (!selectedOneTask) return;
    await deleteTasksByIds([selectedOneTask.id]);
  };

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
          disabled={!canAddTask}
          onClick={() => {
            setNewTaskOpen(true);
            if (!project && allProjects[0]) {
              setNewTaskFolderKey(allProjects[0].folder_key);
            }
          }}
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
          <SavedViewPicker
            context="tasks"
            views={savedViews}
            activeViewId={activeViewId}
            sorting={sorting}
            columnFilters={columnFilters}
            columnVisibility={columnVisibility}
            onLoadView={handleLoadView}
            onViewsChange={loadViews}
          />
          <DataTableViewOptions table={table} />
        </div>
      </div>

      <ActiveFilters
        table={table}
        context="tasks"
        sorting={sorting}
        columnFilters={columnFilters}
        columnVisibility={columnVisibility}
        activeView={activeView}
        isDirty={isDirty}
        onSaveView={handleSaveView}
        onViewsChange={loadViews}
      />

      {selectedCount > 0 && (
        <div className="flex shrink-0 items-center gap-2 py-1.5">
          <span className="text-xs text-muted-foreground">{selectedCount} selected</span>
          <Button
            variant="secondary"
            size="sm"
            className="h-6 gap-1.5 text-xs"
            onClick={handleEditSelection}
            disabled={!selectedOneTask}
          >
            <Pencil className="h-3 w-3" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-6 gap-1.5 text-xs"
            onClick={() => {
              setDeleteError("");
              if (selectedCount === 1 && selectedOneTask) {
                setSingleDeleteOpen(true);
              } else {
                setBulkDeleteOpen(true);
              }
            }}
            disabled={deleting}
          >
            <Trash2 className="h-3 w-3" />
            {deleting ? "Deleting…" : selectedCount === 1 ? "Delete task" : "Delete tasks"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-muted-foreground"
            onClick={() => table.resetRowSelection()}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      {loading && tasks.length === 0 ? (
        <div className="mt-1 flex-1 rounded-md border border-border">
          <div className="flex items-center gap-3 border-b border-border px-3 py-2.5">
            <Skeleton className="h-4 w-4 rounded-[4px]" />
            <Skeleton className="h-3.5 w-[180px]" />
            <Skeleton className="h-3.5 w-[300px]" />
            <Skeleton className="h-3.5 w-[100px]" />
            <Skeleton className="h-3.5 w-[80px]" />
            <Skeleton className="h-3.5 w-[80px]" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-border/50 px-3 py-2.5">
              <Skeleton className="h-4 w-4 rounded-[4px]" />
              <Skeleton className="h-3.5 w-[180px]" />
              <Skeleton className="h-3.5 w-[300px]" />
              <Skeleton className="h-3.5 w-[100px]" />
              <Skeleton className="h-3.5 w-[80px]" />
              <Skeleton className="h-3.5 w-[80px]" />
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="mt-1 flex flex-1 items-center justify-center text-sm text-muted-foreground">
          No tasks yet. Use the plus button to add one.
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="mt-1 flex flex-1 items-center justify-center text-sm text-muted-foreground">
          No tasks match your search.
        </div>
      ) : (
        <div className="mt-1 min-h-0 flex-1 overflow-auto rounded-md border border-border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="hover:bg-transparent">
                  {hg.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        header.column.id === "select" && "w-10 pl-3",
                        header.column.id === "title" && "w-[240px] pl-2",
                        header.column.id === "description" && "w-[300px]",
                        header.column.id === "project" && "w-[160px]",
                        header.column.id === "kind" && "w-[100px]",
                        header.column.id === "status" && "w-[120px]",
                        header.column.id === "priority" && "w-[100px]",
                        header.column.id === "created_at" && "w-[100px]",
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => {
                const task = row.original;
                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer",
                      sheetTask?.id === task.id && sheetOpen && "bg-accent/20",
                    )}
                    onClick={() => openTaskSheet(task)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          cell.column.id === "select" && "pl-3",
                          cell.column.id === "title" && "pl-2",
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* New task dialog */}
      <Dialog
        open={newTaskOpen}
        onOpenChange={(open) => {
          setNewTaskOpen(open);
          if (!open) {
            setNewTitle("");
            setNewTaskFolderKey("");
            setNewKind("task");
            setNewPriority("medium");
          }
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription className="text-xs">
              {project
                ? `Add a task for ${project.folder_name}.`
                : "Choose a project and add a task."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {!project && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Project</label>
                <Select
                  value={newTaskFolderKey}
                  onValueChange={(v) => v && setNewTaskFolderKey(v)}
                >
                  <SelectTrigger className="mt-1 h-8 text-xs">
                    <SelectValue placeholder="Select project…" />
                  </SelectTrigger>
                  <SelectContent>
                    {allProjects.map((p) => (
                      <SelectItem key={p.folder_key} value={p.folder_key}>
                        {p.folder_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
                setNewTaskFolderKey("");
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
              disabled={
                !newTitle.trim() ||
                creating ||
                (!project && !newTaskFolderKey)
              }
            >
              {creating ? "Adding…" : "Add task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TaskDetail
        task={sheetTask}
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setSheetTask(null);
        }}
        onTaskSaved={async (updated) => {
          setSheetTask(updated);
          await loadTasks();
        }}
        onTaskDeleted={async () => {
          setRowSelection({});
          await loadTasks();
        }}
      />

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete tasks</DialogTitle>
            <DialogDescription className="text-xs">
              Permanently delete {selectedCount} selected tasks? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setBulkDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete tasks"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={singleDeleteOpen} onOpenChange={setSingleDeleteOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete task</DialogTitle>
            <DialogDescription className="text-xs">
              Permanently delete &quot;{selectedOneTask?.title}&quot;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSingleDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleSingleDeleteFromBar}
              disabled={deleting || !selectedOneTask}
            >
              {deleting ? "Deleting…" : "Delete task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
