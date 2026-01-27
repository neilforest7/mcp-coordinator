use serde::Serialize;
use std::env;
use std::process::Command;
use crate::db::machines;
use crate::commands::remote::execute_remote_command_helper;
use crate::ssh::pool::SshPool;
use sqlx::{Pool, Sqlite};
use tauri::State;

#[derive(Debug, Serialize)]
pub struct EnvCheckResult {
    pub npx_exists: bool,
    pub npx_version: Option<String>,
    pub node_version: Option<String>,
    pub is_valid: bool,
    pub error: Option<String>,
}

pub fn parse_version(output: &str) -> Option<String> {
    // Simple parser: take the first line, trim.
    // npx -v -> 10.2.3
    // node -v -> v20.11.0
    let line = output.lines().next()?.trim();
    if line.is_empty() {
        None
    } else {
        Some(line.to_string())
    }
}

pub fn is_version_compatible(version: &str, min_major: u32) -> bool {
    // Handle "v" prefix if present
    let v_str = version.trim_start_matches('v');
    let parts: Vec<&str> = v_str.split('.').collect();
    if let Some(major_str) = parts.first() {
        if let Ok(major) = major_str.parse::<u32>() {
            return major >= min_major;
        }
    }
    false
}

pub fn get_kill_command(platform: &str) -> String {
    match platform.to_lowercase().as_str() {
        "windows" => "taskkill /F /IM Claude.exe".to_string(),
        _ => "pkill -f \"claude\" || true".to_string(),
    }
}

#[tauri::command]
pub fn get_host_platform() -> String {
    env::consts::OS.to_string()
}

#[tauri::command]
pub async fn nuclear_restart(
    pool: State<'_, Pool<Sqlite>>,
    ssh_pool: State<'_, SshPool>,
    machine_id: Option<i64>,
) -> Result<String, String> {
    if let Some(id) = machine_id {
        // Remote
        let machine = machines::get_machine(&pool, id).await?;
        let cmd = get_kill_command(&machine.platform);
        
        // Use helper with pool
        execute_remote_command_helper(&pool, &ssh_pool, id, cmd).await
    } else {
        // Local
        let platform = get_host_platform();
        let cmd_str = get_kill_command(&platform);
        
        println!("[System] Executing local nuclear restart: {}", cmd_str);
        
        let output = if platform == "windows" {
            Command::new("cmd")
                .args(["/C", &cmd_str])
                .output()
        } else {
            Command::new("sh")
                .arg("-c")
                .arg(&cmd_str)
                .output()
        };

        match output {
            Ok(o) => {
                if o.status.success() {
                    Ok("Restart signal sent successfully".to_string())
                } else {
                    let stderr = String::from_utf8_lossy(&o.stderr);
                    // taskkill error 128: process not found. This is fine, considered success (already dead)
                    if platform == "windows" && stderr.contains("not found") {
                        Ok("Claude was not running".to_string())
                    } else {
                         // For pkill, || true handles the "not found" case usually, but if it fails otherwise:
                        Err(format!("Command failed: {}", stderr))
                    }
                }
            }
            Err(e) => Err(format!("Failed to execute command: {}", e)),
        }
    }
}

#[tauri::command]
pub async fn check_environment(
    pool: State<'_, Pool<Sqlite>>,
    ssh_pool: State<'_, SshPool>,
    machine_id: Option<i64>,
) -> Result<EnvCheckResult, String> {
    let (npx_cmd, node_cmd) = if machine_id.is_some() {
        // Remote
        ("npx -v", "node -v")
    } else {
        // Local: Windows might need "cmd /c npx -v"
        if cfg!(windows) {
            ("cmd /c npx -v", "cmd /c node -v")
        } else {
            ("npx -v", "node -v")
        }
    };

    let run_cmd = |cmd: &str| {
        let pool = pool.clone();
        let ssh_pool = ssh_pool.clone();
        let cmd = cmd.to_string();
        async move {
            if let Some(id) = machine_id {
                // Remote
                execute_remote_command_helper(&pool, &ssh_pool, id, cmd).await
            } else {
                // Local
                if cfg!(windows) {
                    let output = Command::new("cmd")
                        .args(["/C", cmd.strip_prefix("cmd /c ").unwrap_or(&cmd)])
                        .output()
                        .map_err(|e| e.to_string())?;
                     if output.status.success() {
                        Ok(String::from_utf8_lossy(&output.stdout).to_string())
                    } else {
                        Err(String::from_utf8_lossy(&output.stderr).to_string())
                    }
                } else {
                    let output = Command::new("sh")
                        .arg("-c")
                        .arg(cmd)
                        .output()
                        .map_err(|e| e.to_string())?;
                    if output.status.success() {
                        Ok(String::from_utf8_lossy(&output.stdout).to_string())
                    } else {
                        Err(String::from_utf8_lossy(&output.stderr).to_string())
                    }
                }
            }
        }
    };

    let npx_output = run_cmd(npx_cmd).await;
    let node_output = run_cmd(node_cmd).await;

    let mut result = EnvCheckResult {
        npx_exists: false,
        npx_version: None,
        node_version: None,
        is_valid: false,
        error: None,
    };

    match npx_output {
        Ok(out) => {
            if let Some(v) = parse_version(&out) {
                result.npx_exists = true;
                // Check version >= 8 (arbitrary requirement from PRD "npx version >= 8.0.0")
                if is_version_compatible(&v, 8) {
                    result.is_valid = true;
                } else {
                    result.error = Some(format!("npx version {} is too old (>= 8.0.0 required)", v));
                }
                result.npx_version = Some(v);
            } else {
                result.error = Some("Failed to parse npx version".to_string());
            }
        },
        Err(e) => {
             result.error = Some(format!("npx check failed: {}", e));
        }
    }

    if let Ok(out) = node_output {
        result.node_version = parse_version(&out);
    }
    
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_kill_command_windows() {
        assert_eq!(get_kill_command("windows"), "taskkill /F /IM Claude.exe");
        assert_eq!(get_kill_command("Windows"), "taskkill /F /IM Claude.exe");
    }

    #[test]
    fn test_get_kill_command_linux() {
        assert_eq!(get_kill_command("linux"), "pkill -f \"claude\" || true");
    }

    #[test]
    fn test_get_kill_command_macos() {
        assert_eq!(get_kill_command("macos"), "pkill -f \"claude\" || true");
        assert_eq!(get_kill_command("darwin"), "pkill -f \"claude\" || true");
    }

    #[test]
    fn test_parse_version() {
        assert_eq!(parse_version("10.2.3\n"), Some("10.2.3".to_string()));
        assert_eq!(parse_version("v20.11.0"), Some("v20.11.0".to_string()));
        assert_eq!(parse_version(""), None);
    }

    #[test]
    fn test_is_version_compatible() {
        assert!(is_version_compatible("10.2.3", 8));
        assert!(is_version_compatible("8.0.0", 8));
        assert!(!is_version_compatible("6.14.0", 8));
        assert!(is_version_compatible("v20.11.0", 8));
        assert!(!is_version_compatible("v4.0.0", 8));
    }
}
