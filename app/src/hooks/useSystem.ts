import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tauriApi } from "@/lib/tauri";
import { useEffect } from "react";

export function useEnvironmentCheck(machineId: string) {
    const isLocal = machineId === "local";
    const id = isLocal ? undefined : parseInt(machineId);
    
    // Invalidate when machineId changes
    const queryClient = useQueryClient();
    useEffect(() => {
        queryClient.invalidateQueries({ queryKey: ["env-check"] });
    }, [machineId, queryClient]);

    return useQuery({
        queryKey: ["env-check", machineId],
        queryFn: async () => {
            return await tauriApi.checkEnvironment(id);
        },
        retry: false,
        refetchOnWindowFocus: false,
    });
}
