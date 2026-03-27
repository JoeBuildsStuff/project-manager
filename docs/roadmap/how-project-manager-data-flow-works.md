# Project Manager Data Flow (End-to-End)

This document explains how the app works from first launch through workspace setup, sync, and the main read path — including known gaps in the current onboarding experience.

## Big Picture

Project Manager is a Tauri desktop app with four layers:

- **React frontend** (`src/`) — UI state, filtering, and user interactions.
- **Rust backend** (`src-tauri/src/commands.rs`) — filesystem, SQLite, git, and process execution.
- **Workspace-local SQLite** (`project-metadata.sqlite`) — the primary data source for the UI.
- **Workspace Python script** (`scripts/update-readme-repo-from-git.py`) — populates and refreshes SQLite from the filesystem and git history.

The UI is a read-only client over SQLite. It has no ability to discover projects on its own. All project data enters the DB through the sync script. **The app is non-functional for project discovery without that script present in the selected workspace.**

---

## 1) First Launch

On startup:

1. Rust reads app config from `~/Library/Application Support/com.joebuilds.project-manager/config.json`.
2. A workspace is considered **configured** only if `<workspace>/project-metadata.sqlite` exists on disk.
3. Frontend calls `get_workspace_config`.
4. If not configured, the UI renders onboarding (`WorkspaceSetup`).

The app does not auto-create a workspace on install. The user must pick a folder first.

---

## 2) Onboarding: Selecting a Workspace Folder

The `WorkspaceSetup` screen lets the user pick a directory. On confirmation:

1. Frontend calls `set_workspace_path(path)`.
2. Rust validates the path is a directory, then:
   - Creates `<workspace>/project-metadata.sqlite` if missing.
   - Creates `<workspace>/README.md` **only if one does not already exist**, with a short stub describing the workspace.
   - Writes `workspace_path` to `config.json`.
   - Updates in-memory workspace state immediately.
3. Frontend receives success and transitions to the main UI.

**Important:** after this step, the SQLite DB exists but is empty. The table will show zero projects. There is currently no auto-sync triggered and no empty-state guidance shown to the user — this is a known UX gap (see Section 6).

---

## 3) Main Read Path

Once the workspace is configured, the main UI loads data via:

- `get_projects(...)` — reads rows from `project_metadata` with active filters and search applied.
- `get_filter_options()` — loads distinct deploy platforms and hosts for sidebar filters.
- `get_diff_stats()` — runs lazily after the initial project list renders, computing line additions/removals from git diffs and merging them into the project rows.

SQLite is the single source of truth for everything shown in the table. The UI never reads the filesystem or git directly.

**Known limitation:** diff stats are only fetched once per session, when the project list first loads with `lines_added == null` for all rows. Projects added by a subsequent sync in the same session will not have diff stats populated until the app is restarted.

---

## 4) What Sync Actually Does

When the user presses **Sync**:

1. Frontend calls `run_sync_scripts`.
2. Rust runs `python3 scripts/update-readme-repo-from-git.py` with `cwd` set to the selected workspace.
3. After the command exits (success or failure), frontend calls `load()` to refresh the table.

**Known bug:** errors from `run_sync_scripts` are silently swallowed in `handleSync`. The spinner completes and the table reloads regardless of whether the script succeeded, failed, or was missing. The user gets no feedback on failure.

```ts
// App.tsx — error is caught and discarded
const handleSync = async () => {
  setSyncing(true);
  try {
    await invoke<string>("run_sync_scripts");
  } catch {
    // silent
  } finally {
    setSyncing(false);
    await load();
  }
};
```

---

## 5) What the Sync Script Does

`scripts/update-readme-repo-from-git.py` is primarily a DB population script despite its name.

It:

- Connects to `<workspace>/project-metadata.sqlite`.
- Ensures/migrates the schema via `metadata_db.ensure_schema`.
- Discovers folders at the workspace root, excluding `.git`, `node_modules`, `logs`, etc.
- Handles bucket folders (`01-active`, `02-reference`, `03-inbox`, `04-archive`) by iterating their children instead.
- Includes specific nested projects listed in `NESTED_PROJECTS`.
- **Skips any folder without a `README.md` or `readme.md`.** This means a brand-new workspace where subfolders have no READMEs will remain empty after sync.
- For each qualifying folder:
  - Resolves remote URL (origin, fallback upstream).
  - Detects host (`GitHub`, `Gitea`, etc.).
  - Computes `git_remote_normalized` (`owner/repo` for GitHub remotes).
  - Collects commit stats (`commit_count`, `last_commit_date`, `days_since_last_commit`).
  - Upserts the row via `upsert_repo_host(...)`.
  - Extracts a short description from the README and writes it via `upsert_description(...)`.
- Prunes DB rows whose folders no longer exist on disk (`prune_orphaned`).

This script does **not** create the workspace README stub — that is handled by `set_workspace_path` in Rust.

---

## 6) Known Onboarding Gaps

### Empty state after setup
After completing onboarding, the user lands on an empty project table with no explanation and no prompt to sync. The `WorkspaceSetup` copy says "each subfolder becomes a tracked project," but this is misleading — subfolders are only tracked after sync runs successfully, and only if they have a README.

### Silent sync failure
If the sync script is missing or errors, the app behaves identically to a successful sync from the user's perspective. No error toast, no banner, no indication anything went wrong.

### Script is not bundled
The app does not copy `scripts/update-readme-repo-from-git.py` into the selected workspace. It must already exist there. A user pointing the app at an arbitrary folder has no path to a working sync without manually adding the script. This makes the app effectively workspace-specific rather than general-purpose.

### `is_configured` is a weak signal
The configured state only checks whether `project-metadata.sqlite` exists. It does not indicate whether sync has ever run, whether the script is present, or whether the workspace has any data. The UI transitions from onboarding to "ready" without verifying any of these conditions.

---

## 7) Data Ownership Summary

| Store | What it holds |
|---|---|
| `config.json` | Which workspace folder is selected |
| `project-metadata.sqlite` | All project metadata rows shown in the UI |
| Python script | Logic for discovering and populating project rows from filesystem + git |
| React state | In-memory copy of DB rows for rendering; not persisted |

The UI is a thin client over SQLite. Sync is an external pipeline driven entirely by a script that must exist in the workspace. The app itself has no built-in discovery logic.
