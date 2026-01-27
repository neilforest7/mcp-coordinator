import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SSHKey, AddSSHKeyParams } from "../types";
import { toast } from "sonner";

export function useSSH() {
  const [keys, setKeys] = useState<SSHKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      setLoading(true);
      const data = await invoke<SSHKey[]>("list_ssh_keys");
      setKeys(data);
    } catch (error) {
      console.error("Failed to fetch SSH keys:", error);
      toast.error("Failed to load SSH keys");
    } finally {
      setLoading(false);
    }
  }, []);

  const addKey = useCallback(async (params: AddSSHKeyParams) => {
    try {
      await invoke("add_ssh_key", {
        name: params.name,
        privateKey: params.privateKey,
      });
      toast.success("SSH key added successfully");
      fetchKeys();
      return true;
    } catch (error) {
      console.error("Failed to add SSH key:", error);
      toast.error(`Failed to add SSH key: ${error}`);
      return false;
    }
  }, [fetchKeys]);

  const deleteKey = useCallback(async (keyId: number) => {
    try {
      await invoke("delete_ssh_key", { keyId });
      toast.success("SSH key deleted successfully");
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
    } catch (error) {
      console.error("Failed to delete SSH key:", error);
      toast.error("Failed to delete SSH key");
    }
  }, []);

  const testConnection = useCallback(async (host: string, username: string, privateKey: string) => {
    try {
      setTestingConnection(true);
      const output = await invoke<string>("test_ssh_connection", {
        host,
        username,
        privateKey,
      });
      toast.success("Connection successful!");
      console.log("SSH Output:", output);
      return true;
    } catch (error) {
      console.error("SSH Test Failed:", error);
      toast.error(`Connection failed: ${error}`);
      return false;
    } finally {
      setTestingConnection(false);
    }
  }, []);

  return {
    keys,
    loading,
    testingConnection,
    fetchKeys,
    addKey,
    deleteKey,
    testConnection,
  };
}
