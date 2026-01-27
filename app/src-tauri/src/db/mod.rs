use sqlx::{sqlite::SqliteConnectOptions, Pool, Sqlite, SqlitePool};
use std::str::FromStr;
use tauri::{AppHandle, Manager};
use std::fs;

pub mod machines;
pub mod ssh_keys;
pub mod sync_history;

pub async fn init_db(app_handle: &AppHandle) -> Result<Pool<Sqlite>, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    if !app_dir.exists() {
        fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    }

    let db_path = app_dir.join("mcp_hub.db");
    let db_url = format!("sqlite://{}?mode=rwc", db_path.to_string_lossy());

    let options = SqliteConnectOptions::from_str(&db_url)
        .map_err(|e| e.to_string())?
        .create_if_missing(true);

    let pool = SqlitePool::connect_with(options)
        .await
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    // Create ssh_keys table (ENCRYPTED storage with AES-GCM)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS ssh_keys (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            private_key_encrypted TEXT NOT NULL,
            iv TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to run migrations (ssh_keys): {}", e))?;

    // Create machines table with reference to ssh_key
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS machines (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            host TEXT NOT NULL,
            username TEXT NOT NULL,
            ssh_key_id INTEGER NOT NULL,
            port INTEGER NOT NULL DEFAULT 22,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (ssh_key_id) REFERENCES ssh_keys(id) ON DELETE RESTRICT
        );",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to run migrations (machines): {}", e))?;

    // Create sync_history table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS sync_history (
            id INTEGER PRIMARY KEY,
            scope TEXT NOT NULL CHECK(scope IN ('cross-source', 'cross-machine')),
            target_id TEXT NOT NULL,
            server_name TEXT NOT NULL,
            last_hash TEXT NOT NULL,
            last_synced_at TEXT NOT NULL
        );",
    )
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to run migrations (sync_history): {}", e))?;

    // Drop old credentials table (no longer needed)
    let _ = sqlx::query("DROP TABLE IF EXISTS credentials")
        .execute(&pool)
        .await;

    Ok(pool)
}
