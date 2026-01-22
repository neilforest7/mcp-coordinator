use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ClaudeMCPServer {
    #[serde(rename = "isActive", skip_serializing_if = "Option::is_none")]
    pub is_active: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,

    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub server_type: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub args: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<HashMap<String, String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub headers: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeConfig {
    #[serde(rename = "mcpServers", default)]
    pub mcp_servers: HashMap<String, ClaudeMCPServer>,

    #[serde(flatten)]
    pub other_fields: HashMap<String, serde_json::Value>,
}

impl ClaudeConfig {
    #[allow(dead_code)]
    pub fn get_enabled_servers(&self) -> Vec<(&String, &ClaudeMCPServer)> {
        self.mcp_servers
            .iter()
            .filter(|(name, server)| {
                !name.starts_with("_disabled_") && server.is_active.unwrap_or(true)
            })
            .collect()
    }

    #[allow(dead_code)]
    pub fn get_disabled_servers(&self) -> Vec<(&String, &ClaudeMCPServer)> {
        self.mcp_servers
            .iter()
            .filter(|(name, server)| {
                name.starts_with("_disabled_") || !server.is_active.unwrap_or(true)
            })
            .collect()
    }
}
