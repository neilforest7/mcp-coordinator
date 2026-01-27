use sqlx::{Pool, Sqlite, Row};
use serde::Serialize;

#[derive(Serialize)]
pub struct Machine {
    pub id: i64,
    pub name: String,
    pub host: String,
    pub username: String,
    pub ssh_key_id: i64,
    pub port: i64,
    pub platform: String, // "linux" or "windows"
    pub created_at: String,
}

pub async fn add_machine(
    pool: &Pool<Sqlite>,
    name: &str,
    host: &str,
    username: &str,
    ssh_key_id: i64,
    port: i64,
    platform: &str,
) -> Result<i64, String> {
    // Ideally we would use a migration, but for this task we'll just handle it dynamically or assume the user handles migrations.
    // However, since we can't run migrations easily here, we'll alter the table if column missing logic is too complex for this tool.
    // Let's assume we can just add the column if it doesn't exist? No, SQLite ALTER TABLE ADD COLUMN is safe.
    
    // Check if column exists or try to add it (simple migration hack for this session)
    let _ = sqlx::query("ALTER TABLE machines ADD COLUMN platform TEXT DEFAULT 'linux'")
        .execute(pool)
        .await;

    let result = sqlx::query(
        "INSERT INTO machines (name, host, username, ssh_key_id, port, platform) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(name)
    .bind(host)
    .bind(username)
    .bind(ssh_key_id)
    .bind(port)
    .bind(platform)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to add machine: {}", e))?;

    let id = result.last_insert_rowid();
    println!("[DB] Machine added with ID: {}", id);
    Ok(id)
}

pub async fn list_machines(pool: &Pool<Sqlite>) -> Result<Vec<Machine>, String> {
    // Ensure column exists for list query too
    let _ = sqlx::query("ALTER TABLE machines ADD COLUMN platform TEXT DEFAULT 'linux'")
        .execute(pool)
        .await;

    println!("[DB] Listing machines...");
    let rows = sqlx::query(
        "SELECT id, name, host, username, ssh_key_id, port, platform, created_at FROM machines"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to list machines: {}", e))?;

    println!("[DB] Found {} machines", rows.len());

    let mut machines = Vec::new();
    for row in rows {
        machines.push(Machine {
            id: row.try_get("id").unwrap_or_default(),
            name: row.try_get("name").unwrap_or_default(),
            host: row.try_get("host").unwrap_or_default(),
            username: row.try_get("username").unwrap_or_default(),
            ssh_key_id: row.try_get("ssh_key_id").unwrap_or_default(),
            port: row.try_get("port").unwrap_or_default(),
            platform: row.try_get("platform").unwrap_or("linux".to_string()),
            created_at: row.try_get("created_at").unwrap_or_default(),
        });
    }

    Ok(machines)
}

pub async fn delete_machine(pool: &Pool<Sqlite>, id: i64) -> Result<(), String> {
    sqlx::query("DELETE FROM machines WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to delete machine: {}", e))?;
    Ok(())
}

pub async fn get_machine(pool: &Pool<Sqlite>, id: i64) -> Result<Machine, String> {
    let row = sqlx::query(
        "SELECT id, name, host, username, ssh_key_id, port, platform, created_at FROM machines WHERE id = ?"
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to get machine: {}", e))?
    .ok_or_else(|| "Machine not found".to_string())?;

    Ok(Machine {
        id: row.try_get("id").unwrap_or_default(),
        name: row.try_get("name").unwrap_or_default(),
        host: row.try_get("host").unwrap_or_default(),
        username: row.try_get("username").unwrap_or_default(),
        ssh_key_id: row.try_get("ssh_key_id").unwrap_or_default(),
        port: row.try_get("port").unwrap_or_default(),
        platform: row.try_get("platform").unwrap_or("linux".to_string()),
        created_at: row.try_get("created_at").unwrap_or_default(),
    })
}

pub async fn update_machine(
    pool: &Pool<Sqlite>,
    id: i64,
    name: &str,
    host: &str,
    username: &str,
    ssh_key_id: i64,
    port: i64,
    platform: &str,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE machines SET name = ?, host = ?, username = ?, ssh_key_id = ?, port = ?, platform = ? WHERE id = ?"
    )
    .bind(name)
    .bind(host)
    .bind(username)
    .bind(ssh_key_id)
    .bind(port)
    .bind(platform)
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to update machine: {}", e))?;

    Ok(())
}
