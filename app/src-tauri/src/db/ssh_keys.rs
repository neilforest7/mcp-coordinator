use sqlx::{Pool, Sqlite, Row};
use serde::{Deserialize, Serialize};
use crate::ssh::encryption;

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SshKey {
    pub id: i64,
    pub name: String,
    #[serde(skip)]  // Never serialize the private key to frontend
    pub private_key_encrypted: String,
    #[serde(skip)]  // Never serialize the IV to frontend
    pub iv: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SshKeyListItem {
    pub id: i64,
    pub name: String,
    pub created_at: String,
}

/// Add a new SSH key with encryption
pub async fn add_ssh_key(
    pool: &Pool<Sqlite>,
    name: &str,
    private_key: &str,
    master_key: &[u8; 32],
) -> Result<i64, String> {
    // Encrypt the private key
    let (encrypted, iv) = encryption::encrypt(private_key, master_key)?;
    
    let result = sqlx::query(
        "INSERT INTO ssh_keys (name, private_key_encrypted, iv) VALUES (?, ?, ?)"
    )
    .bind(name)
    .bind(&encrypted)
    .bind(&iv)
    .execute(pool)
    .await
    .map_err(|e| {
        if e.to_string().contains("UNIQUE constraint") {
            format!("SSH key with name '{}' already exists", name)
        } else {
            format!("Database error: {}", e)
        }
    })?;

    Ok(result.last_insert_rowid())
}

/// Get all SSH keys (without decrypting private keys)
pub async fn list_ssh_keys(pool: &Pool<Sqlite>) -> Result<Vec<SshKeyListItem>, String> {
    let rows = sqlx::query(
        "SELECT id, name, created_at FROM ssh_keys ORDER BY created_at DESC"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let keys = rows.into_iter().map(|row| {
        SshKeyListItem {
            id: row.get("id"),
            name: row.get("name"),
            created_at: row.get("created_at"),
        }
    }).collect();

    Ok(keys)
}

/// Get a specific SSH key and decrypt its private key
pub async fn get_ssh_key(
    pool: &Pool<Sqlite>,
    key_id: i64,
    master_key: &[u8; 32],
) -> Result<String, String> {
    let row: (String, String) = sqlx::query_as(
        "SELECT private_key_encrypted, iv FROM ssh_keys WHERE id = ?"
    )
    .bind(key_id)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        if e.to_string().contains("no rows") {
            format!("SSH key with ID {} not found", key_id)
        } else {
            format!("Database error: {}", e)
        }
    })?;

    let (encrypted, iv) = row;
    
    // Decrypt the private key
    let decrypted = encryption::decrypt(&encrypted, &iv, master_key)?;
    
    Ok(decrypted)
}

/// Get SSH key by name and decrypt
#[allow(dead_code)]
pub async fn get_ssh_key_by_name(
    pool: &Pool<Sqlite>,
    name: &str,
    master_key: &[u8; 32],
) -> Result<String, String> {
    let row: (String, String) = sqlx::query_as(
        "SELECT private_key_encrypted, iv FROM ssh_keys WHERE name = ?"
    )
    .bind(name)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        if e.to_string().contains("no rows") {
            format!("SSH key '{}' not found", name)
        } else {
            format!("Database error: {}", e)
        }
    })?;

    let (encrypted, iv) = row;
    
    // Decrypt the private key
    let decrypted = encryption::decrypt(&encrypted, &iv, master_key)?;
    
    Ok(decrypted)
}

/// Delete an SSH key
pub async fn delete_ssh_key(pool: &Pool<Sqlite>, key_id: i64) -> Result<(), String> {
    // Check if any machines are using this key
    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM machines WHERE ssh_key_id = ?"
    )
    .bind(key_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if count.0 > 0 {
        return Err(format!(
            "Cannot delete SSH key: {} machine(s) are using it",
            count.0
        ));
    }

    sqlx::query("DELETE FROM ssh_keys WHERE id = ?")
        .bind(key_id)
        .execute(pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    Ok(())
}

/// Update SSH key name
pub async fn rename_ssh_key(
    pool: &Pool<Sqlite>,
    key_id: i64,
    new_name: &str,
) -> Result<(), String> {
    sqlx::query("UPDATE ssh_keys SET name = ? WHERE id = ?")
        .bind(new_name)
        .bind(key_id)
        .execute(pool)
        .await
        .map_err(|e| {
            if e.to_string().contains("UNIQUE constraint") {
                format!("SSH key with name '{}' already exists", new_name)
            } else {
                format!("Database error: {}", e)
            }
        })?;

    Ok(())
}
