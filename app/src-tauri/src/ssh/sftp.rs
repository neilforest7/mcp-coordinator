use std::io::{Read, Write};
use std::path::Path;
use crate::ssh::pool::SshPool;
use crate::ssh::connection::is_fatal_error;

/// SFTP-based file operations module
/// 
/// SECURITY: This module uses SFTP instead of shell commands to prevent injection vulnerabilities
/// and handle binary files/special characters correctly.

/// Read a file from remote server using SFTP
pub async fn sftp_read_file_with_pool(pool: SshPool, host: &str, port: u16, username: &str, private_key: &str, remote_path: &str) -> Result<String, String> {
    let host = host.to_string();
    let username = username.to_string();
    let private_key = private_key.to_string();
    let remote_path = remote_path.to_string();
    let pool = pool.clone();
    
    tokio::task::spawn_blocking(move || {
        // Retry logic
        for attempt in 0..2 {
            let session_arc = pool.get_connection(&host, port, &username, &private_key)?;
            let sess = session_arc.lock().map_err(|_| "Poisoned lock".to_string())?;
            
            match sess.sftp() {
                Ok(sftp) => {
                    match expand_tilde_path(&sftp, &remote_path) {
                        Ok(expanded_path) => {
                            match sftp.open(Path::new(&expanded_path)) {
                                Ok(mut file) => {
                                    let mut contents = String::new();
                                    if let Err(e) = file.read_to_string(&mut contents) {
                                        let err_msg = e.to_string();
                                        println!("[SFTP Pool] Read error: {}.", err_msg);
                                        
                                        if is_fatal_error(&err_msg) {
                                            println!("[SFTP Pool] Error is fatal. Removing connection.");
                                            drop(sess); pool.remove(&host, port, &username);
                                            if attempt == 0 { continue; }
                                        }
                                        return Err(err_msg);
                                    }
                                    return Ok(contents);
                                },
                                Err(e) => {
                                    let err_msg = e.to_string();
                                    println!("[SFTP Pool] Open error: {}.", err_msg);
                                    
                                    if is_fatal_error(&err_msg) {
                                        println!("[SFTP Pool] Error is fatal. Removing connection.");
                                        drop(sess); pool.remove(&host, port, &username);
                                        if attempt == 0 { continue; }
                                    }
                                    return Err(format!("Failed to open remote file '{}': {}", expanded_path, err_msg));
                                }
                            }
                        },
                        Err(e) => {
                             let err_msg = e; // String
                             println!("[SFTP Pool] Expand path error: {}.", err_msg);
                             if is_fatal_error(&err_msg) {
                                 drop(sess); pool.remove(&host, port, &username);
                                 if attempt == 0 { continue; }
                             }
                             return Err(err_msg);
                        }
                    }
                },
                Err(e) => {
                    let err_msg = e.to_string();
                    println!("[SFTP Pool] SFTP init error: {}. Retrying...", err_msg);
                    drop(sess); pool.remove(&host, port, &username);
                    if attempt == 0 { continue; } else { return Err(err_msg); }
                }
            }
        }
        Err("Max retries exceeded".to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

pub async fn sftp_write_file_with_pool(pool: SshPool, host: &str, port: u16, username: &str, private_key: &str, remote_path: &str, content: &str) -> Result<(), String> {
    let host = host.to_string();
    let username = username.to_string();
    let private_key = private_key.to_string();
    let remote_path = remote_path.to_string();
    let content = content.to_string();
    let pool = pool.clone();
    
    tokio::task::spawn_blocking(move || {
        for attempt in 0..2 {
            let session_arc = pool.get_connection(&host, port, &username, &private_key)?;
            let sess = session_arc.lock().map_err(|_| "Poisoned lock".to_string())?;
            
            match sess.sftp() {
                Ok(sftp) => {
                    match expand_tilde_path(&sftp, &remote_path) {
                        Ok(expanded_path) => {
                             match sftp.create(Path::new(&expanded_path)) {
                                 Ok(mut file) => {
                                     if let Err(e) = file.write_all(content.as_bytes()) {
                                          let err_msg = e.to_string();
                                          println!("[SFTP Pool] Write error: {}.", err_msg);
                                          if is_fatal_error(&err_msg) {
                                              drop(sess); pool.remove(&host, port, &username);
                                              if attempt == 0 { continue; }
                                          }
                                          return Err(err_msg);
                                     }
                                     return Ok(());
                                 },
                                 Err(e) => {
                                      let err_msg = e.to_string();
                                      println!("[SFTP Pool] Create error: {}.", err_msg);
                                      if is_fatal_error(&err_msg) {
                                          drop(sess); pool.remove(&host, port, &username);
                                          if attempt == 0 { continue; }
                                      }
                                      return Err(format!("Failed to create remote file '{}': {}", expanded_path, err_msg));
                                 }
                             }
                        },
                        Err(e) => {
                             let err_msg = e;
                             if is_fatal_error(&err_msg) {
                                 drop(sess); pool.remove(&host, port, &username);
                                 if attempt == 0 { continue; }
                             }
                             return Err(err_msg);
                        }
                    }
                },
                Err(e) => {
                    let err_msg = e.to_string();
                    drop(sess); pool.remove(&host, port, &username);
                    if attempt == 0 { continue; } else { return Err(err_msg); }
                }
            }
        }
        Err("Max retries exceeded".to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

pub async fn sftp_copy_file_with_pool(pool: SshPool, host: &str, port: u16, username: &str, private_key: &str, src_path: &str, dst_path: &str) -> Result<(), String> {
    let host = host.to_string();
    let username = username.to_string();
    let private_key = private_key.to_string();
    let src_path = src_path.to_string();
    let dst_path = dst_path.to_string();
    let pool = pool.clone();
    
    tokio::task::spawn_blocking(move || {
        for attempt in 0..2 {
            let session_arc = pool.get_connection(&host, port, &username, &private_key)?;
            let sess = session_arc.lock().map_err(|_| "Poisoned lock".to_string())?;
            
            match sess.sftp() {
                Ok(sftp) => {
                    let expanded_src = match expand_tilde_path(&sftp, &src_path) {
                        Ok(p) => p,
                        Err(e) => { 
                            if is_fatal_error(&e) {
                                drop(sess); pool.remove(&host, port, &username); 
                                if attempt == 0 { continue; } 
                            }
                            return Err(format!("Failed to expand src: {}", e)); 
                        }
                    };
                    let expanded_dst = match expand_tilde_path(&sftp, &dst_path) {
                         Ok(p) => p,
                         Err(e) => { 
                             if is_fatal_error(&e) {
                                 drop(sess); pool.remove(&host, port, &username); 
                                 if attempt == 0 { continue; } 
                             }
                             return Err(format!("Failed to expand dst: {}", e)); 
                         }
                    };
                    
                    let mut src_file = match sftp.open(Path::new(&expanded_src)) {
                         Ok(f) => f,
                         Err(e) => { 
                             let err_msg = e.to_string();
                             if is_fatal_error(&err_msg) {
                                 drop(sess); pool.remove(&host, port, &username); 
                                 if attempt == 0 { continue; } 
                             }
                             return Err(err_msg); 
                         }
                    };
                    
                    let mut contents = Vec::new();
                    if let Err(e) = src_file.read_to_end(&mut contents) {
                         let err_msg = e.to_string();
                         if is_fatal_error(&err_msg) {
                             drop(sess); pool.remove(&host, port, &username);
                             if attempt == 0 { continue; } 
                         }
                         return Err(err_msg);
                    }
                    
                    let mut dst_file = match sftp.create(Path::new(&expanded_dst)) {
                         Ok(f) => f,
                         Err(e) => { 
                             let err_msg = e.to_string();
                             if is_fatal_error(&err_msg) {
                                 drop(sess); pool.remove(&host, port, &username); 
                                 if attempt == 0 { continue; } 
                             }
                             return Err(err_msg); 
                         }
                    };
                    
                    if let Err(e) = dst_file.write_all(&contents) {
                         let err_msg = e.to_string();
                         if is_fatal_error(&err_msg) {
                             drop(sess); pool.remove(&host, port, &username);
                             if attempt == 0 { continue; } 
                         }
                         return Err(err_msg);
                    }
                    
                    return Ok(());
                },
                Err(e) => {
                    let err_msg = e.to_string();
                    drop(sess); pool.remove(&host, port, &username);
                    if attempt == 0 { continue; } else { return Err(err_msg); }
                }
            }
        }
        Err("Max retries exceeded".to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Expand ~ to home directory path
/// 
/// SFTP doesn't automatically expand ~, so we use SFTP realpath(".") to resolve it.
/// This is more robust than running "echo $HOME" which can be polluted by MOTD/banners.
fn expand_tilde_path(sftp: &ssh2::Sftp, path: &str) -> Result<String, String> {
    if path.starts_with("~/") || path == "~" {
        // Use SFTP realpath(".") to get home directory
        // "." in SFTP resolves to the user's home directory by default
        let home_path = sftp.realpath(Path::new("."))
            .map_err(|e| format!("Failed to resolve home directory via SFTP realpath: {}", e))?;
        
        let home_dir = home_path.to_string_lossy();
        
        if path == "~" {
            Ok(home_dir.to_string())
        } else {
            // Replace ~ with actual home directory
            Ok(path.replacen("~", &home_dir, 1))
        }
    } else {
        Ok(path.to_string())
    }
}
