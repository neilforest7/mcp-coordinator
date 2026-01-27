use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use rand::rngs::OsRng;
use rand::RngCore;

pub fn encrypt(data: &str, key: &[u8; 32]) -> Result<(String, String), String> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, data.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;

    Ok((BASE64.encode(ciphertext), BASE64.encode(nonce_bytes)))
}

pub fn decrypt(ciphertext_base64: &str, iv_base64: &str, key: &[u8; 32]) -> Result<String, String> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));

    let nonce_bytes = BASE64
        .decode(iv_base64)
        .map_err(|e| format!("Invalid IV base64: {}", e))?;

    if nonce_bytes.len() != 12 {
        return Err("Invalid nonce length".to_string());
    }

    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = BASE64
        .decode(ciphertext_base64)
        .map_err(|e| format!("Invalid ciphertext base64: {}", e))?;

    let plaintext = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| format!("Decryption failed (Master Key Mismatch?): {}", e))?;

    String::from_utf8(plaintext).map_err(|e| format!("Invalid UTF-8: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let key = [42u8; 32]; // 32-byte key
        let data = "secret_private_key_content";

        let (encrypted, iv) = encrypt(data, &key).expect("Encryption failed");

        // Ensure it's not the same as input
        assert_ne!(data, encrypted);

        let decrypted = decrypt(&encrypted, &iv, &key).expect("Decryption failed");

        assert_eq!(data, decrypted);
    }
}
