/**
 * Sync Mode Types
 * 
 * Defines the available synchronization modes between config sources.
 * 
 * Current sources:
 * - Claude Desktop (.claude.json)
 * - OpenCode (opencode.json)
 * 
 * Future: Additional config sources on the same machine
 */

/**
 * Available sync endpoints (config sources)
 */
export type SyncEndpoint = 'claude' | 'opencode';

export const SYNC_ENDPOINTS: { id: SyncEndpoint; label: string }[] = [
  { id: 'claude', label: 'Claude Desktop' },
  { id: 'opencode', label: 'OpenCode' },
];

/**
 * One-way transfer configuration
 */
export interface OneWayConfig {
  source: SyncEndpoint;
  destination: SyncEndpoint;
}

/**
 * Sync mode selection result
 * - For 'bidirectional': just the mode
 * - For 'one-way': mode + source/destination config
 */
export interface SyncModeSelection {
  mode: SyncMode;
  oneWayConfig?: OneWayConfig;
}

export type SyncMode = 
  | 'bidirectional'     // Claude ↔ OpenCode (merge both ways)
  | 'one-way'           // One-way transfer with configurable source/destination
  | 'abc-to-d'          // Multiple sources → single destination (future)
  | 'a-to-bcd';         // Single source → multiple destinations (future)

export interface SyncModeOption {
  id: SyncMode;
  label: string;
  description: string;
  icon: 'arrows-both' | 'arrow-right' | 'arrows-merge' | 'arrows-split';
  disabled: boolean;
  disabledReason?: string;
  hasConfig?: boolean; // Whether this mode requires additional configuration
}

export const SYNC_MODE_OPTIONS: SyncModeOption[] = [
  {
    id: 'bidirectional',
    label: 'Bi-directional Sync',
    description: 'Merge changes between Claude and OpenCode in both directions',
    icon: 'arrows-both',
    disabled: false,
  },
  {
    id: 'one-way',
    label: 'One-way Transfer',
    description: 'Transfer config from one source to another (select source and destination below)',
    icon: 'arrow-right',
    disabled: false,
    hasConfig: true,
  },
  {
    id: 'abc-to-d',
    label: 'Multi-Source → Single Target',
    description: 'Merge multiple sources into one destination',
    icon: 'arrows-merge',
    disabled: true,
    disabledReason: 'Coming soon - requires additional config sources',
  },
  {
    id: 'a-to-bcd',
    label: 'Single Source → Multi-Target',
    description: 'Distribute one source to multiple destinations',
    icon: 'arrows-split',
    disabled: true,
    disabledReason: 'Coming soon - requires additional config sources',
  },
];

export const DEFAULT_SYNC_MODE: SyncMode = 'bidirectional';

/**
 * Helper to get direction string for one-way mode
 */
export function getOneWayDirectionLabel(config: OneWayConfig): string {
  const sourceLabel = SYNC_ENDPOINTS.find(e => e.id === config.source)?.label || config.source;
  const destLabel = SYNC_ENDPOINTS.find(e => e.id === config.destination)?.label || config.destination;
  return `${sourceLabel} → ${destLabel}`;
}
