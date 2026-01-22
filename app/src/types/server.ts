import type { SourceType } from "./config";

export interface SyncOptions {
  sourceType: SourceType;
  targetType: SourceType;
  servers: string[];
  mode: "overwrite" | "merge";
}

export interface SyncResult {
  success: boolean;
  syncedServers: string[];
  errors: SyncError[];
}

export interface SyncError {
  serverName: string;
  error: string;
}

export interface ConflictInfo {
  serverName: string;
  localValue: unknown;
  remoteValue: unknown;
  field: string;
}

export interface ConflictResolution {
  serverName: string;
  resolution: "local" | "remote" | "merge";
  mergedValue?: unknown;
}
