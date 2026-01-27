# ⚠️ TEMPORARY: Plaintext SSH Key Storage

## What Changed

**ENCRYPTION DISABLED FOR DEBUGGING**

All SSH private keys are now stored in **PLAINTEXT** in the SQLite database.

### Modified Files

1. **`app/src-tauri/src/db/credentials.rs`**:
   - Removed `encrypt()` and `decrypt()` calls
   - Changed database column from `encrypted_private_key` to `private_key`
   - Removed `iv` column
   - Added warning log: `[SECURITY WARNING] Storing SSH key in PLAINTEXT!`

2. **`app/src-tauri/src/db/mod.rs`**:
   - Drops and recreates `credentials` table on startup
   - New schema:
     ```sql
     CREATE TABLE credentials (
         id INTEGER PRIMARY KEY,
         host TEXT NOT NULL,
         username TEXT NOT NULL,
         private_key TEXT NOT NULL,  -- PLAINTEXT!
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         UNIQUE(host, username)
     );
     ```

### What This Means

✅ **Simplifies debugging**: No encryption/decryption layer  
✅ **Master key issues eliminated**: No keyring or file storage issues  
✅ **Direct database inspection**: Can see keys with `sqlite3 mcp_hub.db`  
❌ **SECURITY RISK**: Keys stored in plaintext on disk  
❌ **DEVELOPMENT ONLY**: Do NOT use in production  

### Terminal Output

When adding a credential, you'll see:
```
[SECURITY WARNING] Storing SSH key in PLAINTEXT!
```

### Database Location

**Windows**: `%LocalAppData%\mcp-control-hub\mcp_hub.db`

You can inspect it with:
```bash
sqlite3 "%LocalAppData%\mcp-control-hub\mcp_hub.db"
sqlite> SELECT host, username, substr(private_key, 1, 50) FROM credentials;
```

### How to Re-enable Encryption Later

1. Uncomment the imports in `db/credentials.rs`:
   ```rust
   use crate::ssh::encryption::{encrypt, decrypt};
   ```

2. Restore the original functions (use git to revert)

3. Update the database schema in `db/mod.rs` to add back:
   - `encrypted_private_key TEXT NOT NULL`
   - `iv TEXT NOT NULL`

4. Remove the `DROP TABLE` migration

### Tests

All tests still pass ✅

The encryption module is still present (just not used), so encryption tests still work.

### Ready to Test

The app will now:
1. Drop any existing credentials (fresh start)
2. Store new credentials in plaintext
3. Retrieve credentials directly without decryption

**Run the app and test your RSA key authentication!**

```bash
npm run tauri dev
```

Expected behavior:
- No more keyring warnings
- No encryption errors
- Direct key storage
- **Should work with rsa-sha2-512 on first attempt**

---

## ⚠️ REMEMBER

This is **TEMPORARY** for debugging. Once SSH authentication works, we should:
1. Re-enable encryption
2. Implement proper key migration
3. Add encryption tests

**DO NOT commit this to production!**
