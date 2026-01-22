import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tauriApi } from "@/lib/tauri";
import { ClaudeMCPServer, OpenCodeMCPServer } from "@/types/config";

export const QUERY_KEYS = {
  paths: ["paths"],
  claude: (path: string) => ["claude", path],
  opencode: (path: string) => ["opencode", path],
};

export function useConfigPaths() {
  return useQuery({
    queryKey: QUERY_KEYS.paths,
    queryFn: tauriApi.getDefaultConfigPaths,
  });
}

export function useClaudeConfig(path: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.claude(path || ""),
    queryFn: () => tauriApi.readClaudeConfig(path!),
    enabled: !!path,
  });
}

export function useOpenCodeConfig(path: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.opencode(path || ""),
    queryFn: () => tauriApi.readOpenCodeConfig(path!),
    enabled: !!path,
  });
}

export function useClaudeMutations(path: string) {
  const queryClient = useQueryClient();

  const updateServer = useMutation({
    mutationFn: ({ name, config }: { name: string; config: ClaudeMCPServer }) =>
      tauriApi.updateClaudeServer(path, name, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.claude(path) });
    },
  });

  const toggleServer = useMutation({
    mutationFn: ({ name, enabled }: { name: string; enabled: boolean }) =>
      enabled
        ? tauriApi.enableClaudeServer(path, name)
        : tauriApi.disableClaudeServer(path, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.claude(path) });
    },
  });

  const deleteServer = useMutation({
    mutationFn: (name: string) => tauriApi.deleteClaudeServer(path, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.claude(path) });
    },
  });

  return { updateServer, toggleServer, deleteServer };
}

export function useOpenCodeMutations(path: string) {
  const queryClient = useQueryClient();

  const updateServer = useMutation({
    mutationFn: ({ name, config }: { name: string; config: OpenCodeMCPServer }) =>
      tauriApi.updateOpenCodeServer(path, name, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.opencode(path) });
    },
  });

  const deleteServer = useMutation({
    mutationFn: (name: string) => tauriApi.deleteOpenCodeServer(path, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.opencode(path) });
    },
  });

  return { updateServer, deleteServer };
}
