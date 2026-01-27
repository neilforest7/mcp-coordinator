use ssh2::Session;
use std::io::Read;
use std::net::TcpStream;
use ssh_key::PrivateKey;
use std::fs;
use std::path::PathBuf;
use crate::ssh::pool::SshPool;

/// Create and authenticate an SSH session
/// 
/// This function is public so it can be reused by other modules (e.g., SFTP)
pub fn create_ssh_session(host: &str, port: u16, username: &str, private_key: &str) -> Result<Session, String> {
    // Normalize private key (trim + convert line endings)
    let normalized_key = private_key
        .trim()
        .replace("\r\n", "\n")  // Windows CRLF -> Unix LF
        .replace("\r", "\n");   // Old Mac CR -> Unix LF

    println!("[SSH] Private key normalized, length: {} bytes", normalized_key.len());
    
    // SECURITY: Validate key format before proceeding
    validate_key_format(&normalized_key)?;
    
    // SECURITY LIMITATION: ssh2 doesn't support in-memory private key auth
    // We must use a temporary file, but we make it as secure as possible
    let temp_key_path = create_secure_temp_key_file(&normalized_key)?;
    
    println!("[SSH] Secure temp key created (will be auto-deleted)");
    
    // Ensure cleanup on scope exit (even if function panics)
    let _cleanup = SecureKeyFileCleanup { path: temp_key_path.clone() };
    
    // Connect to SSH server
    let tcp = TcpStream::connect(format!("{}:{}", host, port))
        .map_err(|e| format!("TCP connection failed: {}\nCheck if SSH service is running and port {} is open.", e, port))?;
    
    println!("[SSH] TCP connection established on port {}", port);
    
    let mut sess = Session::new()
        .map_err(|e| format!("Session creation failed: {}", e))?;
    
    sess.set_tcp_stream(tcp);
    sess.handshake()
        .map_err(|e| format!("SSH handshake failed: {}", e))?;
    
    println!("[SSH] SSH handshake successful");
    
    // Get methods supported by server
    let methods = sess.auth_methods(username)
        .map_err(|e| format!("Failed to get auth methods: {}", e))?;
    
    println!("[SSH] Server supports auth methods: {}", methods);
    
    // Authenticate with private key file
    // ssh2 automatically tries rsa-sha2-512, rsa-sha2-256, and ssh-rsa in order
    println!("[SSH] Attempting publickey authentication...");
    
    sess.userauth_pubkey_file(
        username,
        None,  // No public key file (will derive from private key)
        &temp_key_path,
        None   // No passphrase
    ).map_err(|e| {
        format!(
            "SSH Authentication Failed!\n\n\
            Error: {}\n\n\
            Possible reasons:\n\
            1. The public key is not in ~/.ssh/authorized_keys on the server\n\
            2. The private key doesn't match the public key on the server\n\
            3. The username '{}' is incorrect\n\
            4. Private key has a passphrase (not supported yet)\n\
            5. File permissions on server (chmod 600 ~/.ssh/authorized_keys)\n\
            6. SSH server configuration restricts this key type\n\n\
            Server auth methods: {}\n\n\
            Debug: Check server logs with 'sudo tail -f /var/log/auth.log'",
            e,
            username,
            methods
        )
    })?;
    
    println!("[SSH] ✓ Authentication successful!");
    
    Ok(sess)
}

pub async fn execute_cmd_with_pool(pool: SshPool, host: &str, port: u16, username: &str, private_key: &str, command: &str) -> Result<String, String> {
    let host = host.to_string();
    let username = username.to_string();
    let private_key = private_key.to_string();
    let command = command.to_string();
    let pool = pool.clone();

    tokio::task::spawn_blocking(move || {
        execute_cmd_blocking_with_pool(&pool, &host, port, &username, &private_key, &command)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Check if an error is fatal and requires connection removal
pub fn is_fatal_error(err_msg: &str) -> bool {
    let msg = err_msg.to_lowercase();
    
    // List of errors that definitely indicate a broken connection
    let fatal_patterns = [
        "channel closed",
        "connection refused",
        "socket disconnected",
        "session shutdown",
        "timeout",
        "broken pipe",
        "connection reset",
        "connection aborted",
        "network is unreachable",
        "failure to open channel",
        "failed to open channel", // catch-all for channel open failures
        "poisoned lock", // internal pool error
    ];

    for pattern in fatal_patterns {
        if msg.contains(pattern) {
            return true;
        }
    }

    // Specific check for SFTP error code 2 (FX_NO_SUCH_FILE) - definitely NOT fatal
    if msg.contains("no such file") || msg.contains("does not exist") || msg.contains("sftp(2)") {
        return false;
    }

    // If we failed to EXECUTE a command, it might be the channel died or the command wasn't found.
    // "Failed to execute command" usually comes from channel.exec() failure which is often connection related.
    // But "exit status" errors are APPLICATION errors.
    
    // If we can't classify it, assume fatal to be safe (original behavior), 
    // UNLESS it's clearly an application error we missed?
    // Let's invert: what is SAFE to keep?
    // - File not found
    // - Permission denied (auth is fine, just file perms)
    // - Command not found (127) - wait, execution succeeds but exit code is 127. 
    //   If channel.exec() fails, it's usually the transport.
    
    // So for now, we rely on the fatal list + assumption that unknown libssh2 errors might be fatal.
    // But we explicitly whitelist known non-fatal ones.
    
    false
}

fn execute_cmd_blocking_with_pool(pool: &SshPool, host: &str, port: u16, username: &str, private_key: &str, command: &str) -> Result<String, String> {
    // Retry loop (max 1 retry)
    for attempt in 0..2 {
        println!("[SSH Pool] Requesting connection for command execution (attempt {})...", attempt + 1);
        let session_arc = pool.get_connection(host, port, username, private_key)?;
        
        let mut channel = {
             let sess = session_arc.lock().map_err(|_| "Poisoned lock".to_string())?;
             match sess.channel_session() {
                 Ok(c) => c,
                 Err(e) => {
                     println!("[SSH Pool] Failed to open channel: {}. Removing invalid connection.", e);
                     drop(sess); // Unlock before removing
                     pool.remove(host, port, username);
                     if attempt == 0 { continue; } else { return Err(e.to_string()); }
                 }
             }
        }; // sess lock dropped here. Channel is alive.

        // Execute command
        println!("[SSH Pool] Executing command: {}", command);
        if let Err(e) = channel.exec(command) {
             let err_msg = e.to_string();
             println!("[SSH Pool] Failed to exec: {}.", err_msg);
             
             if is_fatal_error(&err_msg) {
                 println!("[SSH Pool] Error is fatal. Removing connection.");
                 pool.remove(host, port, username);
                 if attempt == 0 { continue; }
             }
             return Err(err_msg);
        }

        let mut output = String::new();
        if let Err(e) = channel.read_to_string(&mut output) {
             let err_msg = e.to_string();
             println!("[SSH Pool] Failed to read output: {}", err_msg);
             
             if is_fatal_error(&err_msg) {
                 println!("[SSH Pool] Error is fatal. Removing connection.");
                 pool.remove(host, port, username);
                 if attempt == 0 { continue; }
             }
             return Err(err_msg);
        }
        
        if let Err(e) = channel.wait_close() {
             println!("[SSH Pool] Failed to close channel: {}", e);
             // Closing failure might not be fatal for *this* command result, but implies connection issues.
             // We won't retry the command since we (maybe) got the output, but we should clean up the pool.
             if is_fatal_error(&e.to_string()) {
                 pool.remove(host, port, username);
             }
        }
        
        let exit_status = match channel.exit_status() {
            Ok(s) => s,
            Err(e) => {
                 println!("[SSH Pool] Failed to get exit status: {}", e);
                 -1
            }
        };

        println!("[SSH Pool] Command completed with exit code: {}", exit_status);
        return Ok(output.trim().to_string());
    }
    
    Err("Max retries exceeded".to_string())
}

/// Create a temporary file with maximum security
/// 
/// SECURITY NOTE: ssh2 crate doesn't support in-memory private key authentication,
/// so we must use temp files. This function implements defense-in-depth:
/// - Restrictive file permissions (600 on Unix)
/// - Secure temp directory
/// - Unique filename per process
/// - Minimal lifetime (auto-deleted by RAII)
fn create_secure_temp_key_file(key_content: &str) -> Result<PathBuf, String> {
    let temp_dir = std::env::temp_dir();
    
    // Use process ID + random component for uniqueness
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let key_filename = format!("mcp_ssh_{}_{}.pem", std::process::id(), timestamp);
    let key_path = temp_dir.join(key_filename);
    
    // Write with restrictive permissions from the start
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        use std::io::Write;
        
        let mut file = fs::OpenOptions::new()
            .create_new(true)  // Fail if file already exists
            .write(true)
            .mode(0o600)       // rw-------
            .open(&key_path)
            .map_err(|e| format!("Failed to create secure temp key file: {}", e))?;
        
        file.write_all(key_content.as_bytes())
            .map_err(|e| format!("Failed to write key content: {}", e))?;
    }
    
    #[cfg(not(unix))]
    {
        // Windows: Write file then restrict permissions
        fs::write(&key_path, key_content)
            .map_err(|e| format!("Failed to write temp key file: {}", e))?;
        
        // TODO: On Windows, set ACL to restrict access to current user only
        // This requires winapi crate - for now we rely on temp directory permissions
    }
    
    Ok(key_path)
}

/// RAII cleanup for temporary key file with secure deletion
struct SecureKeyFileCleanup {
    path: PathBuf,
}

impl Drop for SecureKeyFileCleanup {
    fn drop(&mut self) {
        if self.path.exists() {
            // Overwrite with zeros before deletion (defense in depth)
            if let Ok(metadata) = fs::metadata(&self.path) {
                let size = metadata.len() as usize;
                let zeros = vec![0u8; size];
                let _ = fs::write(&self.path, zeros);
            }
            
            // Delete the file
            let _ = fs::remove_file(&self.path);
        }
    }
}

/// Validate SSH private key format and provide helpful error messages
pub fn validate_key_format(key_content: &str) -> Result<(), String> {
    println!("[SSH] Validating key format...");
    
    // Check for OpenSSH format header explicitly
    if key_content.contains("BEGIN OPENSSH PRIVATE KEY") {
        // We need to parse it to check if it's RSA. 
        match PrivateKey::from_openssh(key_content) {
            Ok(key) => {
                match key.key_data() {
                    ssh_key::private::KeypairData::Rsa(_) => {
                        return Err(
                            "Unsupported Key Format: OpenSSH (RFC4716)\n\n\
                            This application uses libssh2, which requires RSA keys to be in PEM (PKCS#1) format.\n\
                            Your key is in the newer OpenSSH format.\n\n\
                            Please convert your key to PEM format using this command:\n\
                            ssh-keygen -p -m PEM -f /path/to/your/private_key"
                            .to_string()
                        );
                    }
                    _ => {
                        // Ed25519 keys usually come in OpenSSH format and are generally supported
                        println!("[SSH] Non-RSA OpenSSH key detected. Proceeding.");
                        return Ok(());
                    }
                }
            }
            Err(e) => {
                return Err(format!("Failed to parse OpenSSH key: {}", e));
            }
        }
    }

    // Check for PEM (PKCS#1) format explicitly
    // ssh-key crate v0.6 DOES NOT support parsing these, but libssh2 requires them.
    // So we must trust the header and skip parsing validation for these.
    if key_content.contains("BEGIN RSA PRIVATE KEY") {
        println!("[SSH] ✓ Valid PEM (PKCS#1) RSA key detected via header check");
        return Ok(());
    }

    // Check for PKCS#8 format
    if key_content.contains("BEGIN PRIVATE KEY") {
        println!("[SSH] ✓ Valid PKCS#8 key detected via header check");
        return Ok(());
    }

    // If it's not OpenSSH and not PEM/PKCS#8, try to parse with ssh-key generic parser just in case
    // (though unlikely to succeed if headers didn't match)
    match PrivateKey::from_openssh(key_content) {
        Ok(_) => Ok(()),
        Err(e) => {
            Err(format!(
                "Invalid SSH Private Key\n\n\
                Could not identify key format. Error: {}\n\n\
                Supported formats:\n\
                • PEM format (starts with -----BEGIN RSA PRIVATE KEY-----)\n\
                • PKCS#8 format (starts with -----BEGIN PRIVATE KEY-----)\n\
                • Ed25519 keys (OpenSSH format)\n\n\
                If you have an OpenSSH RSA key, convert it to PEM:\n\
                ssh-keygen -p -m PEM -f <key_file>",
                e
            ))
        }
    }
}
