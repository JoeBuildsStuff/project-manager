# Roadmap: TipTap Image Storage (Tauri)

This document records the **current behavior** of images in the workspace Notes editor, why it is a poor long-term fit for a desktop app, and a **recommended direction** for storing and rendering images without embedding huge payloads in saved HTML.

The chosen direction in this document is:

- **Store attachment binaries as workspace-local files**
- **Track them in a SQLite metadata table**
- **Keep only stable attachment references in note HTML**

---

## Current behavior (summary)

- **Insert path:** Drop and paste are handled in `src/components/tiptap/file-handler.tsx`. **Image** files are read in the browser with `FileReader` and inserted as TipTap `image` nodes whose `src` is a **`data:` URL** (base64 inline). Non-image files use `uploadFile` from `supabase-file-manager.ts` and insert `fileNode` with a storage-style path (that path is a legacy from shared TipTap code; in this Tauri app there is no Supabase upload pipeline unless wired separately).
- **Persistence:** The editor serializes with `editor.getHTML()`. Notes are saved via Tauri (`save_notes_document`), so the **entire image bytes live inside the HTML string** stored with the document.
- **Rendering:** `custom-image-view.tsx` treats `http`, `data:`, and `blob:` as direct image sources.

### Problems with inline images at scale

- **Document size:** Large base64 strings bloat every autosave and SQLite/JSON row.
- **Performance:** Parsing and diffing huge HTML, memory in the WebView, and janky typing when the doc grows.
- **Portability / tooling:** Backups, search, and future sync become harder when binary is mixed into prose HTML.
- **No deduplication:** The same image pasted twice is stored twice.

---

## Target behavior

1. **Binary lives outside the HTML** — as files inside the selected workspace, never as permanent `data:` URLs in the canonical document.
2. **The document stores a stable reference** — an opaque `attachment_id` in the note HTML, not a raw filesystem path.
3. **SQLite tracks attachment metadata** — each attachment row records which note owns it and where its file lives relative to the workspace.
4. **The WebView gets a loadable URL** — resolve `attachment_id` through a Tauri command or protocol into a displayable URL.
5. **Lifecycle:** attachment cleanup happens after successful note saves or note deletion, not on every transient editor delete event.

---

## Suggested implementation phases

### Phase 1 — Storage API (Rust)

- Add a `note_attachments` table in the workspace SQLite DB, for example:

```sql
CREATE TABLE IF NOT EXISTS note_attachments (
  id           TEXT PRIMARY KEY,
  document_id  TEXT NOT NULL REFERENCES notes_documents(id) ON DELETE CASCADE,
  rel_path     TEXT NOT NULL,
  mime         TEXT NOT NULL,
  filename     TEXT,
  size_bytes   INTEGER NOT NULL,
  sha256       TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);
```

- Store files under a workspace-local directory such as:

```text
<workspace>/.project-manager/notes/<attachment-id>.<ext>
```

- Add commands such as:
  - `save_note_attachment(document_id, bytes, mime, filename?) -> attachment_id`
  - `get_note_attachment_url(attachment_id) -> url`
  - `delete_note_attachment(attachment_id) -> ok`
- Store `rel_path` relative to the workspace root so the workspace remains portable when moved or copied.
- Optionally compute `sha256` to support future deduplication, but do not block the first implementation on that.

### Phase 2 — TipTap integration

- Change `file-handler.tsx`: on image drop/paste, call the Rust save command, then insert `image` with `src` set to an opaque reference such as `attachment:<id>`, not a `data:` URL and not a raw path.
- Update `custom-image-view.tsx`: if `src` is an attachment reference, resolve it through the Tauri attachment API before setting `<img src>`.
- Apply the same resolver pattern to non-image file previews so the app stops depending on the legacy `/api/files/*` web-style abstraction.
- Optionally show a temporary loading state while the attachment is being written to disk.

### Phase 3 — Migration (optional)

- One-shot or script: load existing notes HTML, find `data:` images, extract and save as attachments, rewrite `src` to references.
- Or: migrate lazily on open/save when a note still contains `data:` URLs.
- Preserve existing rendered width / height attributes when rewriting image nodes.

### Phase 4 — Cleanup

- On successful note save: parse saved HTML, collect referenced attachment ids, diff against `note_attachments`, and delete rows/files no longer referenced.
- Do not delete attachment files immediately when a node is removed from the editor, because undo or failed saves could otherwise destroy still-needed files.
- A periodic GC command is optional, but the primary cleanup path should be tied to successful saves.
- On note delete: remove all attachments for that note.

---

## Implementation decisions

- **Files over SQLite BLOBs:** Notes may contain many or large images, so file-backed attachments are preferred to avoid growing the main workspace DB with large binary payloads.
- **Workspace-local storage:** Notes already live in workspace-local SQLite, so attachments should live in the workspace too for portability, backup, and copy/move safety.
- **Metadata table required:** File-backed storage still needs a DB table so ownership, cleanup, and future deduplication remain explicit.
- **Opaque refs over raw paths:** Store `attachment:<id>` in HTML, not direct filesystem paths, so storage layout can evolve without rewriting note content.
- **Single resolver path:** Pick one Tauri-native resolution strategy for attachments and use it consistently across image nodes and file nodes.

---

## References in repo

- `src/components/tiptap/file-handler.tsx` — image insert (currently data URLs).
- `src/components/tiptap/custom-image-view.tsx` — resolution and display.
- `src/components/tiptap/supabase-file-manager.ts` — current legacy `/api/files/*` abstraction to replace for Tauri-native attachments.
- `src/components/Notes.tsx` — `save_notes_document` / HTML persistence.
- `src-tauri/src/commands.rs` — workspace-local notes SQLite and future attachment commands/table.
- `docs/roadmap/how-project-manager-data-flow-works.md` — broader app data flow.

---

*Last updated: 2026-03-29*
