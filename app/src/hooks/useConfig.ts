import { useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tauriApi } from "@/lib/tauri";
import { ClaudeMCPServer, OpenCodeMCPServer, ClaudeConfig, OpenCodeConfig } from "@/types/config";

// Cache configuration constants
// For remote connections, we want data to be considered fresh for longer
// to avoid unnecessary SSH connections on every tab switch
export const CACHE_CONFIG = {
  // How long data is considered "fresh" (won't re-fetch)
  REMOTE_STALE_TIME: 5 * 60 * 1000, // 5 minutes for remote configs
  LOCAL_STALE_TIME: 30 * 1000,       // 30 seconds for local configs
  
  // How long to keep data in cache after it becomes unused
  GC_TIME: 30 * 60 * 1000,           // 30 minutes garbage collection
  
  // Retry configuration for failed requests
  RETRY_COUNT: 2,
  RETRY_DELAY: 1000,
};

export const QUERY_KEYS = {
  paths: ["paths"],
  claude: (path: string) => ["claude", path],
  opencode: (path: string) => ["opencode", path],
  // Specific keys for remote prefetching
  remoteClaudeConfig: (machineId: string) => ["remote-claude-config", machineId],
  remoteOpenCodeConfig: (machineId: string) => ["remote-opencode-config", machineId],
};

export function useConfigPaths() {
  const query = useQuery({
    queryKey: QUERY_KEYS.paths,
    queryFn: tauriApi.getDefaultConfigPaths,
    staleTime: CACHE_CONFIG.LOCAL_STALE_TIME,
    gcTime: CACHE_CONFIG.GC_TIME,
  });
  
  return {
      ...query,
      refetch: query.refetch
  };
}

// Helper hook to get the remote path
export function useRemoteConfigPaths(machineId: string) {
    const isRemote = machineId !== "local";
    
    // Only invalidate on explicit user actions (refresh button), 
    // NOT on machine ID changes - we want to use cached data!
    
    const claudeQuery = useQuery({
        queryKey: ["remote-path", "claude", machineId],
        queryFn: async () => {
            if (!isRemote) return null;
            const res = await tauriApi.readRemoteClaudeConfig(parseInt(machineId));
            return res.path;
        },
        enabled: isRemote,
        staleTime: CACHE_CONFIG.REMOTE_STALE_TIME,
        gcTime: CACHE_CONFIG.GC_TIME,
        refetchOnMount: false, // Use cached data on mount
        refetchOnWindowFocus: false, // Don't refetch on focus for remote
    });

    const opencodeQuery = useQuery({
        queryKey: ["remote-path", "opencode", machineId],
        queryFn: async () => {
            if (!isRemote) return null;
            const res = await tauriApi.readRemoteOpenCodeConfig(parseInt(machineId));
            return res.path;
        },
        enabled: isRemote,
        staleTime: CACHE_CONFIG.REMOTE_STALE_TIME,
        gcTime: CACHE_CONFIG.GC_TIME,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });

    const refetch = useCallback(() => {
        claudeQuery.refetch();
        opencodeQuery.refetch();
    }, [claudeQuery, opencodeQuery]);

    return {
        claudePath: claudeQuery.data,
        opencodePath: opencodeQuery.data,
        isLoading: claudeQuery.isLoading || opencodeQuery.isLoading,
        isFetching: claudeQuery.isFetching || opencodeQuery.isFetching,
        isStale: claudeQuery.isStale || opencodeQuery.isStale,
        refetch
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

  const query = useQuery({
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
    // Caching configuration
    staleTime: isRemote ? CACHE_CONFIG.REMOTE_STALE_TIME : CACHE_CONFIG.LOCAL_STALE_TIME,
    gcTime: CACHE_CONFIG.GC_TIME,
    refetchOnMount: isRemote ? false : true, // Use cached data for remote on mount
    refetchOnWindowFocus: isRemote ? false : true,
    retry: isRemote ? CACHE_CONFIG.RETRY_COUNT : 0,
    retryDelay: CACHE_CONFIG.RETRY_DELAY,
  });

  return {
    ...query,
    isFetching: query.isFetching,
    isStale: query.isStale,
  };
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

  const query = useQuery({
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
    // Caching configuration
    staleTime: isRemote ? CACHE_CONFIG.REMOTE_STALE_TIME : CACHE_CONFIG.LOCAL_STALE_TIME,
    gcTime: CACHE_CONFIG.GC_TIME,
    refetchOnMount: isRemote ? false : true,
    refetchOnWindowFocus: isRemote ? false : true,
    retry: isRemote ? CACHE_CONFIG.RETRY_COUNT : 0,
    retryDelay: CACHE_CONFIG.RETRY_DELAY,
  });

  return {
    ...query,
    isFetching: query.isFetching,
    isStale: query.isStale,
  };
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

export function useClaudeBatchMutations(path: string, machineId: string = "local") {
  const queryClient = useQueryClient();
  const isRemote = machineId !== "local";
  const queryKey = QUERY_KEYS.claude(isRemote ? `remote-${machineId}` : (path || ""));

  const batchToggle = useMutation({
    mutationFn: async (items: { name: string; enabled: boolean }[]) => {
      if (isRemote) {
        throw new Error("Batch operations not supported for remote machines yet");
      }
      return tauriApi.batchToggleClaudeServers(path, items);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return { batchToggle };
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

export function useOpenCodeBatchMutations(path: string, machineId: string = "local") {
  const queryClient = useQueryClient();
  const isRemote = machineId !== "local";
  const queryKey = QUERY_KEYS.opencode(isRemote ? `remote-${machineId}` : (path || ""));

  const batchToggle = useMutation({
    mutationFn: async (items: { name: string; enabled: boolean }[]) => {
      if (isRemote) {
        throw new Error("Batch operations not supported for remote machines yet");
      }
      return tauriApi.batchToggleOpencodeServers(path, items);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return { batchToggle };
}

/**
 * Hook to prefetch remote machine configurations in the background.
 * Call this after machines list is loaded to warm up the cache.
 * 
 * This enables instant tab switching by pre-fetching data before user needs it.
 */
export function usePrefetchRemoteConfigs() {
  const queryClient = useQueryClient();

  const prefetchMachineConfigs = useCallback(async (machineIds: string[]) => {
    const remoteMachineIds = machineIds.filter(id => id !== "local");
    
    console.log(`[Cache] Prefetching configs for ${remoteMachineIds.length} remote machines...`);
    
    // Prefetch all remote machine configs in parallel
    const prefetchPromises = remoteMachineIds.flatMap(machineId => [
      // Prefetch Claude config
      queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.claude(`remote-${machineId}`),
        queryFn: async () => {
          const response = await tauriApi.readRemoteClaudeConfig(parseInt(machineId));
          return { config: response.config, exists: response.exists, appInstalled: response.app_installed };
        },
        staleTime: CACHE_CONFIG.REMOTE_STALE_TIME,
        gcTime: CACHE_CONFIG.GC_TIME,
      }),
      // Prefetch OpenCode config
      queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.opencode(`remote-${machineId}`),
        queryFn: async () => {
          const response = await tauriApi.readRemoteOpenCodeConfig(parseInt(machineId));
          return { config: response.config, exists: response.exists, appInstalled: response.app_installed };
        },
        staleTime: CACHE_CONFIG.REMOTE_STALE_TIME,
        gcTime: CACHE_CONFIG.GC_TIME,
      }),
    ]);

    // Don't await - let it run in background
    // But catch errors to prevent unhandled rejections
    Promise.allSettled(prefetchPromises).then(results => {
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failCount = results.filter(r => r.status === 'rejected').length;
      console.log(`[Cache] Prefetch complete: ${successCount} succeeded, ${failCount} failed`);
    });
  }, [queryClient]);

  const prefetchSingleMachine = useCallback(async (machineId: string) => {
    if (machineId === "local") return;
    
    console.log(`[Cache] Prefetching configs for machine ${machineId}...`);
    
    // Prefetch both configs
    await Promise.allSettled([
      queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.claude(`remote-${machineId}`),
        queryFn: async () => {
          const response = await tauriApi.readRemoteClaudeConfig(parseInt(machineId));
          return { config: response.config, exists: response.exists, appInstalled: response.app_installed };
        },
        staleTime: CACHE_CONFIG.REMOTE_STALE_TIME,
        gcTime: CACHE_CONFIG.GC_TIME,
      }),
      queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.opencode(`remote-${machineId}`),
        queryFn: async () => {
          const response = await tauriApi.readRemoteOpenCodeConfig(parseInt(machineId));
          return { config: response.config, exists: response.exists, appInstalled: response.app_installed };
        },
        staleTime: CACHE_CONFIG.REMOTE_STALE_TIME,
        gcTime: CACHE_CONFIG.GC_TIME,
      }),
    ]);
    
    console.log(`[Cache] Prefetch complete for machine ${machineId}`);
  }, [queryClient]);

  return {
    prefetchMachineConfigs,
    prefetchSingleMachine,
  };
}
