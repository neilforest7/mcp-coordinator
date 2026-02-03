export type SourceType = "claude" | "opencode";

export interface ClaudeMCPServer {
  isActive?: boolean;
  name?: string;
  type?: "stdio" | "sse" | "http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

export interface ClaudeConfig {
  mcpServers: Record<string, ClaudeMCPServer>;
  projects?: Record<string, unknown>;
  userID?: string;
  numStartups?: number;
  [key: string]: unknown;
}

export interface OpenCodeMCPServer {
  type: "local" | "remote";
  command?: string[];
  environment?: Record<string, string>;
  enabled?: boolean;
  url?: string;
  headers?: Record<string, string>;
}

export interface OpenCodeConfig {
  $schema?: string;
  plugin?: string[];
  provider?: Record<string, unknown>;
  mcp: Record<string, OpenCodeMCPServer>;
  [key: string]: unknown;
}

export interface MCPServer {
  name: string;
  originalName: string;
  enabled: boolean;
  type: "local" | "remote";
  command?: string[];
  environment?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  source: SourceType;
  rawConfig?: OpenCodeMCPServer | ClaudeMCPServer;
}


export interface SourceConfig {
  type: SourceType;
  filePath: string;
  servers: MCPServer[];
  lastModified?: Date;
  md5Hash?: string;
}

export interface DiffLine {
  tag: "equal" | "insert" | "delete";
  content: string;
}

export interface SyncItem {
  name: string;
  status: "Synced" | "CreatedInB" | "DeletedFromB" | "UpdatedInB" | "CreatedInA" | "DeletedFromA" | "UpdatedInA" | "Conflict";
  actionDescription: string;
  diff?: string;
  diffLines?: DiffLine[];
  claudeJson?: string;
  opencodeJson?: string;
  claudeAsOpencodeJson?: string;
  opencodeAsClaudeJson?: string;
  contentMatches?: string[];
}

export interface SyncPlan {
  items: SyncItem[];
}
