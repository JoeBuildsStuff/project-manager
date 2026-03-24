import { useState } from "react";
import { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
  icon?: React.ReactNode;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  icon,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const [open, setOpen] = useState(false);
  const sorted = column.getIsSorted();
  const canFilter = column.getCanFilter();
  const filterValue = column.getFilterValue() as string[] | undefined;
  const isFiltered = filterValue && filterValue.length > 0;

  if (!column.getCanSort()) {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs", className)}>
        {icon}
        {title}
      </div>
    );
  }

  // Only compute faceted values when the dropdown is open
  let uniqueValues: (string | null)[] = [];
  let facetedValues = new Map<unknown, number>();
  if (open && canFilter) {
    facetedValues = column.getFacetedUniqueValues();
    uniqueValues = Array.from(facetedValues.keys())
      .map((v) => (v == null ? null : String(v)))
      .sort((a, b) => {
        if (a === null) return 1;
        if (b === null) return -1;
        return a.localeCompare(b);
      });
  }

  const toggleFilterValue = (value: string | null) => {
    const current = (column.getFilterValue() as string[] | undefined) ?? [];
    const normalized = value ?? "__null__";
    const next = current.includes(normalized)
      ? current.filter((v) => v !== normalized)
      : [...current, normalized];
    column.setFilterValue(next.length ? next : undefined);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          className={cn(
            "-ml-2 flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground data-[popup-open]:bg-accent data-[popup-open]:text-foreground",
            isFiltered && "text-foreground",
          )}
        >
          {icon}
          <span>{title}</span>
          {isFiltered && (
            <Filter className="h-3 w-3 text-primary" />
          )}
          {sorted === "desc" ? (
            <ArrowDown className="h-3 w-3" />
          ) : sorted === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ChevronsUpDown className="h-3 w-3 opacity-40" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="text-xs">
          <DropdownMenuItem
            className="gap-2 text-xs"
            onClick={() => column.toggleSorting(false)}
          >
            <ArrowUp className="h-3.5 w-3.5" />
            Asc
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2 text-xs"
            onClick={() => column.toggleSorting(true)}
          >
            <ArrowDown className="h-3.5 w-3.5" />
            Desc
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2 text-xs"
            onClick={() => column.toggleVisibility(false)}
          >
            <EyeOff className="h-3.5 w-3.5" />
            Hide
          </DropdownMenuItem>

          {canFilter && uniqueValues.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Filter by value
              </div>
              {isFiltered && (
                <DropdownMenuItem
                  className="gap-2 text-xs text-muted-foreground"
                  onClick={() => column.setFilterValue(undefined)}
                >
                  <X className="h-3.5 w-3.5" />
                  Clear filter
                </DropdownMenuItem>
              )}
              <div className="max-h-[200px] overflow-y-auto">
                {uniqueValues.map((value) => {
                  const normalized = value ?? "__null__";
                  const checked = filterValue?.includes(normalized) ?? false;
                  const count = facetedValues.get(value as unknown) ?? 0;
                  return (
                    <DropdownMenuCheckboxItem
                      key={normalized}
                      checked={checked}
                      onCheckedChange={() => toggleFilterValue(value)}
                      onSelect={(e) => e.preventDefault()}
                      className="gap-2 text-xs"
                    >
                      <span className="flex-1 truncate">
                        {value ?? <span className="italic text-muted-foreground/50">empty</span>}
                      </span>
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {count}
                      </span>
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
