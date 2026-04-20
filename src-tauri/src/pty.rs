use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};

use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

pub struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
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
    id: String,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
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

    let session = PtySession {
        master: pair.master,
        writer,
        child,
    };

    {
        let mut map = state.sessions.lock().map_err(|e| e.to_string())?;
        map.insert(id.clone(), session);
    }

    // Reader thread — stream output bytes as base64-ish utf8 lossy string
    let app_reader = app.clone();
    let id_reader = id.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
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
                map.remove(&id_wait);
                drop(map);
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
pub fn pty_write(state: State<'_, PtyState>, id: String, data: String) -> Result<(), String> {
    let mut map = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = map
        .get_mut(&id)
        .ok_or_else(|| "pty session not found".to_string())?;
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
