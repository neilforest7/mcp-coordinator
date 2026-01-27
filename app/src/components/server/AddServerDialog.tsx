import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { parseImportedJson, formatCommandForPlatform } from "@/lib/transformers";

interface AddServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: "claude" | "opencode";
  path: string;
  machineId: string;
  platform?: "linux" | "windows" | "macos";
  onSuccess?: () => void;
}

export function AddServerDialog({ open, onOpenChange, source, path, machineId, platform, onSuccess }: AddServerDialogProps) {
  const claudeMutations = useClaudeMutations(path, machineId);
  const opencodeMutations = useOpenCodeMutations(path, machineId);
  const [jsonInput, setJsonInput] = useState("");
  const [activeTab, setActiveTab] = useState("manual");
  const [prefilledValues, setPrefilledValues] = useState<Partial<ServerFormValues> | undefined>(undefined);

  const handleSubmit = (values: ServerFormValues) => {
    const configData = formValuesToConfig(values);
    
    // Apply platform-specific command formatting if it's a local command
    let finalCommand = configData.command;
    if (configData.type === "local" && finalCommand) {
        finalCommand = formatCommandForPlatform(finalCommand, platform);
    }

    if (source === "claude") {
      const claudeConfig = {
          isActive: true,
          type: (configData.type === "local" ? "stdio" : "sse") as "stdio" | "sse" | "http",
          command: finalCommand && finalCommand.length > 0 ? finalCommand[0] : undefined,
          args: finalCommand && finalCommand.length > 1 ? finalCommand.slice(1) : undefined,
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
            setJsonInput("");
            setPrefilledValues(undefined);
          },
          onError: (e) => toast.error(`Failed to add server: ${e.message}`),
        }
      );
    } else {
        const opencodeConfig = {
           type: configData.type,
           command: finalCommand,
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
                    setJsonInput("");
                    setPrefilledValues(undefined);
                },
                onError: (e) => toast.error(`Failed to add server: ${e.message}`),
            }
        );
    }
  };

  const handleJsonImport = () => {
      const parsed = parseImportedJson(jsonInput);
      if (parsed) {
          // Convert env record to string for form
          const envString = parsed.env 
            ? Object.entries(parsed.env).map(([key, value]) => `${key}=${value}`).join("\n")
            : "";

          setPrefilledValues({
              name: parsed.name || "",
              type: parsed.type,
              command: parsed.command?.join(" ") || "",
              url: parsed.url || "",
              env: envString
          });
          setActiveTab("manual");
          toast.success("JSON parsed successfully! Please review and save.");
      } else {
          toast.error("Invalid JSON or unrecognizable server configuration.");
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
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                <TabsTrigger value="import">Import JSON</TabsTrigger>
            </TabsList>
            <TabsContent value="manual">
                <ServerForm 
                    onSubmit={handleSubmit} 
                    isLoading={isLoading} 
                    submitLabel="Add Server" 
                    defaultValues={prefilledValues}
                />
            </TabsContent>
            <TabsContent value="import" className="space-y-4">
                <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                        Paste a server configuration JSON snippet (Claude or OpenCode format).
                    </p>
                    <Textarea 
                        placeholder='{"command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]}' 
                        className="h-[300px] font-mono text-xs"
                        value={jsonInput}
                        onChange={(e) => setJsonInput(e.target.value)}
                    />
                </div>
                <div className="flex justify-end">
                    <Button onClick={handleJsonImport} disabled={!jsonInput.trim()}>
                        Parse & Fill Form
                    </Button>
                </div>
            </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
