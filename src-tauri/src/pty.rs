use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use crate::commands::{
    append_terminal_event_to_db, finish_agent_run_in_db, mark_agent_run_running_in_db,
    workspace_db_path, WorkspaceState,
};
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

pub struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
    agent_run_id: Arc<Mutex<Option<String>>>,
    next_seq: Arc<Mutex<i64>>,
    db_path: Option<PathBuf>,
}

#[derive(Default)]
pub struct PtyState {
    pub sessions: Arc<Mutex<HashMap<String, PtySession>>>,
}

impl PtyState {
    pub fn new() -> Self {
        Self::default()
    }
}

#[derive(Serialize, Clone)]
struct PtyOutput {
    id: String,
    data: String,
}

#[derive(Serialize, Clone)]
struct PtyExit {
    id: String,
    code: Option<i32>,
}

fn output_event(id: &str) -> String {
    format!("pty://output/{id}")
}

fn exit_event(id: &str) -> String {
    format!("pty://exit/{id}")
}

#[tauri::command]
pub fn pty_start(
    app: AppHandle,
    state: State<'_, PtyState>,
    workspace_state: State<'_, WorkspaceState>,
    id: String,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
    agent_run_id: Option<String>,
) -> Result<(), String> {
    {
        let map = state.sessions.lock().map_err(|e| e.to_string())?;
        if map.contains_key(&id) {
            return Ok(());
        }
    }

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: rows.max(1),
            cols: cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let mut cmd = CommandBuilder::new(shell);
    cmd.env("TERM", "xterm-256color");
    if let Some(home) = dirs::home_dir() {
        cmd.env("HOME", home.to_string_lossy().to_string());
    }
    if let Some(dir) = cwd.as_deref().filter(|s| !s.is_empty()) {
        cmd.cwd(dir);
    } else if let Some(home) = dirs::home_dir() {
        cmd.cwd(home);
    }

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    let agent_run_id = Arc::new(Mutex::new(agent_run_id));
    let next_seq = Arc::new(Mutex::new(0));
    let db_path = workspace_db_path(&workspace_state).ok();

    let session = PtySession {
        master: pair.master,
        writer,
        child,
        agent_run_id: agent_run_id.clone(),
        next_seq: next_seq.clone(),
        db_path: db_path.clone(),
    };

    {
        let mut map = state.sessions.lock().map_err(|e| e.to_string())?;
        map.insert(id.clone(), session);
    }

    // Reader thread — stream output bytes as base64-ish utf8 lossy string
    let app_reader = app.clone();
    let id_reader = id.clone();
    let run_reader = agent_run_id.clone();
    let seq_reader = next_seq.clone();
    let db_reader = db_path.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                    if let (Some(db_path), Ok(run_guard)) = (db_reader.as_ref(), run_reader.lock())
                    {
                        if let Some(run_id) = run_guard.as_deref() {
                            if let Ok(mut seq) = seq_reader.lock() {
                                let _ = append_terminal_event_to_db(
                                    db_path,
                                    run_id,
                                    *seq,
                                    "output",
                                    Some(&chunk),
                                );
                                *seq += 1;
                            }
                        }
                    }
                    let _ = app_reader.emit(
                        &output_event(&id_reader),
                        PtyOutput {
                            id: id_reader.clone(),
                            data: chunk,
                        },
                    );
                }
                Err(_) => break,
            }
        }
    });

    // Waiter thread — notify frontend on exit and clean up
    let app_wait = app.clone();
    let id_wait = id.clone();
    let sessions_wait = state.sessions.clone();
    std::thread::spawn(move || {
        // Wait on child via a separate handle: kill-wait loop by polling
        loop {
            std::thread::sleep(std::time::Duration::from_millis(250));
            let mut map = match sessions_wait.lock() {
                Ok(m) => m,
                Err(_) => return,
            };
            let finished = match map.get_mut(&id_wait) {
                Some(s) => match s.child.try_wait() {
                    Ok(Some(status)) => Some(status.exit_code() as i32),
                    Ok(None) => None,
                    Err(_) => Some(-1),
                },
                None => return,
            };
            if let Some(code) = finished {
                let run_context = map.get(&id_wait).and_then(|s| {
                    let run_id = s.agent_run_id.lock().ok().and_then(|g| g.clone());
                    let seq = s.next_seq.lock().ok().map(|mut guard| {
                        let current = *guard;
                        *guard += 1;
                        current
                    });
                    run_id.map(|run_id| (s.db_path.clone(), run_id, seq))
                });
                map.remove(&id_wait);
                drop(map);
                if let Some((Some(db_path), run_id, Some(seq))) = run_context {
                    let text = format!("process exited with code {code}");
                    let _ =
                        append_terminal_event_to_db(&db_path, &run_id, seq, "exit", Some(&text));
                    let _ = finish_agent_run_in_db(&db_path, &run_id, Some(code));
                }
                let _ = app_wait.emit(
                    &exit_event(&id_wait),
                    PtyExit {
                        id: id_wait.clone(),
                        code: Some(code),
                    },
                );
                return;
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn pty_set_agent_run(
    state: State<'_, PtyState>,
    id: String,
    agent_run_id: Option<String>,
) -> Result<(), String> {
    let map = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = map
        .get(&id)
        .ok_or_else(|| "pty session not found".to_string())?;
    if let (Some(db_path), Some(run_id)) = (session.db_path.as_ref(), agent_run_id.as_deref()) {
        let _ = mark_agent_run_running_in_db(db_path, run_id);
        if let Ok(mut seq) = session.next_seq.lock() {
            let _ = append_terminal_event_to_db(
                db_path,
                run_id,
                *seq,
                "system",
                Some("agent run attached to terminal"),
            );
            *seq += 1;
        }
    }
    let mut run_guard = session.agent_run_id.lock().map_err(|e| e.to_string())?;
    *run_guard = agent_run_id;
    Ok(())
}

#[tauri::command]
pub fn pty_write(state: State<'_, PtyState>, id: String, data: String) -> Result<(), String> {
    let mut map = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = map
        .get_mut(&id)
        .ok_or_else(|| "pty session not found".to_string())?;
    if let (Some(db_path), Ok(run_guard)) = (session.db_path.as_ref(), session.agent_run_id.lock())
    {
        if let Some(run_id) = run_guard.as_deref() {
            if let Ok(mut seq) = session.next_seq.lock() {
                let _ = append_terminal_event_to_db(db_path, run_id, *seq, "input", Some(&data));
                *seq += 1;
            }
        }
    }
    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| e.to_string())?;
    session.writer.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn pty_resize(
    state: State<'_, PtyState>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let map = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = map
        .get(&id)
        .ok_or_else(|| "pty session not found".to_string())?;
    session
        .master
        .resize(PtySize {
            rows: rows.max(1),
            cols: cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn pty_kill(state: State<'_, PtyState>, id: String) -> Result<(), String> {
    let mut map = state.sessions.lock().map_err(|e| e.to_string())?;
    if let Some(mut session) = map.remove(&id) {
        let _ = session.child.kill();
    }
    Ok(())
}
