import {
  Component,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { Heart, Trash } from "lucide-react";

import Tiptap from "@/components/tiptap/tiptap";
import { NoteIconPicker } from "@/components/note-icon-picker";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  normalizeNoteIconName,
  type NoteIconName,
} from "@/lib/note-icons";
import type { NotesDocument } from "@/types";

type NotesProps = {
  selectedNoteId: string | null;
  onRefreshNotesList: () => Promise<void>;
};

type EditorErrorBoundaryProps = {
  children: ReactNode;
};

type EditorErrorBoundaryState = {
  hasError: boolean;
  message: string | null;
};

class EditorErrorBoundary extends Component<
  EditorErrorBoundaryProps,
  EditorErrorBoundaryState
> {
  state: EditorErrorBoundaryState = {
    hasError: false,
    message: null,
  };

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }

  componentDidCatch(error: unknown) {
    console.error("Notes editor crashed", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center justify-center rounded-md border bg-card px-4 text-sm text-muted-foreground">
          <div className="max-w-lg space-y-2 text-center">
            <div>The notes editor failed to load.</div>
            {this.state.message ? (
              <pre className="overflow-auto rounded bg-muted p-3 text-left text-xs text-foreground">
                {this.state.message}
              </pre>
            ) : null}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function Notes({
  selectedNoteId,
  onRefreshNotesList,
}: NotesProps) {
  const [document, setDocument] = useState<NotesDocument | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [iconName, setIconName] = useState<NoteIconName>(
    normalizeNoteIconName(undefined)
  );
  const [isFavorite, setIsFavorite] = useState(false);
  const [isUpdatingFavorite, setIsUpdatingFavorite] = useState(false);
  const [isUpdatingIcon, setIsUpdatingIcon] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    if (!selectedNoteId) {
      setDocument(null);
      setTitle("");
      setContent("");
      setIconName(normalizeNoteIconName(undefined));
      setIsFavorite(false);
      setLoadError(null);
      setLoadingDoc(false);
      return;
    }

    let cancelled = false;
    setLoadError(null);
    setLoadingDoc(true);

    void invoke<NotesDocument>("get_notes_document_by_id", {
      id: selectedNoteId,
    })
      .then((doc) => {
        if (cancelled) return;
        setDocument(doc);
        setTitle(doc.title);
        setContent(doc.content);
        setIconName(normalizeNoteIconName(doc.icon_name));
        setIsFavorite(doc.is_favorite);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("Could not load this note.");
          setDocument(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDoc(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedNoteId]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const saveDocument = useCallback(
    async (nextTitle: string, nextContent: string) => {
      if (!document) return;

      setSaveState("saving");

      try {
        const updated = await invoke<NotesDocument>("save_notes_document", {
          id: document.id,
          title: nextTitle.trim() || "Untitled",
          content: nextContent,
        });

        setDocument(updated);
        setTitle(updated.title);
        setContent(updated.content);
        setIconName(normalizeNoteIconName(updated.icon_name));
        setIsFavorite(updated.is_favorite);
        setSaveState("saved");
        void onRefreshNotesList();
        window.setTimeout(() => {
          setSaveState((current) => (current === "saved" ? "idle" : current));
        }, 1200);
      } catch {
        setSaveState("error");
      }
    },
    [document, onRefreshNotesList]
  );

  const queueSave = useCallback(
    (nextTitle: string, nextContent: string) => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = window.setTimeout(() => {
        saveTimeoutRef.current = null;
        void saveDocument(nextTitle, nextContent);
      }, 700);
    },
    [saveDocument]
  );

  const handleTitleChange = useCallback(
    (nextTitle: string) => {
      setTitle(nextTitle);
      queueSave(nextTitle, content);
    },
    [content, queueSave]
  );

  const handleContentChange = useCallback(
    (nextContent: string) => {
      setContent(nextContent);
      queueSave(title, nextContent);
    },
    [queueSave, title]
  );

  const handleTitleBlur = useCallback(() => {
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    void saveDocument(title, content);
  }, [content, saveDocument, title]);

  const handleToggleFavorite = useCallback(async () => {
    if (!document || isUpdatingFavorite) return;

    const next = !isFavorite;
    setIsUpdatingFavorite(true);
    setIsFavorite(next);

    try {
      await invoke("set_notes_document_favorite", {
        id: document.id,
        isFavorite: next,
      });
      void onRefreshNotesList();
    } catch {
      setIsFavorite(!next);
      setSaveState("error");
    } finally {
      setIsUpdatingFavorite(false);
    }
  }, [document, isFavorite, isUpdatingFavorite, onRefreshNotesList]);

  const handleIconSelect = useCallback(
    async (nextIconName: NoteIconName) => {
      if (!document || isUpdatingIcon || nextIconName === iconName) return;

      const prev = iconName;
      setIsUpdatingIcon(true);
      setIconName(nextIconName);

      try {
        await invoke("set_notes_document_icon", {
          id: document.id,
          iconName: nextIconName,
        });
        void onRefreshNotesList();
      } catch {
        setIconName(prev);
        setSaveState("error");
      } finally {
        setIsUpdatingIcon(false);
      }
    },
    [document, iconName, isUpdatingIcon, onRefreshNotesList]
  );

  const handleDelete = useCallback(async () => {
    if (!document || isDeleting) return;

    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    setDeleteError(null);
    setIsDeleting(true);

    try {
      await invoke("delete_notes_document", { id: document.id });
      setDeleteOpen(false);
      await onRefreshNotesList();
    } catch {
      setDeleteError("Delete failed");
    } finally {
      setIsDeleting(false);
    }
  }, [document, isDeleting, onRefreshNotesList]);

  return (
    <>
      <div className="m-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-background">
        <div className="flex min-w-0 items-center gap-2 border-b px-3 py-2">
          <SidebarTrigger className="-ml-1 shrink-0" />
          {selectedNoteId && !loadError ? (
            <ButtonGroup className="min-w-0 flex-1">
              <NoteIconPicker
                iconName={iconName}
                isUpdating={isUpdatingIcon}
                onSelect={handleIconSelect}
              />
              <Input
                size="sm"
                value={title}
                onChange={(event) => handleTitleChange(event.target.value)}
                onBlur={handleTitleBlur}
                placeholder="Untitled"
                aria-label="Note title"
                className="min-w-0 flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={isDeleting}
                aria-label="Delete note"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={isUpdatingFavorite}
                aria-label={
                  isFavorite ? "Unfavorite note" : "Favorite note"
                }
                onClick={() => void handleToggleFavorite()}
              >
                <Heart
                  className={`size-4 ${isFavorite ? "fill-current text-primary" : ""}`}
                />
              </Button>
            </ButtonGroup>
          ) : (
            <h1 className="min-w-0 truncate text-sm font-medium">Notes</h1>
          )}
          <div className="ml-auto shrink-0 text-xs text-muted-foreground">
            {saveState === "saving" ? "Saving..." : null}
            {saveState === "saved" ? "Saved" : null}
            {saveState === "error" ? "Save failed" : null}
          </div>
        </div>

        {!selectedNoteId ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <p>No note selected.</p>
            <p className="max-w-xs">
              Choose a note in the sidebar or create one with the + button.
            </p>
          </div>
        ) : loadError ? (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-destructive">
            {loadError}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col p-3">
            <div className="min-h-0 flex-1 overflow-hidden">
              {loadingDoc ? (
                <div className="h-full rounded-md border bg-muted/30" />
              ) : document ? (
                <EditorErrorBoundary>
                  <Tiptap
                    content={content}
                    onChange={handleContentChange}
                    showFixedMenu
                    showBubbleMenu
                    enableFileNodes
                    commentsDocumentId={document.id}
                    attachmentsDocumentId={document.id}
                  />
                </EditorErrorBoundary>
              ) : (
                <div className="h-full rounded-md border bg-card" />
              )}
            </div>
          </div>
        )}
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent showCloseButton={!isDeleting}>
          <DialogHeader>
            <DialogTitle>Delete note</DialogTitle>
            <DialogDescription>
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError ? (
            <p className="text-sm text-destructive">{deleteError}</p>
          ) : null}
          <DialogFooter className="border-0 bg-transparent p-0 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={() => void handleDelete()}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
