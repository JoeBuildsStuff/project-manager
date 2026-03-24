use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const APP_DIR_NAME: &str = "com.joebuilds.project-manager";
const CONFIG_FILE: &str = "config.json";

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct AppConfig {
    pub workspace_path: Option<String>,
}

/// Returns the path to the app's config directory:
/// ~/Library/Application Support/com.joebuilds.project-manager/
fn config_dir() -> Option<PathBuf> {
    dirs::data_dir().map(|d| d.join(APP_DIR_NAME))
}

fn config_file_path() -> Option<PathBuf> {
    config_dir().map(|d| d.join(CONFIG_FILE))
}

pub fn read_config() -> AppConfig {
    let Some(path) = config_file_path() else {
        return AppConfig::default();
    };
    match fs::read_to_string(&path) {
        Ok(contents) => serde_json::from_str(&contents).unwrap_or_default(),
        Err(_) => AppConfig::default(),
    }
}

pub fn write_config(config: &AppConfig) -> Result<(), String> {
    let dir = config_dir().ok_or("Could not determine app config directory")?;
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create config dir: {e}"))?;

    let path = dir.join(CONFIG_FILE);
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| format!("Failed to write config: {e}"))?;
    Ok(())
}
