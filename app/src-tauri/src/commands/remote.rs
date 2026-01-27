use crate::config::{ClaudeConfig, OpenCodeConfig, ClaudeMCPServer, OpenCodeMCPServer, platform_adapter};
use crate::ssh::{key_manager, sftp, connection, pool::SshPool};
use crate::db::{machines, ssh_keys};
use sqlx::{Pool, Sqlite};
use tauri::State;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct RemoteConfigResponse<T> {
    pub config: T,
    pub path: String,
    pub exists: bool,
    pub app_installed: bool,
}

pub(crate) async fn get_connection_info(pool: &Pool<Sqlite>, machine_id: i64) -> Result<(String, u16, String, String, String), String> {
    let machine = machines::get_machine(pool, machine_id).await?;
    let master_key = key_manager::get_or_create_master_key()?;
    let private_key = ssh_keys::get_ssh_key(pool, machine.ssh_key_id, &master_key).await?;
    let port = machine.port.try_into().unwrap_or(22);
    Ok((machine.host, port, machine.username, private_key, machine.platform))
}

/// SECURITY: Use SFTP instead of shell commands to prevent injection vulnerabilities
pub(crate) async fn read_remote_file(pool: &Pool<Sqlite>, ssh_pool: &SshPool, machine_id: i64, path: &str) -> Result<String, String> {
    let (host, port, username, private_key, _) = get_connection_info(pool, machine_id).await?;
    sftp::sftp_read_file_with_pool(ssh_pool.clone(), &host, port, &username, &private_key, path).await
}

/// SECURITY: Use SFTP instead of shell commands to prevent injection vulnerabilities
pub(crate) async fn write_remote_file(pool: &Pool<Sqlite>, ssh_pool: &SshPool, machine_id: i64, path: &str, content: &str) -> Result<(), String> {
    let (host, port, username, private_key, _) = get_connection_info(pool, machine_id).await?;
    sftp::sftp_write_file_with_pool(ssh_pool.clone(), &host, port, &username, &private_key, path, content).await
}

/// SECURITY: Use SFTP instead of shell commands to prevent injection vulnerabilities
pub(crate) async fn backup_remote_file(pool: &Pool<Sqlite>, ssh_pool: &SshPool, machine_id: i64, path: &str) -> Result<(), String> {
    let (host, port, username, private_key, _) = get_connection_info(pool, machine_id).await?;
    
    // Create timestamped backup
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let backup_path = format!("{}.bak.{}", path, timestamp);
    
    sftp::sftp_copy_file_with_pool(ssh_pool.clone(), &host, port, &username, &private_key, path, &backup_path).await
}

async fn check_claude_installed_v2(pool: &Pool<Sqlite>, ssh_pool: &SshPool, machine_id: i64) -> bool {
    let (_, _, _, _, platform) = match get_connection_info(pool, machine_id).await {
        Ok(info) => info,
        Err(_) => return false,
    };

    let cmd = match platform.to_lowercase().as_str() {
        "macos" | "darwin" => "test -d '/Applications/Claude.app' && echo INSTALLED",
        "windows" => "powershell -Command \"if (Test-Path '$env:LOCALAPPDATA\\Anthropic\\Claude\\Claude.exe') { Write-Host 'INSTALLED' }\"",
        // For Linux, check common paths or flatpak
        "linux" => "which claude >/dev/null 2>&1 && echo INSTALLED || test -d /opt/Claude && echo INSTALLED || flatpak list | grep com.anthropic.Claude && echo INSTALLED",
        _ => return false,
    };
    
    check_app_installed_generic(pool, ssh_pool, machine_id, cmd).await
}

async fn check_app_installed_generic(pool: &Pool<Sqlite>, ssh_pool: &SshPool, machine_id: i64, check_cmd: &str) -> bool {
    let (host, port, username, private_key, _) = match get_connection_info(pool, machine_id).await {
        Ok(info) => info,
        Err(_) => return false,
    };
    
    match connection::execute_cmd_with_pool(ssh_pool.clone(), &host, port, &username, &private_key, check_cmd).await {
        Ok(output) => output.trim().contains("INSTALLED"),
        Err(_) => false,
    }
}

async fn check_opencode_installed(pool: &Pool<Sqlite>, ssh_pool: &SshPool, machine_id: i64) -> bool {
    let (_, _, _, _, platform) = match get_connection_info(pool, machine_id).await {
        Ok(info) => info,
        Err(_) => return false,
    };

    let cmd = match platform.to_lowercase().as_str() {
        "macos" | "darwin" | "linux" => "which opencode >/dev/null 2>&1 && echo INSTALLED",
        "windows" => "powershell -Command \"if (Get-Command opencode -ErrorAction SilentlyContinue) { Write-Host 'INSTALLED' }\"",
        _ => return false,
    };

    check_app_installed_generic(pool, ssh_pool, machine_id, cmd).await
}

async fn check_remote_file_exists_via_shell(pool: &Pool<Sqlite>, ssh_pool: &SshPool, machine_id: i64, path: &str) -> Result<bool, String> {
    let (host, port, username, private_key, platform) = get_connection_info(pool, machine_id).await?;
    
    let cmd = if platform.to_lowercase() == "windows" {
        // PowerShell command for Windows
        format!("powershell -Command \"if (Test-Path '{}') {{ Write-Host 'MCP_FILE_EXISTS' }} else {{ Write-Host 'MCP_FILE_MISSING' }}\"", path)
    } else {
        // Sh command for Linux/Unix
        format!("test -f {} && echo MCP_FILE_EXISTS || echo MCP_FILE_MISSING", path)
    };
    
    match connection::execute_cmd_with_pool(ssh_pool.clone(), &host, port, &username, &private_key, &cmd).await {
        Ok(output) => {
            Ok(output.contains("MCP_FILE_EXISTS"))
        },
        Err(e) => {
            println!("[Remote] Shell existence check failed: {}", e);
            Err(e)
        }
    }
}

async fn find_claude_config(pool: &Pool<Sqlite>, ssh_pool: &SshPool, machine_id: i64) -> Result<(String, Option<String>), String> {
    let candidates = vec![
        "~/.claude.json", // Linux/Mac default
        "~/AppData/Roaming/Claude/claude.json", // Windows default
        "~/Library/Application Support/Claude/claude.json", // Mac alternative?
        "~/.config/Claude/claude.json", // Linux XDG style?
    ];

    for path in &candidates {
        match read_remote_file(pool, ssh_pool, machine_id, path).await {
            Ok(content) => {
                // Verify content is valid JSON to ensure it's the right file
                if serde_json::from_str::<serde_json::Value>(&content).is_ok() {
                    return Ok((path.to_string(), Some(content)));
                } else {
                    println!("[Remote] Found file at {} but invalid JSON, skipping", path);
                }
            }
            Err(e) => {
                let e_lower = e.to_lowercase();
                if e_lower.contains("no such file") || e_lower.contains("code 2") || e_lower.contains("does not exist") {
                    // Double check via shell
                    if let Ok(true) = check_remote_file_exists_via_shell(pool, ssh_pool, machine_id, path).await {
                         return Err(format!("File '{}' exists but cannot be read via SFTP. Check permissions. (Original error: {})", path, e));
                    }
                    continue;
                }
                println!("[Remote] Failed to read candidate {}: {}", path, e);
            }
        }
    }

    // Fallback default
    Ok(("~/.claude.json".to_string(), None))
}

async fn find_opencode_config(pool: &Pool<Sqlite>, ssh_pool: &SshPool, machine_id: i64) -> Result<(String, Option<String>), String> {
    let candidates = vec![
        "~/.config/opencode/opencode.json", // Linux/Mac default
        "~/AppData/Roaming/opencode/opencode.json", // Windows guess
        "~/.opencode.json",
        "~/opencode.json",
    ];

    for path in &candidates {
        match read_remote_file(pool, ssh_pool, machine_id, path).await {
            Ok(content) => {
                 if serde_json::from_str::<serde_json::Value>(&content).is_ok() {
                    return Ok((path.to_string(), Some(content)));
                 }
            },
            Err(e) => {
                let e_lower = e.to_lowercase();
                if e_lower.contains("no such file") || e_lower.contains("code 2") || e_lower.contains("does not exist") {
                    if let Ok(true) = check_remote_file_exists_via_shell(pool, ssh_pool, machine_id, path).await {
                        return Err(format!("File '{}' exists but cannot be read via SFTP. Check permissions. (Original error: {})", path, e));
                    }
                    continue;
                }
            }
        }
    }
    
    // Default fallback if none found
    Ok(("~/.config/opencode/opencode.json".to_string(), None))
}

#[tauri::command]
pub async fn read_remote_claude_config(
    pool: State<'_, Pool<Sqlite>>,
    ssh_pool: State<'_, SshPool>,
    machine_id: i64,
) -> Result<RemoteConfigResponse<ClaudeConfig>, String> {
    let (path, content_opt) = find_claude_config(&pool, &ssh_pool, machine_id).await?;
    let app_installed = check_claude_installed_v2(&pool, &ssh_pool, machine_id).await;

    if let Some(content) = content_opt {
        println!("[Remote] Successfully read Claude config from {}", path);
        let config: ClaudeConfig = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse JSON in {}: {}", path, e))?;
        Ok(RemoteConfigResponse { config, path, exists: true, app_installed })
    } else {
        println!("[Remote] Claude config not found, returning default");
        Ok(RemoteConfigResponse { config: ClaudeConfig::default(), path, exists: false, app_installed })
    }
}

#[tauri::command]
pub async fn read_remote_opencode_config(
    pool: State<'_, Pool<Sqlite>>,
    ssh_pool: State<'_, SshPool>,
    machine_id: i64,
) -> Result<RemoteConfigResponse<OpenCodeConfig>, String> {
    let (path, content_opt) = find_opencode_config(&pool, &ssh_pool, machine_id).await?;
    let app_installed = check_opencode_installed(&pool, &ssh_pool, machine_id).await;
    
    if let Some(content) = content_opt {
        let config: OpenCodeConfig = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse JSON: {}", e))?;
        Ok(RemoteConfigResponse { config, path, exists: true, app_installed })
    } else {
        Ok(RemoteConfigResponse { config: OpenCodeConfig::default(), path, exists: false, app_installed })
    }
}

#[tauri::command]
pub async fn update_remote_claude_server(
    pool: State<'_, Pool<Sqlite>>,
    ssh_pool: State<'_, SshPool>,
    machine_id: i64,
    server_name: String,
    mut server_config: ClaudeMCPServer,
    path: Option<String>,
) -> Result<(), String> {
    let path_str = path.as_deref().unwrap_or("~/.claude.json");
    let content = match read_remote_file(&pool, &ssh_pool, machine_id, path_str).await {
        Ok(c) => c,
        Err(_) => "{}".to_string(), // Handle missing file by starting fresh
    };
    
    // Backup using SFTP
    if content != "{}" {
        let _ = backup_remote_file(&pool, &ssh_pool, machine_id, path_str).await;
    }

    // Get platform for normalization
    let (_, _, _, _, platform) = get_connection_info(&pool, machine_id).await?;

    // Normalize command
    if let Some(ref cmd) = server_config.command {
        let mut full_cmd = vec![cmd.clone()];
        if let Some(args) = &server_config.args {
            full_cmd.extend(args.clone());
        }
        
        let normalized = platform_adapter::normalize_command_for_platform(full_cmd, &platform);
        
        if !normalized.is_empty() {
            server_config.command = Some(normalized[0].clone());
            if normalized.len() > 1 {
                server_config.args = Some(normalized[1..].to_vec());
            } else {
                server_config.args = Some(vec![]);
            }
        }
    }

    let mut config: ClaudeConfig = serde_json::from_str(&content).unwrap_or_default();

    config.mcp_servers.insert(server_name, server_config);

    let output = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    write_remote_file(&pool, &ssh_pool, machine_id, path_str, &output).await?;
    Ok(())
}

#[tauri::command]
pub async fn disable_remote_claude_server(
    pool: State<'_, Pool<Sqlite>>,
    ssh_pool: State<'_, SshPool>,
    machine_id: i64,
    server_name: String,
    path: Option<String>,
) -> Result<(), String> {
    let path_str = path.as_deref().unwrap_or("~/.claude.json");
    let content = read_remote_file(&pool, &ssh_pool, machine_id, path_str).await?;
    
    let _ = backup_remote_file(&pool, &ssh_pool, machine_id, path_str).await;

    let mut config: ClaudeConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    if let Some(mut server) = config.mcp_servers.remove(&server_name) {
        server.is_active = Some(false);
        let disabled_name = format!("_disabled_{}", server_name);
        config.mcp_servers.insert(disabled_name, server);
    }

    let output = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    write_remote_file(&pool, &ssh_pool, machine_id, path_str, &output).await?;
    Ok(())
}

#[tauri::command]
pub async fn enable_remote_claude_server(
    pool: State<'_, Pool<Sqlite>>,
    ssh_pool: State<'_, SshPool>,
    machine_id: i64,
    server_name: String,
    path: Option<String>,
) -> Result<(), String> {
    let path_str = path.as_deref().unwrap_or("~/.claude.json");
    let content = read_remote_file(&pool, &ssh_pool, machine_id, path_str).await?;
    
    let _ = backup_remote_file(&pool, &ssh_pool, machine_id, path_str).await;

    let mut config: ClaudeConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    let disabled_name = format!("_disabled_{}", server_name);
    if let Some(mut server) = config.mcp_servers.remove(&disabled_name) {
        server.is_active = Some(true);
        config.mcp_servers.insert(server_name, server);
    }

    let output = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    write_remote_file(&pool, &ssh_pool, machine_id, path_str, &output).await?;
    Ok(())
}

#[tauri::command]
pub async fn delete_remote_claude_server(
    pool: State<'_, Pool<Sqlite>>,
    ssh_pool: State<'_, SshPool>,
    machine_id: i64,
    server_name: String,
    path: Option<String>,
) -> Result<(), String> {
    let path_str = path.as_deref().unwrap_or("~/.claude.json");
    let content = read_remote_file(&pool, &ssh_pool, machine_id, path_str).await?;
    
    let _ = backup_remote_file(&pool, &ssh_pool, machine_id, path_str).await;

    let mut config: ClaudeConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    config.mcp_servers.remove(&server_name);
    let disabled_name = format!("_disabled_{}", server_name);
    config.mcp_servers.remove(&disabled_name);

    let output = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    write_remote_file(&pool, &ssh_pool, machine_id, path_str, &output).await?;
    Ok(())
}

#[tauri::command]
pub async fn update_remote_opencode_server(
    pool: State<'_, Pool<Sqlite>>,
    ssh_pool: State<'_, SshPool>,
    machine_id: i64,
    server_name: String,
    mut server_config: OpenCodeMCPServer,
    path: Option<String>,
) -> Result<(), String> {
    // If path is not provided, we should probably try to find it again or fail?
    // But frontend should pass it. If not, fallback to default.
    let path_str = path.as_deref().unwrap_or("~/.config/opencode/opencode.json");
    
    let content = match read_remote_file(&pool, &ssh_pool, machine_id, path_str).await {
        Ok(c) => c,
        Err(_) => "{}".to_string(),
    };
    
    if content != "{}" {
        let _ = backup_remote_file(&pool, &ssh_pool, machine_id, path_str).await;
    }

    // Get platform for normalization
    let (_, _, _, _, platform) = get_connection_info(&pool, machine_id).await?;

    // Normalize command
    if let Some(cmd) = server_config.command {
        server_config.command = Some(platform_adapter::normalize_command_for_platform(cmd, &platform));
    }

    let mut config: OpenCodeConfig = serde_json::from_str(&content).unwrap_or_default();

    config.mcp.insert(server_name, server_config);

    let output = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    write_remote_file(&pool, &ssh_pool, machine_id, path_str, &output).await?;
    Ok(())
}

#[tauri::command]
pub async fn delete_remote_opencode_server(
    pool: State<'_, Pool<Sqlite>>,
    ssh_pool: State<'_, SshPool>,
    machine_id: i64,
    server_name: String,
    path: Option<String>,
) -> Result<(), String> {
    let path_str = path.as_deref().unwrap_or("~/.config/opencode/opencode.json");
    let content = read_remote_file(&pool, &ssh_pool, machine_id, path_str).await?;
    
    let _ = backup_remote_file(&pool, &ssh_pool, machine_id, path_str).await;

    let mut config: OpenCodeConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    config.mcp.remove(&server_name);

    let output = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    write_remote_file(&pool, &ssh_pool, machine_id, path_str, &output).await?;
    Ok(())
}

pub async fn execute_remote_command_helper(
    pool: &Pool<Sqlite>,
    ssh_pool: &SshPool,
    machine_id: i64,
    command: String,
) -> Result<String, String> {
    let (host, port, username, private_key, _) = get_connection_info(pool, machine_id).await?;
    connection::execute_cmd_with_pool(ssh_pool.clone(), &host, port, &username, &private_key, &command).await
}

#[tauri::command]
pub async fn execute_remote_command(
    pool: State<'_, Pool<Sqlite>>,
    ssh_pool: State<'_, SshPool>,
    machine_id: i64,
    command: String,
) -> Result<String, String> {
    execute_remote_command_helper(&pool, &ssh_pool, machine_id, command).await
}
