use russh::keys;
use std::io::Write;

fn main() {
    println!("=== SSH Key Pair Verification Tool ===\n");

    // Read the private key
    println!("Paste your PRIVATE key (the one from C:\\Users\\Lukee\\.ssh\\id_rsa):");
    println!("(End with a blank line)\n");

    let mut private_key_lines = Vec::new();
    loop {
        let mut line = String::new();
        std::io::stdin().read_line(&mut line).unwrap();
        if line.trim().is_empty() && !private_key_lines.is_empty() {
            break;
        }
        private_key_lines.push(line);
    }

    let private_key_str = private_key_lines.join("");
    let normalized_key = private_key_str
        .trim()
        .replace("\r\n", "\n")
        .replace("\r", "\n");

    // Decode the private key
    let private_key = match keys::decode_secret_key(&normalized_key, None) {
        Ok(key) => key,
        Err(e) => {
            eprintln!("ERROR: Failed to decode private key: {:?}", e);
            return;
        }
    };

    println!("\n✓ Private key decoded successfully!");

    // Extract the public key from the private key
    let public_key = private_key.clone_public_key().unwrap();

    // Get the public key in SSH format
    let public_key_ssh = public_key.public_key_base64();
    let key_type = if format!("{:?}", private_key).contains("Rsa") {
        "ssh-rsa"
    } else if format!("{:?}", private_key).contains("Ed25519") {
        "ssh-ed25519"
    } else {
        "ecdsa-sha2"
    };

    println!("\n=== YOUR PUBLIC KEY (derived from private key) ===");
    println!("{} {}", key_type, public_key_ssh);
    println!("\n=== FINGERPRINT ===");

    // Calculate fingerprint (MD5 and SHA256)
    let public_key_bytes = public_key.public_key_bytes();
    let md5_hash = md5::compute(&public_key_bytes);
    println!("MD5:    {:x}", md5_hash);

    // SHA256 fingerprint
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(&public_key_bytes);
    let sha256_hash = hasher.finalize();
    println!("SHA256: {}", base64::encode(&sha256_hash));

    println!("\n=== WHAT TO DO NEXT ===");
    println!("1. Copy the public key above");
    println!("2. On your server (root@192.168.31.7), run:");
    println!(
        "   echo '{} {}' >> ~/.ssh/authorized_keys",
        key_type, public_key_ssh
    );
    println!("   chmod 600 ~/.ssh/authorized_keys");
    println!("\n3. OR compare this public key with C:\\Users\\Lukee\\.ssh\\id_rsa.pub");
    println!("   They should MATCH EXACTLY!");
    println!("\n4. On the server, check if this key is already there:");
    println!("   ssh root@192.168.31.7 'cat ~/.ssh/authorized_keys'");
    println!(
        "   Look for: {}",
        public_key_ssh.chars().take(50).collect::<String>()
    );
}
