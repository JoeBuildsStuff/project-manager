# Roadmap: TipTap Image Storage (Tauri)

This document records the **current behavior** of images in the workspace Notes editor, why it is a poor long-term fit for a desktop app, and a **recommended direction** for storing and rendering images without embedding huge payloads in saved HTML.

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

1. **Binary lives outside the HTML** — either as files under the app (or workspace) data directory, or as BLOBs in a dedicated table — never as permanent `data:` URLs in the canonical document.
2. **The document stores a stable reference** — e.g. attachment UUID, relative path from an app root, or `attachment_id` that maps in Rust/SQLite.
3. **The WebView gets a loadable URL** — e.g. Tauri **custom protocol** or **`asset://`**, or a small Rust command that returns a temporary file URL / bytes (choose one strategy and stay consistent with security allowlists).
4. **Lifecycle:** Deleting an image from the editor or deleting the note triggers **orphan cleanup** (or a periodic GC of unreferenced attachment ids).

---

## Suggested implementation phases

### Phase 1 — Storage API (Rust)

- Add commands such as `save_note_attachment(note_id | document_id, bytes, mime) -> attachment_id` and `get_note_attachment_url(attachment_id)` (or resolve path for protocol).
- Store files under something like `<app_data>/notes-attachments/{id}.{ext}` or use a SQLite `attachments` table if a single-file backup is preferred.
- Extend the notes schema (or side table) to track **which attachments belong to which note** for GC.

### Phase 2 — TipTap integration

- Change `file-handler.tsx`: on image drop/paste, call the Rust save command, then insert `image` with `src` set to the **reference** (not `data:`). Optionally show a small loading state during write.
- Update `custom-image-view.tsx`: if `src` is a reference (not `http`/`data`/`blob`), resolve it through the Tauri command or custom URL scheme before setting `<img src>`.

### Phase 3 — Migration (optional)

- One-shot or script: load existing notes HTML, find `data:` images, extract and save as attachments, rewrite `src` to references.
- Or: migrate lazily on open when a note still contains `data:` URLs.

### Phase 4 — Cleanup

- On note save or on interval: parse HTML (or track refs in doc metadata), diff referenced attachment ids, delete files/rows no longer referenced.
- On note delete: remove all attachments for that note.

---

## Open decisions

- **Files vs SQLite BLOBs:** Files are simpler for large images and keep the DB small; BLOBs simplify “one file to copy” backups.
- **Custom protocol vs command:** Custom protocols give normal `<img src>` behavior; commands returning paths require careful temp-file handling versus **forbidden** `file://` restrictions in WebView on some platforms.
- **Workspace vs global app data:** If notes are workspace-scoped, attachment roots should probably live next to the workspace (or in config) so switching workspaces does not break paths.

---

## References in repo

- `src/components/tiptap/file-handler.tsx` — image insert (currently data URLs).
- `src/components/tiptap/custom-image-view.tsx` — resolution and display.
- `src/components/Notes.tsx` — `save_notes_document` / HTML persistence.
- `docs/roadmap/how-project-manager-data-flow-works.md` — broader app data flow.

---

*Last updated: 2026-03-29*
