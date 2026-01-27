use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use keyring::Entry;
use rand::rngs::OsRng;
use rand::RngCore;
use std::fs;
use std::path::PathBuf;

const SERVICE_NAME: &str = "mcp-control-hub";
const USER_NAME: &str = "master-key";

fn get_key_file_path() -> Option<PathBuf> {
    // Use data_local_dir (e.g., %LocalAppData% on Windows, ~/.local/share on Linux)
    let mut path = dirs::data_local_dir()?;
    path.push("mcp-control-hub");
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
    }
    path.push("master.key");
    Some(path)
}

pub fn get_or_create_master_key() -> Result<[u8; 32], String> {
    let entry = Entry::new(SERVICE_NAME, USER_NAME).map_err(|e| e.to_string())?;

    // 1. Try Keyring
    match entry.get_password() {
        Ok(password) => {
            println!("KeyManager: Found master key in Keyring.");
            return decode_key(&password);
        }
        Err(e) => {
            println!("KeyManager: Keyring lookup failed/not found: {}", e);
        }
    }

    // 2. Try File
    if let Some(path) = get_key_file_path() {
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                println!("KeyManager: Found master key in File.");
                let key = decode_key(content.trim())?;
                // Try to sync back to keyring
                let _ = entry.set_password(content.trim());
                return Ok(key);
            }
        }
    }

    println!("KeyManager: No existing key found. Creating new one.");
    // 3. Generate New
    let mut key = [0u8; 32];
    OsRng.fill_bytes(&mut key);
    let password = BASE64.encode(key);

    // Save to Keyring
    if let Err(e) = entry.set_password(&password) {
        println!("KeyManager: Failed to save to keyring: {}", e);
    } else {
        println!("KeyManager: Saved to keyring.");
    }

    // Save to File
    if let Some(path) = get_key_file_path() {
        if let Err(e) = fs::write(&path, &password) {
            println!("KeyManager: Failed to save to file: {}", e);
        } else {
            println!("KeyManager: Saved to file at {:?}", path);
        }
    }

    Ok(key)
}

fn decode_key(password: &str) -> Result<[u8; 32], String> {
    let bytes = BASE64
        .decode(password)
        .map_err(|e| format!("Failed to decode master key: {}", e))?;
    if bytes.len() != 32 {
        return Err("Master key has invalid length".to_string());
    }
    let mut key = [0u8; 32];
    key.copy_from_slice(&bytes);
    Ok(key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_master_key_stability() {
        // We cannot easily clear keyring in test without affecting user state if they have one
        // But for file, we can clear if we mock path, but we can't easily mock path here.
        // So we just test that calling it twice returns the same result.

        let key1 = get_or_create_master_key().expect("Failed to get first key");
        let key2 = get_or_create_master_key().expect("Failed to get second key");

        assert_eq!(key1, key2, "Master key is not stable!");
    }
}
