use crate::db::ssh_keys;
use crate::ssh::key_manager;
use sqlx::{Pool, Sqlite};
use tauri::State;

#[tauri::command]
pub async fn add_ssh_key(
    pool: State<'_, Pool<Sqlite>>,
    name: String,
    private_key: String,
) -> Result<i64, String> {
    // Get or create master key for encryption
    let master_key = key_manager::get_or_create_master_key()?;
    
    // Validate the key format before storing
    crate::ssh::connection::validate_key_format(&private_key)?;
    
    // Add the key with encryption
    ssh_keys::add_ssh_key(&pool, &name, &private_key, &master_key).await
}

#[tauri::command]
pub async fn list_ssh_keys(
    pool: State<'_, Pool<Sqlite>>,
) -> Result<Vec<ssh_keys::SshKeyListItem>, String> {
    ssh_keys::list_ssh_keys(&pool).await
}

#[tauri::command]
pub async fn delete_ssh_key(
    pool: State<'_, Pool<Sqlite>>,
    key_id: i64,
) -> Result<(), String> {
    ssh_keys::delete_ssh_key(&pool, key_id).await
}

#[tauri::command]
pub async fn rename_ssh_key(
    pool: State<'_, Pool<Sqlite>>,
    key_id: i64,
    new_name: String,
) -> Result<(), String> {
    ssh_keys::rename_ssh_key(&pool, key_id, &new_name).await
}

#[tauri::command]
pub async fn get_ssh_key_preview(
    pool: State<'_, Pool<Sqlite>>,
    key_id: i64,
) -> Result<String, String> {
    let master_key = key_manager::get_or_create_master_key()?;
    let private_key = ssh_keys::get_ssh_key(&pool, key_id, &master_key).await?;
    
    // Return only first 100 characters for preview (security)
    let preview = if private_key.len() > 100 {
        format!("{}...", &private_key[..100])
    } else {
        private_key
    };
    
    Ok(preview)
}
