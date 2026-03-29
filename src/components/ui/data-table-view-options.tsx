import { Table } from "@tanstack/react-table";
import { Columns, Eye, EyeOff } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
const LABELS: Record<string, string> = {
  folder_name:      "Name",
  description:      "Description",
  status:           "Status",
  deploy_platform:  "Deploy",
  commit_count:     "Commits",
  last_commit_date: "Last commit",
};

export function DataTableViewOptions<TData>({ table }: { table: Table<TData> }) {
  const hideableCols = table.getAllColumns().filter((c) => c.getCanHide());

  return (
    <Popover>
      <PopoverTrigger
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
      >
        <Columns className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" sideOffset={6} className="w-40 p-1">
        {hideableCols.map((col) => {
          const visible = col.getIsVisible();
          return (
            <button
              key={col.id}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent"
              onClick={() => col.toggleVisibility(!visible)}
            >
              {visible
                ? <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                : <EyeOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />}
              <span className={visible ? "" : "opacity-40"}>
                {LABELS[col.id] ?? col.id}
              </span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
