import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MCPServer } from "@/types/config";

const serverFormSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_-]+$/, "Name must be alphanumeric, dashes, or underscores"),
  type: z.enum(["local", "remote"]),
  command: z.string().optional(),
  args: z.string().optional(),
  url: z.string().optional(), // .url() validation added in refine if type is remote
  env: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.type === "local") {
      if (!data.command || data.command.trim() === "") {
          ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Command is required for local server",
              path: ["command"],
          });
      }
  }
  if (data.type === "remote") {
      if (!data.url || data.url.trim() === "") {
          ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "URL is required for remote server",
              path: ["url"],
          });
      } else {
          try {
              new URL(data.url);
          } catch {
              ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: "Invalid URL",
                  path: ["url"],
              });
          }
      }
  }
});

export type ServerFormValues = z.infer<typeof serverFormSchema>;

interface ServerFormProps {
  defaultValues?: Partial<ServerFormValues>;
  onSubmit: (data: ServerFormValues) => void;
  isLoading?: boolean;
  submitLabel?: string;
  mode?: "create" | "edit";
}

export function ServerForm({ defaultValues, onSubmit, isLoading, submitLabel = "Save", mode = "create" }: ServerFormProps) {
  const form = useForm<ServerFormValues>({
    resolver: zodResolver(serverFormSchema),
    defaultValues: {
      name: "",
      type: "local",
      command: "",
      args: "",
      url: "",
      env: "",
      ...defaultValues,
    },
  });

  const serverType = form.watch("type");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Server Name</FormLabel>
              <FormControl>
                <Input placeholder="my-server" {...field} disabled={mode === "edit"} />
              </FormControl>
              <FormDescription>
                Unique identifier for this server.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select server type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="local">Local (stdio)</SelectItem>
                  <SelectItem value="remote">Remote (SSE/HTTP)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {serverType === "local" ? (
          <>
            <FormField
              control={form.control}
              name="command"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Command</FormLabel>
                  <FormControl>
                    <Input placeholder="npx, python, node, docker..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="args"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Arguments</FormLabel>
                  <FormControl>
                    <Textarea 
                        placeholder="One argument per line&#10;-y&#10;@modelcontextprotocol/server-github" 
                        className="resize-none font-mono text-xs" 
                        rows={5}
                        {...field} 
                    />
                  </FormControl>
                  <FormDescription>Enter arguments separated by newlines.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        ) : (
          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Server URL</FormLabel>
                <FormControl>
                  <Input placeholder="http://localhost:3000/sse" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="env"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Environment Variables</FormLabel>
              <FormControl>
                <Textarea 
                    placeholder="KEY=VALUE&#10;GITHUB_TOKEN=ghp_..." 
                    className="resize-none font-mono text-xs" 
                    rows={4}
                    {...field} 
                />
              </FormControl>
              <FormDescription>One per line (KEY=VALUE)</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : submitLabel}
            </Button>
        </div>
      </form>
    </Form>
  );
}

// Helper to convert MCPServer to Form Values
export function serverToFormValues(server: MCPServer): Partial<ServerFormValues> {
    return {
        name: server.originalName,
        type: server.type,
        command: server.command && server.command.length > 0 ? server.command[0] : "",
        args: server.command && server.command.length > 1 ? server.command.slice(1).join("\n") : "",
        url: server.url || "",
        env: server.environment ? Object.entries(server.environment).map(([k, v]) => `${k}=${v}`).join("\n") : "",
    };
}

// Helper to convert Form Values to MCPServer structure (for mutation)
export function formValuesToConfig(values: ServerFormValues): { 
    type: "local" | "remote"; 
    command?: string[]; 
    url?: string; 
    environment?: Record<string, string>; 
} {
    const environment: Record<string, string> = {};
    if (values.env) {
        values.env.split("\n").forEach(line => {
            const parts = line.split("=");
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join("=").trim();
                if (key) environment[key] = value;
            }
        });
    }

    if (values.type === "local") {
        const args = values.args ? values.args.split("\n").map(s => s.trim()).filter(s => s !== "") : [];
        return {
            type: "local",
            command: [values.command!, ...args],
            environment,
        };
    } else {
        return {
            type: "remote",
            url: values.url!,
            environment,
        };
    }
}
