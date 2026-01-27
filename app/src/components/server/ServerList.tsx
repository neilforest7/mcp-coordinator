import { useState, useMemo } from "react";
import { MCPServer } from "@/types/config";
import { ServerCard } from "./ServerCard";
import { ServerToolbar, SortOption, ViewMode } from "./ServerToolbar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface ServerListProps {
  servers: MCPServer[];
  onToggle: (server: MCPServer, enabled: boolean) => void;
  onEdit: (server: MCPServer) => void;
  onDelete: (server: MCPServer) => void;
  onAdd: () => void;
  onRestart?: () => void;
}

export function ServerList({ servers, onToggle, onEdit, onDelete, onAdd, onRestart }: ServerListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name-asc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const filteredServers = useMemo(() => {
    let result = [...servers];

    // Filter
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(lowerQuery) ||
          (s.command && s.command.join(" ").toLowerCase().includes(lowerQuery)) ||
          (s.url && s.url.toLowerCase().includes(lowerQuery))
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "status":
          // Active first (true > false)
          return Number(b.enabled) - Number(a.enabled);
        case "source":
          return a.source.localeCompare(b.source);
        default:
          return 0;
      }
    });

    return result;
  }, [servers, searchQuery, sortBy]);

  return (
    <div className="flex flex-col h-full">
      <ServerToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        onSortChange={setSortBy}
        viewMode={viewMode}
        onViewChange={setViewMode}
        onAdd={onAdd}
        onRestart={onRestart}
      />

      <div className="flex-1 overflow-y-auto min-h-0 pb-12">
        {filteredServers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No servers found matching "{searchQuery}"
          </div>
        ) : (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                : "flex flex-col gap-2"
            }
          >
            {filteredServers.map((server) => (
              <ServerCard
                key={`${server.source}-${server.originalName}`} // Ensure unique key across sources
                server={server}
                onToggle={(enabled) => onToggle(server, enabled)}
                onEdit={() => onEdit(server)}
                onDelete={() => onDelete(server)}
                viewMode={viewMode}
              />
            ))}
            
            {/* Optional: Add Button Card in Grid View */}
            {viewMode === "grid" && !searchQuery && (
                <Button 
                    variant="outline" 
                    className="h-[140px] w-full border-dashed flex flex-col gap-2 hover:bg-accent hover:text-accent-foreground items-center justify-center"
                    onClick={onAdd}
                >
                    <Plus className="h-8 w-8 text-muted-foreground" />
                    <span className="text-muted-foreground font-medium">Add Server</span>
                </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
