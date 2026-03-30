import { FilePlusCorner, Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { getNoteIconComponent } from "@/lib/note-icons";
import type { NotesDocumentSummary } from "@/types";

export interface NotesSidebarContentProps {
  notes: NotesDocumentSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  loading?: boolean;
}

export function NotesSidebarContent({
  notes,
  selectedId,
  onSelect,
  onCreate,
  loading = false,
}: NotesSidebarContentProps) {
  return (
    <SidebarGroup className="min-h-0 flex-1 group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="flex items-center justify-between gap-2 pr-1">
        <span>Notes</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="h-7 w-7 shrink-0"
          onClick={onCreate}
          disabled={loading}
          aria-label="New note"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <FilePlusCorner className="size-3.5 text-muted-foreground" />
          )}
        </Button>
      </SidebarGroupLabel>
      <SidebarGroupContent className="min-h-0 max-h-[min(60vh,24rem)] overflow-y-auto pr-1">
        <SidebarMenu className="gap-0.5">
          {notes.length === 0 && !loading ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              No notes yet. Create one with +.
            </p>
          ) : null}
          {notes.map((note) => {
            const Icon = getNoteIconComponent(note.icon_name);
            return (
              <SidebarMenuItem key={note.id}>
                <SidebarMenuButton
                  isActive={note.id === selectedId}
                  className="w-full"
                  tooltip={note.title || "Untitled"}
                  onClick={() => onSelect(note.id)}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">
                    {note.title || "Untitled"}
                  </span>
                  {note.is_favorite ? (
                    <Heart
                      className={cn(
                        "h-3 w-3 shrink-0 fill-primary text-primary",
                        "opacity-90"
                      )}
                      aria-hidden
                    />
                  ) : null}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
