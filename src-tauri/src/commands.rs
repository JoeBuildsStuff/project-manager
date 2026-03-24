use rusqlite::{Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::LazyLock;

/// Workspace root: resolved once at startup.
/// In dev (`cargo` or `tauri dev`), walk up from the Cargo manifest dir.
/// In production (bundled .app), walk up from the executable.
/// Falls back to `WORKSPACE_ROOT` env var if set.
static WORKSPACE: LazyLock<PathBuf> = LazyLock::new(|| {
    // 1. Explicit env override
    if let Ok(p) = std::env::var("WORKSPACE_ROOT") {
        let pb = PathBuf::from(p);
        if pb.join("project-metadata.sqlite").exists() {
            return pb;
        }
    }

    // 2. Walk up from the executable to find the workspace root
    //    (contains project-metadata.sqlite)
    if let Ok(exe) = std::env::current_exe() {
        let mut dir = exe.as_path();
        while let Some(parent) = dir.parent() {
            if parent.join("project-metadata.sqlite").exists() {
                return parent.to_path_buf();
            }
            dir = parent;
        }
    }

    // 3. Walk up from current working directory
    if let Ok(cwd) = std::env::current_dir() {
        let mut dir = cwd.as_path();
        loop {
            if dir.join("project-metadata.sqlite").exists() {
                return dir.to_path_buf();
            }
            match dir.parent() {
                Some(parent) => dir = parent,
                None => break,
            }
        }
    }

    panic!("Could not locate workspace root (project-metadata.sqlite). Set WORKSPACE_ROOT env var.");
});

static DB_PATH: LazyLock<PathBuf> = LazyLock::new(|| WORKSPACE.join("project-metadata.sqlite"));

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

fn open_db() -> SqlResult<Connection> {
    Connection::open(DB_PATH.as_path())
}

fn workspace_path(folder_key: &str) -> PathBuf {
    WORKSPACE.join(folder_key)
}

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

#[tauri::command]
pub fn get_projects(
    status_filter: Option<String>,
    category_filter: Option<String>,
    deploy_filter: Option<String>,
    host_filter: Option<String>,
    search: Option<String>,
) -> Result<Vec<Project>, String> {
    let conn = open_db().map_err(|e| e.to_string())?;

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
                vercel_team_slug, vercel_project_name
         FROM project_metadata
         {}
         ORDER BY folder_key",
        where_clause
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            let folder_key: String = row.get(0)?;
            let diff_path = workspace_path(&folder_key);
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
pub fn get_filter_options() -> Result<FilterOptions, String> {
    let conn = open_db().map_err(|e| e.to_string())?;

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
pub fn get_project(folder_key: String) -> Result<Option<Project>, String> {
    let conn = open_db().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT folder_key, folder_name, description, status, category, repo, host, repo_owner,
                    commit_count, last_commit_date, days_since_last_commit,
                    deployment, production_url, deploy_platform,
                    vercel_team_slug, vercel_project_name
             FROM project_metadata WHERE folder_key = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map([&folder_key], |row| {
            let folder_key: String = row.get(0)?;
            let diff_path = workspace_path(&folder_key);
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
pub fn update_project_status(folder_key: String, status: String) -> Result<(), String> {
    let conn = open_db().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE project_metadata SET status = ?1 WHERE folder_key = ?2",
        [&status, &folder_key],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn open_in_finder(folder_key: String) -> Result<(), String> {
    let path = WORKSPACE.join(&folder_key);
    Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn open_in_vscode(folder_key: String) -> Result<(), String> {
    let path = WORKSPACE.join(&folder_key);
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
pub fn get_git_status(folder_key: String) -> Result<GitStatus, String> {
    let path = WORKSPACE.join(&folder_key);
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
pub fn get_delete_guardrails(folder_key: String) -> Result<DeleteGuardrails, String> {
    let conn = open_db().map_err(|e| e.to_string())?;
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

    let path = workspace_path(&folder_key);
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
pub fn delete_projects(folder_keys: Vec<String>) -> Result<usize, String> {
    if folder_keys.is_empty() {
        return Ok(0);
    }

    for folder_key in &folder_keys {
        let path = workspace_path(folder_key);
        if path.exists() {
            fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
        }
    }

    let mut conn = open_db().map_err(|e| e.to_string())?;
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
pub fn delete_project_folder(folder_key: String) -> Result<usize, String> {
    let path = workspace_path(&folder_key);
    if path.exists() {
        fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
    }

    let conn = open_db().map_err(|e| e.to_string())?;
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
pub fn rename_project_folder(folder_key: String, new_name: String) -> Result<String, String> {
    let trimmed = new_name.trim();
    if trimmed.is_empty() {
        return Err("New folder name is required.".into());
    }
    if trimmed.contains('/') || trimmed.contains('\\') {
        return Err("Folder name cannot contain path separators.".into());
    }

    let old_path = workspace_path(&folder_key);
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

    let new_path = workspace_path(&new_folder_key);
    if new_path.exists() {
        return Err("A folder with that name already exists.".into());
    }

    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())?;

    let conn = open_db().map_err(|e| e.to_string())?;
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
) -> Result<(), String> {
    let folder_path = WORKSPACE.join(&folder_key);
    std::fs::create_dir_all(&folder_path).map_err(|e| e.to_string())?;

    let conn = open_db().map_err(|e| e.to_string())?;
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

#[tauri::command]
pub fn run_sync_scripts() -> Result<String, String> {
    let output = Command::new("python3")
        .args(["scripts/update-readme-repo-from-git.py"])
        .current_dir(WORKSPACE.as_path())
        .output()
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        Ok(stdout)
    } else {
        Err(format!("Script failed:\n{}\n{}", stdout, stderr))
    }
}
