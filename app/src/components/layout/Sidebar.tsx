import { Machine } from "@/types/machine";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Laptop, Server, Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SidebarProps {
  machines: Machine[];
  selectedMachineId: string | null;
  onSelectMachine: (id: string) => void;
  onAddMachine: () => void;
  onEditMachine?: (machine: Machine) => void;
  onDeleteMachine?: (machine: Machine) => void;
  className?: string;
}

export function Sidebar({
  machines,
  selectedMachineId,
  onSelectMachine,
  onAddMachine,
  onEditMachine,
  onDeleteMachine,
  className,
}: SidebarProps) {
  return (
    <div className={cn("pb-12 w-64 border-r bg-muted/20 flex flex-col h-full", className)}>
      <div className="space-y-4 py-4 flex-1">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
            Machines
          </h2>
          <div className="space-y-1">
             <ScrollArea className="h-[calc(100vh-10rem)]">
                {machines.map((machine) => (
                  <div key={machine.id} className="relative group">
                    <Button
                      variant={selectedMachineId === machine.id ? "secondary" : "ghost"}
                      className="w-full justify-start font-normal mb-1 pr-8"
                      onClick={() => onSelectMachine(machine.id)}
                    >
                      {machine.type === "local" ? (
                        <Laptop className="mr-2 h-4 w-4" />
                      ) : (
                        <Server className="mr-2 h-4 w-4" />
                      )}
                      <span className="truncate flex-1 text-left">{machine.name}</span>
                      <Badge 
                          variant={machine.status === "connected" ? "default" : "destructive"}
                          className={cn("ml-auto h-2 w-2 rounded-full p-0 hover:bg-current", 
                              machine.status === "connected" ? "bg-green-500 hover:bg-green-600" : 
                              machine.status === "error" ? "bg-red-500 hover:bg-red-600" : "bg-gray-400 hover:bg-gray-500"
                          )} 
                      />
                    </Button>
                    
                    {machine.type !== "local" && (
                        <div className="absolute right-1 top-1">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted" onClick={(e) => e.stopPropagation()}>
                                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={(e) => {
                                        e.stopPropagation();
                                        onEditMachine?.(machine);
                                    }}>
                                        <Pencil className="mr-2 h-4 w-4" />
                                        <span>Edit</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteMachine?.(machine);
                                    }}>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        <span>Delete</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )}
                  </div>
                ))}
             </ScrollArea>
          </div>
        </div>
      </div>
      <div className="px-3 py-2 border-t">
        <Button onClick={onAddMachine} variant="outline" className="w-full justify-start">
            <Plus className="mr-2 h-4 w-4" />
            Add Machine
        </Button>
        <div className="mt-2 text-xs text-muted-foreground px-2 text-center">
            v0.1.0-mvp
        </div>
      </div>
    </div>
  );
}
