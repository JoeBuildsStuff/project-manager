use crate::config::{self, AppConfig};
use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::env;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex, RwLock};
use std::thread;
use std::time::Duration;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
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
        let path = config
            .workspace_path
            .map(PathBuf::from)
            .filter(|p| p.join("project-metadata.sqlite").exists());
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
        Self {
            cache: Mutex::new(std::collections::HashMap::new()),
        }
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
        Self {
            pending: Mutex::new(None),
        }
    }
}

pub struct ClaudeRunState {
    runs: Mutex<HashMap<String, Arc<Mutex<ClaudeRunEntry>>>>,
}

impl ClaudeRunState {
    pub fn new() -> Self {
        Self {
            runs: Mutex::new(HashMap::new()),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ClaudeTaskRunStatus {
    Starting,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Serialize, Clone)]
pub struct ClaudeTaskRunSnapshot {
    pub run_id: String,
    pub task_id: i64,
    pub model: Option<String>,
    pub status: ClaudeTaskRunStatus,
    pub pid: Option<u32>,
    pub cwd: String,
    pub started_at: u64,
    pub finished_at: Option<u64>,
    pub exit_code: Option<i32>,
}

struct ClaudeRunEntry {
    snapshot: ClaudeTaskRunSnapshot,
    child: Option<Arc<Mutex<Child>>>,
    cancelled: bool,
    seq: u64,
    final_text: String,
    /// Full last `type: "result"` SDK message (includes `total_cost_usd`, `modelUsage`, etc.).
    last_result: Option<Value>,
    db_path: Option<PathBuf>,
}

#[derive(Debug, Serialize)]
pub struct ClaudeRunStartedPayload {
    pub run_id: String,
    pub task_id: i64,
    pub model: Option<String>,
    pub cwd: String,
    pub pid: u32,
    pub started_at: u64,
}

#[derive(Debug, Serialize)]
pub struct ClaudeRunEventPayload {
    pub run_id: String,
    pub seq: u64,
    pub ts: u64,
    pub kind: String,
    pub text: Option<String>,
    pub raw_type: Option<String>,
    pub raw_subtype: Option<String>,
    pub data: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct ClaudeRunCompletedPayload {
    pub run_id: String,
    pub task_id: i64,
    pub exit_code: Option<i32>,
    pub status: ClaudeTaskRunStatus,
    pub finished_at: u64,
    pub final_text: Option<String>,
    /// Nested `usage` object from the result message (tokens, etc.).
    pub usage: Option<Value>,
    /// From the result message root when the CLI provides it.
    pub total_cost_usd: Option<f64>,
    /// Per-model rollup from the result message (`modelUsage`), when present.
    pub model_usage: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct ClaudeRunErrorPayload {
    pub run_id: Option<String>,
    pub task_id: Option<i64>,
    pub stage: String,
    pub message: String,
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

fn unix_ms_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn next_run_id(task_id: i64) -> String {
    format!("claude-task-{task_id}-{}", unix_ms_now())
}

fn model_token_pricing_usd_per_million(model: &str) -> Option<(f64, f64)> {
    let normalized = model.trim();
    if normalized.starts_with("claude-haiku-4-5") {
        return Some((1.0, 5.0));
    }
    if normalized.starts_with("claude-sonnet-4-6") {
        return Some((3.0, 15.0));
    }
    if normalized.starts_with("claude-opus-4-6") {
        return Some((5.0, 25.0));
    }
    None
}

fn emit_claude_run_error(
    app: &AppHandle,
    run_id: Option<String>,
    task_id: Option<i64>,
    stage: &str,
    message: impl Into<String>,
) {
    let payload = ClaudeRunErrorPayload {
        run_id,
        task_id,
        stage: stage.into(),
        message: message.into(),
    };
    let _ = app.emit("claude-run:error", &payload);
}

fn clone_run_entry(
    runs: &tauri::State<'_, ClaudeRunState>,
    run_id: &str,
) -> Result<Arc<Mutex<ClaudeRunEntry>>, String> {
    runs.runs
        .lock()
        .map_err(|e| e.to_string())?
        .get(run_id)
        .cloned()
        .ok_or_else(|| "Claude run not found".into())
}

fn open_db(state: &WorkspaceState) -> Result<Connection, String> {
    let path = db_path(state)?;
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;
    let _ = conn.execute("PRAGMA foreign_keys = ON", []);
    // Idempotent migrations – add columns if missing
    let _ = conn.execute("ALTER TABLE project_metadata ADD COLUMN stage TEXT", []);
    let _ = conn.execute("ALTER TABLE project_metadata ADD COLUMN actions_status TEXT", []);
    let _ = conn.execute("ALTER TABLE project_metadata ADD COLUMN actions_run_url TEXT", []);

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

    // Idempotent migration: add context column if missing (existing rows → 'projects')
    let _ = conn.execute(
        "ALTER TABLE table_views ADD COLUMN context TEXT NOT NULL DEFAULT 'projects'",
        [],
    );

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS notes_documents (
            id         TEXT PRIMARY KEY,
            title      TEXT NOT NULL DEFAULT 'Workspace Notes',
            content    TEXT NOT NULL DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

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

        CREATE TABLE IF NOT EXISTS note_comment_threads (
            id            TEXT PRIMARY KEY,
            document_id   TEXT NOT NULL REFERENCES notes_documents(id) ON DELETE CASCADE,
            created_by    TEXT NOT NULL,
            status        TEXT NOT NULL DEFAULT 'unresolved',
            anchor_from   INTEGER NOT NULL,
            anchor_to     INTEGER NOT NULL,
            anchor_exact  TEXT NOT NULL DEFAULT '',
            anchor_prefix TEXT NOT NULL DEFAULT '',
            anchor_suffix TEXT NOT NULL DEFAULT '',
            resolved_at   TEXT,
            created_at    TEXT DEFAULT (datetime('now')),
            updated_at    TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS note_comments (
            id         TEXT PRIMARY KEY,
            thread_id  TEXT NOT NULL REFERENCES note_comment_threads(id) ON DELETE CASCADE,
            user_id    TEXT NOT NULL,
            content    TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );",
    )
    .map_err(|e| e.to_string())?;

    // Idempotent migrations: note icon & favorite (matches local-first multi-note UI)
    let _ = conn.execute(
        "ALTER TABLE notes_documents ADD COLUMN icon_name TEXT NOT NULL DEFAULT 'utensils-crossed'",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE notes_documents ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0",
        [],
    );

    // -----------------------------------------------------------------------
    // Claude task-run persistence tables
    // -----------------------------------------------------------------------

    // Enable WAL mode for better concurrent read/write from spawned threads
    let _ = conn.execute("PRAGMA journal_mode=WAL", []);

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS claude_sessions (
            run_id      TEXT PRIMARY KEY,
            task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            model       TEXT,
            prompt      TEXT NOT NULL,
            cwd         TEXT NOT NULL,
            pid         INTEGER,
            status      TEXT NOT NULL DEFAULT 'starting',
            exit_code   INTEGER,
            started_at  INTEGER NOT NULL,
            finished_at INTEGER,
            final_text  TEXT,
            usage_json  TEXT
        );

        CREATE TABLE IF NOT EXISTS claude_events (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id      TEXT NOT NULL REFERENCES claude_sessions(run_id) ON DELETE CASCADE,
            seq         INTEGER NOT NULL,
            ts          INTEGER NOT NULL,
            kind        TEXT NOT NULL,
            raw_type    TEXT,
            raw_subtype TEXT,
            text        TEXT,
            raw_json    TEXT,
            UNIQUE(run_id, seq)
        );

        CREATE INDEX IF NOT EXISTS idx_claude_events_run_seq
            ON claude_events(run_id, seq);

        CREATE INDEX IF NOT EXISTS idx_claude_events_kind
            ON claude_events(kind);

        CREATE TABLE IF NOT EXISTS claude_results (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id         TEXT NOT NULL REFERENCES claude_sessions(run_id) ON DELETE CASCADE,
            result_text    TEXT,
            model          TEXT,
            input_tokens   INTEGER,
            output_tokens  INTEGER,
            cache_creation_input_tokens INTEGER,
            cache_read_input_tokens     INTEGER,
            cost_usd       REAL,
            duration_ms    INTEGER,
            num_turns      INTEGER,
            stop_reason    TEXT,
            usage_json     TEXT,
            ts             INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS claude_tool_calls (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id          TEXT NOT NULL REFERENCES claude_sessions(run_id) ON DELETE CASCADE,
            seq             INTEGER NOT NULL,
            tool_name       TEXT,
            tool_input_json TEXT,
            ts              INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_claude_tool_calls_run
            ON claude_tool_calls(run_id);",
    )
    .map_err(|e| e.to_string())?;

    migrate_claude_tracking(&conn)?;

    Ok(conn)
}

/// Add analytics columns/tables and repair older rows from stored `raw_json` result lines.
fn migrate_claude_tracking(conn: &Connection) -> Result<(), String> {
    let _ = conn.execute(
        "ALTER TABLE claude_results ADD COLUMN total_cost_usd REAL",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE claude_results ADD COLUMN model_usage_json TEXT",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE claude_results ADD COLUMN duration_api_ms INTEGER",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE claude_results ADD COLUMN terminal_reason TEXT",
        [],
    );
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS claude_run_model_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id TEXT NOT NULL REFERENCES claude_sessions(run_id) ON DELETE CASCADE,
            model_name TEXT NOT NULL,
            input_tokens INTEGER,
            output_tokens INTEGER,
            cache_read_input_tokens INTEGER,
            cache_creation_input_tokens INTEGER,
            web_search_requests INTEGER,
            cost_usd REAL,
            context_window INTEGER,
            max_output_tokens INTEGER,
            UNIQUE (run_id, model_name)
        );
        CREATE INDEX IF NOT EXISTS idx_claude_run_model_usage_run
            ON claude_run_model_usage(run_id);",
    )
    .map_err(|e| e.to_string())?;

    backfill_claude_results_from_events(conn).map_err(|e| e.to_string())?;
    Ok(())
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
pub fn get_workspace_config(
    state: tauri::State<'_, WorkspaceState>,
) -> Result<WorkspaceConfig, String> {
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
    let _ = conn.execute("PRAGMA foreign_keys = ON", []);
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
        );

        CREATE TABLE IF NOT EXISTS notes_documents (
            id         TEXT PRIMARY KEY,
            title      TEXT NOT NULL DEFAULT 'Workspace Notes',
            content    TEXT NOT NULL DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

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

        CREATE TABLE IF NOT EXISTS note_comment_threads (
            id            TEXT PRIMARY KEY,
            document_id   TEXT NOT NULL REFERENCES notes_documents(id) ON DELETE CASCADE,
            created_by    TEXT NOT NULL,
            status        TEXT NOT NULL DEFAULT 'unresolved',
            anchor_from   INTEGER NOT NULL,
            anchor_to     INTEGER NOT NULL,
            anchor_exact  TEXT NOT NULL DEFAULT '',
            anchor_prefix TEXT NOT NULL DEFAULT '',
            anchor_suffix TEXT NOT NULL DEFAULT '',
            resolved_at   TEXT,
            created_at    TEXT DEFAULT (datetime('now')),
            updated_at    TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS note_comments (
            id         TEXT PRIMARY KEY,
            thread_id  TEXT NOT NULL REFERENCES note_comment_threads(id) ON DELETE CASCADE,
            user_id    TEXT NOT NULL,
            content    TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );",
    )
    .map_err(|e| e.to_string())?;

    // Idempotent migrations – silently ignored if column already exists
    let _ = conn.execute(
        "ALTER TABLE project_metadata ADD COLUMN lines_added INTEGER",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE project_metadata ADD COLUMN lines_removed INTEGER",
        [],
    );
    let _ = conn.execute("ALTER TABLE project_metadata ADD COLUMN stage TEXT", []);
    let _ = conn.execute("ALTER TABLE project_metadata ADD COLUMN actions_status TEXT", []);
    let _ = conn.execute("ALTER TABLE project_metadata ADD COLUMN actions_run_url TEXT", []);

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

    // Idempotent migration: add context column if missing (existing rows → 'projects')
    let _ = conn.execute(
        "ALTER TABLE table_views ADD COLUMN context TEXT NOT NULL DEFAULT 'projects'",
        [],
    );

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
    pub actions_status: Option<String>,
    pub actions_run_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NotesDocument {
    pub id: String,
    pub title: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
    pub icon_name: String,
    pub is_favorite: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NotesDocumentSummary {
    pub id: String,
    pub title: String,
    pub icon_name: String,
    pub is_favorite: bool,
    pub created_at: String,
    pub updated_at: String,
}

const NOTES_WORKSPACE_ID: &str = "workspace";

const NOTE_ICON_NAMES: &[&str] = &[
    "utensils-crossed",
    "chef-hat",
    "beef",
    "drumstick",
    "fish",
    "salad",
    "carrot",
    "apple",
    "pizza",
    "sandwich",
    "soup",
    "croissant",
    "cookie",
    "ice-cream-cone",
    "coffee",
];

fn is_valid_note_icon(name: &str) -> bool {
    NOTE_ICON_NAMES.iter().any(|&n| n == name)
}

fn normalize_note_title(raw: &str) -> String {
    let value = raw.trim();
    if value.is_empty() {
        "Untitled".to_string()
    } else {
        value.to_string()
    }
}

fn map_notes_document_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<NotesDocument> {
    let is_favorite_int: i64 = row.get(6)?;
    Ok(NotesDocument {
        id: row.get(0)?,
        title: row.get(1)?,
        content: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
        icon_name: row.get(5)?,
        is_favorite: is_favorite_int != 0,
    })
}

fn map_notes_summary_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<NotesDocumentSummary> {
    let is_favorite_int: i64 = row.get(3)?;
    Ok(NotesDocumentSummary {
        id: row.get(0)?,
        title: row.get(1)?,
        icon_name: row.get(2)?,
        is_favorite: is_favorite_int != 0,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

fn ensure_workspace_notes_seed(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "INSERT INTO notes_documents (id, title, content)
         VALUES (?1, 'Workspace Notes', '')
         ON CONFLICT(id) DO NOTHING",
        [NOTES_WORKSPACE_ID],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteAttachment {
    pub id: String,
    pub document_id: String,
    pub rel_path: String,
    pub mime: String,
    pub filename: Option<String>,
    pub size_bytes: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteAttachmentPayload {
    pub id: String,
    pub mime: String,
    pub filename: Option<String>,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentCurrentUser {
    pub id: String,
    pub display_name: String,
    pub email: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NoteComment {
    pub id: String,
    pub thread_id: String,
    pub user_id: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NoteCommentThread {
    pub id: String,
    pub document_id: String,
    pub created_by: String,
    pub status: String,
    pub anchor_from: i64,
    pub anchor_to: i64,
    pub anchor_exact: String,
    pub anchor_prefix: String,
    pub anchor_suffix: String,
    pub resolved_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub comments: Vec<NoteComment>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteCommentAnchorInput {
    pub id: String,
    pub anchor_from: i64,
    pub anchor_to: i64,
    pub anchor_exact: String,
    pub anchor_prefix: String,
    pub anchor_suffix: String,
}

fn local_comment_user() -> CommentCurrentUser {
    let display_name = env::var("USER")
        .ok()
        .or_else(|| env::var("USERNAME").ok())
        .or_else(|| env::var("LOGNAME").ok())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "Local User".to_string());

    CommentCurrentUser {
        id: "local-user".to_string(),
        display_name,
        email: None,
        avatar_url: None,
    }
}

fn strip_rich_text(content: &str) -> String {
    let mut text = String::with_capacity(content.len());
    let mut in_tag = false;

    for ch in content.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => {
                in_tag = false;
                text.push(' ');
            }
            _ if !in_tag => text.push(ch),
            _ => {}
        }
    }

    text.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .trim()
        .to_string()
}

fn ensure_notes_document_exists(conn: &Connection, document_id: &str) -> Result<(), String> {
    let exists = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM notes_documents WHERE id = ?1)",
            [document_id],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|e| e.to_string())?;

    if exists == 0 {
        return Err("Document not found".into());
    }

    Ok(())
}

fn note_attachments_dir(workspace_root: &Path) -> PathBuf {
    workspace_root.join(".project-manager").join("notes")
}

fn generate_attachment_id() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);

    format!("att-{nanos:x}")
}

fn sanitized_extension(filename: Option<&str>, mime: &str) -> Option<String> {
    let from_filename = filename
        .and_then(|value| Path::new(value).extension())
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.trim().to_ascii_lowercase())
        .filter(|ext| !ext.is_empty())
        .map(|ext| {
            ext.chars()
                .filter(|ch| ch.is_ascii_alphanumeric())
                .collect::<String>()
        })
        .filter(|ext| !ext.is_empty());

    from_filename.or_else(|| {
        let ext = match mime {
            "image/jpeg" => Some("jpg"),
            "image/png" => Some("png"),
            "image/gif" => Some("gif"),
            "image/webp" => Some("webp"),
            "image/svg+xml" => Some("svg"),
            "application/pdf" => Some("pdf"),
            "text/plain" => Some("txt"),
            "text/csv" => Some("csv"),
            "application/json" => Some("json"),
            "text/html" => Some("html"),
            "text/css" => Some("css"),
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" => {
                Some("docx")
            }
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" => Some("xlsx"),
            "application/vnd.openxmlformats-officedocument.presentationml.presentation" => {
                Some("pptx")
            }
            "application/msword" => Some("doc"),
            "application/vnd.ms-excel" => Some("xls"),
            "application/vnd.ms-powerpoint" => Some("ppt"),
            "application/zip" => Some("zip"),
            "application/x-rar-compressed" => Some("rar"),
            "application/x-7z-compressed" => Some("7z"),
            _ => None,
        }?;

        Some(ext.to_string())
    })
}

fn attachment_ref_ids(content: &str) -> HashSet<String> {
    let mut ids = HashSet::new();
    let needle = "attachment:";
    let bytes = content.as_bytes();
    let mut search_index = 0;

    while let Some(relative_index) = content[search_index..].find(needle) {
        let start = search_index + relative_index + needle.len();
        let mut end = start;

        while end < bytes.len() {
            let ch = bytes[end] as char;
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                end += 1;
            } else {
                break;
            }
        }

        if end > start {
            ids.insert(content[start..end].to_string());
        }

        search_index = end;
    }

    ids
}

fn delete_note_attachment_internal(
    conn: &Connection,
    workspace_root: &Path,
    attachment_id: &str,
) -> Result<(), String> {
    let rel_path = conn
        .query_row(
            "SELECT rel_path FROM note_attachments WHERE id = ?1",
            [attachment_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    if let Some(rel_path) = rel_path {
        let full_path = workspace_root.join(&rel_path);
        match fs::remove_file(&full_path) {
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.to_string()),
        }

        conn.execute(
            "DELETE FROM note_attachments WHERE id = ?1",
            [attachment_id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn remove_attachments_for_document(
    conn: &Connection,
    workspace_root: &Path,
    document_id: &str,
) -> Result<(), String> {
    let mut stmt = conn
        .prepare("SELECT id FROM note_attachments WHERE document_id = ?1")
        .map_err(|e| e.to_string())?;

    let ids: Vec<String> = stmt
        .query_map([document_id], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    for attachment_id in ids {
        delete_note_attachment_internal(conn, workspace_root, &attachment_id)?;
    }

    Ok(())
}

fn cleanup_unreferenced_note_attachments(
    conn: &Connection,
    workspace_root: &Path,
    document_id: &str,
    content: &str,
) -> Result<(), String> {
    let referenced_ids = attachment_ref_ids(content);
    let mut stmt = conn
        .prepare("SELECT id FROM note_attachments WHERE document_id = ?1")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([document_id], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;

    let mut stale_ids = Vec::new();
    for row in rows {
        let attachment_id = row.map_err(|e| e.to_string())?;
        if !referenced_ids.contains(&attachment_id) {
            stale_ids.push(attachment_id);
        }
    }

    for attachment_id in stale_ids {
        delete_note_attachment_internal(conn, workspace_root, &attachment_id)?;
    }

    Ok(())
}

fn map_note_comment(row: &rusqlite::Row<'_>) -> rusqlite::Result<NoteComment> {
    Ok(NoteComment {
        id: row.get(0)?,
        thread_id: row.get(1)?,
        user_id: row.get(2)?,
        content: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

fn get_note_comments_for_thread(
    conn: &Connection,
    thread_id: &str,
) -> Result<Vec<NoteComment>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, thread_id, user_id, content, created_at, updated_at
             FROM note_comments
             WHERE thread_id = ?1
             ORDER BY created_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([thread_id], map_note_comment)
        .map_err(|e| e.to_string())?;

    let mut comments = Vec::new();
    for row in rows {
        comments.push(row.map_err(|e| e.to_string())?);
    }

    Ok(comments)
}

fn get_note_comment_thread_by_id(
    conn: &Connection,
    document_id: &str,
    thread_id: &str,
) -> Result<NoteCommentThread, String> {
    let thread = conn
        .query_row(
            "SELECT id, document_id, created_by, status, anchor_from, anchor_to,
                    anchor_exact, anchor_prefix, anchor_suffix, resolved_at, created_at, updated_at
             FROM note_comment_threads
             WHERE id = ?1 AND document_id = ?2",
            rusqlite::params![thread_id, document_id],
            |row| {
                Ok(NoteCommentThread {
                    id: row.get(0)?,
                    document_id: row.get(1)?,
                    created_by: row.get(2)?,
                    status: row.get(3)?,
                    anchor_from: row.get(4)?,
                    anchor_to: row.get(5)?,
                    anchor_exact: row.get(6)?,
                    anchor_prefix: row.get(7)?,
                    anchor_suffix: row.get(8)?,
                    resolved_at: row.get(9)?,
                    created_at: row.get(10)?,
                    updated_at: row.get(11)?,
                    comments: Vec::new(),
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(NoteCommentThread {
        comments: get_note_comments_for_thread(conn, thread_id)?,
        ..thread
    })
}

#[tauri::command]
pub fn get_comment_current_user() -> Result<CommentCurrentUser, String> {
    Ok(local_comment_user())
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

#[tauri::command]
pub fn list_notes_documents(
    state: tauri::State<'_, WorkspaceState>,
) -> Result<Vec<NotesDocumentSummary>, String> {
    let conn = open_db(&state)?;
    ensure_workspace_notes_seed(&conn)?;

    let mut stmt = conn
        .prepare(
            "SELECT id, title, icon_name, is_favorite, created_at, updated_at
             FROM notes_documents
             ORDER BY is_favorite DESC, updated_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| map_notes_summary_row(row))
        .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
pub fn get_notes_document_by_id(
    id: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<NotesDocument, String> {
    let conn = open_db(&state)?;
    ensure_workspace_notes_seed(&conn)?;

    conn.query_row(
        "SELECT id, title, content, created_at, updated_at, icon_name, is_favorite
         FROM notes_documents
         WHERE id = ?1",
        [&id],
        |row| {
            let is_favorite_int: i64 = row.get(6)?;
            Ok(NotesDocument {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                icon_name: row.get(5)?,
                is_favorite: is_favorite_int != 0,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_notes_document(
    state: tauri::State<'_, WorkspaceState>,
) -> Result<NotesDocument, String> {
    let conn = open_db(&state)?;
    ensure_workspace_notes_seed(&conn)?;

    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let id = format!("n{nanos:x}");

    conn.execute(
        "INSERT INTO notes_documents (id, title, content, icon_name, is_favorite)
         VALUES (?1, 'My Note', '', 'utensils-crossed', 0)",
        [&id],
    )
    .map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT id, title, content, created_at, updated_at, icon_name, is_favorite
         FROM notes_documents
         WHERE id = ?1",
        [&id],
        |row| {
            let is_favorite_int: i64 = row.get(6)?;
            Ok(NotesDocument {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
                icon_name: row.get(5)?,
                is_favorite: is_favorite_int != 0,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_notes_document(
    id: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<(), String> {
    let conn = open_db(&state)?;
    let workspace_root = workspace(&state)?;

    remove_attachments_for_document(&conn, &workspace_root, &id)?;

    let deleted = conn
        .execute("DELETE FROM notes_documents WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;

    if deleted == 0 {
        return Err("Document not found".into());
    }

    Ok(())
}

#[tauri::command]
pub fn set_notes_document_favorite(
    id: String,
    is_favorite: bool,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<NotesDocumentSummary, String> {
    let conn = open_db(&state)?;
    let fav_int: i64 = if is_favorite { 1 } else { 0 };

    let updated = conn
        .execute(
            "UPDATE notes_documents SET is_favorite = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![fav_int, &id],
        )
        .map_err(|e| e.to_string())?;

    if updated == 0 {
        return Err("Document not found".into());
    }

    conn.query_row(
        "SELECT id, title, icon_name, is_favorite, created_at, updated_at
         FROM notes_documents
         WHERE id = ?1",
        [&id],
        |row| map_notes_summary_row(row),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_notes_document_icon(
    id: String,
    icon_name: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<NotesDocumentSummary, String> {
    if !is_valid_note_icon(&icon_name) {
        return Err("Invalid note icon".into());
    }

    let conn = open_db(&state)?;
    let updated = conn
        .execute(
            "UPDATE notes_documents SET icon_name = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![&icon_name, &id],
        )
        .map_err(|e| e.to_string())?;

    if updated == 0 {
        return Err("Document not found".into());
    }

    conn.query_row(
        "SELECT id, title, icon_name, is_favorite, created_at, updated_at
         FROM notes_documents
         WHERE id = ?1",
        [&id],
        |row| map_notes_summary_row(row),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_notes_document(
    id: String,
    title: String,
    content: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<NotesDocument, String> {
    let conn = open_db(&state)?;
    let workspace_root = workspace(&state)?;
    let trimmed_title = normalize_note_title(&title);

    let updated = conn
        .execute(
            "UPDATE notes_documents SET title = ?2, content = ?3, updated_at = datetime('now')
             WHERE id = ?1",
            rusqlite::params![&id, &trimmed_title, &content],
        )
        .map_err(|e| e.to_string())?;

    if updated == 0 {
        return Err("Document not found".into());
    }

    cleanup_unreferenced_note_attachments(&conn, &workspace_root, &id, &content)?;

    conn.query_row(
        "SELECT id, title, content, created_at, updated_at, icon_name, is_favorite
         FROM notes_documents
         WHERE id = ?1",
        rusqlite::params![&id],
        |row| map_notes_document_row(row),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_note_attachment(
    document_id: String,
    bytes: Vec<u8>,
    mime: String,
    filename: Option<String>,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<NoteAttachment, String> {
    let conn = open_db(&state)?;
    ensure_notes_document_exists(&conn, &document_id)?;

    let workspace_root = workspace(&state)?;
    let attachments_dir = note_attachments_dir(&workspace_root);
    fs::create_dir_all(&attachments_dir).map_err(|e| e.to_string())?;

    let attachment_id = generate_attachment_id();
    let extension = sanitized_extension(filename.as_deref(), &mime);
    let stored_filename = match extension {
        Some(ref ext) => format!("{attachment_id}.{ext}"),
        None => attachment_id.clone(),
    };
    let full_path = attachments_dir.join(&stored_filename);
    fs::write(&full_path, &bytes).map_err(|e| e.to_string())?;

    let rel_path = PathBuf::from(".project-manager")
        .join("notes")
        .join(&stored_filename)
        .to_string_lossy()
        .to_string();
    let size_bytes = i64::try_from(bytes.len()).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO note_attachments (id, document_id, rel_path, mime, filename, size_bytes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            &attachment_id,
            &document_id,
            &rel_path,
            &mime,
            &filename,
            &size_bytes
        ],
    )
    .map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT id, document_id, rel_path, mime, filename, size_bytes, created_at
         FROM note_attachments
         WHERE id = ?1",
        [&attachment_id],
        |row| {
            Ok(NoteAttachment {
                id: row.get(0)?,
                document_id: row.get(1)?,
                rel_path: row.get(2)?,
                mime: row.get(3)?,
                filename: row.get(4)?,
                size_bytes: row.get(5)?,
                created_at: row.get(6)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_note_attachment(
    attachment_id: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<NoteAttachmentPayload, String> {
    let conn = open_db(&state)?;
    let workspace_root = workspace(&state)?;

    let attachment = conn
        .query_row(
            "SELECT id, rel_path, mime, filename
             FROM note_attachments
             WHERE id = ?1",
            [&attachment_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?,
                ))
            },
        )
        .map_err(|e| e.to_string())?;

    let bytes = fs::read(workspace_root.join(&attachment.1)).map_err(|e| e.to_string())?;

    Ok(NoteAttachmentPayload {
        id: attachment.0,
        mime: attachment.2,
        filename: attachment.3,
        bytes,
    })
}

#[tauri::command]
pub fn delete_note_attachment(
    attachment_id: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<(), String> {
    let conn = open_db(&state)?;
    let workspace_root = workspace(&state)?;
    delete_note_attachment_internal(&conn, &workspace_root, &attachment_id)
}

#[tauri::command]
pub fn list_notes_comment_threads(
    document_id: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<Vec<NoteCommentThread>, String> {
    let conn = open_db(&state)?;
    ensure_notes_document_exists(&conn, &document_id)?;

    let mut stmt = conn
        .prepare(
            "SELECT id, document_id, created_by, status, anchor_from, anchor_to,
                    anchor_exact, anchor_prefix, anchor_suffix, resolved_at, created_at, updated_at
             FROM note_comment_threads
             WHERE document_id = ?1
             ORDER BY created_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([&document_id], |row| {
            Ok(NoteCommentThread {
                id: row.get(0)?,
                document_id: row.get(1)?,
                created_by: row.get(2)?,
                status: row.get(3)?,
                anchor_from: row.get(4)?,
                anchor_to: row.get(5)?,
                anchor_exact: row.get(6)?,
                anchor_prefix: row.get(7)?,
                anchor_suffix: row.get(8)?,
                resolved_at: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
                comments: Vec::new(),
            })
        })
        .map_err(|e| e.to_string())?;

    let mut threads = Vec::new();
    for row in rows {
        let thread = row.map_err(|e| e.to_string())?;
        let comments = get_note_comments_for_thread(&conn, &thread.id)?;
        threads.push(NoteCommentThread { comments, ..thread });
    }

    Ok(threads)
}

#[tauri::command]
pub fn create_notes_comment_thread(
    document_id: String,
    anchor_from: i64,
    anchor_to: i64,
    anchor_exact: String,
    anchor_prefix: String,
    anchor_suffix: String,
    content: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<NoteCommentThread, String> {
    if anchor_to <= anchor_from {
        return Err("Invalid anchor range".into());
    }

    if strip_rich_text(&content).is_empty() {
        return Err("Comment content is required".into());
    }

    let current_user = local_comment_user();
    let mut conn = open_db(&state)?;
    ensure_notes_document_exists(&conn, &document_id)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let thread_id: String = tx
        .query_row("SELECT lower(hex(randomblob(16)))", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    let comment_id: String = tx
        .query_row("SELECT lower(hex(randomblob(16)))", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO note_comment_threads (
            id, document_id, created_by, status, anchor_from, anchor_to,
            anchor_exact, anchor_prefix, anchor_suffix, created_at, updated_at
         ) VALUES (?1, ?2, ?3, 'unresolved', ?4, ?5, ?6, ?7, ?8, datetime('now'), datetime('now'))",
        rusqlite::params![
            &thread_id,
            &document_id,
            &current_user.id,
            anchor_from,
            anchor_to,
            &anchor_exact,
            &anchor_prefix,
            &anchor_suffix
        ],
    )
    .map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO note_comments (
            id, thread_id, user_id, content, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, datetime('now'), datetime('now'))",
        rusqlite::params![&comment_id, &thread_id, &current_user.id, &content],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    get_note_comment_thread_by_id(&conn, &document_id, &thread_id)
}

#[tauri::command]
pub fn update_notes_comment_thread(
    document_id: String,
    thread_id: String,
    resolved: Option<bool>,
    anchor_from: Option<i64>,
    anchor_to: Option<i64>,
    anchor_exact: Option<String>,
    anchor_prefix: Option<String>,
    anchor_suffix: Option<String>,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<NoteCommentThread, String> {
    let conn = open_db(&state)?;
    ensure_notes_document_exists(&conn, &document_id)?;

    let existing = get_note_comment_thread_by_id(&conn, &document_id, &thread_id)?;
    let next_anchor_from = anchor_from.unwrap_or(existing.anchor_from);
    let next_anchor_to = anchor_to.unwrap_or(existing.anchor_to);
    if next_anchor_to <= next_anchor_from {
        return Err("Invalid anchor range".into());
    }

    let next_status = match resolved {
        Some(true) => "resolved",
        Some(false) => "unresolved",
        None => existing.status.as_str(),
    };
    let resolved_at_value = match resolved {
        Some(true) => Some("datetime('now')"),
        Some(false) => None,
        None => existing.resolved_at.as_deref(),
    };

    let resolved_sql = match resolved_at_value {
        Some("datetime('now')") => "datetime('now')".to_string(),
        Some(value) => format!("'{}'", value.replace('\'', "''")),
        None => "NULL".to_string(),
    };

    conn.execute(
        &format!(
            "UPDATE note_comment_threads
             SET status = ?1,
                 anchor_from = ?2,
                 anchor_to = ?3,
                 anchor_exact = ?4,
                 anchor_prefix = ?5,
                 anchor_suffix = ?6,
                 resolved_at = {},
                 updated_at = datetime('now')
             WHERE id = ?7 AND document_id = ?8",
            resolved_sql
        ),
        rusqlite::params![
            next_status,
            next_anchor_from,
            next_anchor_to,
            anchor_exact.unwrap_or(existing.anchor_exact),
            anchor_prefix.unwrap_or(existing.anchor_prefix),
            anchor_suffix.unwrap_or(existing.anchor_suffix),
            &thread_id,
            &document_id
        ],
    )
    .map_err(|e| e.to_string())?;

    get_note_comment_thread_by_id(&conn, &document_id, &thread_id)
}

#[tauri::command]
pub fn delete_notes_comment_thread(
    document_id: String,
    thread_id: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<(), String> {
    let conn = open_db(&state)?;
    ensure_notes_document_exists(&conn, &document_id)?;

    conn.execute(
        "DELETE FROM note_comment_threads WHERE id = ?1 AND document_id = ?2",
        rusqlite::params![&thread_id, &document_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn create_notes_comment(
    document_id: String,
    thread_id: String,
    content: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<NoteCommentThread, String> {
    if strip_rich_text(&content).is_empty() {
        return Err("Comment content is required".into());
    }

    let current_user = local_comment_user();
    let conn = open_db(&state)?;
    ensure_notes_document_exists(&conn, &document_id)?;
    get_note_comment_thread_by_id(&conn, &document_id, &thread_id)?;

    let comment_id: String = conn
        .query_row("SELECT lower(hex(randomblob(16)))", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO note_comments (
            id, thread_id, user_id, content, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, datetime('now'), datetime('now'))",
        rusqlite::params![&comment_id, &thread_id, &current_user.id, &content],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE note_comment_threads
         SET updated_at = datetime('now')
         WHERE id = ?1 AND document_id = ?2",
        rusqlite::params![&thread_id, &document_id],
    )
    .map_err(|e| e.to_string())?;

    get_note_comment_thread_by_id(&conn, &document_id, &thread_id)
}

#[tauri::command]
pub fn update_notes_comment(
    document_id: String,
    thread_id: String,
    comment_id: String,
    content: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<NoteCommentThread, String> {
    if strip_rich_text(&content).is_empty() {
        return Err("Comment content is required".into());
    }

    let current_user = local_comment_user();
    let conn = open_db(&state)?;
    ensure_notes_document_exists(&conn, &document_id)?;
    get_note_comment_thread_by_id(&conn, &document_id, &thread_id)?;

    let updated = conn
        .execute(
            "UPDATE note_comments
             SET content = ?1, updated_at = datetime('now')
             WHERE id = ?2 AND thread_id = ?3 AND user_id = ?4",
            rusqlite::params![&content, &comment_id, &thread_id, &current_user.id],
        )
        .map_err(|e| e.to_string())?;

    if updated == 0 {
        return Err("Comment not found".into());
    }

    conn.execute(
        "UPDATE note_comment_threads
         SET updated_at = datetime('now')
         WHERE id = ?1 AND document_id = ?2",
        rusqlite::params![&thread_id, &document_id],
    )
    .map_err(|e| e.to_string())?;

    get_note_comment_thread_by_id(&conn, &document_id, &thread_id)
}

#[tauri::command]
pub fn delete_notes_comment(
    document_id: String,
    thread_id: String,
    comment_id: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<(), String> {
    let current_user = local_comment_user();
    let conn = open_db(&state)?;
    ensure_notes_document_exists(&conn, &document_id)?;

    let remaining_comments: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM note_comments WHERE thread_id = ?1",
            [&thread_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if remaining_comments <= 1 {
        return Err("Delete the thread instead of its root comment".into());
    }

    let deleted = conn
        .execute(
            "DELETE FROM note_comments
             WHERE id = ?1 AND thread_id = ?2 AND user_id = ?3",
            rusqlite::params![&comment_id, &thread_id, &current_user.id],
        )
        .map_err(|e| e.to_string())?;

    if deleted == 0 {
        return Err("Comment not found".into());
    }

    conn.execute(
        "UPDATE note_comment_threads
         SET updated_at = datetime('now')
         WHERE id = ?1 AND document_id = ?2",
        rusqlite::params![&thread_id, &document_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn sync_notes_comment_anchors(
    document_id: String,
    anchors: Vec<NoteCommentAnchorInput>,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<(), String> {
    let mut conn = open_db(&state)?;
    ensure_notes_document_exists(&conn, &document_id)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    for anchor in anchors {
        if anchor.anchor_to <= anchor.anchor_from {
            continue;
        }

        tx.execute(
            "UPDATE note_comment_threads
             SET anchor_from = ?1,
                 anchor_to = ?2,
                 anchor_exact = ?3,
                 anchor_prefix = ?4,
                 anchor_suffix = ?5,
                 updated_at = datetime('now')
             WHERE id = ?6 AND document_id = ?7",
            rusqlite::params![
                anchor.anchor_from,
                anchor.anchor_to,
                anchor.anchor_exact,
                anchor.anchor_prefix,
                anchor.anchor_suffix,
                anchor.id,
                &document_id
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
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
        .args([
            "-C",
            path.to_str().unwrap_or_default(),
            "diff",
            "--numstat",
            "HEAD",
        ])
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
                lines_added, lines_removed, stage,
                actions_status, actions_run_url
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
                actions_status: row.get(19)?,
                actions_run_url: row.get(20)?,
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
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    for row in rows {
        deploy_values.push(row.map_err(|e| e.to_string())?);
    }

    let mut host_values: Vec<String> = Vec::new();
    let mut stmt = conn
        .prepare("SELECT DISTINCT host FROM project_metadata WHERE host IS NOT NULL ORDER BY host")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
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
                    vercel_team_slug, vercel_project_name, stage,
                    actions_status, actions_run_url
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
                actions_status: row.get(17)?,
                actions_run_url: row.get(18)?,
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
    println!(
        "[update_project_field] folder={} field={} value={:?}",
        folder_key, field, value
    );
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
    "node_modules",
    "logs",
    "__pycache__",
    ".venv",
    "venv",
    "target",
    "dist",
    "build",
    ".next",
    ".nuxt",
    ".cache",
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
        if trimmed.starts_with("![") || trimmed.starts_with("[![") || trimmed.starts_with('<') {
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
            conn.execute("DELETE FROM project_metadata WHERE folder_key = ?1", [key])
                .map_err(|e| e.to_string())?;
            pruned += 1;
        }
    }

    Ok(pruned)
}

#[tauri::command]
pub fn sync_workspace(state: tauri::State<'_, WorkspaceState>) -> Result<SyncResult, String> {
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
pub fn get_diff_stats(state: tauri::State<'_, WorkspaceState>) -> Result<Vec<DiffStat>, String> {
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

        handles.into_iter().filter_map(|h| h.join().ok()).collect()
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
    /// Display name from `project_metadata` (joined in list/detail queries).
    pub folder_name: Option<String>,
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
pub fn get_task_counts(state: tauri::State<'_, WorkspaceState>) -> Result<Vec<TaskCount>, String> {
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

fn map_task_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Task> {
    Ok(Task {
        id: row.get(0)?,
        folder_key: row.get(1)?,
        folder_name: row.get(2)?,
        kind: row.get(3)?,
        title: row.get(4)?,
        description: row.get(5)?,
        status: row.get(6)?,
        priority: row.get(7)?,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
        completed_at: row.get(10)?,
    })
}

fn get_task_by_id(conn: &Connection, id: i64) -> Result<Task, String> {
    conn.query_row(
        "SELECT t.id, t.folder_key, m.folder_name, t.kind, t.title, t.description, t.status, t.priority,
                t.created_at, t.updated_at, t.completed_at
         FROM tasks t
         LEFT JOIN project_metadata m ON m.folder_key = t.folder_key
         WHERE t.id = ?1",
        [id],
        map_task_row,
    )
    .map_err(|e| e.to_string())
}

const TASK_LIST_ORDER: &str = "
             ORDER BY
                CASE t.status
                    WHEN 'in-progress' THEN 0
                    WHEN 'open' THEN 1
                    WHEN 'done' THEN 2
                    WHEN 'closed' THEN 3
                    ELSE 4
                END,
                CASE t.priority
                    WHEN 'urgent' THEN 0
                    WHEN 'high' THEN 1
                    WHEN 'medium' THEN 2
                    WHEN 'low' THEN 3
                    ELSE 4
                END,
                t.created_at DESC";

#[tauri::command]
pub fn get_tasks(
    folder_key: Option<String>,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<Vec<Task>, String> {
    let conn = open_db(&state)?;
    let sql = format!(
        "SELECT t.id, t.folder_key, m.folder_name, t.kind, t.title, t.description, t.status, t.priority,
                t.created_at, t.updated_at, t.completed_at
         FROM tasks t
         LEFT JOIN project_metadata m ON m.folder_key = t.folder_key
         WHERE (?1 IS NULL OR t.folder_key = ?1)
         {}",
        TASK_LIST_ORDER
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![folder_key], map_task_row)
        .map_err(|e| e.to_string())?;

    let mut tasks = Vec::new();
    for row in rows {
        tasks.push(row.map_err(|e| e.to_string())?);
    }
    Ok(tasks)
}

#[tauri::command]
pub fn get_task(id: i64, state: tauri::State<'_, WorkspaceState>) -> Result<Task, String> {
    let conn = open_db(&state)?;
    get_task_by_id(&conn, id)
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
            "SELECT t.id, t.folder_key, m.folder_name, t.kind, t.title, t.description, t.status, t.priority,
                    t.created_at, t.updated_at, t.completed_at
             FROM tasks t
             LEFT JOIN project_metadata m ON m.folder_key = t.folder_key
             WHERE t.id = ?1",
            [id],
            map_task_row,
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
            "SELECT t.id, t.folder_key, m.folder_name, t.kind, t.title, t.description, t.status, t.priority,
                    t.created_at, t.updated_at, t.completed_at
             FROM tasks t
             LEFT JOIN project_metadata m ON m.folder_key = t.folder_key
             WHERE t.id = ?1",
            [id],
            map_task_row,
        )
        .map_err(|e| e.to_string())?;

    Ok(task)
}

#[tauri::command]
pub fn delete_task(id: i64, state: tauri::State<'_, WorkspaceState>) -> Result<(), String> {
    let conn = open_db(&state)?;
    conn.execute("DELETE FROM tasks WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn build_claude_task_prompt(task: &Task) -> String {
    let mut prompt = format!(
        "Implement this task in the current local repository.\n\nTask title: {}\nTask kind: {}\nTask status: {}\nTask priority: {}\n",
        task.title,
        task.kind,
        task.status,
        task.priority.clone().unwrap_or_else(|| "medium".into())
    );

    if let Some(description) = task.description.as_ref().filter(|value| !value.trim().is_empty()) {
        prompt.push_str(&format!("\nTask description:\n{}\n", description.trim()));
    }

    prompt.push_str(
        "\nRequirements:\n- Work only in the current project directory.\n- Inspect the codebase first, then implement the task.\n- Make the necessary file changes locally.\n- Run relevant checks or tests if feasible.\n- At the end, summarize what changed, list the files you edited, and note any tests or checks you ran.\n",
    );

    prompt
}

fn normalize_claude_event(value: &Value) -> (String, Option<String>, Option<String>, Option<String>) {
    let raw_type = value
        .get("type")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let raw_subtype = value
        .get("subtype")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);

    if raw_type.as_deref() == Some("stream_event") {
        if let Some(delta) = value.get("event").and_then(|event| event.get("delta")) {
            if delta.get("type").and_then(Value::as_str) == Some("text_delta") {
                let text = delta
                    .get("text")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned);
                return ("assistant-text".into(), text, raw_type, raw_subtype);
            }
        }

        if let Some(event_type) = value
            .get("event")
            .and_then(|event| event.get("type"))
            .and_then(Value::as_str)
        {
            return (
                if event_type.contains("tool") {
                    "tool".into()
                } else {
                    "activity".into()
                },
                Some(event_type.to_string()),
                raw_type,
                raw_subtype,
            );
        }
    }

    if raw_type.as_deref() == Some("system") && raw_subtype.as_deref() == Some("api_retry") {
        let attempt = value
            .get("attempt")
            .and_then(Value::as_i64)
            .unwrap_or_default();
        let max_retries = value
            .get("max_retries")
            .and_then(Value::as_i64)
            .unwrap_or_default();
        let retry_delay_ms = value
            .get("retry_delay_ms")
            .and_then(Value::as_i64)
            .unwrap_or_default();
        return (
            "retry".into(),
            Some(format!(
                "Retrying API request ({attempt}/{max_retries}) in {retry_delay_ms}ms"
            )),
            raw_type,
            raw_subtype,
        );
    }

    if raw_type.as_deref() == Some("result") {
        let text = value
            .get("result")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned);
        return ("result".into(), text, raw_type, raw_subtype);
    }

    let fallback_text = value
        .get("message")
        .and_then(Value::as_str)
        .or_else(|| value.get("result").and_then(Value::as_str))
        .or_else(|| value.get("subtype").and_then(Value::as_str))
        .or_else(|| value.get("type").and_then(Value::as_str))
        .map(ToOwned::to_owned);

    ("activity".into(), fallback_text, raw_type, raw_subtype)
}

fn emit_claude_run_event(
    app: &AppHandle,
    entry: &Arc<Mutex<ClaudeRunEntry>>,
    run_id: &str,
    kind: String,
    text: Option<String>,
    raw_type: Option<String>,
    raw_subtype: Option<String>,
    data: Option<Value>,
) {
    let mut guard = match entry.lock() {
        Ok(guard) => guard,
        Err(_) => return,
    };
    guard.seq += 1;
    let payload = ClaudeRunEventPayload {
        run_id: run_id.to_string(),
        seq: guard.seq,
        ts: unix_ms_now(),
        kind,
        text,
        raw_type,
        raw_subtype,
        data,
    };
    let _ = app.emit("claude-run:event", &payload);
}

fn persist_event_to_db(
    conn: &Connection,
    run_id: &str,
    seq: u64,
    ts: u64,
    kind: &str,
    raw_type: Option<&str>,
    raw_subtype: Option<&str>,
    text: Option<&str>,
    raw_json: Option<&str>,
) {
    let _ = conn.execute(
        "INSERT OR IGNORE INTO claude_events (run_id, seq, ts, kind, raw_type, raw_subtype, text, raw_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![run_id, seq, ts, kind, raw_type, raw_subtype, text, raw_json],
    );
}

fn persist_tool_call_to_db(conn: &Connection, run_id: &str, seq: u64, value: &Value, ts: u64) {
    // Try to extract tool name from various event shapes
    let tool_name = value
        .get("event")
        .and_then(|e| e.get("name"))
        .and_then(Value::as_str)
        .or_else(|| {
            value
                .get("event")
                .and_then(|e| e.get("type"))
                .and_then(Value::as_str)
        });

    let tool_input = value
        .get("event")
        .and_then(|e| e.get("input"))
        .map(|v| v.to_string());

    let _ = conn.execute(
        "INSERT OR IGNORE INTO claude_tool_calls (run_id, seq, tool_name, tool_input_json, ts)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![run_id, seq, tool_name, tool_input, ts],
    );
}

fn spawn_claude_stream_threads(
    app: AppHandle,
    run_id: String,
    entry: Arc<Mutex<ClaudeRunEntry>>,
    stdout: std::process::ChildStdout,
    stderr: std::process::ChildStderr,
    db_path: Option<PathBuf>,
) {
    let stdout_app = app.clone();
    let stdout_run_id = run_id.clone();
    let stdout_entry = entry.clone();
    let stdout_db_path = db_path.clone();
    thread::spawn(move || {
        // Open a thread-local DB connection for persisting events
        let db_conn = stdout_db_path.and_then(|p| Connection::open(&p).ok());

        for line in BufReader::new(stdout).lines() {
            let Ok(line) = line else {
                emit_claude_run_error(
                    &stdout_app,
                    Some(stdout_run_id.clone()),
                    stdout_entry.lock().ok().map(|guard| guard.snapshot.task_id),
                    "stream",
                    "Failed reading Claude stdout",
                );
                break;
            };

            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            match serde_json::from_str::<Value>(trimmed) {
                Ok(value) => {
                    let (kind, text, raw_type, raw_subtype) = normalize_claude_event(&value);
                    let seq;
                    {
                        if let Ok(mut guard) = stdout_entry.lock() {
                            if kind == "assistant-text" {
                                if let Some(ref chunk) = text {
                                    guard.final_text.push_str(chunk);
                                }
                            } else if kind == "result" {
                                if let Some(ref result_text) = text {
                                    guard.final_text = result_text.clone();
                                }
                                guard.last_result = Some(value.clone());
                            }
                            guard.seq += 1;
                            seq = guard.seq;
                        } else {
                            seq = 0;
                        }
                    }

                    // Persist to SQLite
                    if let Some(ref conn) = db_conn {
                        let ts = unix_ms_now();
                        persist_event_to_db(
                            conn,
                            &stdout_run_id,
                            seq,
                            ts,
                            &kind,
                            raw_type.as_deref(),
                            raw_subtype.as_deref(),
                            text.as_deref(),
                            Some(trimmed),
                        );
                        if kind == "tool" {
                            persist_tool_call_to_db(conn, &stdout_run_id, seq, &value, ts);
                        }
                    }

                    // Emit to frontend (seq already incremented above, re-emit via helper)
                    let payload = ClaudeRunEventPayload {
                        run_id: stdout_run_id.clone(),
                        seq,
                        ts: unix_ms_now(),
                        kind,
                        text,
                        raw_type,
                        raw_subtype,
                        data: Some(value),
                    };
                    let _ = stdout_app.emit("claude-run:event", &payload);
                }
                Err(_) => {
                    emit_claude_run_event(
                        &stdout_app,
                        &stdout_entry,
                        &stdout_run_id,
                        "stdout".into(),
                        Some(trimmed.to_string()),
                        None,
                        None,
                        None,
                    );
                }
            }
        }
    });

    let stderr_app = app;
    let stderr_db_path = db_path;
    thread::spawn(move || {
        let db_conn = stderr_db_path.and_then(|p| Connection::open(&p).ok());

        for line in BufReader::new(stderr).lines() {
            let Ok(line) = line else {
                emit_claude_run_error(
                    &stderr_app,
                    Some(run_id.clone()),
                    entry.lock().ok().map(|guard| guard.snapshot.task_id),
                    "stream",
                    "Failed reading Claude stderr",
                );
                break;
            };
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            // Persist stderr events too
            if let Some(ref conn) = db_conn {
                let seq = entry.lock().map(|mut g| { g.seq += 1; g.seq }).unwrap_or(0);
                persist_event_to_db(
                    conn,
                    &run_id,
                    seq,
                    unix_ms_now(),
                    "stderr",
                    None,
                    None,
                    Some(trimmed),
                    None,
                );
            }

            emit_claude_run_event(
                &stderr_app,
                &entry,
                &run_id,
                "stderr".into(),
                Some(trimmed.to_string()),
                None,
                None,
                None,
            );
        }
    });
}

fn json_num_as_i64(v: &Value) -> Option<i64> {
    v.as_i64()
        .or_else(|| v.as_f64().map(|f| f as i64))
}

#[derive(Default)]
struct ClaudeSdkProjection {
    usage_json: Option<String>,
    input_tokens: Option<i64>,
    output_tokens: Option<i64>,
    cache_creation_input_tokens: Option<i64>,
    cache_read_input_tokens: Option<i64>,
    total_cost_usd: Option<f64>,
    cost_usd: Option<f64>,
    model: Option<String>,
    num_turns: Option<i64>,
    stop_reason: Option<String>,
    terminal_reason: Option<String>,
    duration_api_ms: Option<i64>,
    model_usage_json: Option<String>,
}

fn project_sdk_result(result: Option<&Value>, session_model: Option<&str>) -> ClaudeSdkProjection {
    let mut p = ClaudeSdkProjection::default();
    let Some(r) = result else {
        return p;
    };
    let usage = r.get("usage");
    p.usage_json = usage.map(|u| u.to_string());
    p.input_tokens = usage.and_then(|u| u.get("input_tokens")).and_then(|v| json_num_as_i64(v));
    p.output_tokens = usage.and_then(|u| u.get("output_tokens")).and_then(|v| json_num_as_i64(v));
    p.cache_creation_input_tokens = usage
        .and_then(|u| u.get("cache_creation_input_tokens"))
        .and_then(|v| json_num_as_i64(v));
    p.cache_read_input_tokens = usage
        .and_then(|u| u.get("cache_read_input_tokens"))
        .and_then(|v| json_num_as_i64(v));

    let model_for_pricing = usage
        .and_then(|u| u.get("model"))
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| session_model.map(str::to_string));
    p.model = model_for_pricing.clone();

    p.total_cost_usd = r.get("total_cost_usd").and_then(Value::as_f64);
    let usage_cost = usage.and_then(|u| u.get("cost_usd")).and_then(Value::as_f64);

    p.cost_usd = p.total_cost_usd.or(usage_cost).or_else(|| {
        let mn = model_for_pricing.as_deref()?;
        let (input_rate, output_rate) = model_token_pricing_usd_per_million(mn)?;
        let input = p.input_tokens.unwrap_or(0) as f64;
        let output = p.output_tokens.unwrap_or(0) as f64;
        Some((input / 1_000_000.0) * input_rate + (output / 1_000_000.0) * output_rate)
    });

    p.num_turns = r
        .get("num_turns")
        .and_then(|v| json_num_as_i64(v))
        .or_else(|| {
            usage
                .and_then(|u| u.get("num_turns"))
                .and_then(|v| json_num_as_i64(v))
        });

    p.stop_reason = r
        .get("stop_reason")
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| {
            usage
                .and_then(|u| u.get("stop_reason"))
                .and_then(Value::as_str)
                .map(str::to_string)
        });

    p.terminal_reason = r
        .get("terminal_reason")
        .and_then(Value::as_str)
        .map(str::to_string);

    p.duration_api_ms = r
        .get("duration_api_ms")
        .and_then(|v| json_num_as_i64(v));

    p.model_usage_json = r.get("modelUsage").map(|v| v.to_string());

    p
}

fn persist_claude_model_usage_breakdown(
    conn: &Connection,
    run_id: &str,
    result: &Value,
) -> rusqlite::Result<()> {
    let Some(mu) = result.get("modelUsage").and_then(Value::as_object) else {
        return Ok(());
    };
    conn.execute(
        "DELETE FROM claude_run_model_usage WHERE run_id = ?1",
        [run_id],
    )?;
    let mut stmt = conn.prepare(
        "INSERT INTO claude_run_model_usage (
            run_id, model_name, input_tokens, output_tokens,
            cache_read_input_tokens, cache_creation_input_tokens, web_search_requests,
            cost_usd, context_window, max_output_tokens
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
    )?;
    for (model_name, raw) in mu {
        let Some(obj) = raw.as_object() else {
            continue;
        };
        let i64f = |k: &str| -> Option<i64> { obj.get(k).and_then(|v| json_num_as_i64(v)) };
        let cost = obj.get("costUSD").and_then(Value::as_f64);
        stmt.execute(rusqlite::params![
            run_id,
            model_name.as_str(),
            i64f("inputTokens"),
            i64f("outputTokens"),
            i64f("cacheReadInputTokens"),
            i64f("cacheCreationInputTokens"),
            i64f("webSearchRequests"),
            cost,
            i64f("contextWindow"),
            i64f("maxOutputTokens"),
        ])?;
    }
    Ok(())
}

fn backfill_claude_results_from_events(conn: &Connection) -> rusqlite::Result<()> {
    let mut stmt = conn.prepare(
        "SELECT cr.id, cr.run_id, cr.duration_ms, cr.result_text,
                (SELECT raw_json FROM claude_events e
                 WHERE e.run_id = cr.run_id AND e.kind = 'result' AND e.raw_json IS NOT NULL
                 ORDER BY e.seq DESC LIMIT 1) AS raw_json
         FROM claude_results cr
         WHERE (
             (cr.total_cost_usd IS NULL AND cr.cost_usd IS NULL)
             OR cr.model IS NULL
         )
         AND EXISTS (
             SELECT 1 FROM claude_events e2
             WHERE e2.run_id = cr.run_id AND e2.kind = 'result' AND e2.raw_json IS NOT NULL
         )",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, Option<i64>>(2)?,
            row.get::<_, Option<String>>(3)?,
            row.get::<_, Option<String>>(4)?,
        ))
    })?;

    for r in rows {
        let (id, run_id, _duration_ms, _result_text, raw_json) = r?;
        let Some(raw) = raw_json else {
            continue;
        };
        let Ok(value) = serde_json::from_str::<Value>(&raw) else {
            continue;
        };
        let session_model = conn
            .query_row(
                "SELECT model FROM claude_sessions WHERE run_id = ?1",
                [&run_id],
                |row| row.get::<_, Option<String>>(0),
            )
            .optional()
            .ok()
            .flatten()
            .flatten();

        let proj = project_sdk_result(Some(&value), session_model.as_deref());

        let _ = conn.execute(
            "UPDATE claude_results SET
                total_cost_usd = COALESCE(total_cost_usd, ?1),
                cost_usd = COALESCE(cost_usd, ?2),
                model = COALESCE(model, ?3),
                input_tokens = COALESCE(input_tokens, ?4),
                output_tokens = COALESCE(output_tokens, ?5),
                cache_creation_input_tokens = COALESCE(cache_creation_input_tokens, ?6),
                cache_read_input_tokens = COALESCE(cache_read_input_tokens, ?7),
                num_turns = COALESCE(num_turns, ?8),
                stop_reason = COALESCE(stop_reason, ?9),
                terminal_reason = COALESCE(terminal_reason, ?10),
                duration_api_ms = COALESCE(duration_api_ms, ?11),
                model_usage_json = COALESCE(model_usage_json, ?12),
                usage_json = COALESCE(usage_json, ?13)
             WHERE id = ?14",
            rusqlite::params![
                proj.total_cost_usd,
                proj.cost_usd,
                proj.model,
                proj.input_tokens,
                proj.output_tokens,
                proj.cache_creation_input_tokens,
                proj.cache_read_input_tokens,
                proj.num_turns,
                proj.stop_reason,
                proj.terminal_reason,
                proj.duration_api_ms,
                proj.model_usage_json,
                proj.usage_json,
                id,
            ],
        );

        if value.get("modelUsage").is_some() {
            let _ = persist_claude_model_usage_breakdown(conn, &run_id, &value);
        }
    }
    Ok(())
}

fn persist_session_completion(
    db_path: &Path,
    run_id: &str,
    status: &str,
    exit_code: Option<i32>,
    finished_at: u64,
    started_at: u64,
    final_text: Option<&str>,
    result: Option<&Value>,
) {
    let Ok(conn) = Connection::open(db_path) else {
        return;
    };

    let session_model = conn
        .query_row(
            "SELECT model FROM claude_sessions WHERE run_id = ?1",
            [run_id],
            |row| row.get::<_, Option<String>>(0),
        )
        .optional()
        .ok()
        .flatten()
        .flatten();

    let proj = project_sdk_result(result, session_model.as_deref());
    let usage_json = proj.usage_json.clone();

    let _ = conn.execute(
        "UPDATE claude_sessions SET status = ?1, exit_code = ?2, finished_at = ?3, final_text = ?4, usage_json = ?5
         WHERE run_id = ?6",
        rusqlite::params![status, exit_code, finished_at, final_text, usage_json, run_id],
    );

    let duration_ms = finished_at.saturating_sub(started_at) as i64;

    let _ = conn.execute(
        "INSERT INTO claude_results (run_id, result_text, model, input_tokens, output_tokens,
            cache_creation_input_tokens, cache_read_input_tokens, cost_usd, duration_ms,
            num_turns, stop_reason, usage_json, ts, total_cost_usd, model_usage_json,
            duration_api_ms, terminal_reason)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
        rusqlite::params![
            run_id,
            final_text,
            proj.model,
            proj.input_tokens,
            proj.output_tokens,
            proj.cache_creation_input_tokens,
            proj.cache_read_input_tokens,
            proj.cost_usd,
            duration_ms,
            proj.num_turns,
            proj.stop_reason,
            proj.usage_json,
            finished_at as i64,
            proj.total_cost_usd,
            proj.model_usage_json,
            proj.duration_api_ms,
            proj.terminal_reason,
        ],
    );

    if let Some(r) = result {
        let _ = persist_claude_model_usage_breakdown(&conn, run_id, r);
    }
}

fn spawn_claude_wait_thread(
    app: AppHandle,
    run_id: String,
    entry: Arc<Mutex<ClaudeRunEntry>>,
) {
    thread::spawn(move || loop {
        let child_arc = {
            let guard = match entry.lock() {
                Ok(guard) => guard,
                Err(_) => return,
            };
            guard.child.clone()
        };

        let Some(child_arc) = child_arc else {
            return;
        };

        let maybe_status = {
            let mut child = match child_arc.lock() {
                Ok(child) => child,
                Err(_) => return,
            };
            child.try_wait().ok().flatten()
        };

        if let Some(status) = maybe_status {
            let payload = {
                let mut guard = match entry.lock() {
                    Ok(guard) => guard,
                    Err(_) => return,
                };
                guard.snapshot.finished_at = Some(unix_ms_now());
                guard.snapshot.exit_code = status.code();
                guard.snapshot.pid = None;
                guard.snapshot.status = if guard.cancelled {
                    ClaudeTaskRunStatus::Cancelled
                } else if status.success() {
                    ClaudeTaskRunStatus::Completed
                } else {
                    ClaudeTaskRunStatus::Failed
                };
                guard.child = None;

                let final_text = if guard.final_text.trim().is_empty() {
                    None
                } else {
                    Some(guard.final_text.clone())
                };

                // Persist to SQLite
                if let Some(ref db_path) = guard.db_path {
                    let status_str = match guard.snapshot.status {
                        ClaudeTaskRunStatus::Completed => "completed",
                        ClaudeTaskRunStatus::Failed => "failed",
                        ClaudeTaskRunStatus::Cancelled => "cancelled",
                        ClaudeTaskRunStatus::Starting => "starting",
                        ClaudeTaskRunStatus::Running => "running",
                    };
                    persist_session_completion(
                        db_path,
                        &run_id,
                        status_str,
                        guard.snapshot.exit_code,
                        guard.snapshot.finished_at.unwrap_or_else(unix_ms_now),
                        guard.snapshot.started_at,
                        final_text.as_deref(),
                        guard.last_result.as_ref(),
                    );
                }

                let usage = guard
                    .last_result
                    .as_ref()
                    .and_then(|r| r.get("usage").cloned());
                let total_cost_usd = guard
                    .last_result
                    .as_ref()
                    .and_then(|r| r.get("total_cost_usd"))
                    .and_then(Value::as_f64);
                let model_usage = guard
                    .last_result
                    .as_ref()
                    .and_then(|r| r.get("modelUsage").cloned());

                ClaudeRunCompletedPayload {
                    run_id: run_id.clone(),
                    task_id: guard.snapshot.task_id,
                    exit_code: guard.snapshot.exit_code,
                    status: guard.snapshot.status.clone(),
                    finished_at: guard.snapshot.finished_at.unwrap_or_else(unix_ms_now),
                    final_text,
                    usage,
                    total_cost_usd,
                    model_usage,
                }
            };

            let _ = app.emit("claude-run:completed", &payload);
            return;
        }

        thread::sleep(Duration::from_millis(250));
    });
}

/// Starts `claude -p` in the task repo. When `pass_anthropic_api_key` is false or omitted,
/// `ANTHROPIC_API_KEY` is stripped from the child environment so CLI/subscription auth can win.
#[tauri::command]
pub async fn start_claude_task_run(
    task_id: i64,
    model: Option<String>,
    pass_anthropic_api_key: Option<bool>,
    app: tauri::AppHandle,
    state: tauri::State<'_, WorkspaceState>,
    runs: tauri::State<'_, ClaudeRunState>,
) -> Result<ClaudeRunStartedPayload, String> {
    // -----------------------------------------------------------------------
    // Gather everything we need from State BEFORE the first .await so that
    // non-Send types (rusqlite::Connection, tauri::State) never cross an
    // await boundary.
    // -----------------------------------------------------------------------
    let task: Task;
    let cwd: PathBuf;
    let prompt: String;
    let run_id: String;
    let run_db_path: Option<PathBuf>;

    // Normalize model: treat empty string as None (use CLI default)
    let model = model.filter(|m| !m.trim().is_empty());
    let pass_anthropic_api_key = pass_anthropic_api_key.unwrap_or(false);

    {
        let conn = open_db(&state)?;
        task = get_task_by_id(&conn, task_id)?;
        cwd = workspace_path(&state, &task.folder_key)?;
        run_db_path = db_path(&state).ok();

        if !cwd.is_dir() {
            let message = format!("Project folder does not exist: {}", cwd.display());
            emit_claude_run_error(&app, None, Some(task_id), "preflight", &message);
            return Err(message);
        }

        // Check for active runs (in-memory only — fast)
        {
            let runs_guard = runs.runs.lock().map_err(|e| e.to_string())?;
            let active_runs = runs_guard.values().filter_map(|entry| entry.lock().ok());
            for active in active_runs {
                if matches!(
                    active.snapshot.status,
                    ClaudeTaskRunStatus::Starting | ClaudeTaskRunStatus::Running
                ) {
                    let message = if active.snapshot.task_id == task_id {
                        "A Claude run is already active for this task".to_string()
                    } else {
                        "Only one Claude run can be active at a time".to_string()
                    };
                    emit_claude_run_error(&app, None, Some(task_id), "preflight", &message);
                    return Err(message);
                }
            }
        }

        prompt = build_claude_task_prompt(&task);
        run_id = next_run_id(task_id);
        // conn is dropped here — no longer held across await
    }

    // -----------------------------------------------------------------------
    // Preflight checks — run on a blocking thread so we don't freeze the UI.
    // `claude --version` and `claude auth status` each spawn a Node.js process
    // which can take 1-3 seconds; doing this on the main thread beach-balls.
    // -----------------------------------------------------------------------
    let preflight_app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        Command::new("claude")
            .arg("--version")
            .output()
            .map_err(|e| {
                let message = format!("Claude CLI is not available on PATH: {e}");
                emit_claude_run_error(&preflight_app, None, Some(task_id), "preflight", &message);
                message
            })?;

        let auth_output = Command::new("claude")
            .args(["auth", "status"])
            .output()
            .map_err(|e| {
                let message = format!("Failed to check Claude auth status: {e}");
                emit_claude_run_error(&preflight_app, None, Some(task_id), "preflight", &message);
                message
            })?;
        if !auth_output.status.success() {
            let stderr_text = String::from_utf8_lossy(&auth_output.stderr).trim().to_string();
            let stdout_text = String::from_utf8_lossy(&auth_output.stdout).trim().to_string();
            let detail = if !stderr_text.is_empty() { stderr_text } else { stdout_text };
            let message = if detail.is_empty() {
                "Claude CLI is not authenticated. Run `claude auth login` first.".to_string()
            } else {
                format!("Claude CLI is not authenticated: {detail}")
            };
            emit_claude_run_error(&preflight_app, None, Some(task_id), "preflight", &message);
            return Err(message);
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("Preflight task panicked: {e}"))??;

    // -----------------------------------------------------------------------
    // Spawn the Claude CLI — also on a blocking thread since .spawn() can
    // briefly block on slower machines while the OS sets up the child process.
    // -----------------------------------------------------------------------
    let spawn_cwd = cwd.clone();
    let spawn_model = model.clone();
    let spawn_run_id = run_id.clone();
    let spawn_prompt = prompt.clone();
    let spawn_app = app.clone();
    let spawn_pass_api_key = pass_anthropic_api_key;

    let (child_proc, pid, child_stdout, child_stderr) =
        tauri::async_runtime::spawn_blocking(move || {
            let parent_has_api_key = env::var_os("ANTHROPIC_API_KEY").is_some();
            let child_will_receive_key = spawn_pass_api_key && parent_has_api_key;
            println!(
                "[start_claude_task_run] Claude spawn env: ANTHROPIC_API_KEY set in app process: {parent_has_api_key} | pass_to_child: {spawn_pass_api_key} | child sees key: {child_will_receive_key}"
            );

            let mut cmd = Command::new("claude");
            cmd.arg("-p")
                .arg(&spawn_prompt)
                .arg("--output-format")
                .arg("stream-json")
                .arg("--verbose")
                .arg("--include-partial-messages");

            if let Some(ref m) = spawn_model {
                cmd.arg("--model").arg(m);
            }

            if !spawn_pass_api_key {
                cmd.env_remove("ANTHROPIC_API_KEY");
            }

            let mut child = cmd
                .current_dir(&spawn_cwd)
                .stdin(Stdio::null())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| {
                    let message = format!("Failed to start Claude Code: {e}");
                    emit_claude_run_error(
                        &spawn_app,
                        Some(spawn_run_id.clone()),
                        Some(task_id),
                        "spawn",
                        &message,
                    );
                    message
                })?;

            let pid = child.id();
            let stdout = child.stdout.take().ok_or_else(|| {
                let message = "Failed to capture Claude stdout".to_string();
                emit_claude_run_error(
                    &spawn_app,
                    Some(spawn_run_id.clone()),
                    Some(task_id),
                    "spawn",
                    &message,
                );
                message
            })?;
            let stderr = child.stderr.take().ok_or_else(|| {
                let message = "Failed to capture Claude stderr".to_string();
                emit_claude_run_error(
                    &spawn_app,
                    Some(spawn_run_id.clone()),
                    Some(task_id),
                    "spawn",
                    &message,
                );
                message
            })?;

            Ok::<_, String>((child, pid, stdout, stderr))
        })
        .await
        .map_err(|e| format!("Spawn task panicked: {e}"))??;

    // -----------------------------------------------------------------------
    // Back on the async task — persist and wire up streaming.
    // Open a fresh DB connection (previous one was dropped before await).
    // -----------------------------------------------------------------------
    let started_at = unix_ms_now();

    // Persist session row to SQLite
    if let Some(ref db) = run_db_path {
        if let Ok(conn) = Connection::open(db) {
            let _ = conn.execute(
                "INSERT INTO claude_sessions (run_id, task_id, model, prompt, cwd, pid, status, started_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'running', ?7)",
                rusqlite::params![
                    run_id,
                    task_id,
                    model,
                    prompt,
                    cwd.to_string_lossy().to_string(),
                    pid,
                    started_at,
                ],
            );
        }
    }

    let child = Arc::new(Mutex::new(child_proc));
    let entry = Arc::new(Mutex::new(ClaudeRunEntry {
        snapshot: ClaudeTaskRunSnapshot {
            run_id: run_id.clone(),
            task_id,
            model: model.clone(),
            status: ClaudeTaskRunStatus::Running,
            pid: Some(pid),
            cwd: cwd.to_string_lossy().to_string(),
            started_at,
            finished_at: None,
            exit_code: None,
        },
        child: Some(child),
        cancelled: false,
        seq: 0,
        final_text: String::new(),
        last_result: None,
        db_path: run_db_path.clone(),
    }));

    runs.runs
        .lock()
        .map_err(|e| e.to_string())?
        .insert(run_id.clone(), entry.clone());

    let payload = ClaudeRunStartedPayload {
        run_id: run_id.clone(),
        task_id,
        model: model.clone(),
        cwd: cwd.to_string_lossy().to_string(),
        pid,
        started_at,
    };
    let _ = app.emit("claude-run:started", &payload);

    spawn_claude_stream_threads(app.clone(), run_id.clone(), entry.clone(), child_stdout, child_stderr, run_db_path);
    spawn_claude_wait_thread(app, run_id, entry);

    Ok(payload)
}

#[derive(Debug, Serialize)]
pub struct CancelClaudeTaskRunResponse {
    pub ok: bool,
}

#[tauri::command]
pub fn cancel_claude_task_run(
    run_id: String,
    app: tauri::AppHandle,
    runs: tauri::State<'_, ClaudeRunState>,
) -> Result<CancelClaudeTaskRunResponse, String> {
    let entry = clone_run_entry(&runs, &run_id)?;
    let child_arc = {
        let mut guard = entry.lock().map_err(|e| e.to_string())?;
        guard.cancelled = true;
        guard.snapshot.status = ClaudeTaskRunStatus::Cancelled;
        guard.child.clone()
    };

    let Some(child_arc) = child_arc else {
        return Ok(CancelClaudeTaskRunResponse { ok: true });
    };

    let mut child = child_arc.lock().map_err(|e| e.to_string())?;
    child.kill().map_err(|e| {
        let message = format!("Failed to cancel Claude run: {e}");
        let task_id = entry.lock().ok().map(|guard| guard.snapshot.task_id);
        emit_claude_run_error(&app, Some(run_id.clone()), task_id, "cancel", &message);
        message
    })?;

    Ok(CancelClaudeTaskRunResponse { ok: true })
}

#[tauri::command]
pub fn get_claude_task_run_state(
    run_id: String,
    runs: tauri::State<'_, ClaudeRunState>,
) -> Result<ClaudeTaskRunSnapshot, String> {
    let entry = clone_run_entry(&runs, &run_id)?;
    let guard = entry.lock().map_err(|e| e.to_string())?;
    Ok(guard.snapshot.clone())
}

// ---------------------------------------------------------------------------
// Claude run history queries (persisted in SQLite)
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct ClaudeSessionRow {
    pub run_id: String,
    pub task_id: i64,
    pub model: Option<String>,
    pub status: String,
    pub started_at: i64,
    pub finished_at: Option<i64>,
    pub exit_code: Option<i32>,
    pub final_text: Option<String>,
    pub usage_json: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ClaudeEventRow {
    pub id: i64,
    pub run_id: String,
    pub seq: i64,
    pub ts: i64,
    pub kind: String,
    pub raw_type: Option<String>,
    pub raw_subtype: Option<String>,
    pub text: Option<String>,
    /// Original stdout JSON line when the event was parsed from stream-json (large; use sparingly).
    pub raw_json: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ClaudeResultRow {
    pub run_id: String,
    pub result_text: Option<String>,
    pub model: Option<String>,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub cache_creation_input_tokens: Option<i64>,
    pub cache_read_input_tokens: Option<i64>,
    pub cost_usd: Option<f64>,
    pub duration_ms: Option<i64>,
    pub num_turns: Option<i64>,
    pub stop_reason: Option<String>,
    pub total_cost_usd: Option<f64>,
    pub model_usage_json: Option<String>,
    pub duration_api_ms: Option<i64>,
    pub terminal_reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ClaudeRunModelUsageRow {
    pub model_name: String,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub cache_read_input_tokens: Option<i64>,
    pub cache_creation_input_tokens: Option<i64>,
    pub web_search_requests: Option<i64>,
    pub cost_usd: Option<f64>,
    pub context_window: Option<i64>,
    pub max_output_tokens: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct TaskClaudeCostRow {
    pub task_id: i64,
    pub total_cost_usd: f64,
    pub run_count: i64,
}

#[tauri::command]
pub fn get_claude_sessions_for_task(
    task_id: i64,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<Vec<ClaudeSessionRow>, String> {
    let conn = open_db(&state)?;
    let mut stmt = conn
        .prepare(
            "SELECT run_id, task_id, model, status, started_at, finished_at, exit_code, final_text, usage_json
             FROM claude_sessions
             WHERE task_id = ?1
             ORDER BY started_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([task_id], |row| {
            Ok(ClaudeSessionRow {
                run_id: row.get(0)?,
                task_id: row.get(1)?,
                model: row.get(2)?,
                status: row.get(3)?,
                started_at: row.get(4)?,
                finished_at: row.get(5)?,
                exit_code: row.get(6)?,
                final_text: row.get(7)?,
                usage_json: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut sessions = Vec::new();
    for row in rows {
        sessions.push(row.map_err(|e| e.to_string())?);
    }
    Ok(sessions)
}

#[tauri::command]
pub fn get_claude_session_events(
    run_id: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<Vec<ClaudeEventRow>, String> {
    let conn = open_db(&state)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, run_id, seq, ts, kind, raw_type, raw_subtype, text, raw_json
             FROM claude_events
             WHERE run_id = ?1
             ORDER BY seq ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([&run_id], |row| {
            Ok(ClaudeEventRow {
                id: row.get(0)?,
                run_id: row.get(1)?,
                seq: row.get(2)?,
                ts: row.get(3)?,
                kind: row.get(4)?,
                raw_type: row.get(5)?,
                raw_subtype: row.get(6)?,
                text: row.get(7)?,
                raw_json: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut events = Vec::new();
    for row in rows {
        events.push(row.map_err(|e| e.to_string())?);
    }
    Ok(events)
}

#[tauri::command]
pub fn get_claude_session_result(
    run_id: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<Option<ClaudeResultRow>, String> {
    let conn = open_db(&state)?;
    conn.query_row(
        "SELECT run_id, result_text, model, input_tokens, output_tokens,
                cache_creation_input_tokens, cache_read_input_tokens,
                cost_usd, duration_ms, num_turns, stop_reason,
                total_cost_usd, model_usage_json, duration_api_ms, terminal_reason
         FROM claude_results
         WHERE run_id = ?1
         ORDER BY ts DESC
         LIMIT 1",
        [&run_id],
        |row| {
            Ok(ClaudeResultRow {
                run_id: row.get(0)?,
                result_text: row.get(1)?,
                model: row.get(2)?,
                input_tokens: row.get(3)?,
                output_tokens: row.get(4)?,
                cache_creation_input_tokens: row.get(5)?,
                cache_read_input_tokens: row.get(6)?,
                cost_usd: row.get(7)?,
                duration_ms: row.get(8)?,
                num_turns: row.get(9)?,
                stop_reason: row.get(10)?,
                total_cost_usd: row.get(11)?,
                model_usage_json: row.get(12)?,
                duration_api_ms: row.get(13)?,
                terminal_reason: row.get(14)?,
            })
        },
    )
    .optional()
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_claude_session_model_usage(
    run_id: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<Vec<ClaudeRunModelUsageRow>, String> {
    let conn = open_db(&state)?;
    let mut stmt = conn
        .prepare(
            "SELECT model_name, input_tokens, output_tokens, cache_read_input_tokens,
                    cache_creation_input_tokens, web_search_requests, cost_usd,
                    context_window, max_output_tokens
             FROM claude_run_model_usage
             WHERE run_id = ?1
             ORDER BY model_name ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([&run_id], |row| {
            Ok(ClaudeRunModelUsageRow {
                model_name: row.get(0)?,
                input_tokens: row.get(1)?,
                output_tokens: row.get(2)?,
                cache_read_input_tokens: row.get(3)?,
                cache_creation_input_tokens: row.get(4)?,
                web_search_requests: row.get(5)?,
                cost_usd: row.get(6)?,
                context_window: row.get(7)?,
                max_output_tokens: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
pub fn get_claude_cost_totals_by_task(
    state: tauri::State<'_, WorkspaceState>,
) -> Result<Vec<TaskClaudeCostRow>, String> {
    let conn = open_db(&state)?;
    let mut stmt = conn
        .prepare(
            "SELECT s.task_id,
                    SUM(COALESCE(r.total_cost_usd, r.cost_usd, 0.0)) AS total_cost_usd,
                    COUNT(r.id) AS run_count
             FROM claude_sessions s
             INNER JOIN claude_results r ON r.run_id = s.run_id
             GROUP BY s.task_id",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(TaskClaudeCostRow {
                task_id: row.get(0)?,
                total_cost_usd: row.get(1)?,
                run_count: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

// ---------------------------------------------------------------------------
// Secure token storage (OS Keychain)
// ---------------------------------------------------------------------------

const KEYRING_SERVICE: &str = "com.joebuilds.project-manager";

#[tauri::command]
pub fn save_secret(
    key: String,
    value: String,
    cache: tauri::State<'_, TokenCache>,
) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &key).map_err(|e| e.to_string())?;
    entry.set_password(&value).map_err(|e| e.to_string())?;
    // Update in-memory cache immediately
    cache.cache.lock().unwrap().insert(key, value);
    Ok(())
}

#[tauri::command]
pub fn get_secret(key: String, cache: tauri::State<'_, TokenCache>) -> Result<Option<String>, String> {
    // Check in-memory cache first to avoid repeated keychain prompts
    if let Some(v) = cache.cache.lock().unwrap().get(&key).cloned() {
        return Ok(Some(v));
    }
    let entry = keyring::Entry::new(KEYRING_SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(pw) => {
            cache.cache.lock().unwrap().insert(key, pw.clone());
            Ok(Some(pw))
        }
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
pub fn has_secret(key: String, cache: tauri::State<'_, TokenCache>) -> Result<bool, String> {
    // Check in-memory cache first to avoid repeated keychain prompts
    if cache.cache.lock().unwrap().contains_key(&key) {
        return Ok(true);
    }
    let entry = keyring::Entry::new(KEYRING_SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(pw) => {
            cache.cache.lock().unwrap().insert(key, pw);
            Ok(true)
        }
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
    println!(
        "[update_github_repo_url] repo={} homepage={:?}",
        owner_repo, homepage
    );

    // Try in-memory cache first to avoid repeated keychain prompts
    let token = {
        let mut map = cache.cache.lock().unwrap();
        if let Some(t) = map.get("github_token").cloned() {
            println!("[update_github_repo_url] ✓ token from memory cache");
            t
        } else {
            // Not cached yet — read from keychain (may prompt once)
            let entry =
                keyring::Entry::new(KEYRING_SERVICE, "github_token").map_err(|e| e.to_string())?;
            match entry.get_password() {
                Ok(t) => {
                    println!("[update_github_repo_url] ✓ token loaded from keychain (now cached)");
                    map.insert("github_token".into(), t.clone());
                    t
                }
                Err(keyring::Error::NoEntry) => {
                    println!("[update_github_repo_url] ✗ no token in keychain");
                    return Err("No GitHub token configured. Add one in Settings.".into());
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
        println!(
            "[update_github_repo_url] ✗ GitHub error {} — {}",
            status, body
        );
        Err(format!("GitHub API error {}: {}", status, body))
    }
}

// ---------------------------------------------------------------------------
// LLM API proxy – keeps API keys in Rust, never exposes them to the webview
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn llm_request(
    provider: String,
    url: String,
    body: String,
    extra_headers: Option<std::collections::HashMap<String, String>>,
    cache: tauri::State<'_, TokenCache>,
) -> Result<String, String> {
    // Map provider to its keychain secret name
    let secret_key = match provider.as_str() {
        "anthropic" => "anthropic_api_key",
        "openai" => "openai_api_key",
        "cerebras" => "cerebras_api_key",
        other => return Err(format!("Unknown provider: {other}")),
    };

    // Retrieve API key from in-memory cache or keychain
    let api_key = {
        let mut map = cache.cache.lock().unwrap();
        if let Some(k) = map.get(secret_key).cloned() {
            k
        } else {
            let entry = keyring::Entry::new(KEYRING_SERVICE, secret_key)
                .map_err(|e| e.to_string())?;
            match entry.get_password() {
                Ok(k) => {
                    map.insert(secret_key.to_string(), k.clone());
                    k
                }
                Err(keyring::Error::NoEntry) => {
                    return Err(format!(
                        "No API key configured for {provider}. Add one in Settings."
                    ));
                }
                Err(e) => return Err(e.to_string()),
            }
        }
    };

    // Build the request
    let client = reqwest::Client::new();
    let mut req = client
        .post(&url)
        .header("Content-Type", "application/json")
        .body(body);

    // Inject auth header based on provider
    match provider.as_str() {
        "anthropic" => {
            req = req
                .header("x-api-key", &api_key)
                .header("anthropic-version", "2023-06-01");
        }
        "openai" | "cerebras" => {
            req = req.header("Authorization", format!("Bearer {}", api_key));
        }
        _ => {} // unreachable due to earlier match
    }

    // Add any extra headers from the caller
    if let Some(headers) = extra_headers {
        for (k, v) in headers {
            req = req.header(&k, &v);
        }
    }

    // Execute the request
    let resp = req.send().await.map_err(|e| format!("HTTP request failed: {e}"))?;

    let status = resp.status();
    let resp_body = resp.text().await.map_err(|e| format!("Failed to read response: {e}"))?;

    if status.is_success() {
        Ok(resp_body)
    } else {
        Err(format!("API error {}: {}", status.as_u16(), resp_body))
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
    context: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<Vec<TableView>, String> {
    let conn = open_db(&state)?;
    let mut stmt = conn
        .prepare("SELECT id, name, sorting, filters, visibility FROM table_views WHERE context = ?1 ORDER BY name")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params![context], |row| {
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
    context: String,
    sorting: String,
    filters: String,
    visibility: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<(), String> {
    let conn = open_db(&state)?;
    conn.execute(
        "INSERT INTO table_views (id, name, context, sorting, filters, visibility, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           name       = excluded.name,
           context    = excluded.context,
           sorting    = excluded.sorting,
           filters    = excluded.filters,
           visibility = excluded.visibility,
           updated_at = datetime('now')",
        rusqlite::params![id, name, context, sorting, filters, visibility],
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
    conn.execute(
        "DELETE FROM table_views WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Actions status – fetch latest CI run conclusion from GitHub / Gitea
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct ActionsStat {
    pub folder_key: String,
    pub actions_status: Option<String>,
    pub actions_run_url: Option<String>,
}

/// Extract the scheme+host base URL from a git remote URL.
/// Handles both HTTPS (`https://host/owner/repo`) and SSH (`git@host:owner/repo`) formats.
fn extract_base_url(remote_url: &str) -> Option<String> {
    if let Some(rest) = remote_url.strip_prefix("git@") {
        if let Some((host, _)) = rest.split_once(':') {
            return Some(format!("https://{}", host));
        }
        return None;
    }
    let (proto, without_proto) = if let Some(s) = remote_url.strip_prefix("https://") {
        ("https", s)
    } else if let Some(s) = remote_url.strip_prefix("http://") {
        ("http", s)
    } else {
        return None;
    };
    let host = without_proto.split('/').next()?;
    Some(format!("{}://{}", proto, host))
}

/// Call the GitHub or Gitea Actions API and return `(conclusion_or_status, html_url)`.
/// Returns `None` if no runs exist or the call fails.
fn fetch_latest_run(
    client: &reqwest::blocking::Client,
    host: &str,
    remote_url: &str,
    owner_repo: &str,
    token: Option<&str>,
) -> Option<(String, Option<String>)> {
    let url = match host {
        "github" => format!(
            "https://api.github.com/repos/{}/actions/runs?per_page=1",
            owner_repo
        ),
        "gitea" => {
            let base = extract_base_url(remote_url)?;
            format!("{}/api/v1/repos/{}/actions/runs?limit=1", base, owner_repo)
        }
        _ => return None,
    };

    let mut req = client
        .get(&url)
        .header("User-Agent", "project-manager")
        .timeout(std::time::Duration::from_secs(8));

    if let Some(t) = token {
        req = req.header("Authorization", format!("Bearer {}", t));
    }
    if host == "github" {
        req = req
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28");
    }

    let resp = req.send().ok()?;
    if !resp.status().is_success() {
        return None;
    }

    let json: serde_json::Value = resp.json().ok()?;
    let runs = json.get("workflow_runs")?.as_array()?;
    let run = runs.first()?;

    let status = run.get("status").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let conclusion = run.get("conclusion").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let html_url = run.get("html_url").and_then(|v| v.as_str()).map(|s| s.to_string());

    // If the run is in-flight, report the live status; otherwise report the conclusion.
    let effective = if status == "in_progress" || status == "queued" || status == "waiting" {
        status
    } else if !conclusion.is_empty() {
        conclusion
    } else {
        status
    };

    Some((effective, html_url))
}

#[tauri::command]
pub fn refresh_actions_status(
    state: tauri::State<'_, WorkspaceState>,
    cache: tauri::State<'_, TokenCache>,
) -> Result<Vec<ActionsStat>, String> {
    let conn = open_db(&state)?;

    // Load GitHub token from cache / keychain (soft failure — works without it for public repos)
    let github_token: Option<String> = {
        let mut map = cache.cache.lock().unwrap();
        if let Some(t) = map.get("github_token").cloned() {
            Some(t)
        } else if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, "github_token") {
            match entry.get_password() {
                Ok(t) => {
                    map.insert("github_token".into(), t.clone());
                    Some(t)
                }
                _ => None,
            }
        } else {
            None
        }
    };

    // Load Gitea token similarly (optional)
    let gitea_token: Option<String> = {
        let mut map = cache.cache.lock().unwrap();
        if let Some(t) = map.get("gitea_token").cloned() {
            Some(t)
        } else if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, "gitea_token") {
            match entry.get_password() {
                Ok(t) => {
                    map.insert("gitea_token".into(), t.clone());
                    Some(t)
                }
                _ => None,
            }
        } else {
            None
        }
    };

    // Fetch projects that have a supported host and owner_repo
    let mut stmt = conn
        .prepare(
            "SELECT folder_key, host, repo, repo_owner FROM project_metadata
             WHERE host IN ('github', 'gitea') AND repo_owner IS NOT NULL AND repo IS NOT NULL",
        )
        .map_err(|e| e.to_string())?;

    let rows: Vec<(String, String, String, String)> = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    if rows.is_empty() {
        return Ok(vec![]);
    }

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let github_token_ref = github_token.as_deref();
    let gitea_token_ref = gitea_token.as_deref();

    let results: Vec<ActionsStat> = std::thread::scope(|s| {
        let handles: Vec<_> = rows
            .iter()
            .map(|(folder_key, host, repo, owner_repo)| {
                let client = &client;
                s.spawn(move || {
                    let token = match host.as_str() {
                        "github" => github_token_ref,
                        "gitea" => gitea_token_ref,
                        _ => None,
                    };
                    let run = fetch_latest_run(client, host, repo, owner_repo, token);
                    let (actions_status, actions_run_url) = run
                        .map(|(s, u)| (Some(s), u))
                        .unwrap_or((None, None));
                    ActionsStat {
                        folder_key: folder_key.clone(),
                        actions_status,
                        actions_run_url,
                    }
                })
            })
            .collect();

        handles
            .into_iter()
            .filter_map(|h| h.join().ok())
            .collect()
    });

    // Persist results back to DB
    for stat in &results {
        conn.execute(
            "UPDATE project_metadata SET actions_status = ?1, actions_run_url = ?2 WHERE folder_key = ?3",
            rusqlite::params![stat.actions_status, stat.actions_run_url, stat.folder_key],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(results)
}

#[derive(Debug, Serialize)]
pub struct TerminalOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

#[tauri::command]
pub fn execute_terminal_command(command: String) -> Result<TerminalOutput, String> {
    let output = Command::new("zsh")
        .arg("-c")
        .arg(&command)
        .output()
        .map_err(|e| e.to_string())?;

    Ok(TerminalOutput {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}
