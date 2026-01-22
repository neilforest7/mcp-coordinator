import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ServerForm, ServerFormValues, formValuesToConfig, serverToFormValues } from "./ServerForm";
import { useClaudeMutations, useOpenCodeMutations } from "@/hooks/useConfig";
import { toast } from "sonner";
import { MCPServer } from "@/types/config";

interface EditServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: MCPServer;
  path: string;
  onSuccess?: () => void;
}

export function EditServerDialog({ open, onOpenChange, server, path, onSuccess }: EditServerDialogProps) {
  const claudeMutations = useClaudeMutations(path);
  const opencodeMutations = useOpenCodeMutations(path);

  const handleSubmit = (values: ServerFormValues) => {
    const configData = formValuesToConfig(values);
    
    if (server.source === "claude") {
      const claudeConfig = {
          isActive: server.enabled,
          type: (configData.type === "local" ? "stdio" : "sse") as "stdio" | "sse" | "http",
          command: configData.command && configData.command.length > 0 ? configData.command[0] : undefined,
          args: configData.command && configData.command.length > 1 ? configData.command.slice(1) : undefined,
          url: configData.url,
          env: configData.environment,
          name: values.name, 
      };
      
      claudeMutations.updateServer.mutate(
        { name: values.name, config: claudeConfig },
        {
          onSuccess: () => {
            toast.success("Server updated");
            onOpenChange(false);
            onSuccess?.();
          },
          onError: (e) => toast.error(`Failed to update server: ${e.message}`),
        }
      );
    } else {
        const opencodeConfig = {
           type: configData.type,
           command: configData.command,
           url: configData.url,
           environment: configData.environment,
           enabled: server.enabled,
       };
       
        opencodeMutations.updateServer.mutate(
            { name: values.name, config: opencodeConfig },
            {
                onSuccess: () => {
                    toast.success("Server updated");
                    onOpenChange(false);
                    onSuccess?.();
                },
                onError: (e) => toast.error(`Failed to update server: ${e.message}`),
            }
        );
    }
  };

  const isLoading = server.source === "claude" ? claudeMutations.updateServer.isPending : opencodeMutations.updateServer.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Server: {server.name}</DialogTitle>
          <DialogDescription>
            Modify settings for this MCP server.
          </DialogDescription>
        </DialogHeader>
        <ServerForm 
            onSubmit={handleSubmit} 
            isLoading={isLoading} 
            submitLabel="Save Changes" 
            defaultValues={serverToFormValues(server)}
            mode="edit"
        />
      </DialogContent>
    </Dialog>
  );
}
