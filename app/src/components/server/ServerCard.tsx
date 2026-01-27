import { MCPServer } from "@/types/config";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, Trash2, Terminal, Globe } from "lucide-react";
import { ViewMode } from "./ServerToolbar";

interface ServerCardProps {
  server: MCPServer;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  viewMode?: ViewMode;
}

export function ServerCard({ server, onToggle, onEdit, onDelete, viewMode = "grid" }: ServerCardProps) {
  const commandOrUrl = server.type === "local" 
    ? (server.command && server.command.length > 0 
        ? (server.command.join(" ").length > 100 
            ? server.command.join(" ").substring(0, 100) + "..." 
            : server.command.join(" "))
        : "No command")
    : (server.url || "No URL");

  if (viewMode === "list") {
    return (
      <Card className="w-full mb-2">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* Status Switch */}
            <Switch 
                checked={server.enabled} 
                onCheckedChange={onToggle}
                className="data-[state=checked]:bg-green-500 shrink-0"
            />
            
            {/* Icon */}
            <div className="shrink-0">
                {server.type === "local" ? (
                    <Terminal className="h-4 w-4 text-muted-foreground" />
                ) : (
                    <Globe className="h-4 w-4 text-muted-foreground" />
                )}
            </div>

            {/* Name */}
            <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{server.name}</span>
                    <Badge variant="outline" className="text-[10px] h-5 font-normal shrink-0">
                        {server.source}
                    </Badge>
                </div>
                <code className="text-xs text-muted-foreground truncate font-mono mt-0.5">
                    {commandOrUrl}
                </code>
            </div>

            {/* Env Vars (Compact) */}
            {server.environment && Object.keys(server.environment).length > 0 && (
                <div className="hidden md:flex gap-1 shrink-0">
                    <Badge variant="secondary" className="text-[10px] h-5 font-normal">
                        {Object.keys(server.environment).length} env vars
                    </Badge>
                </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 ml-4 shrink-0">
             <Button variant="ghost" size="sm" onClick={onEdit} className="h-8 w-8 p-0">
                <Edit2 className="h-4 w-4" />
             </Button>
             <Button variant="ghost" size="sm" onClick={onDelete} className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
             </Button>
          </div>
        </div>
      </Card>
    );
  }

  // Grid View (Default)
  return (
    <Card className="w-full flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
           <CardTitle className="text-sm font-medium truncate" title={server.name}>
             {server.name}
           </CardTitle>
           <Badge variant={server.enabled ? "default" : "secondary"} className="text-[10px] px-1.5 py-0 h-5 shrink-0">
             {server.enabled ? "Active" : "Disabled"}
           </Badge>
        </div>
        <Switch 
            checked={server.enabled} 
            onCheckedChange={onToggle}
            className="data-[state=checked]:bg-green-500 shrink-0"
        />
      </CardHeader>
      <CardContent className="pb-2 flex-1">
        <div className="text-xs text-muted-foreground mt-1 space-y-2">
            <div className="flex items-start gap-2">
                {server.type === "local" ? (
                    <Terminal className="h-3 w-3 mt-0.5 shrink-0" />
                ) : (
                    <Globe className="h-3 w-3 mt-0.5 shrink-0" />
                )}
                <code className="font-mono bg-muted px-1 py-0.5 rounded break-all line-clamp-3">
                    {commandOrUrl}
                </code>
            </div>
            {server.environment && Object.keys(server.environment).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                    {Object.keys(server.environment).slice(0, 3).map(key => (
                        <Badge key={key} variant="outline" className="text-[10px] h-5 font-normal">
                            {key}
                        </Badge>
                    ))}
                    {Object.keys(server.environment).length > 3 && (
                        <Badge variant="outline" className="text-[10px] h-5 font-normal">
                            +{Object.keys(server.environment).length - 3} more
                        </Badge>
                    )}
                </div>
            )}
        </div>
      </CardContent>
      <CardFooter className="justify-between pt-0 pb-3 border-t bg-muted/10 mt-auto pt-2">
         <Badge variant="outline" className="text-[10px] font-normal border-0 text-muted-foreground px-0">
            {server.source}
         </Badge>
         <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit} className="h-8 w-8 p-0">
                <Edit2 className="h-3.5 w-3.5" />
                <span className="sr-only">Edit</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="h-3.5 w-3.5" />
                <span className="sr-only">Delete</span>
            </Button>
         </div>
      </CardFooter>
    </Card>
  );
}
