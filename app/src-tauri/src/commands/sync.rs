use crate::config::{ClaudeConfig, OpenCodeConfig};
use crate::config::converter::{self, Platform};
use crate::sync::engine::{SyncEngine, SyncItem, SyncStatus};
use crate::sync::conflict_detector::ConflictDetector;
use crate::sync::diff_generator;
use crate::db::sync_history;
use crate::commands::remote;
use crate::ssh::pool::SshPool;
use std::fs;
use std::collections::HashMap;
use tauri::{command, State};
use sqlx::{Pool, Sqlite};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPlan {
    pub items: Vec<SyncItem>,
}

#[command]
pub async fn generate_sync_plan(
    pool: State<'_, Pool<Sqlite>>,
    ssh_pool: State<'_, SshPool>,
    claude_path: String,
    opencode_path: String,
    machine_id: Option<i64>,
) -> Result<SyncPlan, String> {
    let claude_content = if let Some(id) = machine_id {
        remote::read_remote_file(&pool, &ssh_pool, id, &claude_path).await?
    } else {
        fs::read_to_string(&claude_path)
            .map_err(|e| format!("Failed to read Claude config: {}", e))?
    };

    let opencode_content = if let Some(id) = machine_id {
        remote::read_remote_file(&pool, &ssh_pool, id, &opencode_path).await?
    } else {
        fs::read_to_string(&opencode_path)
            .map_err(|e| format!("Failed to read OpenCode config: {}", e))?
    };

    let claude_config: ClaudeConfig = serde_json::from_str(&claude_content)
        .map_err(|e| format!("Failed to parse Claude config: {}", e))?;
    let opencode_config: OpenCodeConfig = serde_json::from_str(&opencode_content)
        .map_err(|e| format!("Failed to parse OpenCode config: {}", e))?;

    let claude_map: HashMap<String, _> = claude_config.mcp_servers
        .into_iter()
        .filter(|(k, _)| !k.starts_with("_disabled_"))
        .collect();

    let opencode_map = opencode_config.mcp.clone();

    let platform = if let Some(id) = machine_id {
        let (_, _, _, _, p) = remote::get_connection_info(&pool, id).await?;
        p.parse().unwrap_or(Platform::Linux)
    } else {
        Platform::current()
    };

    let target_id = machine_id.map(|id| format!("machine_{}", id)).unwrap_or_else(|| "local".to_string());
    let engine = SyncEngine::new(&pool, "cross-source", &target_id);
    
    let mut items = engine.plan(
        &claude_map,
        &opencode_map,
        |v| ConflictDetector::fingerprint_claude(v),
        |v| ConflictDetector::fingerprint_opencode(v),
        |v| ConflictDetector::canonical_fingerprint_claude(v),
        |v| ConflictDetector::canonical_fingerprint_opencode(v),
    ).await?;

    // Enrich items with diff data and JSON
    for item in items.iter_mut() {
        let claude_server = claude_map.get(&item.name);
        let opencode_server = opencode_map.get(&item.name);

        // Always populate JSON fields for UI details
        if let Some(cs) = claude_server {
            item.claude_json = Some(serde_json::to_string_pretty(cs).unwrap_or_default());
        }
        if let Some(os) = opencode_server {
            item.opencode_json = Some(serde_json::to_string_pretty(os).unwrap_or_default());
        }

        if item.status == SyncStatus::Conflict {
            if let (Some(cs), Some(os)) = (claude_server, opencode_server) {
                let claude_json = item.claude_json.clone().unwrap_or_default();
                let opencode_json = item.opencode_json.clone().unwrap_or_default();
                
                // Convert for normalization
                let claude_as_opencode = converter::claude_to_opencode(cs, platform);
                let opencode_as_claude = converter::opencode_to_claude(os, platform);
                
                let claude_as_opencode_json = serde_json::to_string_pretty(&claude_as_opencode).unwrap_or_default();
                let opencode_as_claude_json = serde_json::to_string_pretty(&opencode_as_claude).unwrap_or_default();

                let diff = diff_generator::generate_unified_diff(
                    &claude_json, 
                    &opencode_json, 
                    "Claude", 
                    "OpenCode"
                );
                let diff_result = diff_generator::generate_diff_lines(&claude_json, &opencode_json);
                
                item.diff = Some(diff);
                item.diff_lines = Some(diff_result.lines);
                item.claude_as_opencode_json = Some(claude_as_opencode_json);
                item.opencode_as_claude_json = Some(opencode_as_claude_json);
            }
        }
    }

    Ok(SyncPlan { items })
}

#[command]
pub async fn apply_sync_opencode_to_claude(
    pool: State<'_, Pool<Sqlite>>,
    ssh_pool: State<'_, SshPool>,
    claude_path: String,
    opencode_path: String,
    server_names: Vec<String>,
    machine_id: Option<i64>,
) -> Result<(), String> {
    let claude_content = if let Some(id) = machine_id {
        remote::read_remote_file(&pool, &ssh_pool, id, &claude_path).await?
    } else {
        fs::read_to_string(&claude_path)
            .map_err(|e| format!("Failed to read Claude config: {}", e))?
    };

    let opencode_content = if let Some(id) = machine_id {
        remote::read_remote_file(&pool, &ssh_pool, id, &opencode_path).await?
    } else {
        fs::read_to_string(&opencode_path)
            .map_err(|e| format!("Failed to read OpenCode config: {}", e))?
    };

    let mut claude_config: ClaudeConfig = serde_json::from_str(&claude_content)
        .map_err(|e| format!("Failed to parse Claude config: {}", e))?;
    let opencode_config: OpenCodeConfig = serde_json::from_str(&opencode_content)
        .map_err(|e| format!("Failed to parse OpenCode config: {}", e))?;

    let platform = if let Some(id) = machine_id {
        let (_, _, _, _, p) = remote::get_connection_info(&pool, id).await?;
        p.parse().unwrap_or(Platform::Linux)
    } else {
        Platform::current()
    };

    let target_id = machine_id.map(|id| format!("machine_{}", id)).unwrap_or_else(|| "local".to_string());

    for name in server_names {
        if let Some(server) = opencode_config.mcp.get(&name) {
            let converted = converter::opencode_to_claude(server, platform.clone());
            claude_config.mcp_servers.insert(name.clone(), converted.clone());
            
            // Update history
            let hash = ConflictDetector::fingerprint_claude(&converted);
            sync_history::upsert_sync_history(&pool, "cross-source", &target_id, &name, &hash).await?;
        }
    }

    let output = serde_json::to_string_pretty(&claude_config)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    if let Some(id) = machine_id {
        let _ = remote::backup_remote_file(&pool, &ssh_pool, id, &claude_path).await;
        remote::write_remote_file(&pool, &ssh_pool, id, &claude_path, &output).await?;
    } else {
        let backup_path = format!("{}.bak", claude_path);
        fs::write(&backup_path, &claude_content)
            .map_err(|e| format!("Failed to create backup: {}", e))?;
        fs::write(&claude_path, output)
            .map_err(|e| format!("Failed to write file: {}", e))?;
    }

    Ok(())
}

#[command]
pub async fn apply_sync_claude_to_opencode(
    pool: State<'_, Pool<Sqlite>>,
    ssh_pool: State<'_, SshPool>,
    claude_path: String,
    opencode_path: String,
    server_names: Vec<String>,
    machine_id: Option<i64>,
) -> Result<(), String> {
    let claude_content = if let Some(id) = machine_id {
        remote::read_remote_file(&pool, &ssh_pool, id, &claude_path).await?
    } else {
        fs::read_to_string(&claude_path)
            .map_err(|e| format!("Failed to read Claude config: {}", e))?
    };

    let opencode_content = if let Some(id) = machine_id {
        remote::read_remote_file(&pool, &ssh_pool, id, &opencode_path).await?
    } else {
        fs::read_to_string(&opencode_path)
            .map_err(|e| format!("Failed to read OpenCode config: {}", e))?
    };

    let claude_config: ClaudeConfig = serde_json::from_str(&claude_content)
        .map_err(|e| format!("Failed to parse Claude config: {}", e))?;
    let mut opencode_config: OpenCodeConfig = serde_json::from_str(&opencode_content)
        .map_err(|e| format!("Failed to parse OpenCode config: {}", e))?;

    let platform = if let Some(id) = machine_id {
        let (_, _, _, _, p) = remote::get_connection_info(&pool, id).await?;
        p.parse().unwrap_or(Platform::Linux)
    } else {
        Platform::current()
    };

    let target_id = machine_id.map(|id| format!("machine_{}", id)).unwrap_or_else(|| "local".to_string());

    for name in server_names {
        if let Some(server) = claude_config.mcp_servers.get(&name) {
            let converted = converter::claude_to_opencode(server, platform.clone());
            opencode_config.mcp.insert(name.clone(), converted.clone());

            // Update history
            let hash = ConflictDetector::fingerprint_opencode(&converted);
            sync_history::upsert_sync_history(&pool, "cross-source", &target_id, &name, &hash).await?;
        }
    }

    let output = serde_json::to_string_pretty(&opencode_config)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    if let Some(id) = machine_id {
        let _ = remote::backup_remote_file(&pool, &ssh_pool, id, &opencode_path).await;
        remote::write_remote_file(&pool, &ssh_pool, id, &opencode_path, &output).await?;
    } else {
        let backup_path = format!("{}.bak", opencode_path);
        fs::write(&backup_path, &opencode_content)
            .map_err(|e| format!("Failed to create backup: {}", e))?;
        fs::write(&opencode_path, output)
            .map_err(|e| format!("Failed to write file: {}", e))?;
    }

    Ok(())
}
