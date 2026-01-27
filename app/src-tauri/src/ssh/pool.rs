use ssh2::Session;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Debug, Hash, Eq, PartialEq, Clone)]
pub struct PoolKey {
    host: String,
    port: u16,
    username: String,
}

#[derive(Clone)]
pub struct SshPool {
    // We use Arc<Mutex<Session>> because we need to lock the session to use it
    // and we want to share it across threads.
    sessions: Arc<Mutex<HashMap<PoolKey, Arc<Mutex<Session>>>>>,
}

impl SshPool {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Check if the pool has a connection for the given key
    #[allow(dead_code)]
    pub fn has_connection(&self, host: &str, port: u16, username: &str) -> bool {
        let key = PoolKey {
            host: host.to_string(),
            port,
            username: username.to_string(),
        };
        let sessions = self.sessions.lock().unwrap();
        sessions.contains_key(&key)
    }

    /// Remove a connection from the pool (e.g. if known bad)
    pub fn remove(&self, host: &str, port: u16, username: &str) {
        let key = PoolKey {
            host: host.to_string(),
            port,
            username: username.to_string(),
        };
        let mut sessions = self.sessions.lock().unwrap();
        sessions.remove(&key);
        println!(
            "[SSH Pool] Removed connection for {}@{}:{}",
            username, host, port
        );
    }

    /// Get an existing connection or create a new one
    pub fn get_connection(
        &self,
        host: &str,
        port: u16,
        username: &str,
        private_key: &str,
    ) -> Result<Arc<Mutex<Session>>, String> {
        let key = PoolKey {
            host: host.to_string(),
            port,
            username: username.to_string(),
        };

        // 1. Try to get existing session
        {
            let sessions = self.sessions.lock().unwrap();
            if let Some(session_arc) = sessions.get(&key) {
                // Return clone of the Arc
                println!(
                    "[SSH Pool] Reusing connection for {}@{}:{}",
                    username, host, port
                );
                return Ok(session_arc.clone());
            }
        }

        // 2. Create new session (without holding the lock, to avoid blocking other connections)
        println!(
            "[SSH Pool] Creating NEW connection for {}@{}:{}",
            username, host, port
        );
        match crate::ssh::connection::create_ssh_session(host, port, username, private_key) {
            Ok(session) => {
                let session_arc = Arc::new(Mutex::new(session));

                // 3. Insert into pool
                let mut sessions = self.sessions.lock().unwrap();
                sessions.insert(key, session_arc.clone());

                Ok(session_arc)
            }
            Err(e) => Err(e),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pool_key_equality() {
        let key1 = PoolKey {
            host: "127.0.0.1".to_string(),
            port: 22,
            username: "user".to_string(),
        };
        let key2 = PoolKey {
            host: "127.0.0.1".to_string(),
            port: 22,
            username: "user".to_string(),
        };
        let key3 = PoolKey {
            host: "192.168.1.1".to_string(),
            port: 22,
            username: "user".to_string(),
        };

        assert_eq!(key1, key2);
        assert_ne!(key1, key3);
    }

    #[test]
    fn test_pool_management() {
        let pool = SshPool::new();
        assert!(!pool.has_connection("localhost", 22, "root"));

        // We simulate adding by just checking the API availability
        // Since we can't create a real Session without a network call,
        // we can't unit test the get_connection -> insert flow fully here
        // without mocking create_ssh_session.
        // However, we verify the remove logic runs without panic.
        pool.remove("localhost", 22, "root");
    }
}
