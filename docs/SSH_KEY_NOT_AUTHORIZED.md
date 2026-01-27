# SSH Authentication Still Failing - Diagnosis

## What The Logs Tell Us

```
[SSH] Attempt 1 - Trying algorithm: rsa-sha2-256
[SSH] Auth rejected with rsa-sha2-256: Failure { 
    remaining_methods: MethodSet([]),  ← CRITICAL: EMPTY!
    partial_success: false 
}
```

### What This Means

- ✅ TCP connection works
- ✅ Private key is valid and decoded correctly
- ✅ Server accepts rsa-sha2-256 algorithm
- ❌ **Server rejected THIS specific key**
- ❌ `remaining_methods: []` means "I tried all methods, none worked"

**Translation**: The server is saying:
> "Your key format is correct, but I don't recognize this key. It's not in my authorized_keys file."

---

## The REAL Problem

**Your public key is NOT in `~/.ssh/authorized_keys` on the server**, OR the private/public key pair doesn't match.

---

## How to Fix (Step by Step)

### Step 1: Verify Your Public Key

On your **local Windows machine**, display the public key:

```powershell
# In PowerShell
cat C:\Users\Lukee\.ssh\id_rsa.pub
```

You should see something like:
```
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC... your-computer
```

**Copy this entire line!**

---

### Step 2: Add Public Key to Server

**Method A: Using SSH (if you can still login with password)**

```bash
# SSH into the server
ssh root@192.168.31.7

# Add your public key
echo "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC... your-computer" >> ~/.ssh/authorized_keys

# Fix permissions (CRITICAL!)
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys

# Verify it was added
cat ~/.ssh/authorized_keys
```

**Method B: Using ssh-copy-id (easier)**

```bash
# On your local machine
ssh-copy-id -i C:\Users\Lukee\.ssh\id_rsa.pub root@192.168.31.7
```

---

### Step 3: Verify the Key is There

On the server:

```bash
ssh root@192.168.31.7 'cat ~/.ssh/authorized_keys'
```

Look for your public key. It should match **exactly** with the content of `C:\Users\Lukee\.ssh\id_rsa.pub`.

---

### Step 4: Check Server Logs (for exact rejection reason)

On the server:

```bash
ssh root@192.168.31.7
sudo tail -f /var/log/auth.log  # Ubuntu/Debian
# OR
sudo tail -f /var/log/secure    # CentOS/RHEL
```

Then try to connect again from the app. You'll see the exact reason for rejection.

Common reasons:
- `Authentication refused: bad ownership or modes for directory /root`
  → Fix: `chmod 700 /root` (home directory must be 700)
  
- `Authentication refused: bad ownership or modes for file /root/.ssh/authorized_keys`
  → Fix: `chmod 600 ~/.ssh/authorized_keys`

- `User root not allowed because listed in DenyUsers`
  → Fix: Check `/etc/ssh/sshd_config` and remove root from DenyUsers

---

## Diagnostic Questions

### Q1: Can you login with password?

Try:
```bash
ssh root@192.168.31.7
# Enter password when prompted
```

If **YES**: Use Method A above to add the key
If **NO**: You need physical access or another way to add the key

---

### Q2: Does your local public key match the server?

**On local machine**:
```powershell
cat C:\Users\Lukee\.ssh\id_rsa.pub
```

**On server**:
```bash
ssh root@192.168.31.7 'cat ~/.ssh/authorized_keys'
```

They should be **EXACTLY** the same (including the comment at the end).

---

### Q3: Are the file permissions correct on the server?

```bash
ssh root@192.168.31.7 'ls -la ~/.ssh/'
```

Should show:
```
drwx------  2 root root  4096 ... .
-rw-------  1 root root   XXX ... authorized_keys
```

If not:
```bash
ssh root@192.168.31.7
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

---

## Quick Test Script

Run this on your local machine to verify everything:

```bash
# 1. Check local public key exists
ls -la C:\Users\Lukee\.ssh\id_rsa.pub

# 2. Show local public key
cat C:\Users\Lukee\.ssh\id_rsa.pub

# 3. Check if it's on the server
ssh root@192.168.31.7 'cat ~/.ssh/authorized_keys'

# 4. Test SSH with verbose mode to see what's happening
ssh -vvv -i C:\Users\Lukee\.ssh\id_rsa root@192.168.31.7
```

---

## Why the App Can't Add It Automatically

The app can only authenticate with a key that's **already authorized**. To add a key to `authorized_keys`, you need:
1. Password authentication, OR
2. Another already-authorized key, OR
3. Physical access to the server

---

## Next Steps

1. **Add your public key** to the server using one of the methods above
2. **Verify permissions** are correct (700 for .ssh, 600 for authorized_keys)
3. **Try the app again** - it should work immediately
4. **Check server logs** if it still fails

---

## Expected Outcome After Fix

When you retry in the app, you should see:

```
[SSH] Attempt 1 - Trying algorithm: rsa-sha2-256
[SSH] ✓ Authentication successful with rsa-sha2-256!
```

And the toast message: **"SSH connection successful!"**
