# SSH Authentication Fix

## What Was Fixed

### 1. Key Normalization
- Added automatic line ending conversion (Windows CRLF → Unix LF)
- Added whitespace trimming before key decoding
- This handles keys copy-pasted from Windows text editors

### 2. Enhanced Error Messages
When authentication fails, you'll now see:
```
SSH Authentication Failed!

Possible reasons:
1. The public key is not in ~/.ssh/authorized_keys on the server
2. The private key doesn't match the public key on the server
3. The username 'xxx' is incorrect
4. SSH server permissions issue (check /var/log/auth.log on server)
5. Private key has a passphrase (not supported yet)
```

### 3. Debug Logging
Check your terminal output when testing SSH connections. You'll see:
```
[SSH] Connecting to user@host
[SSH] TCP connection established
[SSH] Private key normalized, length: XXX bytes
[SSH] Key starts with: -----BEGIN OPENSSH PRIVATE KEY-----
[SSH] Private key decoded successfully
[SSH] Attempting public key authentication for user: xxx
[SSH] Authentication successful!
```

## Troubleshooting Steps

### If you see "TCP connection failed":
- Check the host IP/hostname is correct
- Check the server is running and port 22 is accessible
- Check firewall settings

### If you see "Failed to decode private key":
- Make sure you're using an **OpenSSH format** key (not PEM/RSA)
- Make sure the key **does NOT have a passphrase** (not supported yet)
- Generate a new key without passphrase: `ssh-keygen -t ed25519 -f ~/.ssh/mcp_key -N ""`

### If you see "Authentication rejected":
This means the TCP connection works, but the server rejected your key.

**Most common fix:**
1. On the **server**, run:
   ```bash
   # Copy your public key to authorized_keys
   cat ~/.ssh/YOUR_KEY.pub >> ~/.ssh/authorized_keys
   
   # Fix permissions (IMPORTANT!)
   chmod 700 ~/.ssh
   chmod 600 ~/.ssh/authorized_keys
   ```

2. Check the server's auth log:
   ```bash
   sudo tail -f /var/log/auth.log   # Ubuntu/Debian
   sudo tail -f /var/log/secure     # CentOS/RHEL
   ```

3. Verify the public key fingerprint matches:
   ```bash
   # On your local machine (where private key is)
   ssh-keygen -lf ~/.ssh/YOUR_KEY
   
   # On the server
   ssh-keygen -lf ~/.ssh/authorized_keys
   ```

### Generate a Compatible Key

If your current key doesn't work, generate a new one:

```bash
# Generate ED25519 key (recommended, no passphrase)
ssh-keygen -t ed25519 -f ~/.ssh/mcp_key -N ""

# This creates:
# - ~/.ssh/mcp_key (private key - paste THIS into the app)
# - ~/.ssh/mcp_key.pub (public key - add to server's authorized_keys)
```

Then on the **server**:
```bash
# Add the public key
cat ~/.ssh/mcp_key.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

## Testing

After adding a credential in the app:
1. Click the "Test" button
2. Check the **terminal output** (not just the toast message)
3. Look for the `[SSH]` log lines to see where it fails
4. The error message will guide you to the specific issue

## Current Limitations

- ❌ **Passphrase-protected keys**: Not supported yet
- ❌ **Custom SSH port**: Currently hardcoded to port 22
- ✅ **OpenSSH format keys**: Fully supported
- ✅ **ED25519/RSA/ECDSA**: All supported

## Need More Help?

If authentication still fails after trying the above:
1. Share the terminal output (the `[SSH]` log lines)
2. Check the server's `/var/log/auth.log` for rejection reasons
3. Verify your username is correct on the server
