import { ClaudeConfig, OpenCodeConfig, MCPServer } from "@/types/config";

export function transformClaudeConfig(config: ClaudeConfig | undefined): MCPServer[] {
  if (!config?.mcpServers) return [];
  
  return Object.entries(config.mcpServers).map(([key, server]) => {
    // Check if disabled (key starts with _disabled_)
    const isDisabled = key.startsWith("_disabled_");
    const originalName = isDisabled ? key.replace("_disabled_", "") : key;
    
    // Check isActive field - default to true if undefined, unless strictly false
    // But if key is prefixed, it is disabled effectively.
    // The "isActive" field inside might be false too.
    const enabled = !isDisabled && (server.isActive !== false);

    return {
      name: originalName,
      originalName: key, // Keep original key for updates
      enabled,
      type: (server.type === "stdio" || !server.type) ? "local" : "remote", // Default to local/stdio
      command: server.command ? [server.command, ...(server.args || [])] : undefined,
      environment: server.env,
      url: server.url,
      source: "claude",
    };
  });
}

export function transformOpenCodeConfig(config: OpenCodeConfig | undefined): MCPServer[] {
  if (!config?.mcp) return [];
  
  return Object.entries(config.mcp).map(([key, server]) => {
    return {
      name: key,
      originalName: key,
      enabled: server.enabled !== false, // Default true
      type: server.type,
      command: server.command,
      environment: server.environment,
      url: server.url,
      source: "opencode",
    };
  });
}
