import { useCallback, useEffect, useMemo, useState } from "react";
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
  Bot, Clock, Cpu, Layers, Loader2, Pencil, Plus, Search, Shield, Trash2, Type,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  InputGroup, InputGroupAddon, InputGroupInput,
} from "@/components/ui/input-group";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { DataTableViewOptions } from "@/components/ui/data-table-view-options";
import { cn } from "@/lib/utils";
import SavedViewPicker from "./SavedViewPicker";
import ActiveFilters from "./ActiveFilters";
import type { LlmAgent, SavedView } from "@/types";

// ─── format helpers ──────────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<string, string> = {
  codex: "Codex",
  cursor: "Cursor",
  claude: "Claude",
};

const REASONING_LABELS: Record<string, string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
  extra_high: "Extra High",
  xhigh: "Extra High",
  max: "Max",
};

const PERMISSION_LABELS: Record<string, string> = {
  default: "Default",
  acceptEdits: "Accept Edits",
  plan: "Plan",
  auto: "Auto",
  dontAsk: "Don't Ask",
  bypassPermissions: "Bypass Permissions",
};

function formatProvider(v: string | null) {
  return v ? (PROVIDER_LABELS[v] ?? v) : "—";
}
function formatReasoning(v: string | null) {
  return v ? (REASONING_LABELS[v] ?? v) : "Medium";
}
function formatPermissionMode(v: string | null) {
  return v ? (PERMISSION_LABELS[v] ?? v) : null;
}
function formatRelativeDate(iso: string | null): string {
  if (!iso) return "—";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff <= 0) return "today";
  if (diff === 1) return "1d ago";
  if (diff < 30) return `${diff}d ago`;
  if (diff < 365) return `${Math.floor(diff / 30)}mo ago`;
  return `${Math.floor(diff / 365)}y ago`;
}

// ─── table setup ─────────────────────────────────────────────────────────────

const colIconProps = "h-3.5 w-3.5 shrink-0 text-muted-foreground";

const arrIncludesFilter = (
  row: { getValue: (id: string) => unknown },
  columnId: string,
  filterValue: string[],
) => {
  const v = row.getValue(columnId);
  return filterValue.includes(v == null ? "__null__" : String(v));
};

const coreRowModel = getCoreRowModel<LlmAgent>();
const filteredRowModel = getFilteredRowModel<LlmAgent>();
const sortedRowModel = getSortedRowModel<LlmAgent>();
const facetedRowModel = getFacetedRowModel<LlmAgent>();
const facetedUniqueValues = getFacetedUniqueValues<LlmAgent>();

function buildColumns(): ColumnDef<LlmAgent>[] {
  return [
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
      accessorKey: "name",
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" icon={<Type className={colIconProps} strokeWidth={1.5} />} />
      ),
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2">
          <Bot className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="truncate text-xs font-medium">{row.original.name}</div>
            {(row.original.instructions ?? row.original.system_prompt) ? (
              <div className="truncate text-[11px] text-muted-foreground">
                {row.original.instructions ?? row.original.system_prompt}
              </div>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "provider",
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: arrIncludesFilter,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Provider" icon={<Cpu className={colIconProps} strokeWidth={1.5} />} />
      ),
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground">{formatProvider(getValue() as string)}</span>
      ),
    },
    {
      accessorKey: "model",
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Model" icon={<Layers className={colIconProps} strokeWidth={1.5} />} />
      ),
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground">{(getValue() as string | null) ?? "—"}</span>
      ),
    },
    {
      accessorKey: "reasoning",
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: arrIncludesFilter,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Reasoning" icon={<Layers className={colIconProps} strokeWidth={1.5} />} />
      ),
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground">{formatReasoning(getValue() as string | null)}</span>
      ),
    },
    {
      accessorKey: "permission_mode",
      enableSorting: true,
      enableColumnFilter: true,
      filterFn: arrIncludesFilter,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Permissions" icon={<Shield className={colIconProps} strokeWidth={1.5} />} />
      ),
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground">{formatPermissionMode(getValue() as string | null) ?? "—"}</span>
      ),
    },
    {
      accessorKey: "updated_at",
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Updated" icon={<Clock className={colIconProps} strokeWidth={1.5} />} />
      ),
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground">{formatRelativeDate(getValue() as string | null)}</span>
      ),
    },
  ];
}

// ─── component ───────────────────────────────────────────────────────────────

interface Props {
  onOpenAgent: (agent: LlmAgent | null) => void;
}

export default function AgentTable({ onOpenAgent }: Props) {
  const [agents, setAgents] = useState<LlmAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<LlmAgent | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      setAgents(await invoke<LlmAgent[]>("get_llm_agents"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAgents(); }, [loadAgents]);

  const loadViews = useCallback(async () => {
    try {
      setSavedViews(await invoke<SavedView[]>("get_table_views", { context: "agents" }));
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => { void loadViews(); }, [loadViews]);

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
      context: "agents",
      sorting: JSON.stringify(sorting),
      filters: JSON.stringify(columnFilters),
      visibility: JSON.stringify(columnVisibility),
    });
    void loadViews();
  }, [activeView, sorting, columnFilters, columnVisibility, loadViews]);

  const filteredAgents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((a) =>
      [a.name, a.provider, a.model, a.reasoning, a.permission_mode, a.instructions, a.system_prompt]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [agents, search]);

  const columns = useMemo(() => buildColumns(), []);

  const table = useReactTable({
    data: filteredAgents,
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
  const selectedOneAgent =
    selectedCount === 1
      ? filteredAgents.find((a) => String(a.id) === selectedKeys[0]) ?? null
      : null;

  const handleDelete = async (agent: LlmAgent) => {
    setDeletingId(agent.id);
    setDeleteError("");
    try {
      await invoke("delete_llm_agent", { id: agent.id });
      setRowSelection({});
      setPendingDelete(null);
      await loadAgents();
    } catch (e) {
      setDeleteError(String(e));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1">
        <SidebarTrigger className="-ml-1" />
        <Button size="icon" className="h-7 w-7 shrink-0" onClick={() => onOpenAgent(null)}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <InputGroup className="h-7 min-w-0 flex-1">
          <InputGroupAddon>
            <Search className="h-3.5 w-3.5" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search agents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
        <div className="flex shrink-0 items-center gap-1">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
          <SavedViewPicker
            context="agents"
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
        context="agents"
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
            onClick={() => selectedOneAgent && onOpenAgent(selectedOneAgent)}
            disabled={!selectedOneAgent}
          >
            <Pencil className="h-3 w-3" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-6 gap-1.5 text-xs"
            onClick={() => selectedOneAgent && setPendingDelete(selectedOneAgent)}
            disabled={!selectedOneAgent || deletingId === selectedOneAgent?.id}
          >
            <Trash2 className="h-3 w-3" />
            Delete
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

      {loading && agents.length === 0 ? (
        <div className="mt-1 flex-1 rounded-md border border-border">
          <div className="flex items-center gap-3 border-b border-border px-3 py-2.5">
            <Skeleton className="h-4 w-4 rounded-[4px]" />
            <Skeleton className="h-3.5 w-[180px]" />
            <Skeleton className="h-3.5 w-[100px]" />
            <Skeleton className="h-3.5 w-[160px]" />
            <Skeleton className="h-3.5 w-[100px]" />
            <Skeleton className="h-3.5 w-[100px]" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-border/50 px-3 py-2.5">
              <Skeleton className="h-4 w-4 rounded-[4px]" />
              <Skeleton className="h-3.5 w-[180px]" />
              <Skeleton className="h-3.5 w-[100px]" />
              <Skeleton className="h-3.5 w-[160px]" />
              <Skeleton className="h-3.5 w-[100px]" />
              <Skeleton className="h-3.5 w-[100px]" />
            </div>
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="mt-1 flex flex-1 items-center justify-center text-sm text-muted-foreground">
          No agents yet. Use the plus button to add one.
        </div>
      ) : table.getRowModel().rows.length === 0 ? (
        <div className="mt-1 flex flex-1 items-center justify-center text-sm text-muted-foreground">
          No agents match your search or filters.
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
                        header.column.id === "name" && "w-[240px] pl-2",
                        header.column.id === "provider" && "w-[120px]",
                        header.column.id === "model" && "w-[180px]",
                        header.column.id === "reasoning" && "w-[120px]",
                        header.column.id === "permission_mode" && "w-[140px]",
                        header.column.id === "updated_at" && "w-[120px]",
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
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className="cursor-pointer"
                  onClick={() => onOpenAgent(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        cell.column.id === "select" && "pl-3",
                        cell.column.id === "name" && "pl-2",
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={pendingDelete != null}
        onOpenChange={(open) => { if (!open) { setPendingDelete(null); setDeleteError(""); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete agent?</DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? `This removes "${pendingDelete.name}" from the workspace. Tasks still assigned to it must be reassigned first.`
                : "This removes the agent from the workspace."}
            </DialogDescription>
          </DialogHeader>
          {deleteError ? <p className="text-xs text-destructive">{deleteError}</p> : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setPendingDelete(null); setDeleteError(""); }}
              disabled={deletingId != null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => pendingDelete && void handleDelete(pendingDelete)}
              disabled={deletingId != null}
            >
              {deletingId != null ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
