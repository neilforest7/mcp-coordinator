use crate::ssh::{connection, pool::SshPool};
use tauri::State;

#[tauri::command]
pub async fn test_ssh_connection(
    pool: State<'_, SshPool>,
    host: String,
    port: u16,
    username: String,
    private_key: String
) -> Result<String, String> {
    connection::execute_cmd_with_pool(pool.inner().clone(), &host, port, &username, &private_key, "echo 'SSH connection successful'").await
}
