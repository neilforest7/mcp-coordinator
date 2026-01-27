import { ClaudeConfig, OpenCodeConfig, MCPServer, ClaudeMCPServer, OpenCodeMCPServer } from "@/types/config";

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

export interface ParsedConfig {
    name?: string;
    type: "local" | "remote";
    command?: string[];
    url?: string;
    env?: Record<string, string>;
}

export function parseImportedJson(jsonStr: string): ParsedConfig | null {
    try {
        const raw = JSON.parse(jsonStr);
        
        // 1. Try to identify as a full Config object (containing mcpServers or mcp keys)
        if (raw.mcpServers) {
            const key = Object.keys(raw.mcpServers)[0];
            if (!key) return null;
            return normalizeClaudeServer(key, raw.mcpServers[key]);
        }
        if (raw.mcp) {
            const key = Object.keys(raw.mcp)[0];
            if (!key) return null;
            return normalizeOpenCodeServer(key, raw.mcp[key]);
        }

        // 2. Try to identify as a single Server object
        
        // Claude-style: has "args" OR "command" is a string OR "type" is stdio/sse
        if (typeof raw.command === "string" || Array.isArray(raw.args) || raw.type === "stdio" || raw.type === "sse") {
             // Try to infer name from "name" field if it exists, else undefined
            return normalizeClaudeServer(raw.name, raw as ClaudeMCPServer);
        }
        
        // OpenCode-style: "command" is array OR "type" is local/remote
        if (Array.isArray(raw.command) || raw.type === "local" || raw.type === "remote") {
            return normalizeOpenCodeServer(raw.name, raw as OpenCodeMCPServer);
        }
        
        return null;
    } catch {
        return null;
    }
}

function normalizeClaudeServer(name: string | undefined, server: ClaudeMCPServer): ParsedConfig {
    return {
        name,
        type: (server.type === "stdio" || !server.type) ? "local" : "remote",
        command: server.command ? [server.command, ...(server.args || [])] : undefined,
        url: server.url,
        env: server.env
    };
}

function normalizeOpenCodeServer(name: string | undefined, server: OpenCodeMCPServer): ParsedConfig {
    return {
        name,
        type: server.type,
        command: server.command,
        url: server.url,
        env: server.environment
    };
}

/**
 * Formats a command array for the target platform.
 * For Windows: Wraps command in "cmd /c ..." if not already present.
 * For Linux/Other: Returns command as-is.
 */
export function formatCommandForPlatform(
    commandParts: string[], 
    platform?: "linux" | "windows" | "macos"
): string[] {
    if (!commandParts.length) return commandParts;
    
    if (platform === "windows") {
        // Avoid double-wrapping
        if (commandParts[0].toLowerCase() === "cmd" && commandParts[1]?.toLowerCase() === "/c") {
            return commandParts;
        }
        return ["cmd", "/c", ...commandParts];
    }
    
    return commandParts;
}
