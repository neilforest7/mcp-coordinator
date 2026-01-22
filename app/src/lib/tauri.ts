import { invoke } from "@tauri-apps/api/core";
import { ClaudeConfig, OpenCodeConfig, ClaudeMCPServer, OpenCodeMCPServer } from "@/types/config";

export interface ConfigPaths {
  claude: string;
  claude_exists: boolean;
  opencode: string;
  opencode_exists: boolean;
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
};
