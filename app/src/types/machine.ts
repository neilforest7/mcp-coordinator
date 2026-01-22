export interface Machine {
  id: string;
  name: string;
  type: "local" | "remote";
  host?: string;
  port?: number;
  username?: string;
  status: "connected" | "disconnected" | "error";
  lastChecked?: Date;
}

export interface MachineFormData {
  name: string;
  type: "local" | "remote";
  host?: string;
  port?: number;
  username?: string;
  privateKey?: string;
}
