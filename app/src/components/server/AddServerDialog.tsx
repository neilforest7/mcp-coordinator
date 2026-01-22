import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ServerForm, ServerFormValues, formValuesToConfig } from "./ServerForm";
import { useClaudeMutations, useOpenCodeMutations } from "@/hooks/useConfig";
import { toast } from "sonner";

interface AddServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: "claude" | "opencode";
  path: string;
  onSuccess?: () => void;
}

export function AddServerDialog({ open, onOpenChange, source, path, onSuccess }: AddServerDialogProps) {
  const claudeMutations = useClaudeMutations(path);
  const opencodeMutations = useOpenCodeMutations(path);

  const handleSubmit = (values: ServerFormValues) => {
    const configData = formValuesToConfig(values);
    
    if (source === "claude") {
      const claudeConfig = {
          isActive: true,
          type: (configData.type === "local" ? "stdio" : "sse") as "stdio" | "sse" | "http",
          command: configData.command && configData.command.length > 0 ? configData.command[0] : undefined,
          args: configData.command && configData.command.length > 1 ? configData.command.slice(1) : undefined,
          url: configData.url,
          env: configData.environment,
      };
      
      claudeMutations.updateServer.mutate(
        { name: values.name, config: claudeConfig },
        {
          onSuccess: () => {
            toast.success("Server added");
            onOpenChange(false);
            onSuccess?.();
          },
          onError: (e) => toast.error(`Failed to add server: ${e.message}`),
        }
      );
    } else {
        const opencodeConfig = {
           type: configData.type,
           command: configData.command,
           url: configData.url,
           environment: configData.environment,
           enabled: true,
       };
       
        opencodeMutations.updateServer.mutate(
            { name: values.name, config: opencodeConfig },
            {
                onSuccess: () => {
                    toast.success("Server added");
                    onOpenChange(false);
                    onSuccess?.();
                },
                onError: (e) => toast.error(`Failed to add server: ${e.message}`),
            }
        );
    }
  };

  const isLoading = source === "claude" ? claudeMutations.updateServer.isPending : opencodeMutations.updateServer.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Server</DialogTitle>
          <DialogDescription>
            Add a new MCP server to your {source === "claude" ? "Claude Desktop" : "OpenCode"} configuration.
          </DialogDescription>
        </DialogHeader>
        <ServerForm onSubmit={handleSubmit} isLoading={isLoading} submitLabel="Add Server" />
      </DialogContent>
    </Dialog>
  );
}
