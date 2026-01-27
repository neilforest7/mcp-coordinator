export interface Machine {
  id: string;
  name: string;
  type: "local" | "remote";
  host?: string;
  port?: number;
  username?: string;
  sshKeyId?: number;
  platform?: "linux" | "windows" | "macos";
  status: "connected" | "disconnected" | "error";
  lastChecked?: Date;
}

export interface MachineFormData {
  name: string;
  type: "local" | "remote";
  host?: string;
  port?: number;
  username?: string;
  sshKeyId?: number;
  platform?: "linux" | "windows" | "macos";
}
