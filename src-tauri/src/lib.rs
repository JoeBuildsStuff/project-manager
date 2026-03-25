mod commands;
mod config;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(WorkspaceState::new())
        .manage(UpdateState::new())
        .invoke_handler(tauri::generate_handler![
            get_workspace_config,
            set_workspace_path,
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
            check_for_update,
            install_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
