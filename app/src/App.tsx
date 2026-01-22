import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { SourceTabs } from "@/components/source/SourceTabs";
import { ServerCard } from "@/components/server/ServerCard";
import { AddServerDialog } from "@/components/server/AddServerDialog";
import { EditServerDialog } from "@/components/server/EditServerDialog";
import { Machine } from "@/types/machine";
import { MCPServer } from "@/types/config";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Plus, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/appStore";
import { 
    useConfigPaths, 
    useClaudeConfig, 
    useOpenCodeConfig, 
    useClaudeMutations,
    useOpenCodeMutations 
} from "@/hooks/useConfig";
import { transformClaudeConfig, transformOpenCodeConfig } from "@/lib/transformers";
import "./App.css";

// Temporary mock machine until we implement machine detection
const LOCAL_MACHINE: Machine = { id: "local", name: "Local Machine", type: "local", status: "connected" };

function App() {
  const { selectedMachineId, activeTab, setSelectedMachineId, setActiveTab } = useAppStore();
  
  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);

  const { data: paths, isLoading: isPathsLoading, error: pathsError } = useConfigPaths();
  
  // Fetch configs using paths
  const { 
      data: claudeConfig, 
      isLoading: isClaudeLoading, 
      error: claudeError 
  } = useClaudeConfig(paths?.claude);
  
  const { 
      data: opencodeConfig, 
      isLoading: isOpenCodeLoading, 
      error: opencodeError 
  } = useOpenCodeConfig(paths?.opencode);

  // Mutations
  const claudeMutations = useClaudeMutations(paths?.claude || "");
  const opencodeMutations = useOpenCodeMutations(paths?.opencode || "");

  // Transform data
  const claudeServers = transformClaudeConfig(claudeConfig);
  const opencodeServers = transformOpenCodeConfig(opencodeConfig);

  // Handlers
  const handleToggle = (server: MCPServer, enabled: boolean) => {
    if (server.source === "claude") {
        claudeMutations.toggleServer.mutate(
            { name: server.name, enabled },
            {
                onSuccess: () => toast.success(`Server ${server.name} ${enabled ? 'enabled' : 'disabled'}`),
                onError: (e) => toast.error(`Failed to toggle server: ${e.message}`)
            }
        );
    } else {
         toast.info("OpenCode toggle implementation pending");
    }
  };

  const handleDelete = (server: MCPServer) => {
     if (!confirm(`Delete server ${server.name}?`)) return;
     
     const mutation = server.source === "claude" 
        ? claudeMutations.deleteServer 
        : opencodeMutations.deleteServer;
        
     mutation.mutate(server.name, {
        onSuccess: () => toast.success("Server deleted"),
        onError: (e) => toast.error(`Failed to delete: ${e.message}`)
     });
  };

  const isLoading = isPathsLoading || (activeTab === "claude" ? isClaudeLoading : isOpenCodeLoading);
  const error = pathsError || (activeTab === "claude" ? claudeError : opencodeError);

  const currentPath = activeTab === "claude" ? paths?.claude : paths?.opencode;

  const ServerList = ({ servers }: { servers: MCPServer[] }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-12">
      {servers.map((server) => (
        <ServerCard 
            key={server.originalName} 
            server={server} 
            onToggle={(e) => handleToggle(server, e)}
            onEdit={() => setEditingServer(server)}
            onDelete={() => handleDelete(server)}
        />
      ))}
      <Button 
        variant="outline" 
        className="h-[140px] w-full border-dashed flex flex-col gap-2 hover:bg-accent hover:text-accent-foreground items-center justify-center"
        onClick={() => setIsAddDialogOpen(true)}
      >
        <Plus className="h-8 w-8 text-muted-foreground" />
        <span className="text-muted-foreground font-medium">Add Server</span>
      </Button>
    </div>
  );

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans antialiased">
      <Sidebar 
        machines={[LOCAL_MACHINE]}
        selectedMachineId={selectedMachineId}
        onSelectMachine={setSelectedMachineId}
        onAddMachine={() => toast.info("Add Machine not implemented yet")}
      />
      
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        <header className="h-14 border-b flex items-center px-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0 sticky top-0 z-10">
             <h1 className="text-lg font-semibold truncate">
                {LOCAL_MACHINE.name}
             </h1>
             {isLoading && <Loader2 className="ml-4 h-4 w-4 animate-spin text-muted-foreground" />}
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
                    claudeContent={
                        <div className="space-y-4 max-w-7xl mx-auto">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium text-muted-foreground">
                                    Claude Desktop Configuration 
                                    {paths?.claude && <span className="ml-2 text-xs font-mono text-muted-foreground/50">({paths.claude})</span>}
                                </h3>
                            </div>
                            <ServerList servers={claudeServers} />
                        </div>
                    }
                    opencodeContent={
                        <div className="space-y-4 max-w-7xl mx-auto">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium text-muted-foreground">
                                    OpenCode Configuration
                                    {paths?.opencode && <span className="ml-2 text-xs font-mono text-muted-foreground/50">({paths.opencode})</span>}
                                </h3>
                            </div>
                            <ServerList servers={opencodeServers} />
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
        />
      )}
      
      {editingServer && (
         <EditServerDialog 
            open={!!editingServer}
            onOpenChange={(open) => !open && setEditingServer(null)}
            server={editingServer}
            path={editingServer.source === "claude" ? paths?.claude || "" : paths?.opencode || ""}
         />
      )}

      <Toaster />
    </div>
  );
}

export default App;
