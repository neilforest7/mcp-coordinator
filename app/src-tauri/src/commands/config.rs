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

/// Request struct for batch toggle operations
#[derive(Debug, Clone, serde::Deserialize)]
pub struct BatchToggleItem {
    pub name: String,
    pub enabled: bool,
}

/// Batch enable/disable Claude servers in a single file operation
#[tauri::command]
pub async fn batch_toggle_claude_servers(
    path: String,
    items: Vec<BatchToggleItem>,
) -> Result<(), String> {
    if items.is_empty() {
        return Ok(());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let backup_path = format!("{}.bak", path);
    fs::write(&backup_path, &content)
        .map_err(|e| format!("Failed to create backup: {}", e))?;

    let mut config: ClaudeConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    for item in items {
        let disabled_name = format!("_disabled_{}", item.name);
        
        if item.enabled {
            // Enable: move from _disabled_<name> to <name>
            if let Some(mut server) = config.mcp_servers.remove(&disabled_name) {
                server.is_active = Some(true);
                config.mcp_servers.insert(item.name, server);
            }
        } else {
            // Disable: move from <name> to _disabled_<name>
            if let Some(mut server) = config.mcp_servers.remove(&item.name) {
                server.is_active = Some(false);
                config.mcp_servers.insert(disabled_name, server);
            }
        }
    }

    let output = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    fs::write(&path, output)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

/// Batch enable/disable OpenCode servers in a single file operation
#[tauri::command]
pub async fn batch_toggle_opencode_servers(
    path: String,
    items: Vec<BatchToggleItem>,
) -> Result<(), String> {
    if items.is_empty() {
        return Ok(());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let backup_path = format!("{}.bak", path);
    fs::write(&backup_path, &content)
        .map_err(|e| format!("Failed to create backup: {}", e))?;

    let mut config: OpenCodeConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    for item in items {
        if let Some(server) = config.mcp.get_mut(&item.name) {
            server.enabled = Some(item.enabled);
        }
    }

    let output = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    fs::write(&path, output)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;
    use std::io::Write;

    fn create_test_claude_config() -> String {
        r#"{
            "mcpServers": {
                "server1": {"command": "npx", "args": ["-y", "server1"]},
                "server2": {"command": "npx", "args": ["-y", "server2"]},
                "_disabled_server3": {"command": "npx", "args": ["-y", "server3"], "isActive": false}
            }
        }"#.to_string()
    }

    fn create_test_opencode_config() -> String {
        r#"{
            "mcp": {
                "server1": {"type": "local", "command": ["npx", "-y", "server1"], "enabled": true},
                "server2": {"type": "local", "command": ["npx", "-y", "server2"], "enabled": true},
                "server3": {"type": "local", "command": ["npx", "-y", "server3"], "enabled": false}
            }
        }"#.to_string()
    }

    #[tokio::test]
    async fn test_batch_toggle_claude_servers_disable() {
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(create_test_claude_config().as_bytes()).unwrap();
        let path = file.path().to_string_lossy().to_string();

        let items = vec![
            BatchToggleItem { name: "server1".to_string(), enabled: false },
            BatchToggleItem { name: "server2".to_string(), enabled: false },
        ];

        let result = batch_toggle_claude_servers(path.clone(), items).await;
        assert!(result.is_ok());

        let content = fs::read_to_string(&path).unwrap();
        let config: ClaudeConfig = serde_json::from_str(&content).unwrap();

        // Both servers should be moved to disabled state
        assert!(config.mcp_servers.contains_key("_disabled_server1"));
        assert!(config.mcp_servers.contains_key("_disabled_server2"));
        assert!(!config.mcp_servers.contains_key("server1"));
        assert!(!config.mcp_servers.contains_key("server2"));
    }

    #[tokio::test]
    async fn test_batch_toggle_claude_servers_enable() {
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(create_test_claude_config().as_bytes()).unwrap();
        let path = file.path().to_string_lossy().to_string();

        let items = vec![
            BatchToggleItem { name: "server3".to_string(), enabled: true },
        ];

        let result = batch_toggle_claude_servers(path.clone(), items).await;
        assert!(result.is_ok());

        let content = fs::read_to_string(&path).unwrap();
        let config: ClaudeConfig = serde_json::from_str(&content).unwrap();

        // server3 should be enabled (moved from _disabled_server3)
        assert!(config.mcp_servers.contains_key("server3"));
        assert!(!config.mcp_servers.contains_key("_disabled_server3"));
    }

    #[tokio::test]
    async fn test_batch_toggle_claude_servers_mixed() {
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(create_test_claude_config().as_bytes()).unwrap();
        let path = file.path().to_string_lossy().to_string();

        let items = vec![
            BatchToggleItem { name: "server1".to_string(), enabled: false },  // disable
            BatchToggleItem { name: "server3".to_string(), enabled: true },   // enable
        ];

        let result = batch_toggle_claude_servers(path.clone(), items).await;
        assert!(result.is_ok());

        let content = fs::read_to_string(&path).unwrap();
        let config: ClaudeConfig = serde_json::from_str(&content).unwrap();

        assert!(config.mcp_servers.contains_key("_disabled_server1"));
        assert!(!config.mcp_servers.contains_key("server1"));
        assert!(config.mcp_servers.contains_key("server3"));
        assert!(!config.mcp_servers.contains_key("_disabled_server3"));
    }

    #[tokio::test]
    async fn test_batch_toggle_claude_servers_empty() {
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(create_test_claude_config().as_bytes()).unwrap();
        let path = file.path().to_string_lossy().to_string();

        let result = batch_toggle_claude_servers(path.clone(), vec![]).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_batch_toggle_opencode_servers() {
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(create_test_opencode_config().as_bytes()).unwrap();
        let path = file.path().to_string_lossy().to_string();

        let items = vec![
            BatchToggleItem { name: "server1".to_string(), enabled: false },
            BatchToggleItem { name: "server2".to_string(), enabled: false },
            BatchToggleItem { name: "server3".to_string(), enabled: true },
        ];

        let result = batch_toggle_opencode_servers(path.clone(), items).await;
        assert!(result.is_ok());

        let content = fs::read_to_string(&path).unwrap();
        let config: OpenCodeConfig = serde_json::from_str(&content).unwrap();

        assert_eq!(config.mcp.get("server1").unwrap().enabled, Some(false));
        assert_eq!(config.mcp.get("server2").unwrap().enabled, Some(false));
        assert_eq!(config.mcp.get("server3").unwrap().enabled, Some(true));
    }

    #[tokio::test]
    async fn test_batch_toggle_opencode_servers_empty() {
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(create_test_opencode_config().as_bytes()).unwrap();
        let path = file.path().to_string_lossy().to_string();

        let result = batch_toggle_opencode_servers(path.clone(), vec![]).await;
        assert!(result.is_ok());
    }
}
