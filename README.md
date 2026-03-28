# project-manager

Native macOS desktop app for managing the CodeProjects3 workspace. Reads `project-metadata.sqlite`, provides filtering/sorting/search across ~100 projects, and quick actions to open in Finder, Cursor, browser, or repo.

## Stack

- **Frontend:** React 18 + TypeScript + Vite, TanStack Table, shadcn/ui, Tailwind CSS
- **Backend:** Rust (Tauri v2) with `rusqlite` (bundled SQLite)
- **Data source:** `../project-metadata.sqlite` (workspace root, gitignored)

## Running

```bash
# Prerequisites: Rust (rustup), Node 20+, pnpm
pnpm install
pnpm tauri dev
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

### Sidebar filters
Filter by Status (`active`, `inbox`, `archived`), Category (`project`, `reference`, `tooling`), Deploy Platform (`vercel`, `hetzner`, `homelab`), and Host (`GitHub`, `Gitea`). Each filter shows a count badge. Filters are additive.

### Project table
Sortable columns: name, category, description, status, deploy platform, host, commit count, lines added/removed, last commit date. Column headers support sorting and visibility toggling. Row selection for bulk operations.

### Search
Fuzzy search across project name, description, and folder key.

### Detail panel
Slide-out sheet on row click with:
- Quick actions: Open in Finder, Cursor, live site, repo URL
- Inline status dropdown (active / inbox / archived)
- All metadata fields
- Live git status (clean/dirty indicator)
- Rename and delete with guardrails (checks git state, production URL, deploy platform)

### Sync
Toolbar button runs `scripts/update-readme-repo-from-git.py` from the workspace root, then refreshes the table. Picks up new folders, prunes deleted ones, updates commit stats.

### New project
Dialog to create a new project folder on disk and insert a DB row.

## Data conventions

The app expects `NULL` for unknown values — not `"N/A"`, `"none"`, or empty strings. `NULL` columns render as blank space in the table. The sync scripts enforce this at write time.

## Structure

```
src/
  App.tsx               # Root layout, state, Tauri command calls
  types.ts              # Project interface, filter types, guardrails
  components/
    Sidebar.tsx         # Status + category + deploy + host filters
    Toolbar.tsx         # Search, sync button, view options, dark mode
    ProjectTable.tsx    # TanStack Table with sorting, selection, bulk actions
    ProjectDetail.tsx   # Detail sheet with quick actions, status, git status
    StatusBadge.tsx     # Colored badges for status, category, deploy platform
src-tauri/
  src/
    commands.rs         # Tauri commands: DB reads, git ops, file ops, sync
    lib.rs              # Tauri builder + plugin registration
    main.rs             # Entry point
```

## Self-referential

This app lives inside the workspace it manages (`CodeProjects3/project-manager/`). When the sync scripts scan the workspace, they find this folder and add it as a row in the very database this app reads. It tracks itself.
