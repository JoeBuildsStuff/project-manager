mod commands;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_projects,
            get_project,
            get_filter_options,
            update_project_status,
            delete_projects,
            delete_project_folder,
            rename_project_folder,
            create_project,
            open_in_finder,
            open_in_vscode,
            open_url,
            run_sync_scripts,
            get_git_status,
            get_delete_guardrails,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
