# project-manager

Native desktop app (Tauri) for managing a **workspace folder** full of git projects: inventory and metadata in SQLite, a sortable project table, per-project tasks, and a TipTap-based notes workspace with local attachments and comments. Optional **Check for updates** when distributed builds are configured.

## Stack

- **Frontend:** React 18 + TypeScript + Vite, TanStack Table, shadcn/ui-style components, Tailwind CSS, TipTap
- **Backend:** Rust (Tauri v2) with `rusqlite` (bundled SQLite), git and filesystem integration
- **Data:** `project-metadata.sqlite` lives **inside the workspace folder** you choose (typically gitignored there)

## First run & workspace

On first launch you pick a **workspace directory**. The app creates (or opens) `project-metadata.sqlite` there and can write a workspace `README.md`. Each immediate subfolder under that directory is treated as a project root (with support for grouped/bucket folders as implemented in sync). You can change the workspace later under **Settings**.

## Running

```bash
# Prerequisites: Rust (rustup), Node 20+, pnpm
pnpm install
pnpm tauri dev
```

For a dev build with a separate app id/name (`Project Manager Dev`), use:

```bash
pnpm run tauri:dev
```

## Building

```bash
pnpm tauri build
# Output: src-tauri/target/release/bundle/
```

### macOS: opening the distributed app

This app is not distributed with an Apple Developer–signed, notarized build. After copying **Project Manager.app** to `/Applications`, Gatekeeper may block it or show security warnings because of quarantine attributes on the bundle.

Clear extended attributes on the app once:

```bash
xattr -cr "/Applications/Project Manager.app"
```

Adjust the path if you installed the app somewhere else.

## Features

### Projects

- **Sidebar filters:** Status, category, deploy platform, host, and **stage** (values are driven by your data). Count badges; filters combine (AND).
- **Client-side filtering:** Instant filter/search after projects are loaded.
- **Project table:** Sorting, column visibility, row selection and bulk delete, task count hints, **saved views** (sorting, filters, column layout) per context.
- **Search:** Case-insensitive substring match on folder key, display name, and description (not fuzzy ranking).
- **Detail sheet:** Open in Finder, editor, live site, repo URL; edit status and fields; live git clean/dirty; rename/delete with guardrails.
- **Sync:** Toolbar action runs in-app **Rust** sync: discovers folders, refreshes git/README-derived fields, upserts rows, prunes missing folders; then refreshes diff line stats and task counts.
- **New project:** Create a folder on disk and insert metadata.

### Tasks

- **Tasks** view lists tasks for the whole workspace or **scoped to one project** (e.g. from the project table or detail flow).
- Table features mirror the projects side where applicable (sorting, filters, saved views).

### Notes

- **Notes** view: multiple documents, TipTap editor (rich text, markdown-related tooling, tables, code blocks, etc.).
- **Attachments:** Files and images stored via Tauri commands (local to your machine / workspace DB), not requiring cloud setup in the default stub client paths.
- **Comments:** Threaded comments anchored to selections; persisted through the app backend (SQLite).

### Settings & integrations

- **Settings:** Change workspace path; optional **GitHub personal access token** (stored in the system keychain) for features that call the GitHub API (e.g. updating a repository homepage URL from the app).
- **Updates:** When built with the updater configured, the app can check for and install newer releases (also exposed from the native menu where enabled).

## Data conventions

The app expects `NULL` for unknown values — not `"N/A"`, `"none"`, or empty strings. `NULL` columns render as blank in tables. Writes from sync and edits should keep that invariant.

## Repository layout (high level)

```
src/
  App.tsx                 # Shell: views, workspace gate, Tauri calls
  types.ts                # Shared types, filters, guardrails
  components/
    ProjectTable.tsx       # Projects grid + toolbar + saved views
    ProjectDetail.tsx     # Detail sheet
    TaskTable.tsx         # Tasks grid
    TaskDetail.tsx
    Notes.tsx             # Notes shell
    Settings.tsx          # Workspace + GitHub token
    WorkspaceSetup.tsx    # First-run folder picker
    Toolbar.tsx, ActiveFilters.tsx, SavedViewPicker.tsx
    sidebar/              # AppSidebar and per-view sidebar content
    tiptap/               # Editor, menus, comments, attachments
    ui/                   # Shared UI primitives
src-tauri/
  src/
    commands.rs           # DB, git, sync, tasks, notes, secrets, etc.
    lib.rs
    main.rs
```

## Self-referential

If you clone this app **inside** the workspace it manages, sync will discover that folder like any other project, so the app can appear as its own row in the same database it opens.
