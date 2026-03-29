import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Bookmark, Check, Plus, Trash2, Save } from "lucide-react";
import type { SortingState, ColumnFiltersState, VisibilityState } from "@tanstack/react-table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SavedView } from "@/types";

interface Props {
  views: SavedView[];
  activeViewId: string | null;
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  columnVisibility: VisibilityState;
  onLoadView: (view: SavedView) => void;
  onViewsChange: () => void;
}

export default function SavedViewPicker({
  views,
  activeViewId,
  sorting,
  columnFilters,
  columnVisibility,
  onLoadView,
  onViewsChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");

  const handleSave = async () => {
    const name = newName.trim();
    if (!name) return;
    const id = crypto.randomUUID();
    await invoke("save_table_view", {
      id,
      name,
      sorting: JSON.stringify(sorting),
      filters: JSON.stringify(columnFilters),
      visibility: JSON.stringify(columnVisibility),
    });
    setNewName("");
    setSaving(false);
    onViewsChange();
  };

  const handleOverwrite = async (view: SavedView) => {
    await invoke("save_table_view", {
      id: view.id,
      name: view.name,
      sorting: JSON.stringify(sorting),
      filters: JSON.stringify(columnFilters),
      visibility: JSON.stringify(columnVisibility),
    });
    onViewsChange();
  };

  const handleDelete = async (id: string) => {
    await invoke("delete_table_view", { id });
    onViewsChange();
  };

  const hasState =
    sorting.length > 0 ||
    columnFilters.length > 0 ||
    Object.values(columnVisibility).some((v) => v === false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
      >
        <Bookmark
          className={cn(
            "h-3.5 w-3.5",
            activeViewId && "fill-current",
          )}
        />
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" sideOffset={6} className="w-56 p-1">
        {views.length === 0 && !saving && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            No saved views yet.
          </p>
        )}

        {views.map((view) => (
          <div
            key={view.id}
            className="group flex items-center gap-1 rounded-sm px-2 py-1.5 text-xs hover:bg-accent"
          >
            <button
              className="flex flex-1 items-center gap-2 text-left"
              onClick={() => {
                onLoadView(view);
                setOpen(false);
              }}
            >
              {activeViewId === view.id ? (
                <Check className="h-3 w-3 shrink-0" />
              ) : (
                <span className="h-3 w-3 shrink-0" />
              )}
              <span className="truncate">{view.name}</span>
            </button>
            <button
              className="hidden shrink-0 text-muted-foreground hover:text-foreground group-hover:block"
              title="Update view with current state"
              onClick={(e) => {
                e.stopPropagation();
                handleOverwrite(view);
              }}
            >
              <Save className="h-3 w-3" />
            </button>
            <button
              className="hidden shrink-0 text-muted-foreground hover:text-destructive group-hover:block"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(view.id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}

        {saving ? (
          <div className="flex items-center gap-1 px-1 py-1">
            <Input
              autoFocus
              placeholder="View name…"
              className="h-6 text-xs"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setSaving(false);
              }}
            />
            <Button
              size="sm"
              className="h-6 px-2 text-xs"
              disabled={!newName.trim()}
              onClick={handleSave}
            >
              Save
            </Button>
          </div>
        ) : (
          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            disabled={!hasState}
            onClick={() => setSaving(true)}
          >
            <Plus className="h-3 w-3" />
            Save current view
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
