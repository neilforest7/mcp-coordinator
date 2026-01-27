use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OpenCodeMCPServer {
    #[serde(rename = "type")]
    pub server_type: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub environment: Option<HashMap<String, String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub enabled: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub headers: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenCodeConfig {
    #[serde(rename = "$schema", skip_serializing_if = "Option::is_none")]
    pub schema: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub plugin: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<serde_json::Value>,

    #[serde(default)]
    pub mcp: HashMap<String, OpenCodeMCPServer>,

    #[serde(flatten)]
    pub other_fields: HashMap<String, serde_json::Value>,
}

impl Default for OpenCodeConfig {
    fn default() -> Self {
        Self {
            schema: None,
            plugin: None,
            provider: None,
            mcp: HashMap::new(),
            other_fields: HashMap::new(),
        }
    }
}

impl OpenCodeConfig {
    #[allow(dead_code)]
    pub fn get_enabled_servers(&self) -> Vec<(&String, &OpenCodeMCPServer)> {
        self.mcp
            .iter()
            .filter(|(_, server)| server.enabled.unwrap_or(true))
            .collect()
    }

    #[allow(dead_code)]
    pub fn get_disabled_servers(&self) -> Vec<(&String, &OpenCodeMCPServer)> {
        self.mcp
            .iter()
            .filter(|(_, server)| !server.enabled.unwrap_or(true))
            .collect()
    }
}
