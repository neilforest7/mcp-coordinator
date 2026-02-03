import { useState, useMemo, useCallback } from "react";
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
  onBatchToggle?: (servers: MCPServer[], enabled: boolean) => void;
}

function getServerKey(server: MCPServer): string {
  return `${server.source}-${server.originalName}`;
}

export function ServerList({ servers, onToggle, onEdit, onDelete, onAdd, onRestart, onBatchToggle }: ServerListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name-asc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const filteredServers = useMemo(() => {
    let result = [...servers];

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(lowerQuery) ||
          (s.command && s.command.join(" ").toLowerCase().includes(lowerQuery)) ||
          (s.url && s.url.toLowerCase().includes(lowerQuery))
      );
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "status":
          return Number(b.enabled) - Number(a.enabled);
        case "source":
          return a.source.localeCompare(b.source);
        default:
          return 0;
      }
    });

    return result;
  }, [servers, searchQuery, sortBy]);

  const handleToggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) {
        setSelectedKeys(new Set());
      }
      return !prev;
    });
  }, []);

  const handleSelect = useCallback((server: MCPServer, selected: boolean) => {
    const key = getServerKey(server);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const allKeys = filteredServers.map(getServerKey);
    setSelectedKeys(new Set(allKeys));
  }, [filteredServers]);

  const handleDeselectAll = useCallback(() => {
    setSelectedKeys(new Set());
  }, []);

  const selectedServers = useMemo(() => {
    return filteredServers.filter((s) => selectedKeys.has(getServerKey(s)));
  }, [filteredServers, selectedKeys]);

  const handleBatchEnable = useCallback(() => {
    if (onBatchToggle && selectedServers.length > 0) {
      onBatchToggle(selectedServers, true);
      setSelectionMode(false);
      setSelectedKeys(new Set());
    }
  }, [onBatchToggle, selectedServers]);

  const handleBatchDisable = useCallback(() => {
    if (onBatchToggle && selectedServers.length > 0) {
      onBatchToggle(selectedServers, false);
      setSelectionMode(false);
      setSelectedKeys(new Set());
    }
  }, [onBatchToggle, selectedServers]);

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
        selectionMode={selectionMode}
        onToggleSelectionMode={handleToggleSelectionMode}
        selectedCount={selectedKeys.size}
        totalCount={filteredServers.length}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onBatchEnable={handleBatchEnable}
        onBatchDisable={handleBatchDisable}
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
            {filteredServers.map((server) => {
              const key = getServerKey(server);
              return (
                <ServerCard
                  key={key}
                  server={server}
                  onToggle={(enabled) => onToggle(server, enabled)}
                  onEdit={() => onEdit(server)}
                  onDelete={() => onDelete(server)}
                  viewMode={viewMode}
                  isSelectable={selectionMode}
                  isSelected={selectedKeys.has(key)}
                  onSelect={(selected) => handleSelect(server, selected)}
                />
              );
            })}
            
            {viewMode === "grid" && !searchQuery && !selectionMode && (
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
