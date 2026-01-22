use crate::config::{ClaudeConfig, OpenCodeConfig};

#[tauri::command]
pub async fn read_claude_config(path: String) -> Result<ClaudeConfig, String> {
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let config: ClaudeConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    Ok(config)
}

#[tauri::command]
pub async fn read_opencode_config(path: String) -> Result<OpenCodeConfig, String> {
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let config: OpenCodeConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    Ok(config)
}

#[tauri::command]
pub async fn get_default_config_paths() -> Result<ConfigPaths, String> {
    let home = dirs::home_dir()
        .ok_or_else(|| "Could not determine home directory".to_string())?;

    let claude_path = home.join(".claude.json");
    let opencode_path = home.join("opencode.json");

    Ok(ConfigPaths {
        claude: claude_path.to_string_lossy().to_string(),
        claude_exists: claude_path.exists(),
        opencode: opencode_path.to_string_lossy().to_string(),
        opencode_exists: opencode_path.exists(),
    })
}

#[derive(serde::Serialize)]
pub struct ConfigPaths {
    pub claude: String,
    pub claude_exists: bool,
    pub opencode: String,
    pub opencode_exists: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_get_default_config_paths() {
        let paths = get_default_config_paths().await.expect("Failed to get paths");
        println!("Claude Path: {}", paths.claude);
        println!("OpenCode Path: {}", paths.opencode);
        
        assert!(!paths.claude.is_empty());
        assert!(!paths.opencode.is_empty());
        
        // In this environment, it should be absolute path
        assert!(paths.claude.starts_with("/"));
    }
}
