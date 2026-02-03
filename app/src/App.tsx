import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { Sidebar } from "@/components/layout/Sidebar";
import { SourceTabs } from "@/components/source/SourceTabs";
import { AddServerDialog } from "@/components/server/AddServerDialog";
import { EditServerDialog } from "@/components/server/EditServerDialog";
import { CredentialManager } from "@/components/ssh/CredentialManager";
import { ServerList } from "@/components/server/ServerList";
import { AddMachineDialog } from "@/components/machine/AddMachineDialog";

import { EditMachineDialog } from "@/components/machine/EditMachineDialog";
import { MCPServer } from "@/types/config";
import { Machine } from "@/types/machine";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { SyncPreview } from "@/components/sync/SyncPreview";
import { SyncModeSelector } from "@/components/sync/SyncModeSelector";
import { SyncModeSelection } from "@/types/sync";
import { Loader2, AlertCircle, Key, RefreshCw, RotateCcw, Wifi, WifiOff, Laptop, FileWarning, Download, Trash2, Plus, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAppStore } from "@/stores/appStore";
import { useConfigPaths, useRemoteConfigPaths, useClaudeConfig, useOpenCodeConfig, useClaudeMutations, useOpenCodeMutations, useClaudeBatchMutations, useOpenCodeBatchMutations } from "@/hooks/useConfig";
import { useMachines } from "@/hooks/useMachines";
import { useEnvironmentCheck } from "@/hooks/useSystem";
import { transformClaudeConfig, transformOpenCodeConfig } from "@/lib/transformers";
import { cn } from "@/lib/utils";
import { tauriApi } from "@/lib/tauri";
import "./App.css";

// Helper types and components for config states
type ConfigState = "ready" | "empty" | "missing" | "leftover" | "not_installed";

function determineConfigState(
    appInstalled: boolean, 
    exists: boolean, 
    isEmpty: boolean
): ConfigState {
    if (appInstalled && exists && !isEmpty) return "ready";
    if (appInstalled && exists && isEmpty) return "empty";
    if (appInstalled && !exists) return "missing";
    if (!appInstalled && exists) return "leftover";
    return "not_installed";
}

function ConfigStateRenderer({ 
    state,
    source, 
    path, 
    onCreate,
    onDelete,
    children
}: { 
    state: ConfigState;
    source: "Claude" | "OpenCode"; 
    path?: string | null;
    onCreate?: () => void;
    onDelete?: () => void;
    children?: React.ReactNode;
}) {
    if (state === "ready") {
        return <>{children}</>;
    }

    if (state === "empty") {
        return (
            <div className="p-6 max-w-3xl mx-auto">
                <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200">
                    <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <AlertTitle className="text-blue-800 dark:text-blue-300 font-semibold mb-2">
                        Configuration Empty
                    </AlertTitle>
                    <AlertDescription className="text-blue-700 dark:text-blue-400/90">
                        <p className="mb-4">
                            The {source} configuration file exists but contains no servers.
                        </p>
                        {onCreate && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={onCreate}
                                className="bg-white/50 hover:bg-white/80 dark:bg-black/20 dark:hover:bg-black/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200"
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Add First Server
                            </Button>
                        )}
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    if (state === "missing") {
        return (
            <div className="p-6 max-w-3xl mx-auto">
                <Alert variant="destructive" className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertTitle className="text-amber-800 dark:text-amber-300 font-semibold mb-2">
                        Configuration Not Found
                    </AlertTitle>
                    <AlertDescription className="text-amber-700 dark:text-amber-400/90">
                        <p className="mb-4">
                            The {source} app is installed but the configuration file is missing{path ? ` at ${path}` : ""}.
                        </p>
                        {onCreate && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={onCreate}
                                className="bg-white/50 hover:bg-white/80 dark:bg-black/20 dark:hover:bg-black/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200"
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Initialize Configuration
                            </Button>
                        )}
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    if (state === "leftover") {
        return (
            <div className="p-6 max-w-3xl mx-auto">
                <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/30 text-orange-900 dark:text-orange-200">
                    <FileWarning className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    <AlertTitle className="text-orange-800 dark:text-orange-300 font-semibold mb-2">
                        Leftover Configuration Detected
                    </AlertTitle>
                    <AlertDescription className="text-orange-700 dark:text-orange-400/90">
                        <p className="mb-4">
                            The {source} app does not appear to be installed, but a configuration file was found{path ? ` at ${path}` : ""}.
                        </p>
                        <div className="flex gap-2">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => toast.info("Backup functionality coming soon")}
                                className="bg-white/50 hover:bg-white/80 dark:bg-black/20 dark:hover:bg-black/40 border-orange-200 dark:border-orange-800 text-orange-900 dark:text-orange-200"
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Backup Config
                            </Button>
                            {onDelete && (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={onDelete}
                                    className="bg-white/50 hover:bg-white/80 dark:bg-black/20 dark:hover:bg-black/40 border-orange-200 dark:border-orange-800 text-orange-900 dark:text-orange-200"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Config
                                </Button>
                            )}
                        </div>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    // not_installed
    return (
        <div className="p-6 max-w-3xl mx-auto">
            <Alert variant="destructive" className="border-red-200 bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-200">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <AlertTitle className="text-red-800 dark:text-red-300 font-semibold mb-2">
                    App Not Installed
                </AlertTitle>
                <AlertDescription className="text-red-700 dark:text-red-400/90">
                    <p className="mb-4">
                        {source} Desktop is not installed on this machine. Please install it to manage its configuration.
                    </p>
                    {source === "Claude" && (
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => window.open("https://claude.ai/download", "_blank")}
                            className="bg-white/50 hover:bg-white/80 dark:bg-black/20 dark:hover:bg-black/40 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Download Claude Desktop
                        </Button>
                    )}
                </AlertDescription>
            </Alert>
        </div>
    );
}

function App() {
  const { selectedMachineId, activeTab, setSelectedMachineId, setActiveTab } = useAppStore();
  const activeMachineId = selectedMachineId || "local";
  
  // Machine management
  const { machines, fetchMachines, deleteMachine } = useMachines();
  const [isAddMachineOpen, setIsAddMachineOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [deletingMachine, setDeletingMachine] = useState<Machine | null>(null);

  // Load machines on mount
  useEffect(() => {
    fetchMachines();
  }, [fetchMachines]);

  const currentMachine = machines.find(m => m.id === selectedMachineId) || machines[0];

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [isSyncModeSelectorOpen, setIsSyncModeSelectorOpen] = useState(false);
  const [selectedSyncMode, setSelectedSyncMode] = useState<SyncModeSelection | null>(null);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);

  const { data: localPaths, isLoading: isPathsLoading, error: pathsError, refetch: refetchLocalPaths } = useConfigPaths();
  const { claudePath: remoteClaudePath, opencodePath: remoteOpenCodePath, refetch: refetchRemotePaths } = useRemoteConfigPaths(activeMachineId);
  const remotePaths = { claudePath: remoteClaudePath, opencodePath: remoteOpenCodePath };
  
  const currentPath = activeMachineId === "local"
    ? (activeTab === "claude" ? localPaths?.claude : localPaths?.opencode)
    : (activeTab === "claude" ? remotePaths.claudePath : remotePaths.opencodePath);

  // Fetch configs using paths
  const { 
      data: claudeData, 
      isLoading: isClaudeLoading, 
      error: claudeError,
      refetch: refetchClaude,
      isFetching: isClaudeFetching,
      isStale: isClaudeStale
  } = useClaudeConfig(localPaths?.claude, activeMachineId);
  
  const { 
    data: opencodeData, 
    isLoading: isOpenCodeLoading, 
    error: opencodeError, 
    refetch: refetchOpenCode,
    isFetching: isOpenCodeFetching,
    isStale: isOpenCodeStale
  } = useOpenCodeConfig(localPaths?.opencode, activeMachineId);

  // Environment Check
  const { data: envCheck, refetch: refetchEnvCheck } = useEnvironmentCheck(activeMachineId);

  // Normalize data (handle remote response vs local config)
  const claudeConfig = claudeData?.config;
  const claudeExists = claudeData?.exists ?? false;

  const opencodeConfig = opencodeData?.config;
  const opencodeExists = opencodeData?.exists ?? false;

  const isLoading = isPathsLoading || (activeTab === "claude" ? isClaudeLoading : isOpenCodeLoading);
  const isGlobalLoading = isPathsLoading || isClaudeLoading || isOpenCodeLoading;
  const error = pathsError || (activeTab === "claude" ? claudeError : opencodeError);

  const syncClaudePath = activeMachineId === "local" ? localPaths?.claude : remotePaths.claudePath;
  const syncOpenCodePath = activeMachineId === "local" ? localPaths?.opencode : remotePaths.opencodePath;
  const syncMachineId = activeMachineId === "local" ? undefined : parseInt(activeMachineId);

  // Connection status logic
  const isRemote = activeMachineId !== "local";
  
  // Cache status for UI (after isRemote is defined)
  const isFetching = isClaudeFetching || isOpenCodeFetching;
  const isShowingCachedData = isRemote && (isClaudeStale || isOpenCodeStale) && (claudeData || opencodeData);
  
  const connectionStatus = (() => {
      if (!isRemote) return "local";
      if (isPathsLoading) return "checking";
      if (pathsError) return "disconnected";
      // If we have paths or config, we are connected
      if (remoteClaudePath || remoteOpenCodePath || claudeData || opencodeData) return "connected";
      return "checking"; // Default to checking if unsure
  })();

  // Listen for config changes from backend
  useEffect(() => {
      // Only listen if we are on local machine, as the watcher is local-only
      if (activeMachineId !== "local") return;

      const unlistenPromise = listen("config-changed", () => {
          console.log("Config changed, reloading...");
          refetchClaude();
          refetchOpenCode();
          toast.info("Configuration updated from file change");
      });

      return () => {
          unlistenPromise.then(unlisten => unlisten());
      };
  }, [refetchClaude, refetchOpenCode, activeMachineId]);

  useEffect(() => {
    if (isLoading) return;

    const checkState = (
        source: "claude" | "opencode",
        error: Error | null,
        exists: boolean,
        _config: any
    ) => {
        // Only show toast for the currently active tab to avoid noise
        if (activeTab !== source) return;

        if (error) {
            toast.error(`Failed to load ${source} config`, {
                description: error.message || "Connection error"
            });
            return;
        }

        if (!exists) {
            // Toast removed as we now show inline Alert
            return;
        }

        // Check for empty config - handled by UI state now
        // const servers = source === "claude" ? config?.mcpServers : config?.mcp;
        // const isEmpty = !servers || Object.keys(servers).length === 0;
        
        // if (isEmpty) {
        //     toast.info("Configuration is Empty", {
        //         description: "No MCP servers are currently configured."
        //     });
        // }
    };

    // Run checks
    checkState("claude", claudeError, claudeExists, claudeConfig);
    checkState("opencode", opencodeError, opencodeExists, opencodeConfig);

  }, [
    activeTab, 
    isLoading, 
    claudeError, claudeExists, claudeConfig,
    opencodeError, opencodeExists, opencodeConfig
  ]);

  // Mutations
  const claudeMutations = useClaudeMutations(localPaths?.claude || "", activeMachineId);
  const opencodeMutations = useOpenCodeMutations(localPaths?.opencode || "", activeMachineId);
  const claudeBatchMutations = useClaudeBatchMutations(localPaths?.claude || "", activeMachineId);
  const opencodeBatchMutations = useOpenCodeBatchMutations(localPaths?.opencode || "", activeMachineId);

  // Transform data
  const claudeServers = transformClaudeConfig(claudeConfig);
  const opencodeServers = transformOpenCodeConfig(opencodeConfig);

  // Calculate states
  const claudeAppInstalled = claudeData?.appInstalled ?? false;
  const claudeServersList = claudeConfig?.mcpServers || {};
  const claudeIsEmpty = !claudeServersList || Object.keys(claudeServersList).length === 0;
  const claudeState = determineConfigState(claudeAppInstalled, claudeExists, claudeIsEmpty);

  const opencodeAppInstalled = opencodeData?.appInstalled ?? false;
  const opencodeServersList = opencodeConfig?.mcp || {};
  const opencodeIsEmpty = !opencodeServersList || Object.keys(opencodeServersList).length === 0;
  const opencodeState = determineConfigState(opencodeAppInstalled, opencodeExists, opencodeIsEmpty);

  // Handlers
  const handleRestart = async () => {
      const isLocal = activeMachineId === "local";
      const machineId = isLocal ? undefined : parseInt(activeMachineId);
      
      const promise = tauriApi.nuclearRestart(machineId);
      
      toast.promise(promise, {
          loading: "Sending restart signal to Claude...",
          success: (data) => `Success: ${data}`,
          error: (err) => `Restart failed: ${err}`
      });
  };

  const handleToggle = (server: MCPServer, enabled: boolean) => {
    if (server.source === "claude") {
        claudeMutations.toggleServer.mutate(
            { name: server.name, enabled, remotePath: remotePaths.claudePath || undefined },
            {
                onSuccess: () => toast.success(`Server ${server.name} ${enabled ? 'enabled' : 'disabled'}`),
                onError: (e: Error) => toast.error(`Failed to toggle server: ${e.message}`)
            }
        );
    } else {
         opencodeMutations.updateServer.mutate(
             { 
                 name: server.name, 
                 config: { 
                     // @ts-ignore - rawConfig type mismatch, but structured is correct
                     ...(server.rawConfig || {}),
                     enabled 
                 } as unknown as import("@/types/config").OpenCodeMCPServer,
                 remotePath: remotePaths.opencodePath || undefined
             },
             {
                 onSuccess: () => toast.success(`Server ${server.name} ${enabled ? 'enabled' : 'disabled'}`),
                 onError: (e: Error) => toast.error(`Failed to toggle server: ${e.message}`)
             }
         );
    }
  };

  const handleDelete = (server: MCPServer) => {
     if (!confirm(`Delete server ${server.name}?`)) return;
     
     const mutation = server.source === "claude" 
        ? claudeMutations.deleteServer 
        : opencodeMutations.deleteServer;
        
     mutation.mutate({ name: server.name, remotePath: (server.source === "claude" ? remotePaths.claudePath : remotePaths.opencodePath) || undefined }, {
        onSuccess: () => toast.success("Server deleted"),
        onError: (e: Error) => toast.error(`Failed to delete: ${e.message}`)
     });
  };

  const handleBatchToggle = (servers: MCPServer[], enabled: boolean) => {
    if (servers.length === 0) return;
    
    const claudeServersToToggle = servers.filter(s => s.source === "claude");
    const opencodeServersToToggle = servers.filter(s => s.source === "opencode");
    
    const promises: Promise<void>[] = [];
    
    if (claudeServersToToggle.length > 0) {
      const items = claudeServersToToggle.map(s => ({ name: s.originalName, enabled }));
      promises.push(claudeBatchMutations.batchToggle.mutateAsync(items));
    }
    
    if (opencodeServersToToggle.length > 0) {
      const items = opencodeServersToToggle.map(s => ({ name: s.originalName, enabled }));
      promises.push(opencodeBatchMutations.batchToggle.mutateAsync(items));
    }
    
    toast.promise(Promise.all(promises), {
      loading: `${enabled ? 'Enabling' : 'Disabling'} ${servers.length} server(s)...`,
      success: () => `${servers.length} server(s) ${enabled ? 'enabled' : 'disabled'}`,
      error: (e: Error) => `Failed: ${e.message}`
    });
  };

  const handleDeleteMachine = async () => {
      if (deletingMachine) {
          await deleteMachine(deletingMachine.id);
          setDeletingMachine(null);
          // If deleted machine was selected, select local
          if (selectedMachineId === deletingMachine.id) {
              setSelectedMachineId("local");
          }
      }
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans antialiased relative">
      {/* Global Loading Indicator */}
      {isGlobalLoading && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/20 z-50">
            <div className="h-full bg-primary animate-indeterminate-progress w-full origin-left" />
        </div>
      )}

      <Sidebar 
        machines={machines}
        selectedMachineId={selectedMachineId}
        onSelectMachine={setSelectedMachineId}
        onAddMachine={() => setIsAddMachineOpen(true)}
        onEditMachine={setEditingMachine}
        onDeleteMachine={setDeletingMachine}
      />
      
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        <header className="h-14 border-b flex items-center px-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0 sticky top-0 z-10 justify-between">
             <div className="flex items-center gap-3">
                 <h1 className="text-lg font-semibold truncate flex items-center gap-2">
                    {currentMachine?.name || "Select Machine"}
                 </h1>
                 
                 {/* Connection Status Badge */}
                  {isRemote && (
                     <Badge variant="outline" className={cn(
                         "gap-1.5 transition-colors",
                         connectionStatus === "connected" && "bg-green-50 text-green-700 border-green-200",
                         connectionStatus === "disconnected" && "bg-red-50 text-red-700 border-red-200",
                         connectionStatus === "checking" && "bg-yellow-50 text-yellow-700 border-yellow-200"
                     )}>
                         {connectionStatus === "connected" && <Wifi className="h-3 w-3" />}
                         {connectionStatus === "disconnected" && <WifiOff className="h-3 w-3" />}
                         {connectionStatus === "checking" && <Loader2 className="h-3 w-3 animate-spin" />}
                         <span className="capitalize">{connectionStatus}</span>
                     </Badge>
                  )}
                  
                  {/* Cache Status Badge - shows when displaying cached data */}
                  {isRemote && isShowingCachedData && (
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "gap-1.5 transition-colors",
                        isFetching 
                          ? "bg-blue-50 text-blue-700 border-blue-200" 
                          : "bg-gray-50 text-gray-600 border-gray-200"
                      )}
                      title={isFetching ? "Refreshing data in background..." : "Showing cached data"}
                    >
                      {isFetching ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Refreshing</span>
                        </>
                      ) : (
                        <>
                          <Clock className="h-3 w-3" />
                          <span>Cached</span>
                        </>
                      )}
                    </Badge>
                  )}
                 
                 {/* Environment Status Badge */}
                 {envCheck && !envCheck.is_valid && (
                    <Badge variant="destructive" className="gap-1.5" title={envCheck.error || "Environment check failed"}>
                        <AlertCircle className="h-3 w-3" />
                        Env Error
                    </Badge>
                 )}
                 {envCheck && envCheck.is_valid && (
                     <Badge variant="outline" className="gap-1.5 bg-blue-50 text-blue-700 border-blue-200">
                         <Badge className="h-1.5 w-1.5 rounded-full bg-blue-500 p-0" />
                         <span className="text-xs">npx {envCheck.npx_version}</span>
                     </Badge>
                 )}

                 {!isRemote && (
                     <Badge variant="secondary" className="gap-1.5 text-muted-foreground font-normal">

                         <Laptop className="h-3 w-3" />
                         Local
                     </Badge>
                 )}
             </div>
             <div className="flex items-center gap-2">
                 <Button 
                    variant="ghost" 
                    size="sm" 
                     onClick={() => {
                        if (activeMachineId === "local") {
                            refetchLocalPaths();
                        } else {
                            refetchRemotePaths();
                        }
                        refetchClaude();
                        refetchOpenCode();
                        refetchEnvCheck();
                        toast.success("Refreshing configuration...");
                    }}
                    title="Reload configuration from disk"
                    disabled={isGlobalLoading}
                 >
                     <RotateCcw className={cn("mr-2 h-4 w-4", isGlobalLoading && "animate-spin")} />
                     Reload
                 </Button>

                  {/* Sync Button - Opens Mode Selector First */}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    disabled={!syncClaudePath || !syncOpenCodePath}
                    onClick={() => setIsSyncModeSelectorOpen(true)}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync
                  </Button>

                   {/* Sync Mode Selector Dialog */}
                   <SyncModeSelector
                     open={isSyncModeSelectorOpen}
                     onSelect={(selection) => {
                       setSelectedSyncMode(selection);
                       setIsSyncModeSelectorOpen(false);
                       setIsSyncDialogOpen(true);
                     }}
                     onCancel={() => setIsSyncModeSelectorOpen(false)}
                   />

                  {/* Sync Preview Dialog */}
                  <Dialog open={isSyncDialogOpen} onOpenChange={(open) => {
                    setIsSyncDialogOpen(open);
                    if (!open) setSelectedSyncMode(null);
                  }}>
                      <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh] overflow-y-auto">
                          {syncClaudePath && syncOpenCodePath && selectedSyncMode && (
                              <SyncPreview 
                                 claudePath={syncClaudePath} 
                                 opencodePath={syncOpenCodePath} 
                                 machineId={syncMachineId}
                                 syncMode={selectedSyncMode}
                                 onSyncComplete={() => {
                                     refetchClaude();
                                     refetchOpenCode();
                                 }} 
                              />
                          )}
                      </DialogContent>
                  </Dialog>

                 <Dialog>
                 <DialogTrigger asChild>
                     <Button variant="ghost" size="sm">
                         <Key className="mr-2 h-4 w-4" />
                         SSH Keys
                     </Button>
                 </DialogTrigger>
                 <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                     <CredentialManager />
                 </DialogContent>
             </Dialog>
             </div>
        </header>
        
        <main className="flex-1 overflow-hidden">
            {error ? (
                <div className="flex flex-col items-center justify-center h-full text-destructive">
                    <AlertCircle className="h-8 w-8 mb-2" />
                    <p>Error loading configuration</p>
                    <p className="text-sm text-muted-foreground">{error.message}</p>
                </div>
            ) : (
                <SourceTabs
                    value={activeTab}
                    onTabChange={setActiveTab}
                    claudeMissing={!claudeExists}
                    opencodeMissing={!opencodeExists}
                    claudeContent={
                        <div className="space-y-4 max-w-7xl mx-auto">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    Claude Desktop Configuration 
                                    {currentPath && activeTab === "claude" && <span className="text-xs font-mono text-muted-foreground/50">({currentPath})</span>}
                                </h3>
                            </div>
                            <ConfigStateRenderer 
                                state={claudeState}
                                source="Claude"
                                path={currentPath}
                                onCreate={() => setIsAddDialogOpen(true)}
                            >
                                <ServerList 
                                    servers={claudeServers}
                                    onToggle={(s, e) => handleToggle(s, e)}
                                    onEdit={setEditingServer}
                                    onDelete={handleDelete}
                                    onAdd={() => setIsAddDialogOpen(true)}
                                    onRestart={handleRestart}
                                    onBatchToggle={handleBatchToggle}
                                />
                            </ConfigStateRenderer>
                        </div>
                    }
                    opencodeContent={
                        <div className="space-y-4 max-w-7xl mx-auto">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    OpenCode Configuration
                                    {currentPath && activeTab === "opencode" && <span className="text-xs font-mono text-muted-foreground/50">({currentPath})</span>}
                                </h3>
                            </div>
                            <ConfigStateRenderer 
                                state={opencodeState}
                                source="OpenCode"
                                path={currentPath}
                                onCreate={() => setIsAddDialogOpen(true)}
                            >
                                <ServerList 
                                    servers={opencodeServers}
                                    onToggle={(s, e) => handleToggle(s, e)}
                                    onEdit={setEditingServer}
                                    onDelete={handleDelete}
                                    onAdd={() => setIsAddDialogOpen(true)}
                                    onRestart={handleRestart}
                                    onBatchToggle={handleBatchToggle}
                                />
                            </ConfigStateRenderer>
                        </div>
                    }
                />
            )}
        </main>
      </div>
      
      {/* Dialogs */}
      {currentPath && (
        <AddServerDialog 
            open={isAddDialogOpen} 
            onOpenChange={setIsAddDialogOpen}
            source={activeTab}
            path={currentPath}
            machineId={activeMachineId}
            platform={currentMachine?.platform}
        />
      )}
      
      {editingServer && (
         <EditServerDialog 
            open={!!editingServer}
            onOpenChange={(open) => !open && setEditingServer(null)}
            server={editingServer}
            path={editingServer.source === "claude" ? localPaths?.claude || "" : localPaths?.opencode || ""}
         />
      )}

      <AddMachineDialog 
        open={isAddMachineOpen} 
        onOpenChange={setIsAddMachineOpen} 
        onAdded={fetchMachines}
      />

      <EditMachineDialog
        open={!!editingMachine}
        onOpenChange={(open) => !open && setEditingMachine(null)}
        machine={editingMachine}
        onUpdated={fetchMachines}
      />

      <AlertDialog open={!!deletingMachine} onOpenChange={(open) => !open && setDeletingMachine(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will remove the machine "{deletingMachine?.name}" from your list. 
                    This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDeleteMachine}>
                    Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </div>
  );
}

export default App;
