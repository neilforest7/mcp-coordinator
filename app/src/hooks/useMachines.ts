import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Machine } from "../types/machine";
import { toast } from "sonner";

const DEFAULT_LOCAL_MACHINE: Machine = { 
    id: "local", 
    name: "Local Machine", 
    type: "local", 
    status: "connected",
    platform: "linux" // Default, will be updated
};

interface BackendMachine {
    id: number;
    name: string;
    host: string;
    username: string;
    ssh_key_id: number;
    port: number;
    platform: string;
    created_at: string;
}

export function useMachines() {
    const [machines, setMachines] = useState<Machine[]>([DEFAULT_LOCAL_MACHINE]);
    const [loading, setLoading] = useState(false);

    // Initial platform detection
    useEffect(() => {
        const initLocalPlatform = async () => {
            try {
                // Check localStorage first
                const storedPlatform = localStorage.getItem("opencode_local_platform");
                if (storedPlatform) {
                    setMachines(prev => prev.map(m => 
                        m.id === "local" ? { ...m, platform: storedPlatform as "linux"|"windows"|"macos" } : m
                    ));
                    return;
                }

                // Detect from backend
                const platform = await invoke<string>("get_host_platform");
                const normalizedPlatform = platform === "macos" ? "macos" : (platform === "windows" ? "windows" : "linux");
                
                setMachines(prev => prev.map(m => 
                    m.id === "local" ? { ...m, platform: normalizedPlatform } : m
                ));
            } catch (e) {
                console.error("Failed to detect platform", e);
            }
        };
        initLocalPlatform();
    }, []);

    const fetchMachines = useCallback(async () => {
        try {
            setLoading(true);
            const backendMachines = await invoke<BackendMachine[]>("list_machines");
            const remoteMachines: Machine[] = backendMachines.map(m => ({
                id: m.id.toString(),
                name: m.name,
                type: "remote",
                host: m.host,
                username: m.username,
                port: m.port,
                sshKeyId: m.ssh_key_id,
                platform: (m.platform as "linux" | "windows" | "macos") || "linux",
                status: "disconnected", // Needs connectivity check implementation
            }));
            
            setMachines(prev => {
                const local = prev.find(m => m.id === "local") || DEFAULT_LOCAL_MACHINE;
                return [local, ...remoteMachines];
            });
        } catch (error) {
            console.error("Failed to fetch machines:", error);
            toast.error("Failed to load machines");
        } finally {
            setLoading(false);
        }
    }, []);

    const addMachine = useCallback(async (name: string, host: string, username: string, sshKeyId: number, port: number = 22, platform: string = "linux") => {
        try {
            await invoke("add_machine", { name, host, username, sshKeyId, port, platform });
            toast.success("Machine added");
            fetchMachines();
            return true;
        } catch (error) {
            console.error("Failed to add machine:", error);
            toast.error(`Failed to add machine: ${error}`);
            return false;
        }
    }, [fetchMachines]);

    const updateMachine = useCallback(async (id: string, name: string, host: string, username: string, sshKeyId: number, port: number = 22, platform: string = "linux") => {
        if (id === "local") {
            // Handle local machine update (platform/name only)
            localStorage.setItem("opencode_local_platform", platform);
            setMachines(prev => prev.map(m => 
                m.id === "local" ? { ...m, name, platform: platform as "linux"|"windows"|"macos" } : m
            ));
            toast.success("Local machine updated");
            return true;
        }

        try {
            await invoke("update_machine", { id: parseInt(id), name, host, username, sshKeyId, port, platform });
            toast.success("Machine updated");
            fetchMachines();
            return true;
        } catch (error) {
            console.error("Failed to update machine:", error);
            toast.error(`Failed to update machine: ${error}`);
            return false;
        }
    }, [fetchMachines]);

    const deleteMachine = useCallback(async (id: string) => {
        if (id === "local") return;
        try {
            await invoke("delete_machine", { id: parseInt(id) });
            toast.success("Machine deleted");
            fetchMachines();
        } catch (error) {
            console.error("Failed to delete machine:", error);
            toast.error("Failed to delete machine");
        }
    }, [fetchMachines]);

    return { machines, loading, fetchMachines, addMachine, updateMachine, deleteMachine };
}
