import { Component, type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"

import Tiptap from "@/components/tiptap/tiptap"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Input } from "@/components/ui/input"

type NotesDocument = {
  id: string
  title: string
  content: string
  updated_at: string
}

type EditorErrorBoundaryProps = {
  children: ReactNode
}

type EditorErrorBoundaryState = {
  hasError: boolean
  message: string | null
}

class EditorErrorBoundary extends Component<
  EditorErrorBoundaryProps,
  EditorErrorBoundaryState
> {
  state: EditorErrorBoundaryState = {
    hasError: false,
    message: null,
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Unknown error",
    }
  }

  componentDidCatch(error: unknown) {
    console.error("Notes editor crashed", error)
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
      )
    }

    return this.props.children
  }
}

export default function Notes() {
  const [document, setDocument] = useState<NotesDocument | null>(null)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const saveTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false

    void invoke<NotesDocument>("get_notes_document").then((nextDocument) => {
      if (cancelled) {
        return
      }

      setDocument(nextDocument)
      setTitle(nextDocument.title)
      setContent(nextDocument.content)
    })

    return () => {
      cancelled = true
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const saveDocument = useCallback(async (nextTitle: string, nextContent: string) => {
    if (!document) {
      return
    }

    setSaveState("saving")

    try {
      const updated = await invoke<NotesDocument>("save_notes_document", {
        id: document.id,
        title: nextTitle.trim() || "Workspace Notes",
        content: nextContent,
      })

      setDocument(updated)
      setTitle(updated.title)
      setContent(updated.content)
      setSaveState("saved")
      window.setTimeout(() => {
        setSaveState((current) => (current === "saved" ? "idle" : current))
      }, 1200)
    } catch {
      setSaveState("error")
    }
  }, [document])

  const queueSave = useCallback((nextTitle: string, nextContent: string) => {
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      saveTimeoutRef.current = null
      void saveDocument(nextTitle, nextContent)
    }, 700)
  }, [saveDocument])

  const handleTitleChange = useCallback((nextTitle: string) => {
    setTitle(nextTitle)
    queueSave(nextTitle, content)
  }, [content, queueSave])

  const handleContentChange = useCallback((nextContent: string) => {
    setContent(nextContent)
    queueSave(title, nextContent)
  }, [queueSave, title])

  const handleTitleBlur = useCallback(() => {
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }

    void saveDocument(title, content)
  }, [content, saveDocument, title])

  return (
    <div className="m-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-background">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <SidebarTrigger className="-ml-1" />
        <h1 className="text-sm font-medium">Notes</h1>
        <div className="ml-auto text-xs text-muted-foreground">
          {saveState === "saving" ? "Saving..." : null}
          {saveState === "saved" ? "Saved" : null}
          {saveState === "error" ? "Save failed" : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <Input
          value={title}
          onChange={(event) => handleTitleChange(event.target.value)}
          onBlur={handleTitleBlur}
          placeholder="Workspace Notes"
          aria-label="Note title"
        />

        <div className="min-h-0 flex-1 overflow-hidden">
          {document ? (
            <EditorErrorBoundary>
              <Tiptap
                content={content}
                onChange={handleContentChange}
                showFixedMenu
                showBubbleMenu
                enableFileNodes={false}
                commentsDocumentId={document.id}
              />
            </EditorErrorBoundary>
          ) : (
            <div className="h-full rounded-md border bg-card" />
          )}
        </div>
      </div>
    </div>
  )
}
