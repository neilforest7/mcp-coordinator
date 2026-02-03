use crate::db::sync_history::{self, SyncHistory};
use crate::sync::diff_generator::DiffLine;
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Sqlite};
use std::collections::HashMap;




#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum SyncStatus {
    Synced,
    CreatedInB,
    DeletedFromB,
    UpdatedInB,
    CreatedInA,
    DeletedFromA,
    UpdatedInA,
    Conflict,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncItem {
    pub name: String,
    pub status: SyncStatus,
    pub action_description: String,
    pub diff: Option<String>,           // Unified diff string for display
    pub diff_lines: Option<Vec<DiffLine>>, // Structured diff lines for UI rendering
    pub claude_json: Option<String>,    // Pretty-printed Claude config JSON
    pub opencode_json: Option<String>,  // Pretty-printed OpenCode config JSON
    pub claude_as_opencode_json: Option<String>, // Claude converted to OpenCode format
    pub opencode_as_claude_json: Option<String>, // OpenCode converted to Claude format
    pub content_matches: Vec<String>,   // Names of items in the OTHER list that have identical content
}

pub struct SyncEngine<'a> {
    pool: &'a Pool<Sqlite>,
    scope: String,
    target_id: String,
}

impl<'a> SyncEngine<'a> {
    pub fn new(pool: &'a Pool<Sqlite>, scope: &str, target_id: &str) -> Self {
        Self {
            pool,
            scope: scope.to_string(),
            target_id: target_id.to_string(),
        }
    }

    pub async fn plan<A, B, FA, FB, CA, CB>(
        &self,
        source_a: &HashMap<String, A>,
        source_b: &HashMap<String, B>,
        hasher_a: FA,
        hasher_b: FB,
        canonical_hasher_a: CA,
        canonical_hasher_b: CB,
    ) -> Result<Vec<SyncItem>, String>
    where
        FA: Fn(&A) -> String,
        FB: Fn(&B) -> String,
        CA: Fn(&A) -> String,
        CB: Fn(&B) -> String,
    {
        let mut plan = Vec::new();
        let mut all_keys: Vec<&String> = source_a.keys().chain(source_b.keys()).collect();
        all_keys.sort();
        all_keys.dedup();

        // Pre-calculate hashes for content matching using CANONICAL hashers
        let mut b_hashes: HashMap<String, Vec<String>> = HashMap::new(); // Hash -> Vec<Name>
        for (k, v) in source_b {
            let h = canonical_hasher_b(v);
            b_hashes.entry(h).or_default().push(k.clone());
        }

        let mut a_hashes: HashMap<String, Vec<String>> = HashMap::new(); // Hash -> Vec<Name>
        for (k, v) in source_a {
            let h = canonical_hasher_a(v);
            a_hashes.entry(h).or_default().push(k.clone());
        }

        for key in all_keys {
            let item_a = source_a.get(key);
            let item_b = source_b.get(key);
            let history = sync_history::get_sync_history(self.pool, &self.scope, &self.target_id, key)
                .await?;

            let status = self.determine_status(item_a, item_b, history, &hasher_a, &hasher_b).await?;
            
            if status != SyncStatus::Synced {
                // Check for content matches in the OTHER side
                // If item_a exists (CreatedInA, UpdatedInA, or Conflict), check if its hash exists in B (under different name)
                // If item_b exists (CreatedInB, UpdatedInB, or Conflict), check if its hash exists in A (under different name)
                
                let mut matches = Vec::new();

                // If we are looking at A -> B sync logic:
                // If "CreatedInA" or "UpdatedInA", we care if B has something similar.
                if let Some(val_a) = item_a {
                    let h_a = canonical_hasher_a(val_a);
                    if let Some(names) = b_hashes.get(&h_a) {
                        for n in names {
                            if n != key { // Don't match self if same name
                                matches.push(format!("Matches '{}' in Destination", n));
                            }
                        }
                    }
                }

                // If "CreatedInB" or "UpdatedInB", we care if A has something similar.
                if let Some(val_b) = item_b {
                    let h_b = canonical_hasher_b(val_b);
                    if let Some(names) = a_hashes.get(&h_b) {
                        for n in names {
                            if n != key {
                                matches.push(format!("Matches '{}' in Source", n));
                            }
                        }
                    }
                }

                plan.push(SyncItem {
                    name: key.clone(),
                    status: status.clone(),
                    action_description: self.describe_action(&status, key),
                    diff: None,
                    diff_lines: None,
                    claude_json: None,
                    opencode_json: None,
                    claude_as_opencode_json: None,
                    opencode_as_claude_json: None,
                    content_matches: matches,
                });
            }
        }

        Ok(plan)
    }

    async fn determine_status<A, B, FA, FB>(
        &self,
        a: Option<&A>,
        b: Option<&B>,
        history: Option<SyncHistory>,
        hasher_a: &FA,
        hasher_b: &FB,
    ) -> Result<SyncStatus, String>
    where
        FA: Fn(&A) -> String,
        FB: Fn(&B) -> String,
    {
        let hash_a = a.map(|v| hasher_a(v));
        let hash_b = b.map(|v| hasher_b(v));
        let hash_history = history.map(|h| h.last_hash);

        // Case 1: Exists in both
        if let (Some(ha), Some(hb)) = (&hash_a, &hash_b) {
            if ha == hb {
                return Ok(SyncStatus::Synced);
            }
            
            // They differ. Check history.
            if let Some(hh) = hash_history {
                if ha == &hh && hb != &hh {
                    // A matches history, B changed -> Update A (or B->A sync)
                    // If Source A is "Claude" and Source B is "OpenCode"
                    // If OpenCode changed, we should Update Claude.
                    // SyncStatus::UpdatedInB implies action "Update B".
                    // Wait, if B changed, we should Update A?
                    // "UpdatedInB" means "The item in B is newer/modified".
                    // The ACTION required is "Copy B to A".
                    return Ok(SyncStatus::UpdatedInB); 
                } else if hb == &hh && ha != &hh {
                    // B matches history, A changed -> Update B (Push)
                    return Ok(SyncStatus::UpdatedInA);
                } else {
                    // Both changed vs history -> Conflict
                    return Ok(SyncStatus::Conflict);
                }
            } else {
                // No history, but both exist and differ -> Conflict (Initial sync collision)
                return Ok(SyncStatus::Conflict);
            }
        }

        // Case 2: Exists in A, missing in B
        if let (Some(ha), None) = (&hash_a, &hash_b) {
            if let Some(hh) = hash_history {
                if ha == &hh {
                    // A matches history, but B is gone. B deleted it.
                    return Ok(SyncStatus::DeletedFromB);
                } else {
                    return Ok(SyncStatus::Conflict);
                }
            } else {
                // No history. A has it, B doesn't. A created it.
                return Ok(SyncStatus::CreatedInA);
            }
        }

        // Case 3: Missing in A, exists in B
        if let (None, Some(hb)) = (&hash_a, &hash_b) {
            if let Some(hh) = hash_history {
                if hb == &hh {
                    // B matches history, A is gone. A deleted it.
                    return Ok(SyncStatus::DeletedFromA);
                } else {
                    return Ok(SyncStatus::Conflict);
                }
            } else {
                // No history. B has it. B created it.
                return Ok(SyncStatus::CreatedInB);
            }
        }

        Ok(SyncStatus::Synced)
    }

    fn describe_action(&self, status: &SyncStatus, key: &str) -> String {
        match status {
            SyncStatus::Synced => format!("{} is in sync", key),
            SyncStatus::CreatedInB => format!("Create {} in Destination", key),
            SyncStatus::DeletedFromB => format!("Delete {} from Destination", key),
            SyncStatus::UpdatedInB => format!("Update {} in Destination", key),
            SyncStatus::CreatedInA => format!("Create {} in Source", key),
            SyncStatus::DeletedFromA => format!("Delete {} from Source", key),
            SyncStatus::UpdatedInA => format!("Update {} in Source", key),
            SyncStatus::Conflict => format!("Conflict in {}", key),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    #[tokio::test]
    async fn test_sync_plan_same_content_different_name() {
        // Setup in-memory DB
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();
        
        // Initialize DB schema matching `sync_history.rs`
        sqlx::query("CREATE TABLE sync_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scope TEXT NOT NULL,
            target_id TEXT NOT NULL,
            server_name TEXT NOT NULL,
            last_hash TEXT NOT NULL,
            last_synced_at TEXT NOT NULL
        )")
            .execute(&pool)
            .await
            .unwrap();

        let engine = SyncEngine::new(&pool, "test", "local");

        // Data
        let mut source_a = HashMap::new();
        source_a.insert("server1".to_string(), "content1");

        let mut source_b = HashMap::new();
        source_b.insert("server1_renamed".to_string(), "content1");

        // Hashers
        let hasher = |s: &&str| format!("hash_{}", s);

        let plan = engine.plan(&source_a, &source_b, hasher, hasher, hasher, hasher).await.unwrap();

        // Expectation:
        // 1. "server1": CreatedInB (since it's in A but not B, and no history) - Wait, logic says CreatedInA if A has it and B doesn't.
        // Actually: "Exists in A, missing in B" -> CreatedInA (Action: Create in B)
        // 2. "server1_renamed": CreatedInB (Exists in B, missing in A) -> CreatedInB (Action: Create in A)
        
        // BUT we want to detect they are the SAME CONTENT.
        
        let item1 = plan.iter().find(|i| i.name == "server1").unwrap();
        assert!(item1.content_matches.iter().any(|m| m.contains("server1_renamed")));

        let item2 = plan.iter().find(|i| i.name == "server1_renamed").unwrap();
        assert!(item2.content_matches.iter().any(|m| m.contains("server1")));
    }

    #[tokio::test]
    async fn test_sync_plan_same_name_different_content() {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();
        
        sqlx::query("CREATE TABLE sync_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scope TEXT NOT NULL,
            target_id TEXT NOT NULL,
            server_name TEXT NOT NULL,
            last_hash TEXT NOT NULL,
            last_synced_at TEXT NOT NULL
        )")
            .execute(&pool)
            .await
            .unwrap();

        let engine = SyncEngine::new(&pool, "test", "local");

        let mut source_a = HashMap::new();
        source_a.insert("server1".to_string(), "content_a");

        let mut source_b = HashMap::new();
        source_b.insert("server1".to_string(), "content_b");

        let hasher = |s: &&str| format!("hash_{}", s);

        let plan = engine.plan(&source_a, &source_b, hasher, hasher, hasher, hasher).await.unwrap();

        let item = plan.iter().find(|i| i.name == "server1").unwrap();
        // Since no history, this should be Conflict
        assert_eq!(item.status, SyncStatus::Conflict);
    }
}
