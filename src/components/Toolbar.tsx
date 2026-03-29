import { Search, RefreshCw, Loader2, Plus, X } from "lucide-react";
import {
  type Table,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { DataTableViewOptions } from "@/components/ui/data-table-view-options";
import SavedViewPicker from "@/components/SavedViewPicker";
import type { Project, SavedView } from "@/types";

interface Props {
  table: Table<Project>;
  search: string;
  onSearch: (v: string) => void;
  onSync: () => void;
  onNewProject: () => void;
  syncing: boolean;
  syncMsg: string;
  syncIsError: boolean;
  loading: boolean;
  // Saved views
  savedViews: SavedView[];
  activeViewId: string | null;
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  columnVisibility: VisibilityState;
  onLoadView: (view: SavedView) => void;
  onViewsChange: () => void;
}

export default function Toolbar({
  table,
  search,
  onSearch,
  onSync,
  onNewProject,
  syncing,
  syncMsg,
  syncIsError,
  loading,
  savedViews,
  activeViewId,
  sorting,
  columnFilters,
  columnVisibility,
  onLoadView,
  onViewsChange,
}: Props) {
  return (
    <div className="flex items-center gap-1">
      <SidebarTrigger className="-ml-1" />
      <Button
        size="icon"
        className="h-7 w-7"
        onClick={onNewProject}
      >
        <Plus />
      </Button>
      <InputGroup className="flex-1 h-7">
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          placeholder="Search projects…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        <InputGroupAddon align="inline-end"> 
          <Button variant="ghost" size="icon-xs" onClick={() => onSearch("")} disabled={search === ""}>
            <X />
          </Button>
        </InputGroupAddon>
      </InputGroup>

      <div className="flex shrink-0 items-center gap-1">
        {loading && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
        {syncMsg && !syncing && (
          <span className={`max-w-[180px] truncate text-[11px] ${syncIsError ? "text-destructive" : "text-muted-foreground"}`}>
            {syncMsg}
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onSync}
          disabled={syncing}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : ""}
        </Button>
        <SavedViewPicker
          context="projects"
          views={savedViews}
          activeViewId={activeViewId}
          sorting={sorting}
          columnFilters={columnFilters}
          columnVisibility={columnVisibility}
          onLoadView={onLoadView}
          onViewsChange={onViewsChange}
        />
        <DataTableViewOptions table={table} />
        <ModeToggle align="end" />
      </div>
    </div>
  );
}
