use crate::db::machines;
use sqlx::{Pool, Sqlite};
use tauri::State;

#[tauri::command]
pub async fn add_machine(
    pool: State<'_, Pool<Sqlite>>,
    name: String,
    host: String,
    username: String,
    ssh_key_id: i64,
    port: i64,
    platform: Option<String>,
) -> Result<i64, String> {
    let platform_val = platform.unwrap_or_else(|| "linux".to_string());
    machines::add_machine(&pool, &name, &host, &username, ssh_key_id, port, &platform_val).await
}

#[tauri::command]
pub async fn list_machines(
    pool: State<'_, Pool<Sqlite>>,
) -> Result<Vec<machines::Machine>, String> {
    machines::list_machines(&pool).await
}

#[tauri::command]
pub async fn delete_machine(
    pool: State<'_, Pool<Sqlite>>,
    id: i64,
) -> Result<(), String> {
    machines::delete_machine(&pool, id).await
}

#[tauri::command]
pub async fn update_machine(
    pool: State<'_, Pool<Sqlite>>,
    id: i64,
    name: String,
    host: String,
    username: String,
    ssh_key_id: i64,
    port: i64,
    platform: Option<String>,
) -> Result<(), String> {
    let platform_val = platform.unwrap_or_else(|| "linux".to_string());
    machines::update_machine(&pool, id, &name, &host, &username, ssh_key_id, port, &platform_val).await
}
