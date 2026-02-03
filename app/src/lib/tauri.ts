import { invoke } from "@tauri-apps/api/core";
import { ClaudeConfig, OpenCodeConfig, ClaudeMCPServer, OpenCodeMCPServer, SyncPlan } from "@/types/config";

export interface ConfigPaths {
  claude: string;
  claude_exists: boolean;
  opencode: string;
  opencode_exists: boolean;
}

export interface RemoteConfigResponse<T> {
  config: T;
  path: string;
  exists: boolean;
  app_installed: boolean;
}

export const tauriApi = {
  readClaudeConfig: (path: string) => 
    invoke<ClaudeConfig>("read_claude_config", { path }),

  readOpenCodeConfig: (path: string) => 
    invoke<OpenCodeConfig>("read_opencode_config", { path }),

  getDefaultConfigPaths: () => 
    invoke<ConfigPaths>("get_default_config_paths"),
  
  updateClaudeServer: (path: string, serverName: string, serverConfig: ClaudeMCPServer) => 
    invoke<void>("update_claude_server", { path, serverName, serverConfig }),
  
  updateOpenCodeServer: (path: string, serverName: string, serverConfig: OpenCodeMCPServer) => 
    invoke<void>("update_opencode_server", { path, serverName, serverConfig }),
    
  disableClaudeServer: (path: string, serverName: string) => 
    invoke<void>("disable_claude_server", { path, serverName }),
    
  enableClaudeServer: (path: string, serverName: string) => 
    invoke<void>("enable_claude_server", { path, serverName }),
    
  deleteClaudeServer: (path: string, serverName: string) => 
    invoke<void>("delete_claude_server", { path, serverName }),
    
  deleteOpenCodeServer: (path: string, serverName: string) => 
    invoke<void>("delete_opencode_server", { path, serverName }),

  batchToggleClaudeServers: (path: string, items: { name: string; enabled: boolean }[]) =>
    invoke<void>("batch_toggle_claude_servers", { path, items }),

  batchToggleOpencodeServers: (path: string, items: { name: string; enabled: boolean }[]) =>
    invoke<void>("batch_toggle_opencode_servers", { path, items }),

  readRemoteClaudeConfig: (machineId: number) => 
    invoke<RemoteConfigResponse<ClaudeConfig>>("read_remote_claude_config", { machineId }),

  readRemoteOpenCodeConfig: (machineId: number) => 
    invoke<RemoteConfigResponse<OpenCodeConfig>>("read_remote_opencode_config", { machineId }),

  updateRemoteClaudeServer: (machineId: number, serverName: string, serverConfig: ClaudeMCPServer, path?: string) => 
    invoke<void>("update_remote_claude_server", { machineId, serverName, serverConfig, path }),

  disableRemoteClaudeServer: (machineId: number, serverName: string, path?: string) =>
    invoke<void>("disable_remote_claude_server", { machineId, serverName, path }),
    
  enableRemoteClaudeServer: (machineId: number, serverName: string, path?: string) =>
    invoke<void>("enable_remote_claude_server", { machineId, serverName, path }),
    
  deleteRemoteClaudeServer: (machineId: number, serverName: string, path?: string) =>
    invoke<void>("delete_remote_claude_server", { machineId, serverName, path }),

  updateRemoteOpenCodeServer: (machineId: number, serverName: string, serverConfig: OpenCodeMCPServer, path?: string) =>
    invoke<void>("update_remote_opencode_server", { machineId, serverName, serverConfig, path }),

  deleteRemoteOpenCodeServer: (machineId: number, serverName: string, path?: string) =>
    invoke<void>("delete_remote_opencode_server", { machineId, serverName, path }),

  generateSyncPlan: (claudePath: string, opencodePath: string, machineId?: number) =>
    invoke<SyncPlan>("generate_sync_plan", { claudePath, opencodePath, machineId }),

  applySyncOpencodeToClaude: (claudePath: string, opencodePath: string, serverNames: string[], machineId?: number) =>
    invoke<void>("apply_sync_opencode_to_claude", { claudePath, opencodePath, serverNames, machineId }),

  applySyncClaudeToOpencode: (claudePath: string, opencodePath: string, serverNames: string[], machineId?: number) =>
    invoke<void>("apply_sync_claude_to_opencode", { claudePath, opencodePath, serverNames, machineId }),

  nuclearRestart: (machineId?: number) =>
    invoke<string>("nuclear_restart", { machineId }),

  checkEnvironment: (machineId?: number) =>
    invoke<import("@/types/system").EnvCheckResult>("check_environment", { machineId }),
};

