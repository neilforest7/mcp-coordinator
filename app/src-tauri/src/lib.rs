mod commands;
mod config;
mod db;
mod ssh;
mod sync;
mod paths;
mod watcher;

use commands::{
    read_claude_config, read_opencode_config, get_default_config_paths,
    update_claude_server, update_opencode_server,
    disable_claude_server, enable_claude_server,
    delete_claude_server, delete_opencode_server,
    batch_toggle_claude_servers, batch_toggle_opencode_servers,
    test_ssh_connection,
    add_machine,
    list_machines,
    delete_machine,
    execute_remote_command,
    read_remote_claude_config,
    read_remote_opencode_config,
    update_remote_claude_server,
    disable_remote_claude_server,
    enable_remote_claude_server,
    delete_remote_claude_server,
    update_remote_opencode_server,
    delete_remote_opencode_server,
    generate_sync_plan,
    apply_sync_opencode_to_claude,
    apply_sync_claude_to_opencode,
    add_ssh_key,
    list_ssh_keys,
    delete_ssh_key,
    rename_ssh_key,
    get_ssh_key_preview,
    get_host_platform,
    update_machine,
    nuclear_restart,
    check_environment,
};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            
            // Initialize watcher
            if let Some(paths) = paths::get_app_paths() {
                watcher::watch_config_files(handle.clone(), vec![paths.claude_path, paths.opencode_path]);
            }

            // Initialize SSH Connection Pool
            let ssh_pool = ssh::pool::SshPool::new();
            app.manage(ssh_pool);

            tauri::async_runtime::block_on(async move {
                let pool = db::init_db(&handle).await.expect("Failed to init DB");
                handle.manage(pool);
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_claude_config,
            read_opencode_config,
            get_default_config_paths,
            update_claude_server,
            update_opencode_server,
            disable_claude_server,
            enable_claude_server,
            delete_claude_server,
            delete_opencode_server,
            batch_toggle_claude_servers,
            batch_toggle_opencode_servers,
            test_ssh_connection,
            add_machine,
            list_machines,
            delete_machine,
            update_machine,
            execute_remote_command,
            read_remote_claude_config,
            read_remote_opencode_config,
            update_remote_claude_server,
            disable_remote_claude_server,
            enable_remote_claude_server,
            delete_remote_claude_server,
            update_remote_opencode_server,
            delete_remote_opencode_server,
            generate_sync_plan,
            apply_sync_opencode_to_claude,
            apply_sync_claude_to_opencode,
            add_ssh_key,
            list_ssh_keys,
            delete_ssh_key,
            rename_ssh_key,
            get_ssh_key_preview,
            get_host_platform,
            nuclear_restart,
            check_environment,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
