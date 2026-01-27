use serde::{Deserialize, Serialize};
use sqlx::{Pool, Sqlite, Row};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SyncHistory {
    pub id: i64,
    pub scope: String,      // "cross-source" or "cross-machine"
    pub target_id: String,  // format: "123" (machine_id) or "aws_s3" (source_type)
    pub server_name: String,
    pub last_hash: String,  // MD5 hash
    pub last_synced_at: String,
}

pub async fn get_sync_history(
    pool: &Pool<Sqlite>,
    scope: &str,
    target_id: &str,
    server_name: &str,
) -> Result<Option<SyncHistory>, String> {
    let row = sqlx::query(
        "SELECT id, scope, target_id, server_name, last_hash, last_synced_at 
         FROM sync_history 
         WHERE scope = ? AND target_id = ? AND server_name = ?"
    )
    .bind(scope)
    .bind(target_id)
    .bind(server_name)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to get sync history: {}", e))?;

    match row {
        Some(row) => Ok(Some(SyncHistory {
            id: row.try_get("id").unwrap_or_default(),
            scope: row.try_get("scope").unwrap_or_default(),
            target_id: row.try_get("target_id").unwrap_or_default(),
            server_name: row.try_get("server_name").unwrap_or_default(),
            last_hash: row.try_get("last_hash").unwrap_or_default(),
            last_synced_at: row.try_get("last_synced_at").unwrap_or_default(),
        })),
        None => Ok(None),
    }
}

pub async fn upsert_sync_history(
    pool: &Pool<Sqlite>,
    scope: &str,
    target_id: &str,
    server_name: &str,
    last_hash: &str,
) -> Result<(), String> {
    // Check if exists
    let existing = get_sync_history(pool, scope, target_id, server_name).await?;

    if let Some(history) = existing {
        sqlx::query(
            "UPDATE sync_history SET last_hash = ?, last_synced_at = datetime('now') WHERE id = ?"
        )
        .bind(last_hash)
        .bind(history.id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to update sync history: {}", e))?;
    } else {
        sqlx::query(
            "INSERT INTO sync_history (scope, target_id, server_name, last_hash, last_synced_at) 
             VALUES (?, ?, ?, ?, datetime('now'))"
        )
        .bind(scope)
        .bind(target_id)
        .bind(server_name)
        .bind(last_hash)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to insert sync history: {}", e))?;
    }

    Ok(())
}
