use crate::config::{ClaudeMCPServer, OpenCodeMCPServer};
use serde::Serialize;
use std::collections::BTreeMap;

#[derive(Serialize)]
struct FingerprintData {
    command: Option<String>,
    args: Option<Vec<String>>,
    env: Option<BTreeMap<String, String>>, // BTreeMap for stable ordering
    // we don't include enabled/disabled in fingerprint for content conflict?
    // PRD says: "Hash: name + command + args + env (sorted)"
    // If enabled state changes, is it a conflict? Usually yes.
    enabled: bool,
}

pub enum ChangeStatus {
    NoChange,
    LocalOnly,    // Local changed, Remote didn't (or matched last sync)
    RemoteOnly,   // Remote changed, Local didn't
    BothModified, // Both changed differently
}

pub struct ConflictDetector;

impl ConflictDetector {
    pub fn fingerprint_claude(server: &ClaudeMCPServer) -> String {
        let data = FingerprintData {
            command: server.command.clone(),
            args: server.args.clone(),
            env: server.env.clone().map(|m| m.into_iter().collect()),
            // Exclude enabled state from content fingerprint to avoid false content conflicts
            enabled: true,
        };
        Self::hash(&data)
    }

    pub fn fingerprint_opencode(server: &OpenCodeMCPServer) -> String {
        let (command, args) = if let Some(cmd_vec) = &server.command {
            if !cmd_vec.is_empty() {
                (Some(cmd_vec[0].clone()), Some(cmd_vec[1..].to_vec()))
            } else {
                (None, None)
            }
        } else {
            (None, None)
        };

        let data = FingerprintData {
            command,
            args,
            env: server.environment.clone().map(|m| m.into_iter().collect()),
            // Exclude enabled state from content fingerprint
            enabled: true,
        };
        Self::hash(&data)
    }

    fn hash<T: Serialize>(data: &T) -> String {
        let json = serde_json::to_string(data).unwrap_or_default();
        let digest = md5::compute(json);
        format!("{:x}", digest)
    }

    pub fn detect_changes(
        local_fingerprint: &str,
        remote_fingerprint: &str,
        last_sync_local: Option<&str>,
        last_sync_remote: Option<&str>, // Usually these are the same if sync was successful
    ) -> ChangeStatus {
        let last = last_sync_local.or(last_sync_remote);

        match last {
            Some(last_fp) => {
                let local_changed = local_fingerprint != last_fp;
                let remote_changed = remote_fingerprint != last_fp;

                if local_changed && remote_changed {
                    if local_fingerprint == remote_fingerprint {
                        ChangeStatus::NoChange // They changed to the same thing
                    } else {
                        ChangeStatus::BothModified
                    }
                } else if local_changed {
                    ChangeStatus::LocalOnly
                } else if remote_changed {
                    ChangeStatus::RemoteOnly
                } else {
                    ChangeStatus::NoChange
                }
            }
            None => {
                // New setup or first sync
                if local_fingerprint == remote_fingerprint {
                    ChangeStatus::NoChange
                } else {
                    ChangeStatus::BothModified // Both exist but different and no history
                }
            }
        }
    }
}
