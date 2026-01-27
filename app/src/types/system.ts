export interface EnvCheckResult {
    npx_exists: boolean;
    npx_version: string | null;
    node_version: string | null;
    is_valid: boolean;
    error: string | null;
}
