import { useState } from 'react';
import { SyncPlan, SyncItem } from '@/types/config';
import { tauriApi } from '@/lib/tauri';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRight, ArrowLeft, AlertTriangle, CheckCircle2, Info, Check, Plus, Pencil, Trash2, FileText, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface SyncPreviewProps {
  claudePath: string;
  opencodePath: string;
  machineId?: number;
  onSyncComplete: () => void;
}

export function SyncPreview({ claudePath, opencodePath, machineId, onSyncComplete }: SyncPreviewProps) {
  const [plan, setPlan] = useState<SyncPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedToClaude, setSelectedToClaude] = useState<string[]>([]);
  const [selectedToOpencode, setSelectedToOpencode] = useState<string[]>([]);

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

  const executeSync = async () => {
    if (!plan) return;
    setLoading(true);
    try {
      if (selectedToClaude.length > 0) {
        await tauriApi.applySyncOpencodeToClaude(claudePath, opencodePath, selectedToClaude, machineId);
      }
      if (selectedToOpencode.length > 0) {
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

  if (loading && !plan) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Analyzing configuration differences...</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4 border rounded-lg bg-muted/10 border-dashed">
        <div className="p-4 bg-muted rounded-full">
          <RefreshCw className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="font-medium">Sync Configuration</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Compare and synchronize MCP servers between Claude Desktop and OpenCode.
          </p>
        </div>
        <Button onClick={analyze}>Analyze Sync Status</Button>
      </div>
    );
  }

  // Filter items
  const itemsToClaude = plan.items.filter(i => i.status === "CreatedInB" || i.status === "UpdatedInB" || i.status === "DeletedFromB");
  const itemsToOpencode = plan.items.filter(i => i.status === "CreatedInA" || i.status === "UpdatedInA" || i.status === "DeletedFromA");
  const conflicts = plan.items.filter(i => i.status === "Conflict");
  const synced = plan.items.filter(i => i.status === "Synced");

  const hasChanges = selectedToClaude.length > 0 || selectedToOpencode.length > 0;
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
          {isDeletable && <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100">Manual delete required</span>}
        </div>
        
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
                    <span>Possible duplicate content with different name</span>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Incoming for Claude */}
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

        {/* Incoming for OpenCode */}
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

        {/* Conflicts */}
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
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm font-medium">{item.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">Modified in both locations</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
