use crate::config::{ClaudeConfig, ClaudeMCPServer, OpenCodeConfig, OpenCodeMCPServer};
use std::fs;

#[tauri::command]
pub async fn update_claude_server(
    path: String,
    server_name: String,
    server_config: ClaudeMCPServer,
) -> Result<(), String> {
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let backup_path = format!("{}.bak", path);
    fs::write(&backup_path, &content)
        .map_err(|e| format!("Failed to create backup: {}", e))?;

    let mut config: ClaudeConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    config.mcp_servers.insert(server_name, server_config);

    let output = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    fs::write(&path, output)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn update_opencode_server(
    path: String,
    server_name: String,
    server_config: OpenCodeMCPServer,
) -> Result<(), String> {
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let backup_path = format!("{}.bak", path);
    fs::write(&backup_path, &content)
        .map_err(|e| format!("Failed to create backup: {}", e))?;

    let mut config: OpenCodeConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    config.mcp.insert(server_name, server_config);

    let output = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    fs::write(&path, output)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn disable_claude_server(path: String, server_name: String) -> Result<(), String> {
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let backup_path = format!("{}.bak", path);
    fs::write(&backup_path, &content)
        .map_err(|e| format!("Failed to create backup: {}", e))?;

    let mut config: ClaudeConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    if let Some(mut server) = config.mcp_servers.remove(&server_name) {
        server.is_active = Some(false);
        let disabled_name = format!("_disabled_{}", server_name);
        config.mcp_servers.insert(disabled_name, server);
    }

    let output = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    fs::write(&path, output)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn enable_claude_server(path: String, server_name: String) -> Result<(), String> {
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let backup_path = format!("{}.bak", path);
    fs::write(&backup_path, &content)
        .map_err(|e| format!("Failed to create backup: {}", e))?;

    let mut config: ClaudeConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    let disabled_name = format!("_disabled_{}", server_name);
    if let Some(mut server) = config.mcp_servers.remove(&disabled_name) {
        server.is_active = Some(true);
        config.mcp_servers.insert(server_name, server);
    }

    let output = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    fs::write(&path, output)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn delete_claude_server(path: String, server_name: String) -> Result<(), String> {
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let backup_path = format!("{}.bak", path);
    fs::write(&backup_path, &content)
        .map_err(|e| format!("Failed to create backup: {}", e))?;

    let mut config: ClaudeConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    config.mcp_servers.remove(&server_name);
    let disabled_name = format!("_disabled_{}", server_name);
    config.mcp_servers.remove(&disabled_name);

    let output = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    fs::write(&path, output)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn delete_opencode_server(path: String, server_name: String) -> Result<(), String> {
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let backup_path = format!("{}.bak", path);
    fs::write(&backup_path, &content)
        .map_err(|e| format!("Failed to create backup: {}", e))?;

    let mut config: OpenCodeConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    config.mcp.remove(&server_name);

    let output = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    fs::write(&path, output)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}
