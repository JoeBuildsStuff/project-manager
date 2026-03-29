import { useState, useEffect, useCallback, useMemo } from "react";
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
  Text,
  Activity,
  Rocket,
  GitCommit,
  GitBranch,
  Clock,
  FolderKanban,
  Pencil,
  Trash2,
  ListTodo,
  Milestone,
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
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { Project, TaskCount, SavedView } from "../types";
import { Badge } from "@/components/ui/badge";
import { CategoryBadge, DeployBadge, StageBadge, StatusBadge } from "./StatusBadge";
import DeleteProjectDialog from "./DeleteProjectDialog";
import Toolbar from "./Toolbar";
import ActiveFilters from "./ActiveFilters";

// Table meta type for passing task data into column renderers
interface TableMeta {
  taskCounts: Map<string, TaskCount>;
  onOpenTasks: (p: Project) => void;
}

interface Props {
  projects: Project[];
  selected: Project | null;
  onSelect: (p: Project) => void;
  search: string;
  onSearch: (v: string) => void;
  onSync: () => void;
  onNewProject: () => void;
  syncing: boolean;
  loading: boolean;
  syncMsg: string;
  syncIsError: boolean;
  onStatusChange: (folder_key: string, status: string) => void;
  onDeleteSelected: (folderKeys: string[]) => Promise<void>;
  taskCounts: Map<string, TaskCount>;
  onOpenTasks: (p: Project) => void;
}

function relativeDate(iso: string | null): string {
  if (!iso) return "—";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff === 0) return "today";
  if (diff === 1) return "1d ago";
  if (diff < 30) return `${diff}d ago`;
  if (diff < 365) return `${Math.floor(diff / 30)}mo ago`;
  return `${Math.floor(diff / 365)}y ago`;
}

const iconProps = "h-3.5 w-3.5 shrink-0 text-muted-foreground";

// Hoist row-model factories so they aren't recreated on every render
const coreRowModel = getCoreRowModel<Project>();
const filteredRowModel = getFilteredRowModel<Project>();
const sortedRowModel = getSortedRowModel<Project>();
const facetedRowModel = getFacetedRowModel<Project>();
const facetedUniqueValues = getFacetedUniqueValues<Project>();

const arrIncludesFilter = (
  row: { getValue: (id: string) => unknown },
  columnId: string,
  filterValue: string[],
) => {
  const cellValue = row.getValue(columnId);
  const normalized = cellValue == null ? "__null__" : String(cellValue);
  return filterValue.includes(normalized);
};

const columns: ColumnDef<Project>[] = [
  {
    id: "select",
    enableSorting: false,
    enableHiding: false,
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(checked) =>
          table.toggleAllPageRowsSelected(checked === true)
        }
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
    accessorKey: "folder_name",
    enableSorting: true,
    enableColumnFilter: false,
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Name"
        icon={<Text className={iconProps} strokeWidth={1.5} />}
      />
    ),
    cell: ({ row: { original: p } }) => (
      <div className="text-xs font-medium">{p.folder_name}</div>
    ),
  },
  {
    accessorKey: "description",
    enableSorting: true,
    enableColumnFilter: false,
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
        <span className="block max-w-[260px] truncate text-xs text-muted-foreground">
          {v}
        </span>
      ) : null;
    },
  },
  {
    accessorKey: "category",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: arrIncludesFilter,
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Category"
        icon={<FolderKanban className={iconProps} strokeWidth={1.5} />}
      />
    ),
    cell: ({ getValue }) => <CategoryBadge category={getValue() as string | null} />,
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
    cell: ({ getValue }) => <StatusBadge status={getValue() as string | null} />,
  },
  {
    accessorKey: "stage",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: arrIncludesFilter,
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Stage"
        icon={<Milestone className={iconProps} strokeWidth={1.5} />}
      />
    ),
    cell: ({ getValue }) => <StageBadge stage={getValue() as string | null} />,
  },
  {
    accessorKey: "deploy_platform",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: arrIncludesFilter,
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Deploy"
        icon={<Rocket className={iconProps} strokeWidth={1.5} />}
      />
    ),
    cell: ({ getValue }) => <DeployBadge platform={getValue() as string | null} />,
  },
  {
    accessorKey: "host",
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: arrIncludesFilter,
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Host"
        icon={<GitBranch className={iconProps} strokeWidth={1.5} />}
      />
    ),
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return v ? (
        <span className="text-xs text-muted-foreground capitalize">{v}</span>
      ) : null;
    },
  },
  {
    accessorKey: "commit_count",
    enableSorting: true,
    enableColumnFilter: false,
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Commits"
        icon={<GitCommit className={iconProps} strokeWidth={1.5} />}
      />
    ),
    cell: ({ getValue }) => {
      const v = getValue() as number | null;
      return v != null ? (
        <span className="text-xs text-muted-foreground">{v}</span>
      ) : null;
    },
  },
  {
    id: "diff",
    accessorFn: (project) =>
      (project.lines_added ?? 0) + (project.lines_removed ?? 0),
    enableSorting: true,
    enableColumnFilter: false,
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Diff"
        icon={<GitCommit className={iconProps} strokeWidth={1.5} />}
      />
    ),
    cell: ({ row: { original: p } }) =>
      p.lines_added != null && p.lines_removed != null ? (
        <span className="text-xs text-muted-foreground">
          <span className="text-emerald-600 dark:text-emerald-400">
            +{p.lines_added}
          </span>
          {" / "}
          <span className="text-rose-600 dark:text-rose-400">
            -{p.lines_removed}
          </span>
        </span>
      ) : null,
  },
  {
    accessorKey: "last_commit_date",
    enableSorting: true,
    enableColumnFilter: false,
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Last commit"
        icon={<Clock className={iconProps} strokeWidth={1.5} />}
      />
    ),
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return v ? (
        <span className="text-xs text-muted-foreground">
          {relativeDate(v)}
        </span>
      ) : null;
    },
  },
  {
    id: "tasks",
    enableSorting: true,
    enableColumnFilter: false,
    accessorFn: (project) => {
      // Sorting value — will be 0 if no tasks
      return project.folder_key;
    },
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Tasks"
        icon={<ListTodo className={iconProps} strokeWidth={1.5} />}
      />
    ),
    cell: ({ row: { original: p }, table: t }) => {
      const meta = t.options.meta as TableMeta | undefined;
      const counts = meta?.taskCounts?.get(p.folder_key);
      const openCount = counts?.open_count ?? 0;
      const totalCount = counts?.total_count ?? 0;

      if (totalCount === 0) {
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              meta?.onOpenTasks(p);
            }}
            className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            +
          </button>
        );
      }

      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            meta?.onOpenTasks(p);
          }}
          className="inline-flex items-center gap-1 transition-colors hover:opacity-80"
        >
          <Badge
            variant={openCount > 0 ? "blue" : "gray"}
            className="text-[11px] font-medium cursor-pointer"
          >
            {openCount} / {totalCount}
          </Badge>
        </button>
      );
    },
    sortingFn: (_rowA, _rowB, _columnId) => {
      // This won't have access to meta easily for sorting, so sort by folder_key as fallback
      return 0;
    },
  },
];

export default function ProjectTable({
  projects,
  selected,
  onSelect,
  search,
  onSearch,
  onSync,
  onNewProject,
  syncing,
  loading,
  syncMsg,
  syncIsError,
  onDeleteSelected,
  taskCounts,
  onOpenTasks,
}: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [singleDeleteOpen, setSingleDeleteOpen] = useState(false);

  // Saved views
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  const loadViews = useCallback(async () => {
    try {
      const views = await invoke<SavedView[]>("get_table_views", { context: "projects" });
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
      context: "projects",
      sorting: JSON.stringify(sorting),
      filters: JSON.stringify(columnFilters),
      visibility: JSON.stringify(columnVisibility),
    });
    loadViews();
  }, [activeView, sorting, columnFilters, columnVisibility, loadViews]);

  const table = useReactTable({
    data: projects,
    columns,
    getRowId: (row) => row.folder_key,
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
    meta: { taskCounts, onOpenTasks } as TableMeta,
  });

  const selectedKeys = Object.keys(rowSelection).filter((k) => rowSelection[k]);
  const selectedCount = selectedKeys.length;
  const selectedProject =
    selectedCount === 1
      ? projects.find((p) => p.folder_key === selectedKeys[0]) ?? null
      : null;

  const handleDelete = async () => {
    if (selectedCount === 0) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await onDeleteSelected(selectedKeys);
      setRowSelection({});
      setConfirmDeleteOpen(false);
    } catch (error) {
      setDeleteError(String(error));
    } finally {
      setDeleting(false);
    }
  };

  const handleSingleDelete = async (folderKey: string) => {
    setDeleting(true);
    try {
      await onDeleteSelected([folderKey]);
      setRowSelection({});
      setSingleDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = () => {
    if (!selectedProject) return;
    onSelect(selectedProject);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Toolbar
        table={table}
        search={search}
        onSearch={onSearch}
        onSync={onSync}
        onNewProject={onNewProject}
        syncing={syncing}
        syncMsg={syncMsg}
        syncIsError={syncIsError}
        loading={loading}
        savedViews={savedViews}
        activeViewId={activeViewId}
        sorting={sorting}
        columnFilters={columnFilters}
        columnVisibility={columnVisibility}
        onLoadView={handleLoadView}
        onViewsChange={loadViews}
      />

      <ActiveFilters
        table={table}
        context="projects"
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
          <span className="text-xs text-muted-foreground">
            {selectedCount} selected
          </span>
          <Button
            variant="secondary"
            size="sm"
            className="h-6 gap-1.5 text-xs"
            onClick={handleEdit}
            disabled={!selectedProject}
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
              if (selectedCount === 1 && selectedProject) {
                setSingleDeleteOpen(true);
              } else {
                setConfirmDeleteOpen(true);
              }
            }}
            disabled={deleting}
          >
            <Trash2 className="h-3 w-3" />
            {deleting ? "Deleting…" : "Delete Folder"}
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
      {loading && projects.length === 0 ? (
        <div className="mt-1 flex-1 rounded-md border border-border">
          {/* Skeleton header */}
          <div className="flex items-center gap-3 border-b border-border px-3 py-2.5">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-3.5 w-[120px]" />
            <Skeleton className="h-3.5 w-[220px]" />
            <Skeleton className="h-3.5 w-[90px]" />
            <Skeleton className="h-3.5 w-[80px]" />
            <Skeleton className="h-3.5 w-[80px]" />
            <Skeleton className="h-3.5 w-[70px]" />
          </div>
          {/* Skeleton rows */}
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-border/50 px-3 py-2.5"
            >
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-3.5 w-[120px]" />
              <Skeleton className="h-3.5 w-[220px]" />
              <Skeleton className="h-3.5 w-[90px]" />
              <Skeleton className="h-3.5 w-[80px]" />
              <Skeleton className="h-3.5 w-[80px]" />
              <Skeleton className="h-3.5 w-[70px]" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          No projects match the current filter.
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
                        header.column.id === "select"           && "w-10 pl-3",
                        header.column.id === "folder_name"      && "w-[150px] pl-2",
                        header.column.id === "category"         && "w-[110px]",
                        header.column.id === "description"      && "w-[260px]",
                        header.column.id === "commit_count"     && "w-[80px]",
                        header.column.id === "diff"             && "w-[110px]",
                        header.column.id === "last_commit_date" && "w-[100px] pr-4",
                        header.column.id === "status"           && "w-[110px]",
                        header.column.id === "stage"            && "w-[110px]",
                        header.column.id === "deploy_platform"  && "w-[100px]",
                        header.column.id === "host"             && "w-[90px]",
                        header.column.id === "tasks"            && "w-[80px]",
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
                const p = row.original;
                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer",
                      selected?.folder_key === p.folder_key && "bg-accent/20",
                    )}
                    onClick={() => onSelect(p)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          cell.column.id === "select"           && "pl-3",
                          cell.column.id === "folder_name"      && "pl-2",
                          cell.column.id === "last_commit_date" && "pr-4",
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

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete {selectedCount === 1 ? "folder" : "folders"}</DialogTitle>
            <DialogDescription className="text-xs">
              This removes {selectedCount} selected {selectedCount === 1 ? "folder" : "folders"} from
              disk and deletes the matching database rows.
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Bulk delete does not inspect per-project remote, deployment, or git state. Use the single-project delete review for full guardrails.
          </p>
          {deleteError && (
            <p className="text-xs text-destructive">{deleteError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete folder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteProjectDialog
        project={selectedProject}
        open={singleDeleteOpen}
        onOpenChange={setSingleDeleteOpen}
        onConfirm={handleSingleDelete}
      />
    </div>
  );
}
