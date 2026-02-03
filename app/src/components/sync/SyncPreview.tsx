import { useState, useEffect } from 'react';
import { SyncPlan, SyncItem } from '@/types/config';
import { SyncModeSelection, SYNC_MODE_OPTIONS, getOneWayDirectionLabel } from '@/types/sync';
import { tauriApi } from '@/lib/tauri';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRight, ArrowLeft, AlertTriangle, CheckCircle2, Info, Check, Plus, Pencil, Trash2, FileText, RefreshCw, Eye, ArrowLeftRight, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { ConflictDiffViewer } from './ConflictDiffViewer';

interface SyncPreviewProps {
  claudePath: string;
  opencodePath: string;
  machineId?: number;
  syncMode: SyncModeSelection;
  onSyncComplete: () => void;
}

export function SyncPreview({ claudePath, opencodePath, machineId, syncMode, onSyncComplete }: SyncPreviewProps) {
  const [plan, setPlan] = useState<SyncPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedToClaude, setSelectedToClaude] = useState<string[]>([]);
  const [selectedToOpencode, setSelectedToOpencode] = useState<string[]>([]);
  const [expandedConflict, setExpandedConflict] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Get mode info for display
  const syncModeInfo = SYNC_MODE_OPTIONS.find(m => m.id === syncMode.mode);
  
  // Build display label
  const getModeDisplayLabel = (): string => {
    if (syncMode.mode === 'one-way' && syncMode.oneWayConfig) {
      return getOneWayDirectionLabel(syncMode.oneWayConfig);
    }
    return syncModeInfo?.label || syncMode.mode;
  };

  // Determine visibility based on sync mode
  const showClaudeIncoming = syncMode.mode === 'bidirectional' || 
    (syncMode.mode === 'one-way' && syncMode.oneWayConfig?.destination === 'claude');
  const showOpencodeIncoming = syncMode.mode === 'bidirectional' || 
    (syncMode.mode === 'one-way' && syncMode.oneWayConfig?.destination === 'opencode');
  const showConflicts = syncMode.mode === 'bidirectional';

  const analyze = async () => {
    setLoading(true);
    try {
      const result = await tauriApi.generateSyncPlan(claudePath, opencodePath, machineId);
      setPlan(result);
      
      // Auto-select safe changes
      const toClaude = result.items
        .filter(i => i.status === "CreatedInB" || i.status === "UpdatedInB")
        .map(i => i.name);
      
      const toOpencode = result.items
        .filter(i => i.status === "CreatedInA" || i.status === "UpdatedInA")
        .map(i => i.name);

      setSelectedToClaude(toClaude);
      setSelectedToOpencode(toOpencode);
    } catch (error) {
      toast.error("Analysis Failed: " + String(error));
    } finally {
      setLoading(false);
    }
  };

  // Auto-analyze on mount
  useEffect(() => {
    analyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const executeSync = async () => {
    if (!plan) return;
    setLoading(true);
    try {
      // Only execute relevant sync operations based on sync mode
      if (showClaudeIncoming && selectedToClaude.length > 0) {
        await tauriApi.applySyncOpencodeToClaude(claudePath, opencodePath, selectedToClaude, machineId);
      }
      if (showOpencodeIncoming && selectedToOpencode.length > 0) {
        await tauriApi.applySyncClaudeToOpencode(claudePath, opencodePath, selectedToOpencode, machineId);
      }
      toast.success("Sync Completed");
      onSyncComplete();
      analyze();
    } catch (error) {
      toast.error("Sync Failed: " + String(error));
      setLoading(false);
    }
  };

  // Show loading state while analyzing (no plan yet)
  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Analyzing configuration differences...</p>
      </div>
    );
  }

  // Filter items
  const itemsToClaude = plan.items.filter(i => i.status === "CreatedInB" || i.status === "UpdatedInB" || i.status === "DeletedFromB");
  const itemsToOpencode = plan.items.filter(i => i.status === "CreatedInA" || i.status === "UpdatedInA" || i.status === "DeletedFromA");
  const conflicts = plan.items.filter(i => i.status === "Conflict");
  const synced = plan.items.filter(i => i.status === "Synced");

  // Mode-aware hasChanges calculation
  const hasChanges = (showClaudeIncoming && selectedToClaude.length > 0) || 
                     (showOpencodeIncoming && selectedToOpencode.length > 0);
  const isFullySynced = itemsToClaude.length === 0 && itemsToOpencode.length === 0 && conflicts.length === 0;

    const renderItem = (item: SyncItem, selected: string[], onSelect: (s: string[]) => void) => {
    // Determine badge style based on status
    let badge = null;
    if (item.status.startsWith("Created")) {
      badge = <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:text-green-800 gap-1"><Plus className="h-3 w-3" /> New</Badge>;
    } else if (item.status.startsWith("Updated")) {
      badge = <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800 gap-1"><Pencil className="h-3 w-3" /> Mod</Badge>;
    } else if (item.status.startsWith("Deleted")) {
      badge = <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 hover:text-red-800 gap-1"><Trash2 className="h-3 w-3" /> Del</Badge>;
    }

    const isDeletable = item.status.startsWith("Deleted"); // Backend support pending for delete

    // Parse details for collapsible
    let details: any = null;
    try {
        if (item.status === 'CreatedInA' || item.status === 'UpdatedInA') {
            if (item.claudeJson) details = JSON.parse(item.claudeJson);
        } else if (item.status === 'CreatedInB' || item.status === 'UpdatedInB') {
            if (item.opencodeJson) details = JSON.parse(item.opencodeJson);
        } else if (item.status === 'DeletedFromA') {
            if (item.opencodeJson) details = JSON.parse(item.opencodeJson);
        } else if (item.status === 'DeletedFromB') {
            if (item.claudeJson) details = JSON.parse(item.claudeJson);
        } else {
            // Fallback for any other case
            if (item.claudeJson) details = JSON.parse(item.claudeJson);
            else if (item.opencodeJson) details = JSON.parse(item.opencodeJson);
        }
    } catch (e) {
        console.error("Failed to parse config JSON", e);
    }

    const isExpanded = expandedItems.includes(item.name);
    const toggleExpanded = () => {
            setExpandedItems(prev => 
                prev.includes(item.name) ? prev.filter(n => n !== item.name) : [...prev, item.name]
            );
    };

    return (
      <div key={item.name} className="group flex flex-col p-3 border rounded-md hover:bg-muted/40 transition-colors bg-card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {!isDeletable && (
                <Checkbox 
                  className="mt-1"
                  checked={selected.includes(item.name)}
                  onCheckedChange={(checked) => {
                    onSelect(checked ? [...selected, item.name] : selected.filter(n => n !== item.name));
                  }}
                />
            )}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{item.name}</span>
                {badge}
              </div>
              <p className="text-xs text-muted-foreground">{item.actionDescription}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {isDeletable && <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100">Manual delete required</span>}
            {details && (
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={toggleExpanded}>
                    <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </Button>
            )}
          </div>
        </div>
        
        {/* Expanded Details */}
        {isExpanded && details && (
            <div className="mt-2 ml-7 p-3 bg-muted/50 rounded text-xs font-mono space-y-1 overflow-x-auto border border-border/50">
                {details.command && (
                    <div><span className="text-muted-foreground font-semibold">Command:</span> {Array.isArray(details.command) ? details.command.join(' ') : details.command}</div>
                )}
                {details.args && (
                    <div><span className="text-muted-foreground font-semibold">Args:</span> {Array.isArray(details.args) ? details.args.join(' ') : details.args}</div>
                )}
                {details.env && Object.keys(details.env).length > 0 && (
                    <div>
                        <span className="text-muted-foreground font-semibold">Env:</span>
                        <div className="pl-2 border-l-2 border-muted mt-1">
                            {Object.entries(details.env).map(([k, v]) => (
                                <div key={k} className="whitespace-pre-wrap break-all">{k}={String(v)}</div>
                            ))}
                        </div>
                    </div>
                )}
                {(details.type || details.server_type) && (
                        <div><span className="text-muted-foreground font-semibold">Type:</span> {details.type || details.server_type}</div>
                )}
                {details.url && (
                        <div><span className="text-muted-foreground font-semibold">URL:</span> {details.url}</div>
                )}
            </div>
        )}

        {item.contentMatches && item.contentMatches.length > 0 && (
            <div className="mt-3 ml-7 pl-3 border-l-2 border-blue-100 space-y-1">
                {item.contentMatches.map((m, idx) => (
                    <div key={idx} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <Info className="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />
                        <span>{m}</span>
                    </div>
                ))}
                {/* Warning about content duplication */}
                <div className="text-xs text-amber-600 flex items-start gap-1.5 font-medium mt-1">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>
                        Possible duplicate of: {
                            item.contentMatches.map(m => {
                                // Parse "Matches 'name' in Source"
                                const match = m.match(/Matches '([^']+)'/);
                                return match ? match[1] : m;
                            }).join(', ')
                        }
                    </span>
                </div>
            </div>
        )}
      </div>
    );
  };

  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-8 text-center space-y-2 text-muted-foreground/60">
      <CheckCircle2 className="h-8 w-8 opacity-20" />
      <p className="text-sm">{message}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Sync Mode Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Sync Preview</h2>
          {syncModeInfo && (
            <Badge variant="outline" className="gap-1">
              <ArrowLeftRight className="h-3 w-3" />
              {getModeDisplayLabel()}
            </Badge>
          )}
        </div>
      </div>

      {isFullySynced && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900 rounded-lg p-4 flex items-center gap-3 text-green-800 dark:text-green-300">
          <div className="bg-green-100 dark:bg-green-900/40 p-2 rounded-full">
            <Check className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-medium">Everything is in sync!</h4>
            <p className="text-sm opacity-90">Both configurations match perfectly.</p>
          </div>
        </div>
      )}

      <div className={`grid grid-cols-1 gap-4 ${
        showClaudeIncoming && showOpencodeIncoming && showConflicts 
          ? 'md:grid-cols-2 lg:grid-cols-3' 
          : showClaudeIncoming && showOpencodeIncoming 
            ? 'md:grid-cols-2' 
            : ''
      }`}>
        {/* Incoming for Claude - shown for bidirectional and b-to-a modes */}
        {showClaudeIncoming && (
          <Card className="flex flex-col h-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded text-green-600 dark:text-green-400">
                  <ArrowRight className="h-4 w-4" />
                </div>
                Incoming for Claude
                <Badge variant="secondary" className="ml-auto">{itemsToClaude.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              {itemsToClaude.length === 0 ? (
                <EmptyState message="Claude is up to date" />
              ) : (
                <div className="space-y-2">
                  {itemsToClaude.map(item => renderItem(item, selectedToClaude, setSelectedToClaude))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Incoming for OpenCode - shown for bidirectional and a-to-b modes */}
        {showOpencodeIncoming && (
          <Card className="flex flex-col h-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded text-blue-600 dark:text-blue-400">
                  <ArrowLeft className="h-4 w-4" />
                </div>
                Incoming for OpenCode
                <Badge variant="secondary" className="ml-auto">{itemsToOpencode.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              {itemsToOpencode.length === 0 ? (
                <EmptyState message="OpenCode is up to date" />
              ) : (
                <div className="space-y-2">
                  {itemsToOpencode.map(item => renderItem(item, selectedToOpencode, setSelectedToOpencode))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Conflicts - only shown for bidirectional mode */}
        {showConflicts && (
          <Card className="flex flex-col h-full border-yellow-200 dark:border-yellow-900 bg-yellow-50/30 dark:bg-yellow-900/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-yellow-700 dark:text-yellow-500">
                <div className="p-1.5 bg-yellow-100 dark:bg-yellow-900/30 rounded">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                Conflicts
                <Badge variant="outline" className="ml-auto border-yellow-200 text-yellow-700">{conflicts.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              {conflicts.length === 0 ? (
                <EmptyState message="No conflicts found" />
              ) : (
                <div className="space-y-2">
                  {conflicts.map(item => (
                    <div key={item.name} className="flex flex-col p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/30 rounded-md">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-yellow-600" />
                          <span className="text-sm font-medium">{item.name}</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs"
                          onClick={() => setExpandedConflict(expandedConflict === item.name ? null : item.name)}
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          {expandedConflict === item.name ? "Hide" : "View"} Diff
                        </Button>
                      </div>
                      <span className="text-xs text-muted-foreground">Modified in both locations</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Expanded conflict diff viewer */}
      {expandedConflict && conflicts.find(c => c.name === expandedConflict) && (
        <ConflictDiffViewer
          item={conflicts.find(c => c.name === expandedConflict)!}
          onKeepClaude={(name) => {
            setSelectedToOpencode([...selectedToOpencode, name]);
            setExpandedConflict(null);
            toast.info(`Will sync ${name} from Claude to OpenCode`);
          }}
          onKeepOpenCode={(name) => {
            setSelectedToClaude([...selectedToClaude, name]);
            setExpandedConflict(null);
            toast.info(`Will sync ${name} from OpenCode to Claude`);
          }}
          onCancel={() => setExpandedConflict(null)}
        />
      )}

      <div className="flex justify-between items-center border-t pt-4">
        <div className="text-sm text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="font-medium">{synced.length}</span> items already in sync
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={analyze} disabled={loading}>
              Re-Analyze
            </Button>
            <Button onClick={executeSync} disabled={!hasChanges || loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Sync Selected
            </Button>
        </div>
      </div>
    </div>
  );
}
