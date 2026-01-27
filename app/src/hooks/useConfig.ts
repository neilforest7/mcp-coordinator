import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tauriApi } from "@/lib/tauri";
import { ClaudeMCPServer, OpenCodeMCPServer, ClaudeConfig, OpenCodeConfig } from "@/types/config";

export const QUERY_KEYS = {
  paths: ["paths"],
  claude: (path: string) => ["claude", path],
  opencode: (path: string) => ["opencode", path],
};

export function useConfigPaths() {
  const query = useQuery({
    queryKey: QUERY_KEYS.paths,
    queryFn: tauriApi.getDefaultConfigPaths,
  });
  
  return {
      ...query,
      refetch: query.refetch
  };
}

// Helper hook to get the remote path
export function useRemoteConfigPaths(machineId: string) {
    const isRemote = machineId !== "local";
    const queryClient = useQueryClient();
    
    // Invalidate queries when machine ID changes
    useEffect(() => {
        if (isRemote) {
            queryClient.invalidateQueries({ queryKey: ["remote-path"] });
        }
    }, [machineId, isRemote, queryClient]);
    
    const claudeQuery = useQuery({
        queryKey: ["remote-path", "claude", machineId],
        queryFn: async () => {
            if (!isRemote) return null;
            const res = await tauriApi.readRemoteClaudeConfig(parseInt(machineId));
            return res.path;
        },
        enabled: isRemote
    });

    const opencodeQuery = useQuery({
        queryKey: ["remote-path", "opencode", machineId],
        queryFn: async () => {
            if (!isRemote) return null;
            const res = await tauriApi.readRemoteOpenCodeConfig(parseInt(machineId));
            return res.path;
        },
        enabled: isRemote
    });

    return {
        claudePath: claudeQuery.data,
        opencodePath: opencodeQuery.data,
        refetch: () => {
            claudeQuery.refetch();
            opencodeQuery.refetch();
        }
    };
}

export function useClaudeConfig(path: string | undefined, machineId: string = "local") {
  const queryClient = useQueryClient();
  const isRemote = machineId !== "local";
  const queryKey = QUERY_KEYS.claude(isRemote ? `remote-${machineId}` : (path || ""));

  useEffect(() => {
    if (isRemote) return;
    const unlisten = listen("config-changed", () => {
        queryClient.invalidateQueries({ queryKey });
    });
    return () => {
        unlisten.then(f => f());
    };
  }, [queryClient, queryKey, isRemote]);

  return useQuery({
    queryKey,
    queryFn: async () => {
        if (isRemote) {
            const response = await tauriApi.readRemoteClaudeConfig(parseInt(machineId));
            return { config: response.config, exists: response.exists, appInstalled: response.app_installed };
        }
        try {
            const config = await tauriApi.readClaudeConfig(path!);
            // Local detection not fully implemented for appInstalled yet, default to true for exists=true
            return { config, exists: true, appInstalled: true };
        } catch (e: any) {
            const msg = e?.toString()?.toLowerCase() || "";
            if (msg.includes("no such file") || msg.includes("cannot find") || msg.includes("does not exist")) {
                // Return empty config with exists: false
                return { config: { mcpServers: {} } as ClaudeConfig, exists: false, appInstalled: false };
            }
            throw e;
        }
    },
    enabled: (isRemote) || (!!path),
  });
}

export function useOpenCodeConfig(path: string | undefined, machineId: string = "local") {
  const queryClient = useQueryClient();
  const isRemote = machineId !== "local";
  const queryKey = QUERY_KEYS.opencode(isRemote ? `remote-${machineId}` : (path || ""));

  useEffect(() => {
    if (isRemote) return;
    const unlisten = listen("config-changed", () => {
        queryClient.invalidateQueries({ queryKey });
    });
    return () => {
        unlisten.then(f => f());
    };
  }, [queryClient, queryKey, isRemote]);

  return useQuery({
    queryKey,
    queryFn: async () => {
        if (isRemote) {
            const response = await tauriApi.readRemoteOpenCodeConfig(parseInt(machineId));
            return { config: response.config, exists: response.exists, appInstalled: response.app_installed };
        }
        try {
            const config = await tauriApi.readOpenCodeConfig(path!);
            return { config, exists: true, appInstalled: true };
        } catch (e: any) {
             const msg = e?.toString()?.toLowerCase() || "";
             if (msg.includes("no such file") || msg.includes("cannot find") || msg.includes("does not exist")) {
                 return { config: { mcp: {} } as OpenCodeConfig, exists: false, appInstalled: false };
             }
             throw e;
        }
    },
    enabled: (isRemote) || (!!path),
  });
}

export function useClaudeMutations(path: string, machineId: string = "local") {
  const queryClient = useQueryClient();
  const isRemote = machineId !== "local";
  const queryKey = QUERY_KEYS.claude(isRemote ? `remote-${machineId}` : (path || ""));
  
  const updateServer = useMutation({
    mutationFn: ({ name, config, remotePath }: { name: string; config: ClaudeMCPServer, remotePath?: string }) => {
        if (isRemote) {
            return tauriApi.updateRemoteClaudeServer(parseInt(machineId), name, config, remotePath);
        }
        return tauriApi.updateClaudeServer(path, name, config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const toggleServer = useMutation({
    mutationFn: ({ name, enabled, remotePath }: { name: string; enabled: boolean, remotePath?: string }) => {
        if (isRemote) {
            const id = parseInt(machineId);
            return enabled
                ? tauriApi.enableRemoteClaudeServer(id, name, remotePath)
                : tauriApi.disableRemoteClaudeServer(id, name, remotePath);
        }
        return enabled
        ? tauriApi.enableClaudeServer(path, name)
        : tauriApi.disableClaudeServer(path, name)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteServer = useMutation({
    mutationFn: ({ name, remotePath }: { name: string, remotePath?: string }) => {
        if (isRemote) {
            return tauriApi.deleteRemoteClaudeServer(parseInt(machineId), name, remotePath);
        }
        return tauriApi.deleteClaudeServer(path, name)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return { updateServer, toggleServer, deleteServer };
}


export function useOpenCodeMutations(path: string, machineId: string = "local") {
  const queryClient = useQueryClient();
  const isRemote = machineId !== "local";
  const queryKey = QUERY_KEYS.opencode(isRemote ? `remote-${machineId}` : (path || ""));

  const updateServer = useMutation({
    mutationFn: ({ name, config, remotePath }: { name: string; config: OpenCodeMCPServer, remotePath?: string }) => {
        if (isRemote) {
            return tauriApi.updateRemoteOpenCodeServer(parseInt(machineId), name, config, remotePath);
        }
        return tauriApi.updateOpenCodeServer(path, name, config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteServer = useMutation({
    mutationFn: ({ name, remotePath }: { name: string, remotePath?: string }) => {
        if (isRemote) {
            return tauriApi.deleteRemoteOpenCodeServer(parseInt(machineId), name, remotePath);
        }
        return tauriApi.deleteOpenCodeServer(path, name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return { updateServer, deleteServer };
}
