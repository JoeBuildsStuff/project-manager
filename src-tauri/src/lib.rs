mod commands;
mod config;
mod pty;

use commands::*;
use pty::{pty_kill, pty_resize, pty_start, pty_write, PtyState};
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{Emitter, Manager};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_updater::UpdaterExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(WorkspaceState::new())
        .manage(UpdateState::new())
        .manage(TokenCache::new())
        .manage(PtyState::new())
        .setup(|app| {
            // Build app menu with "Check for Updates..." item
            let check_updates =
                MenuItemBuilder::with_id("check_for_updates", "Check for Updates...").build(app)?;

            let app_submenu = SubmenuBuilder::new(app, &app.config().product_name.clone().unwrap_or("Project Manager".into()))
                .item(&PredefinedMenuItem::about(app, None, None)?)
                .separator()
                .item(&check_updates)
                .separator()
                .item(&PredefinedMenuItem::services(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::hide(app, None)?)
                .item(&PredefinedMenuItem::hide_others(app, None)?)
                .item(&PredefinedMenuItem::show_all(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::quit(app, None)?)
                .build()?;

            let edit_submenu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let view_submenu = SubmenuBuilder::new(app, "View")
                .fullscreen()
                .build()?;

            let window_submenu = SubmenuBuilder::new(app, "Window")
                .minimize()
                .close_window()
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_submenu)
                .item(&edit_submenu)
                .item(&view_submenu)
                .item(&window_submenu)
                .build()?;

            app.set_menu(menu)?;

            // Handle "Check for Updates..." menu click
            app.on_menu_event(move |app_handle, event| {
                if event.id().as_ref() == "check_for_updates" {
                    let app_handle = app_handle.clone();
                    tauri::async_runtime::spawn(async move {
                        let updater = match app_handle.updater() {
                            Ok(u) => u,
                            Err(e) => {
                                app_handle
                                    .dialog()
                                    .message(format!("Failed to check for updates:\n{e}"))
                                    .title("Update Check Failed")
                                    .show(|_| {});
                                return;
                            }
                        };

                        match updater.check().await {
                            Ok(Some(update)) => {
                                let version = update.version.clone();
                                // Store the pending update so the sidebar install button can use it
                                if let Some(state) = app_handle.try_state::<UpdateState>() {
                                    if let Ok(mut pending) = state.pending.lock() {
                                        *pending = Some(update);
                                    }
                                }
                                // Emit event to frontend so sidebar banner appears
                                let _ = app_handle.emit("update-available", &version);

                                app_handle
                                    .dialog()
                                    .message(format!(
                                        "Version {version} is available.\n\nYou can install it from the sidebar."
                                    ))
                                    .title("Update Available")
                                    .show(|_| {});
                            }
                            Ok(None) => {
                                app_handle
                                    .dialog()
                                    .message("You are running the latest version.")
                                    .title("No Updates Available")
                                    .show(|_| {});
                            }
                            Err(e) => {
                                app_handle
                                    .dialog()
                                    .message(format!("Could not check for updates:\n{e}"))
                                    .title("Update Check Failed")
                                    .show(|_| {});
                            }
                        }
                    });
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_workspace_config,
            set_workspace_path,
            get_projects,
            get_project,
            get_filter_options,
            update_project_status,
            update_project_stage,
            update_project_field,
            delete_projects,
            delete_project_folder,
            rename_project_folder,
            create_project,
            create_project_from_onboarding,
            open_in_finder,
            open_in_vscode,
            open_url,
            sync_workspace,
            get_git_status,
            get_git_activity,
            get_delete_guardrails,
            get_diff_stats,
            check_for_update,
            install_update,
            get_task_counts,
            get_tasks,
            get_task,
            create_task,
            update_task,
            delete_task,
            get_llm_agents,
            create_llm_agent,
            update_llm_agent,
            delete_llm_agent,
            get_task_assignment_options,
            list_notes_documents,
            get_notes_document_by_id,
            create_notes_document,
            delete_notes_document,
            set_notes_document_favorite,
            set_notes_document_icon,
            save_notes_document,
            save_note_attachment,
            get_note_attachment,
            delete_note_attachment,
            get_comment_current_user,
            list_notes_comment_threads,
            create_notes_comment_thread,
            update_notes_comment_thread,
            delete_notes_comment_thread,
            create_notes_comment,
            update_notes_comment,
            delete_notes_comment,
            sync_notes_comment_anchors,
            save_secret,
            delete_secret,
            has_secret,
            update_github_repo_url,
            refresh_actions_status,
            llm_request,
            get_table_views,
            save_table_view,
            delete_table_view,
            execute_terminal_command,
            pty_start,
            pty_write,
            pty_resize,
            pty_kill,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
