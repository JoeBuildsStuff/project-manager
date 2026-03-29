use crate::config::{self, AppConfig};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Mutex, RwLock};
use tauri_plugin_updater::UpdaterExt;

// ---------------------------------------------------------------------------
// Managed state – set once on startup (or during onboarding), read by all cmds
// ---------------------------------------------------------------------------

pub struct WorkspaceState {
    pub path: RwLock<Option<PathBuf>>,
}

impl WorkspaceState {
    pub fn new() -> Self {
        let config = config::read_config();
        let path = config.workspace_path.map(PathBuf::from).filter(|p| {
            p.join("project-metadata.sqlite").exists()
        });
        Self {
            path: RwLock::new(path),
        }
    }
}

// ---------------------------------------------------------------------------
// Token cache – holds secrets in memory so keychain is only hit once per session
// ---------------------------------------------------------------------------

pub struct TokenCache {
    pub cache: Mutex<std::collections::HashMap<String, String>>,
}

impl TokenCache {
    pub fn new() -> Self {
        Self { cache: Mutex::new(std::collections::HashMap::new()) }
    }
}

// ---------------------------------------------------------------------------
// Update state – holds a pending update between check and install
// ---------------------------------------------------------------------------

pub struct UpdateState {
    pub pending: Mutex<Option<tauri_plugin_updater::Update>>,
}

impl UpdateState {
    pub fn new() -> Self {
        Self { pending: Mutex::new(None) }
    }
}

#[derive(Debug, Serialize)]
pub struct UpdateInfo {
    pub version: String,
    pub body: Option<String>,
}

#[tauri::command]
pub async fn check_for_update(
    app: tauri::AppHandle,
    update_state: tauri::State<'_, UpdateState>,
) -> Result<Option<UpdateInfo>, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    match updater.check().await {
        Ok(Some(update)) => {
            let info = UpdateInfo {
                version: update.version.clone(),
                body: update.body.clone(),
            };
            *update_state.pending.lock().map_err(|e| e.to_string())? = Some(update);
            Ok(Some(info))
        }
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn install_update(
    app: tauri::AppHandle,
    update_state: tauri::State<'_, UpdateState>,
) -> Result<(), String> {
    let update = update_state
        .pending
        .lock()
        .map_err(|e| e.to_string())?
        .take();

    if let Some(update) = update {
        update
            .download_and_install(|_, _| {}, || {})
            .await
            .map_err(|e| e.to_string())?;
        app.restart();
    }

    Ok(())
}

fn workspace(state: &WorkspaceState) -> Result<PathBuf, String> {
    state
        .path
        .read()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or_else(|| "No workspace configured".into())
}

fn db_path(state: &WorkspaceState) -> Result<PathBuf, String> {
    Ok(workspace(state)?.join("project-metadata.sqlite"))
}

fn open_db(state: &WorkspaceState) -> Result<Connection, String> {
    let path = db_path(state)?;
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;
    // Idempotent migration – add stage column if missing
    let _ = conn.execute("ALTER TABLE project_metadata ADD COLUMN stage TEXT", []);

    // Ensure tasks table exists (migration for existing databases)
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS tasks (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            folder_key        TEXT NOT NULL REFERENCES project_metadata(folder_key)
                                ON DELETE CASCADE ON UPDATE CASCADE,
            kind              TEXT NOT NULL DEFAULT 'task',
            title             TEXT NOT NULL,
            description       TEXT,
            status            TEXT NOT NULL DEFAULT 'open',
            priority          TEXT DEFAULT 'medium',
            created_at        TEXT DEFAULT (datetime('now')),
            updated_at        TEXT DEFAULT (datetime('now')),
            completed_at      TEXT
        );",
    )
    .map_err(|e| e.to_string())?;

    // Ensure table_views table exists
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS table_views (
            id         TEXT PRIMARY KEY,
            name       TEXT NOT NULL,
            sorting    TEXT NOT NULL DEFAULT '[]',
            filters    TEXT NOT NULL DEFAULT '[]',
            visibility TEXT NOT NULL DEFAULT '{}',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );",
    )
    .map_err(|e| e.to_string())?;

    Ok(conn)
}

fn workspace_path(state: &WorkspaceState, folder_key: &str) -> Result<PathBuf, String> {
    Ok(workspace(state)?.join(folder_key))
}

// ---------------------------------------------------------------------------
// Workspace config commands
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct WorkspaceConfig {
    pub workspace_path: Option<String>,
    pub is_configured: bool,
}

#[tauri::command]
pub fn get_workspace_config(state: tauri::State<'_, WorkspaceState>) -> Result<WorkspaceConfig, String> {
    let path = state.path.read().map_err(|e| e.to_string())?;
    Ok(WorkspaceConfig {
        workspace_path: path.as_ref().map(|p| p.to_string_lossy().to_string()),
        is_configured: path.is_some(),
    })
}

#[tauri::command]
pub fn set_workspace_path(
    path: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<WorkspaceConfig, String> {
    let workspace_dir = PathBuf::from(&path);
    if !workspace_dir.is_dir() {
        return Err("Selected path is not a directory".into());
    }

    // Create DB if it doesn't exist
    let db_file = workspace_dir.join("project-metadata.sqlite");
    if !db_file.exists() {
        initialize_db(&db_file)?;
    }

    // Create a README in the workspace
    let readme = workspace_dir.join("README.md");
    if !readme.exists() {
        let content = "# Project Manager Workspace\n\n\
            This folder is managed by [Project Manager](https://github.com/JoeBuildsStuff/project-manager).\n\n\
            - `project-metadata.sqlite` — project tracking database\n\
            - Each subfolder is a tracked project\n";
        fs::write(&readme, content).map_err(|e| format!("Failed to write README: {e}"))?;
    }

    // Persist to config
    config::write_config(&AppConfig {
        workspace_path: Some(path.clone()),
    })?;

    // Update in-memory state
    let mut guard = state.path.write().map_err(|e| e.to_string())?;
    *guard = Some(workspace_dir);

    Ok(WorkspaceConfig {
        workspace_path: Some(path),
        is_configured: true,
    })
}

fn initialize_db(db_file: &Path) -> Result<(), String> {
    let conn = Connection::open(db_file).map_err(|e| e.to_string())?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS project_metadata (
            folder_key        TEXT PRIMARY KEY,
            folder_name       TEXT NOT NULL,
            description       TEXT,
            status            TEXT DEFAULT 'inbox',
            category          TEXT DEFAULT 'project',
            repo              TEXT,
            host              TEXT,
            repo_owner        TEXT,
            commit_count      INTEGER,
            last_commit_date  TEXT,
            days_since_last_commit INTEGER,
            deployment        TEXT,
            production_url    TEXT,
            deploy_platform   TEXT,
            vercel_team_slug  TEXT,
            vercel_project_name TEXT,
            lines_added       INTEGER,
            lines_removed     INTEGER,
            updated_at        TEXT DEFAULT (datetime('now')),
            created_at        TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS tasks (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            folder_key        TEXT NOT NULL REFERENCES project_metadata(folder_key)
                                ON DELETE CASCADE ON UPDATE CASCADE,
            kind              TEXT NOT NULL DEFAULT 'task',
            title             TEXT NOT NULL,
            description       TEXT,
            status            TEXT NOT NULL DEFAULT 'open',
            priority          TEXT DEFAULT 'medium',
            created_at        TEXT DEFAULT (datetime('now')),
            updated_at        TEXT DEFAULT (datetime('now')),
            completed_at      TEXT
        );",
    )
    .map_err(|e| e.to_string())?;

    // Idempotent migrations – silently ignored if column already exists
    let _ = conn.execute("ALTER TABLE project_metadata ADD COLUMN lines_added INTEGER", []);
    let _ = conn.execute("ALTER TABLE project_metadata ADD COLUMN lines_removed INTEGER", []);
    let _ = conn.execute("ALTER TABLE project_metadata ADD COLUMN stage TEXT", []);

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS table_views (
            id         TEXT PRIMARY KEY,
            name       TEXT NOT NULL,
            sorting    TEXT NOT NULL DEFAULT '[]',
            filters    TEXT NOT NULL DEFAULT '[]',
            visibility TEXT NOT NULL DEFAULT '{}',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );",
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Project {
    pub folder_key: String,
    pub folder_name: String,
    pub description: Option<String>,
    pub status: Option<String>,
    pub category: Option<String>,
    pub repo: Option<String>,
    pub host: Option<String>,
    pub repo_owner: Option<String>,
    pub commit_count: Option<i64>,
    pub last_commit_date: Option<String>,
    pub lines_added: Option<i64>,
    pub lines_removed: Option<i64>,
    pub days_since_last_commit: Option<i64>,
    pub deployment: Option<String>,
    pub production_url: Option<String>,
    pub deploy_platform: Option<String>,
    pub vercel_team_slug: Option<String>,
    pub vercel_project_name: Option<String>,
    pub stage: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FilterOptions {
    pub deploy_platforms: Vec<String>,
    pub hosts: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitStatus {
    pub folder_key: String,
    pub output: String,
    pub is_dirty: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeleteGuardrails {
    pub folder_key: String,
    pub folder_name: String,
    pub status: Option<String>,
    pub category: Option<String>,
    pub exists_on_disk: bool,
    pub has_git_repo: bool,
    pub has_remote_repo: bool,
    pub remote_url: Option<String>,
    pub git_dirty: bool,
    pub git_status_output: Option<String>,
    pub production_url: Option<String>,
    pub deploy_platform: Option<String>,
    pub nested_tracked_rows: i64,
    pub commit_count: Option<i64>,
    pub last_commit_date: Option<String>,
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

fn repo_path_for_folder(path: &Path) -> Option<PathBuf> {
    if path.join(".git").exists() {
        return Some(path.to_path_buf());
    }

    let entries = fs::read_dir(path).ok()?;
    for entry in entries.flatten() {
        let child = entry.path();
        if !child.is_dir() {
            continue;
        }
        let Some(name) = child.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if name.starts_with('.') {
            continue;
        }
        if child.join(".git").exists() {
            return Some(child);
        }
    }

    None
}

fn git_remote_url(path: &Path, remote: &str) -> Option<String> {
    let output = Command::new("git")
        .args(["-C", path.to_str()?, "remote", "get-url", remote])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() {
        None
    } else {
        Some(stdout)
    }
}

fn git_status_short(path: &Path) -> Option<String> {
    let output = Command::new("git")
        .args(["-C", path.to_str()?, "status", "--short"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&output.stdout).to_string())
}

fn git_diff_line_stats(path: &Path) -> (Option<i64>, Option<i64>) {
    let output = match Command::new("git")
        .args(["-C", path.to_str().unwrap_or_default(), "diff", "--numstat", "HEAD"])
        .output()
    {
        Ok(output) => output,
        Err(_) => return (None, None),
    };

    if !output.status.success() {
        return (None, None);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut added = 0_i64;
    let mut removed = 0_i64;

    for line in stdout.lines() {
        let mut parts = line.split_whitespace();
        let Some(add_str) = parts.next() else {
            continue;
        };
        let Some(remove_str) = parts.next() else {
            continue;
        };

        if let Ok(value) = add_str.parse::<i64>() {
            added += value;
        }
        if let Ok(value) = remove_str.parse::<i64>() {
            removed += value;
        }
    }

    (Some(added), Some(removed))
}

// ---------------------------------------------------------------------------
// Project CRUD commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_projects(
    status_filter: Option<String>,
    category_filter: Option<String>,
    deploy_filter: Option<String>,
    host_filter: Option<String>,
    search: Option<String>,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<Vec<Project>, String> {
    let conn = open_db(&state)?;

    let mut conditions: Vec<String> = vec![];

    if let Some(ref s) = status_filter {
        if !s.is_empty() && s != "all" {
            conditions.push(format!("status = '{}'", s.replace('\'', "''")));
        }
    }

    if let Some(ref c) = category_filter {
        if !c.is_empty() && c != "all" {
            conditions.push(format!("category = '{}'", c.replace('\'', "''")));
        }
    }

    if let Some(ref d) = deploy_filter {
        if !d.is_empty() && d != "all" {
            conditions.push(format!("deploy_platform = '{}'", d.replace('\'', "''")));
        }
    }

    if let Some(ref h) = host_filter {
        if !h.is_empty() && h != "all" {
            conditions.push(format!("host = '{}'", h.replace('\'', "''")));
        }
    }

    if let Some(ref q) = search {
        if !q.is_empty() {
            let q = q.replace('\'', "''");
            conditions.push(format!(
                "(folder_name LIKE '%{q}%' OR description LIKE '%{q}%' OR folder_key LIKE '%{q}%')"
            ));
        }
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let sql = format!(
        "SELECT folder_key, folder_name, description, status, category, repo, host, repo_owner,
                commit_count, last_commit_date, days_since_last_commit,
                deployment, production_url, deploy_platform,
                vercel_team_slug, vercel_project_name,
                lines_added, lines_removed, stage
         FROM project_metadata
         {}
         ORDER BY folder_key",
        where_clause
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Project {
                folder_key: row.get(0)?,
                folder_name: row.get(1)?,
                description: row.get(2)?,
                status: row.get(3)?,
                category: row.get(4)?,
                repo: row.get(5)?,
                host: row.get(6)?,
                repo_owner: row.get(7)?,
                commit_count: row.get(8)?,
                last_commit_date: row.get(9)?,
                lines_added: row.get(16)?,
                lines_removed: row.get(17)?,
                days_since_last_commit: row.get(10)?,
                deployment: row.get(11)?,
                production_url: row.get(12)?,
                deploy_platform: row.get(13)?,
                vercel_team_slug: row.get(14)?,
                vercel_project_name: row.get(15)?,
                stage: row.get(18)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut projects = Vec::new();
    for row in rows {
        projects.push(row.map_err(|e| e.to_string())?);
    }
    Ok(projects)
}

#[tauri::command]
pub fn get_filter_options(
    state: tauri::State<'_, WorkspaceState>,
) -> Result<FilterOptions, String> {
    let conn = open_db(&state)?;

    let mut deploy_values: Vec<String> = Vec::new();
    let mut stmt = conn
        .prepare("SELECT DISTINCT deploy_platform FROM project_metadata WHERE deploy_platform IS NOT NULL ORDER BY deploy_platform")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;
    for row in rows {
        deploy_values.push(row.map_err(|e| e.to_string())?);
    }

    let mut host_values: Vec<String> = Vec::new();
    let mut stmt = conn
        .prepare("SELECT DISTINCT host FROM project_metadata WHERE host IS NOT NULL ORDER BY host")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;
    for row in rows {
        host_values.push(row.map_err(|e| e.to_string())?);
    }

    Ok(FilterOptions {
        deploy_platforms: deploy_values,
        hosts: host_values,
    })
}

#[tauri::command]
pub fn get_project(
    folder_key: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<Option<Project>, String> {
    let conn = open_db(&state)?;
    let ws = workspace(&state)?;
    let mut stmt = conn
        .prepare(
            "SELECT folder_key, folder_name, description, status, category, repo, host, repo_owner,
                    commit_count, last_commit_date, days_since_last_commit,
                    deployment, production_url, deploy_platform,
                    vercel_team_slug, vercel_project_name, stage
             FROM project_metadata WHERE folder_key = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map([&folder_key], |row| {
            let folder_key: String = row.get(0)?;
            let diff_path = ws.join(&folder_key);
            let repo_path = repo_path_for_folder(&diff_path);
            let (lines_added, lines_removed) = repo_path
                .as_deref()
                .map(git_diff_line_stats)
                .unwrap_or((None, None));

            Ok(Project {
                folder_key,
                folder_name: row.get(1)?,
                description: row.get(2)?,
                status: row.get(3)?,
                category: row.get(4)?,
                repo: row.get(5)?,
                host: row.get(6)?,
                repo_owner: row.get(7)?,
                commit_count: row.get(8)?,
                last_commit_date: row.get(9)?,
                lines_added,
                lines_removed,
                days_since_last_commit: row.get(10)?,
                deployment: row.get(11)?,
                production_url: row.get(12)?,
                deploy_platform: row.get(13)?,
                vercel_team_slug: row.get(14)?,
                vercel_project_name: row.get(15)?,
                stage: row.get(16)?,
            })
        })
        .map_err(|e| e.to_string())?;

    if let Some(row) = rows.next() {
        Ok(Some(row.map_err(|e| e.to_string())?))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn update_project_status(
    folder_key: String,
    status: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<(), String> {
    let conn = open_db(&state)?;
    conn.execute(
        "UPDATE project_metadata SET status = ?1 WHERE folder_key = ?2",
        [&status, &folder_key],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_project_stage(
    folder_key: String,
    stage: Option<String>,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<(), String> {
    let conn = open_db(&state)?;
    conn.execute(
        "UPDATE project_metadata SET stage = ?1 WHERE folder_key = ?2",
        rusqlite::params![stage, folder_key],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_project_field(
    folder_key: String,
    field: String,
    value: Option<String>,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<(), String> {
    let column = match field.as_str() {
        "status" | "category" | "stage" | "host" | "deploy_platform" | "production_url" => &field,
        _ => return Err(format!("Field '{}' is not editable", field)),
    };
    println!("[update_project_field] folder={} field={} value={:?}", folder_key, field, value);
    let conn = open_db(&state)?;
    let sql = format!(
        "UPDATE project_metadata SET {} = ?1 WHERE folder_key = ?2",
        column
    );
    conn.execute(&sql, rusqlite::params![value, folder_key])
        .map_err(|e| e.to_string())?;
    println!("[update_project_field] ✓ saved to SQLite");
    Ok(())
}

#[tauri::command]
pub fn open_in_finder(
    folder_key: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<(), String> {
    let path = workspace_path(&state, &folder_key)?;
    Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn open_in_vscode(
    folder_key: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<(), String> {
    let path = workspace_path(&state, &folder_key)?;
    let cursor_result = Command::new("cursor").arg(&path).spawn();
    if cursor_result.is_ok() {
        return Ok(());
    }

    Command::new("open")
        .args(["-a", "Cursor"])
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    Command::new("open")
        .arg(&url)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_git_status(
    folder_key: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<GitStatus, String> {
    let path = workspace_path(&state, &folder_key)?;
    let output = Command::new("git")
        .arg("-C")
        .arg(&path)
        .args(["status", "--short"])
        .output()
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let is_dirty = !stdout.trim().is_empty();

    Ok(GitStatus {
        folder_key,
        output: stdout,
        is_dirty,
    })
}

#[tauri::command]
pub fn get_delete_guardrails(
    folder_key: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<DeleteGuardrails, String> {
    let conn = open_db(&state)?;
    let row = conn
        .query_row(
            "SELECT folder_name, status, category, production_url, deploy_platform, commit_count, last_commit_date
             FROM project_metadata
             WHERE folder_key = ?1",
            [&folder_key],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, Option<i64>>(5)?,
                    row.get::<_, Option<String>>(6)?,
                ))
            },
        )
        .map_err(|e| e.to_string())?;

    let nested_tracked_rows: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM project_metadata WHERE folder_key LIKE ?1",
            [format!("{}/%", folder_key)],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let path = workspace_path(&state, &folder_key)?;
    let exists_on_disk = path.is_dir();
    let repo_path = if exists_on_disk {
        repo_path_for_folder(&path)
    } else {
        None
    };
    let remote_url = repo_path.as_ref().and_then(|repo| {
        git_remote_url(repo, "origin").or_else(|| git_remote_url(repo, "upstream"))
    });
    let git_status_output = repo_path.as_ref().and_then(|repo| git_status_short(repo));
    let git_dirty = git_status_output
        .as_ref()
        .map(|output| !output.trim().is_empty())
        .unwrap_or(false);

    Ok(DeleteGuardrails {
        folder_key,
        folder_name: row.0,
        status: row.1,
        category: row.2,
        exists_on_disk,
        has_git_repo: repo_path.is_some(),
        has_remote_repo: remote_url.is_some(),
        remote_url,
        git_dirty,
        git_status_output,
        production_url: row.3,
        deploy_platform: row.4,
        nested_tracked_rows,
        commit_count: row.5,
        last_commit_date: row.6,
    })
}

#[tauri::command]
pub fn delete_projects(
    folder_keys: Vec<String>,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<usize, String> {
    if folder_keys.is_empty() {
        return Ok(0);
    }

    let ws = workspace(&state)?;
    for folder_key in &folder_keys {
        let path = ws.join(folder_key);
        if path.exists() {
            fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
        }
    }

    let mut conn = open_db(&state)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let mut count = 0;
    for folder_key in &folder_keys {
        let like_pattern = format!("{}/%", folder_key);
        count += tx
            .execute(
                "DELETE FROM project_metadata WHERE folder_key = ?1 OR folder_key LIKE ?2",
                rusqlite::params![folder_key, like_pattern],
            )
            .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(count)
}

#[tauri::command]
pub fn delete_project_folder(
    folder_key: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<usize, String> {
    let path = workspace_path(&state, &folder_key)?;
    if path.exists() {
        fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
    }

    let conn = open_db(&state)?;
    let like_pattern = format!("{}/%", folder_key);
    let count = conn
        .execute(
            "DELETE FROM project_metadata WHERE folder_key = ?1 OR folder_key LIKE ?2",
            rusqlite::params![folder_key, like_pattern],
        )
        .map_err(|e| e.to_string())?;
    Ok(count)
}

#[tauri::command]
pub fn rename_project_folder(
    folder_key: String,
    new_name: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<String, String> {
    let trimmed = new_name.trim();
    if trimmed.is_empty() {
        return Err("New folder name is required.".into());
    }
    if trimmed.contains('/') || trimmed.contains('\\') {
        return Err("Folder name cannot contain path separators.".into());
    }

    let old_path = workspace_path(&state, &folder_key)?;
    if !old_path.is_dir() {
        return Err("Folder does not exist on disk.".into());
    }

    let old_rel = Path::new(&folder_key);
    let parent_rel = old_rel.parent().unwrap_or_else(|| Path::new(""));
    let new_folder_key = if parent_rel.as_os_str().is_empty() {
        trimmed.to_string()
    } else {
        parent_rel.join(trimmed).to_string_lossy().to_string()
    };

    if new_folder_key == folder_key {
        return Ok(new_folder_key);
    }

    let ws = workspace(&state)?;
    let new_path = ws.join(&new_folder_key);
    if new_path.exists() {
        return Err("A folder with that name already exists.".into());
    }

    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())?;

    let conn = open_db(&state)?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE project_metadata
         SET folder_key = ?1,
             folder_name = ?2,
             updated_at = datetime('now')
         WHERE folder_key = ?3",
        rusqlite::params![new_folder_key, trimmed, folder_key],
    )
    .map_err(|e| e.to_string())?;

    let prefix_old = format!("{}/", folder_key);
    let prefix_new = format!("{}/", new_folder_key);
    tx.execute(
        "UPDATE project_metadata
         SET folder_key = REPLACE(folder_key, ?1, ?2),
             updated_at = datetime('now')
         WHERE folder_key LIKE ?3",
        rusqlite::params![prefix_old, prefix_new, format!("{}%", prefix_old)],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(new_folder_key)
}

#[tauri::command]
pub fn create_project(
    folder_key: String,
    folder_name: String,
    status: String,
    category: String,
    description: Option<String>,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<(), String> {
    let ws = workspace(&state)?;
    let folder_path = ws.join(&folder_key);
    std::fs::create_dir_all(&folder_path).map_err(|e| e.to_string())?;

    let conn = open_db(&state)?;
    conn.execute(
        "INSERT INTO project_metadata (folder_key, folder_name, status, category, description)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(folder_key) DO UPDATE SET
           folder_name = excluded.folder_name,
           status      = excluded.status,
           category    = excluded.category,
           description = excluded.description",
        rusqlite::params![folder_key, folder_name, status, category, description],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Native workspace sync – discovers projects and populates the DB
// ---------------------------------------------------------------------------

const SKIP_FOLDERS: &[&str] = &[
    "node_modules", "logs", "__pycache__", ".venv", "venv",
    "target", "dist", "build", ".next", ".nuxt", ".cache",
    "scripts",
];

struct DiscoveredFolder {
    folder_key: String,
    folder_name: String,
    path: PathBuf,
}

#[derive(Debug, Serialize)]
pub struct SyncResult {
    pub projects_synced: usize,
    pub projects_pruned: usize,
}

/// Bucket folders use a `NN-name` pattern (e.g. `01-active`, `02-reference`).
/// Their children become projects instead of the bucket itself.
fn is_bucket_folder(name: &str) -> bool {
    if let Some(pos) = name.find('-') {
        pos > 0 && name[..pos].chars().all(|c| c.is_ascii_digit())
    } else {
        false
    }
}

fn discover_folders(ws: &Path) -> Result<Vec<DiscoveredFolder>, String> {
    let mut result = Vec::new();
    let entries = fs::read_dir(ws).map_err(|e| format!("Failed to read workspace: {e}"))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        let name = name.to_string();

        if name.starts_with('.') || SKIP_FOLDERS.contains(&name.as_str()) {
            continue;
        }

        if is_bucket_folder(&name) {
            // Iterate children of the bucket folder
            if let Ok(children) = fs::read_dir(&path) {
                for child in children.flatten() {
                    let cp = child.path();
                    if !cp.is_dir() {
                        continue;
                    }
                    let Some(cn) = cp.file_name().and_then(|n| n.to_str()) else {
                        continue;
                    };
                    let cn = cn.to_string();
                    if cn.starts_with('.') || SKIP_FOLDERS.contains(&cn.as_str()) {
                        continue;
                    }
                    result.push(DiscoveredFolder {
                        folder_key: format!("{}/{}", name, cn),
                        folder_name: cn,
                        path: cp,
                    });
                }
            }
        } else {
            result.push(DiscoveredFolder {
                folder_key: name.clone(),
                folder_name: name,
                path,
            });
        }
    }

    Ok(result)
}

fn has_readme(path: &Path) -> bool {
    path.join("README.md").exists() || path.join("readme.md").exists()
}

fn detect_host(remote_url: &str) -> String {
    let url = remote_url.to_lowercase();
    if url.contains("github.com") {
        "github".into()
    } else if url.contains("gitlab.com") {
        "gitlab".into()
    } else if url.contains("bitbucket.org") {
        "bitbucket".into()
    } else if url.contains("gitea") || url.contains("forgejo") {
        "gitea".into()
    } else {
        "other".into()
    }
}

fn extract_owner_repo(remote_url: &str) -> Option<String> {
    let url = remote_url.trim();

    // SSH: git@github.com:owner/repo.git
    if let Some(rest) = url.strip_prefix("git@") {
        if let Some((_host, path)) = rest.split_once(':') {
            return Some(path.trim_end_matches(".git").to_string());
        }
    }

    // HTTPS: https://github.com/owner/repo.git
    let without_proto = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))
        .unwrap_or(url);

    let parts: Vec<&str> = without_proto.split('/').collect();
    if parts.len() >= 3 {
        let owner = parts[parts.len() - 2];
        let repo = parts[parts.len() - 1].trim_end_matches(".git");
        return Some(format!("{}/{}", owner, repo));
    }

    None
}

fn git_commit_stats(repo_path: &Path) -> (Option<i64>, Option<String>, Option<i64>) {
    let path_str = match repo_path.to_str() {
        Some(s) => s,
        None => return (None, None, None),
    };

    let commit_count = Command::new("git")
        .args(["-C", path_str, "rev-list", "--count", "HEAD"])
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                String::from_utf8_lossy(&o.stdout)
                    .trim()
                    .parse::<i64>()
                    .ok()
            } else {
                None
            }
        });

    // ISO date for display
    let last_commit_date = Command::new("git")
        .args(["-C", path_str, "log", "-1", "--format=%aI"])
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
                if s.is_empty() {
                    None
                } else {
                    Some(s)
                }
            } else {
                None
            }
        });

    // Unix timestamp for days-since calculation (avoids chrono dependency)
    let days_since = Command::new("git")
        .args(["-C", path_str, "log", "-1", "--format=%at"])
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                String::from_utf8_lossy(&o.stdout)
                    .trim()
                    .parse::<i64>()
                    .ok()
            } else {
                None
            }
        })
        .map(|ts| {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs() as i64;
            (now - ts) / 86400
        });

    (commit_count, last_commit_date, days_since)
}

fn extract_readme_description(folder_path: &Path) -> Option<String> {
    let readme_path = if folder_path.join("README.md").exists() {
        folder_path.join("README.md")
    } else if folder_path.join("readme.md").exists() {
        folder_path.join("readme.md")
    } else {
        return None;
    };

    let content = fs::read_to_string(&readme_path).ok()?;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        // Skip badges, images, and HTML tags
        if trimmed.starts_with("![")
            || trimmed.starts_with("[![")
            || trimmed.starts_with('<')
        {
            continue;
        }
        return Some(trimmed.chars().take(200).collect());
    }

    None
}

struct ProjectData {
    folder_key: String,
    folder_name: String,
    repo: Option<String>,
    host: Option<String>,
    repo_owner: Option<String>,
    commit_count: Option<i64>,
    last_commit_date: Option<String>,
    days_since_last_commit: Option<i64>,
    description: Option<String>,
}

fn gather_metadata(folder: &DiscoveredFolder) -> Option<ProjectData> {
    if !has_readme(&folder.path) {
        return None;
    }

    let repo_path = repo_path_for_folder(&folder.path);
    let remote_url = repo_path
        .as_ref()
        .and_then(|rp| git_remote_url(rp, "origin").or_else(|| git_remote_url(rp, "upstream")));
    let host = remote_url.as_ref().map(|u| detect_host(u));
    let owner_repo = remote_url.as_ref().and_then(|u| extract_owner_repo(u));
    let (commit_count, last_commit_date, days_since) = repo_path
        .as_ref()
        .map(|rp| git_commit_stats(rp))
        .unwrap_or((None, None, None));
    let description = extract_readme_description(&folder.path);

    Some(ProjectData {
        folder_key: folder.folder_key.clone(),
        folder_name: folder.folder_name.clone(),
        repo: remote_url,
        host,
        repo_owner: owner_repo,
        commit_count,
        last_commit_date,
        days_since_last_commit: days_since,
        description,
    })
}

fn prune_orphaned_rows(conn: &Connection, ws: &Path) -> Result<usize, String> {
    let mut stmt = conn
        .prepare("SELECT folder_key FROM project_metadata")
        .map_err(|e| e.to_string())?;
    let keys: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut pruned = 0;
    for key in &keys {
        if !ws.join(key).is_dir() {
            conn.execute(
                "DELETE FROM project_metadata WHERE folder_key = ?1",
                [key],
            )
            .map_err(|e| e.to_string())?;
            pruned += 1;
        }
    }

    Ok(pruned)
}

#[tauri::command]
pub fn sync_workspace(
    state: tauri::State<'_, WorkspaceState>,
) -> Result<SyncResult, String> {
    let ws = workspace(&state)?;
    let conn = open_db(&state)?;

    // 1. Discover project folders (bucket folders are expanded)
    let folders = discover_folders(&ws)?;

    // 2. Gather git + README metadata in parallel
    let synced_projects: Vec<ProjectData> = std::thread::scope(|s| {
        let handles: Vec<_> = folders
            .iter()
            .map(|f| s.spawn(|| gather_metadata(f)))
            .collect();

        handles
            .into_iter()
            .filter_map(|h| h.join().ok().flatten())
            .collect()
    });

    // 3. Upsert into DB (preserves user-managed fields: status, category, deployment, etc.)
    let synced = synced_projects.len();
    for p in &synced_projects {
        conn.execute(
            "INSERT INTO project_metadata
                (folder_key, folder_name, repo, host, repo_owner,
                 commit_count, last_commit_date, days_since_last_commit, description)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT(folder_key) DO UPDATE SET
                folder_name = excluded.folder_name,
                repo = excluded.repo,
                host = excluded.host,
                repo_owner = excluded.repo_owner,
                commit_count = excluded.commit_count,
                last_commit_date = excluded.last_commit_date,
                days_since_last_commit = excluded.days_since_last_commit,
                description = excluded.description,
                updated_at = datetime('now')",
            rusqlite::params![
                p.folder_key,
                p.folder_name,
                p.repo,
                p.host,
                p.repo_owner,
                p.commit_count,
                p.last_commit_date,
                p.days_since_last_commit,
                p.description,
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    // 4. Prune rows whose folders no longer exist on disk
    let pruned = prune_orphaned_rows(&conn, &ws)?;

    Ok(SyncResult {
        projects_synced: synced,
        projects_pruned: pruned,
    })
}

// ---------------------------------------------------------------------------
// Lazy diff stats – called after initial table render
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct DiffStat {
    pub folder_key: String,
    pub lines_added: Option<i64>,
    pub lines_removed: Option<i64>,
}

#[tauri::command]
pub fn get_diff_stats(
    state: tauri::State<'_, WorkspaceState>,
) -> Result<Vec<DiffStat>, String> {
    let ws = workspace(&state)?;
    let conn = open_db(&state)?;
    let mut stmt = conn
        .prepare("SELECT folder_key FROM project_metadata ORDER BY folder_key")
        .map_err(|e| e.to_string())?;
    let keys: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    use std::thread;

    let results: Vec<DiffStat> = thread::scope(|s| {
        let handles: Vec<_> = keys
            .iter()
            .map(|key| {
                let ws = &ws;
                s.spawn(move || {
                    let diff_path = ws.join(key);
                    let repo_path = repo_path_for_folder(&diff_path);
                    let (added, removed) = repo_path
                        .as_deref()
                        .map(git_diff_line_stats)
                        .unwrap_or((None, None));
                    DiffStat {
                        folder_key: key.clone(),
                        lines_added: added,
                        lines_removed: removed,
                    }
                })
            })
            .collect();

        handles
            .into_iter()
            .filter_map(|h| h.join().ok())
            .collect()
    });

    // Persist computed stats to DB so subsequent loads are instant
    for stat in &results {
        let _ = conn.execute(
            "UPDATE project_metadata SET lines_added = ?1, lines_removed = ?2 WHERE folder_key = ?3",
            rusqlite::params![stat.lines_added, stat.lines_removed, stat.folder_key],
        );
    }

    Ok(results)
}

// ---------------------------------------------------------------------------
// Task CRUD commands
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub id: i64,
    pub folder_key: String,
    pub kind: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub completed_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TaskCount {
    pub folder_key: String,
    pub open_count: i64,
    pub total_count: i64,
}

#[tauri::command]
pub fn get_task_counts(
    state: tauri::State<'_, WorkspaceState>,
) -> Result<Vec<TaskCount>, String> {
    let conn = open_db(&state)?;
    let mut stmt = conn
        .prepare(
            "SELECT folder_key,
                    SUM(CASE WHEN status IN ('open', 'in-progress') THEN 1 ELSE 0 END) as open_count,
                    COUNT(*) as total_count
             FROM tasks
             GROUP BY folder_key",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(TaskCount {
                folder_key: row.get(0)?,
                open_count: row.get(1)?,
                total_count: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut counts = Vec::new();
    for row in rows {
        counts.push(row.map_err(|e| e.to_string())?);
    }
    Ok(counts)
}

#[tauri::command]
pub fn get_tasks(
    folder_key: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<Vec<Task>, String> {
    let conn = open_db(&state)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, folder_key, kind, title, description, status, priority,
                    created_at, updated_at, completed_at
             FROM tasks
             WHERE folder_key = ?1
             ORDER BY
                CASE status
                    WHEN 'in-progress' THEN 0
                    WHEN 'open' THEN 1
                    WHEN 'done' THEN 2
                    WHEN 'closed' THEN 3
                    ELSE 4
                END,
                CASE priority
                    WHEN 'urgent' THEN 0
                    WHEN 'high' THEN 1
                    WHEN 'medium' THEN 2
                    WHEN 'low' THEN 3
                    ELSE 4
                END,
                created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([&folder_key], |row| {
            Ok(Task {
                id: row.get(0)?,
                folder_key: row.get(1)?,
                kind: row.get(2)?,
                title: row.get(3)?,
                description: row.get(4)?,
                status: row.get(5)?,
                priority: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
                completed_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut tasks = Vec::new();
    for row in rows {
        tasks.push(row.map_err(|e| e.to_string())?);
    }
    Ok(tasks)
}

#[tauri::command]
pub fn create_task(
    folder_key: String,
    title: String,
    kind: Option<String>,
    description: Option<String>,
    priority: Option<String>,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<Task, String> {
    let conn = open_db(&state)?;
    let kind = kind.unwrap_or_else(|| "task".into());
    let priority = priority.unwrap_or_else(|| "medium".into());

    conn.execute(
        "INSERT INTO tasks (folder_key, kind, title, description, priority)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![folder_key, kind, title, description, priority],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    let task = conn
        .query_row(
            "SELECT id, folder_key, kind, title, description, status, priority,
                    created_at, updated_at, completed_at
             FROM tasks WHERE id = ?1",
            [id],
            |row| {
                Ok(Task {
                    id: row.get(0)?,
                    folder_key: row.get(1)?,
                    kind: row.get(2)?,
                    title: row.get(3)?,
                    description: row.get(4)?,
                    status: row.get(5)?,
                    priority: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                    completed_at: row.get(9)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(task)
}

#[tauri::command]
pub fn update_task(
    id: i64,
    title: Option<String>,
    description: Option<String>,
    status: Option<String>,
    kind: Option<String>,
    priority: Option<String>,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<Task, String> {
    let conn = open_db(&state)?;

    // Build dynamic UPDATE
    let mut sets: Vec<String> = vec!["updated_at = datetime('now')".into()];
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];

    if let Some(ref t) = title {
        params.push(Box::new(t.clone()));
        sets.push(format!("title = ?{}", params.len()));
    }
    if let Some(ref d) = description {
        params.push(Box::new(d.clone()));
        sets.push(format!("description = ?{}", params.len()));
    }
    if let Some(ref s) = status {
        params.push(Box::new(s.clone()));
        sets.push(format!("status = ?{}", params.len()));
        if s == "done" || s == "closed" {
            sets.push("completed_at = datetime('now')".into());
        } else {
            sets.push("completed_at = NULL".into());
        }
    }
    if let Some(ref k) = kind {
        params.push(Box::new(k.clone()));
        sets.push(format!("kind = ?{}", params.len()));
    }
    if let Some(ref p) = priority {
        params.push(Box::new(p.clone()));
        sets.push(format!("priority = ?{}", params.len()));
    }

    params.push(Box::new(id));
    let id_param_idx = params.len();

    let sql = format!(
        "UPDATE tasks SET {} WHERE id = ?{}",
        sets.join(", "),
        id_param_idx
    );

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice())
        .map_err(|e| e.to_string())?;

    let task = conn
        .query_row(
            "SELECT id, folder_key, kind, title, description, status, priority,
                    created_at, updated_at, completed_at
             FROM tasks WHERE id = ?1",
            [id],
            |row| {
                Ok(Task {
                    id: row.get(0)?,
                    folder_key: row.get(1)?,
                    kind: row.get(2)?,
                    title: row.get(3)?,
                    description: row.get(4)?,
                    status: row.get(5)?,
                    priority: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                    completed_at: row.get(9)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(task)
}

#[tauri::command]
pub fn delete_task(
    id: i64,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<(), String> {
    let conn = open_db(&state)?;
    conn.execute("DELETE FROM tasks WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Secure token storage (OS Keychain)
// ---------------------------------------------------------------------------

const KEYRING_SERVICE: &str = "com.joebuilds.project-manager";

#[tauri::command]
pub fn save_secret(key: String, value: String, cache: tauri::State<'_, TokenCache>) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &key).map_err(|e| e.to_string())?;
    entry.set_password(&value).map_err(|e| e.to_string())?;
    // Update in-memory cache immediately
    cache.cache.lock().unwrap().insert(key, value);
    Ok(())
}

#[tauri::command]
pub fn get_secret(key: String) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(pw) => Ok(Some(pw)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn delete_secret(key: String, cache: tauri::State<'_, TokenCache>) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // already gone
        Err(e) => Err(e.to_string()),
    }?;
    // Evict from cache
    cache.cache.lock().unwrap().remove(&key);
    Ok(())
}

#[tauri::command]
pub fn has_secret(key: String) -> Result<bool, String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(e) => Err(e.to_string()),
    }
}

// ---------------------------------------------------------------------------
// GitHub API – update repo homepage URL
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn update_github_repo_url(
    owner_repo: String,
    homepage: Option<String>,
    cache: tauri::State<'_, TokenCache>,
) -> Result<(), String> {
    println!("[update_github_repo_url] repo={} homepage={:?}", owner_repo, homepage);

    // Try in-memory cache first to avoid repeated keychain prompts
    let token = {
        let mut map = cache.cache.lock().unwrap();
        if let Some(t) = map.get("github_token").cloned() {
            println!("[update_github_repo_url] ✓ token from memory cache");
            t
        } else {
            // Not cached yet — read from keychain (may prompt once)
            let entry = keyring::Entry::new(KEYRING_SERVICE, "github_token")
                .map_err(|e| e.to_string())?;
            match entry.get_password() {
                Ok(t) => {
                    println!("[update_github_repo_url] ✓ token loaded from keychain (now cached)");
                    map.insert("github_token".into(), t.clone());
                    t
                }
                Err(keyring::Error::NoEntry) => {
                    println!("[update_github_repo_url] ✗ no token in keychain");
                    return Err("No GitHub token configured. Add one in Settings.".into())
                }
                Err(e) => return Err(e.to_string()),
            }
        }
    };

    let url = format!("https://api.github.com/repos/{}", owner_repo);
    println!("[update_github_repo_url] PATCH {}", url);

    let client = reqwest::blocking::Client::new();
    let resp = client
        .patch(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "project-manager")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .json(&serde_json::json!({ "homepage": homepage }))
        .send()
        .map_err(|e| format!("GitHub API request failed: {e}"))?;

    let status = resp.status();
    if status.is_success() {
        println!("[update_github_repo_url] ✓ GitHub responded {}", status);
        Ok(())
    } else {
        let body = resp.text().unwrap_or_default();
        println!("[update_github_repo_url] ✗ GitHub error {} — {}", status, body);
        Err(format!("GitHub API error {}: {}", status, body))
    }
}

// ---------------------------------------------------------------------------
// Table views
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
pub struct TableView {
    pub id: String,
    pub name: String,
    pub sorting: String,
    pub filters: String,
    pub visibility: String,
}

#[tauri::command]
pub fn get_table_views(
    state: tauri::State<'_, WorkspaceState>,
) -> Result<Vec<TableView>, String> {
    let conn = open_db(&state)?;
    let mut stmt = conn
        .prepare("SELECT id, name, sorting, filters, visibility FROM table_views ORDER BY name")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(TableView {
                id: row.get(0)?,
                name: row.get(1)?,
                sorting: row.get(2)?,
                filters: row.get(3)?,
                visibility: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut views = Vec::new();
    for r in rows {
        views.push(r.map_err(|e| e.to_string())?);
    }
    Ok(views)
}

#[tauri::command]
pub fn save_table_view(
    id: String,
    name: String,
    sorting: String,
    filters: String,
    visibility: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<(), String> {
    let conn = open_db(&state)?;
    conn.execute(
        "INSERT INTO table_views (id, name, sorting, filters, visibility, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           name       = excluded.name,
           sorting    = excluded.sorting,
           filters    = excluded.filters,
           visibility = excluded.visibility,
           updated_at = datetime('now')",
        rusqlite::params![id, name, sorting, filters, visibility],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_table_view(
    id: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<(), String> {
    let conn = open_db(&state)?;
    conn.execute("DELETE FROM table_views WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
