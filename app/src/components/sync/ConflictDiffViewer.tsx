import { useState } from "react";
import { DiffLine, SyncItem } from "@/types/config";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, FileCode, ArrowRight, Check } from "lucide-react";

interface ConflictDiffViewerProps {
  item: SyncItem;
  onKeepClaude?: (name: string) => void;
  onKeepOpenCode?: (name: string) => void;
  onCancel?: () => void;
}

function DiffLineView({ line }: { line: DiffLine }) {
  return (
    <div
      className={cn(
        "font-mono text-xs px-2 py-0.5 whitespace-pre",
        line.tag === "delete" && "bg-red-100 dark:bg-red-950/30 text-red-800 dark:text-red-300",
        line.tag === "insert" && "bg-green-100 dark:bg-green-950/30 text-green-800 dark:text-green-300",
        line.tag === "equal" && "bg-transparent text-muted-foreground"
      )}
    >
      <span className="inline-block w-4 text-center opacity-60">
        {line.tag === "delete" && "-"}
        {line.tag === "insert" && "+"}
        {line.tag === "equal" && " "}
      </span>
      {line.content.replace(/\n$/, "")}
    </div>
  );
}

function CodeBlock({ title, content, variant }: { title: string; content: string; variant: "claude" | "opencode" }) {
  return (
    <div className="flex-1 min-w-0">
      <div className={cn(
        "text-xs font-medium px-3 py-1.5 rounded-t-md",
        variant === "claude" && "bg-orange-100 dark:bg-orange-950/30 text-orange-800 dark:text-orange-300",
        variant === "opencode" && "bg-blue-100 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300"
      )}>
        {title}
      </div>
      <ScrollArea className="h-96 border rounded-b-md bg-muted/30">
        <pre className="text-xs p-3 font-mono whitespace-pre overflow-x-auto">
          {content}
        </pre>
      </ScrollArea>
    </div>
  );
}

export function ConflictDiffViewer({ item, onKeepClaude, onKeepOpenCode, onCancel }: ConflictDiffViewerProps) {
  const hasDiffData = item.diffLines && item.diffLines.length > 0;
  const hasJsonData = item.claudeJson && item.opencodeJson;
  const [viewMode, setViewMode] = useState<"side-by-side" | "unified">("side-by-side");
  const [compareMode, setCompareMode] = useState<"claude" | "opencode" | "raw">("claude");

  const getLeftContent = () => {
    if (compareMode === "claude" || compareMode === "raw") return item.claudeJson;
    return item.claudeAsOpencodeJson || "Conversion failed";
  };

  const getRightContent = () => {
    if (compareMode === "opencode" || compareMode === "raw") return item.opencodeJson;
    return item.opencodeAsClaudeJson || "Conversion failed";
  };

  const getLeftTitle = () => {
    if (compareMode === "opencode") return "Claude (Converted)";
    return "Claude Config";
  };

  const getRightTitle = () => {
    if (compareMode === "claude") return "OpenCode (Converted)";
    return "OpenCode Config";
  };

  return (
    <Card className="border-yellow-200 dark:border-yellow-900 bg-yellow-50/30 dark:bg-yellow-900/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <div className="p-1.5 bg-yellow-100 dark:bg-yellow-900/30 rounded text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <span>Conflict: {item.name}</span>
            <Badge variant="outline" className="ml-2 border-yellow-200 text-yellow-700 gap-1">
              <FileCode className="h-3 w-3" />
              Modified in both
            </Badge>
          </CardTitle>
          
          <div className="flex items-center space-x-2">
            <Label htmlFor="diff-mode" className="text-xs font-normal text-muted-foreground">Side-by-Side</Label>
            <Switch 
                id="diff-mode" 
                checked={viewMode === "unified"}
                onCheckedChange={(checked) => setViewMode(checked ? "unified" : "side-by-side")}
            />
            <Label htmlFor="diff-mode" className="text-xs font-normal text-muted-foreground">Unified</Label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Side-by-side JSON view */}
        {hasJsonData && viewMode === "side-by-side" && (
          <div className="space-y-3">
            <div className="flex justify-center">
                <Tabs value={compareMode} onValueChange={(v) => setCompareMode(v as any)} className="w-[400px]">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="claude">As Claude</TabsTrigger>
                        <TabsTrigger value="opencode">As OpenCode</TabsTrigger>
                        <TabsTrigger value="raw">Raw</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <div className="flex gap-4">
                <CodeBlock title={getLeftTitle()} content={getLeftContent()!} variant="claude" />
                <div className="flex items-center self-center">
                <ArrowRight className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <CodeBlock title={getRightTitle()} content={getRightContent()!} variant="opencode" />
            </div>
          </div>
        )}

        {/* Unified diff view */}
        {hasDiffData && viewMode === "unified" && (
          <div className="space-y-2">
            <ScrollArea className="h-96 border rounded-md bg-muted/20">
              <div className="p-1">
                {item.diffLines!.map((line, idx) => (
                  <DiffLineView key={idx} line={line} />
                ))}
              </div>
            </ScrollArea>
            <p className="text-xs text-center text-muted-foreground">Unified diff is based on Raw format comparison.</p>
          </div>
        )}

        {/* Fallback if no diff data */}
        {!hasDiffData && !hasJsonData && (
          <div className="text-sm text-muted-foreground text-center py-4">
            Configuration differs between Claude and OpenCode.
            <br />
            Use the buttons below to resolve the conflict.
          </div>
        )}

        {/* Resolution buttons */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
          {onKeepClaude && (
            <Button
              variant="outline"
              size="sm"
              className="bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200"
              onClick={() => onKeepClaude(item.name)}
            >
              <Check className="mr-1 h-3 w-3" />
              Keep Claude
            </Button>
          )}
          {onKeepOpenCode && (
            <Button
              variant="outline"
              size="sm"
              className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
              onClick={() => onKeepOpenCode(item.name)}
            >
              <Check className="mr-1 h-3 w-3" />
              Keep OpenCode
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
