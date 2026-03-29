import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  type Table,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowUp, ArrowDown, X, Bookmark, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SavedView } from "@/types";

interface Props<TData> {
  table: Table<TData>;
  context: string;
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  columnVisibility: VisibilityState;
  activeView: SavedView | null;
  isDirty: boolean;
  onSaveView: () => void;
  onViewsChange: () => void;
}

const CONDITIONS = ["has any of"] as const;

export default function ActiveFilters<TData>({
  table,
  context,
  sorting,
  columnFilters,
  columnVisibility,
  activeView,
  isDirty,
  onSaveView,
  onViewsChange,
}: Props<TData>) {
  const hasAnything = columnFilters.length > 0 || sorting.length > 0;
  const [savingNew, setSavingNew] = useState(false);
  const [newName, setNewName] = useState("");

  const filterableColumns = useMemo(
    () =>
      table
        .getAllColumns()
        .filter((c) => c.getCanFilter()),
    [table],
  );

  const sortableColumns = useMemo(
    () =>
      table
        .getAllColumns()
        .filter((c) => c.getCanSort() && c.id !== "select"),
    [table],
  );

  const handleSaveNew = async () => {
    const name = newName.trim();
    if (!name) return;
    const id = crypto.randomUUID();
    await invoke("save_table_view", {
      id,
      name,
      context,
      sorting: JSON.stringify(sorting),
      filters: JSON.stringify(columnFilters),
      visibility: JSON.stringify(columnVisibility),
    });
    setNewName("");
    setSavingNew(false);
    onViewsChange();
  };

  if (!hasAnything) return null;

  const getColumnTitle = (id: string) => {
    const col = table.getColumn(id);
    if (!col) return id;
    const def = col.columnDef;
    // Try to extract title from header if it's a string
    if (typeof def.header === "string") return def.header;
    // Fallback: capitalize the id
    return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-1">
      {/* View name badge */}
      <div className="inline-flex items-center rounded-md border border-border text-xs h-6 overflow-hidden">
        <span className="px-2 h-full inline-flex items-center gap-1.5 bg-muted/50 text-foreground font-medium border-r border-border">
          <Bookmark className="h-3 w-3" />
          {activeView ? activeView.name : "Unsaved view"}
        </span>
        {activeView && isDirty && (
          <button
            className="px-1.5 h-full inline-flex items-center gap-1 hover:bg-muted/50 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            title="Save changes to view"
            onClick={onSaveView}
          >
            <Save className="h-3 w-3" />
          </button>
        )}
        {!activeView && (
          savingNew ? (
            <div className="flex items-center h-full">
              <Input
                autoFocus
                placeholder="Name..."
                className="h-full border-0 rounded-none text-xs w-24 px-1.5 shadow-none focus-visible:ring-0"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveNew();
                  if (e.key === "Escape") setSavingNew(false);
                }}
              />
              <button
                className="px-1.5 h-full hover:bg-muted/50 text-muted-foreground hover:text-foreground cursor-pointer transition-colors disabled:opacity-50"
                disabled={!newName.trim()}
                onClick={handleSaveNew}
              >
                <Save className="h-3 w-3" />
              </button>
              <button
                className="px-1.5 h-full hover:bg-muted/50 text-muted-foreground cursor-pointer transition-colors"
                onClick={() => setSavingNew(false)}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              className="px-1.5 h-full inline-flex items-center gap-1 hover:bg-muted/50 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              title="Save as new view"
              onClick={() => setSavingNew(true)}
            >
              <Save className="h-3 w-3" />
            </button>
          )
        )}
      </div>

      {/* Filter badges */}
      {columnFilters.map((filter) => {
        const values = filter.value as string[];
        const columnId = filter.id;

        return (
          <div
            key={`filter-${columnId}`}
            className="inline-flex items-center rounded-md border border-border text-xs h-6 overflow-hidden"
          >
            {/* Column segment */}
            <DropdownMenu>
              <DropdownMenuTrigger className="px-2 h-full bg-muted/50 hover:bg-muted text-foreground font-medium cursor-pointer transition-colors border-r border-border">
                {getColumnTitle(columnId)}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="text-xs">
                {filterableColumns.map((col) => (
                  <DropdownMenuItem
                    key={col.id}
                    className="text-xs"
                    disabled={col.id === columnId}
                    onClick={() => {
                      // Move filter to new column
                      const column = table.getColumn(columnId);
                      column?.setFilterValue(undefined);
                      const newCol = table.getColumn(col.id);
                      newCol?.setFilterValue(values);
                    }}
                  >
                    {getColumnTitle(col.id)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Condition segment */}
            <DropdownMenu>
              <DropdownMenuTrigger className="px-2 h-full hover:bg-muted/50 text-muted-foreground cursor-pointer transition-colors border-r border-border">
                has any of
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="text-xs">
                {CONDITIONS.map((cond) => (
                  <DropdownMenuItem key={cond} className="text-xs" disabled>
                    {cond}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Values segment */}
            <FilterValuesDropdown
              table={table}
              columnId={columnId}
              values={values}
            />

            {/* Remove button */}
            <button
              className="px-1.5 h-full hover:bg-destructive/10 hover:text-destructive text-muted-foreground cursor-pointer transition-colors"
              onClick={() => {
                const column = table.getColumn(columnId);
                column?.setFilterValue(undefined);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}

      {/* Sort badges */}
      {sorting.map((sort) => (
        <div
          key={`sort-${sort.id}`}
          className="inline-flex items-center rounded-md border border-border text-xs h-6 overflow-hidden"
        >
          {/* Column segment */}
          <DropdownMenu>
            <DropdownMenuTrigger className="px-2 h-full bg-muted/50 hover:bg-muted text-foreground font-medium cursor-pointer transition-colors border-r border-border">
              {getColumnTitle(sort.id)}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="text-xs">
              {sortableColumns.map((col) => (
                <DropdownMenuItem
                  key={col.id}
                  className="text-xs"
                  disabled={col.id === sort.id}
                  onClick={() => {
                    // Replace sort column
                    const newSorting = sorting.map((s) =>
                      s.id === sort.id ? { ...s, id: col.id } : s,
                    );
                    table.setSorting(newSorting);
                  }}
                >
                  {getColumnTitle(col.id)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Direction segment */}
          <button
            className="px-2 h-full inline-flex items-center gap-1 hover:bg-muted/50 text-muted-foreground cursor-pointer transition-colors border-r border-border"
            onClick={() => {
              const newSorting = sorting.map((s) =>
                s.id === sort.id ? { ...s, desc: !s.desc } : s,
              );
              table.setSorting(newSorting);
            }}
          >
            {sort.desc ? (
              <>
                <ArrowDown className="h-3 w-3" />
                <span>Desc</span>
              </>
            ) : (
              <>
                <ArrowUp className="h-3 w-3" />
                <span>Asc</span>
              </>
            )}
          </button>

          {/* Remove button */}
          <button
            className="px-1.5 h-full hover:bg-destructive/10 hover:text-destructive text-muted-foreground cursor-pointer transition-colors"
            onClick={() => {
              const newSorting = sorting.filter((s) => s.id !== sort.id);
              table.setSorting(newSorting);
            }}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}

      {/* Clear all */}
      {(columnFilters.length + sorting.length) > 1 && (
        <Button
          variant="ghost"
          size="xs"
          className="h-6 text-xs text-muted-foreground"
          onClick={() => {
            table.resetColumnFilters();
            table.resetSorting();
          }}
        >
          Clear all
        </Button>
      )}
    </div>
  );
}

/** Separate component for filter values dropdown so faceted values are only computed when open */
function FilterValuesDropdown<TData>({
  table,
  columnId,
  values,
}: {
  table: Table<TData>;
  columnId: string;
  values: string[];
}) {
  const column = table.getColumn(columnId);
  const facetedValues = column?.getFacetedUniqueValues();

  const uniqueValues = useMemo(() => {
    if (!facetedValues) return [];
    return Array.from(facetedValues.keys())
      .map((v) => (v == null ? "__null__" : String(v)))
      .sort((a, b) => {
        if (a === "__null__") return 1;
        if (b === "__null__") return -1;
        return a.localeCompare(b);
      });
  }, [facetedValues]);

  const displayValues = values
    .map((v) => (v === "__null__" ? "empty" : v))
    .join(", ");

  const toggleValue = (val: string) => {
    const next = values.includes(val)
      ? values.filter((v) => v !== val)
      : [...values, val];
    column?.setFilterValue(next.length ? next : undefined);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="px-2 h-full hover:bg-muted/50 text-foreground cursor-pointer transition-colors border-r border-border max-w-[200px] truncate">
        {displayValues}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="text-xs">
        <div className="max-h-[200px] overflow-y-auto">
          {uniqueValues.map((val) => (
            <DropdownMenuCheckboxItem
              key={val}
              checked={values.includes(val)}
              onCheckedChange={() => toggleValue(val)}
              onSelect={(e) => e.preventDefault()}
              className="text-xs"
            >
              {val === "__null__" ? (
                <span className="italic text-muted-foreground/50">empty</span>
              ) : (
                val
              )}
            </DropdownMenuCheckboxItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
