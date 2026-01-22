import { MCPServer } from "@/types/config";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, Trash2, Terminal, Globe } from "lucide-react";

interface ServerCardProps {
  server: MCPServer;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ServerCard({ server, onToggle, onEdit, onDelete }: ServerCardProps) {
  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2 overflow-hidden">
           <CardTitle className="text-sm font-medium truncate" title={server.name}>
             {server.name}
           </CardTitle>
           <Badge variant={server.enabled ? "default" : "secondary"} className="text-[10px] px-1.5 py-0 h-5">
             {server.enabled ? "Active" : "Disabled"}
           </Badge>
        </div>
        <Switch 
            checked={server.enabled} 
            onCheckedChange={onToggle}
            className="data-[state=checked]:bg-green-500"
        />
      </CardHeader>
      <CardContent className="pb-2">
        <div className="text-xs text-muted-foreground mt-1 space-y-2">
            <div className="flex items-start gap-2">
                {server.type === "local" ? (
                    <Terminal className="h-3 w-3 mt-0.5 shrink-0" />
                ) : (
                    <Globe className="h-3 w-3 mt-0.5 shrink-0" />
                )}
                <code className="font-mono bg-muted px-1 py-0.5 rounded break-all">
                    {server.type === "local" 
                        ? (server.command && server.command.length > 0 
                            ? (server.command.join(" ").length > 100 
                                ? server.command.join(" ").substring(0, 100) + "..." 
                                : server.command.join(" "))
                            : "No command")
                        : (server.url || "No URL")}
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
      <CardFooter className="justify-end gap-1 pt-0 pb-3">
         <Button variant="ghost" size="sm" onClick={onEdit} className="h-8 w-8 p-0">
            <Edit2 className="h-3.5 w-3.5" />
            <span className="sr-only">Edit</span>
         </Button>
         <Button variant="ghost" size="sm" onClick={onDelete} className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5" />
            <span className="sr-only">Delete</span>
         </Button>
      </CardFooter>
    </Card>
  );
}
