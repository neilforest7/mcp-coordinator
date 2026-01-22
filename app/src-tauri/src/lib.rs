mod commands;
mod config;

use commands::{
    read_claude_config, read_opencode_config, get_default_config_paths,
    update_claude_server, update_opencode_server,
    disable_claude_server, enable_claude_server,
    delete_claude_server, delete_opencode_server,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
