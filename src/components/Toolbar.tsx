import { Search, RefreshCw, Loader2, Plus } from "lucide-react";
import { type Table } from "@tanstack/react-table";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { DataTableViewOptions } from "@/components/ui/data-table-view-options";
import type { Project } from "@/types";

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
          variant="secondary"
          size="sm"
          onClick={onSync}
          disabled={syncing}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync"}
        </Button>
        <DataTableViewOptions table={table} />
        <ModeToggle align="end" />
      </div>
    </div>
  );
}
