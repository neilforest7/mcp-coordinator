import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReactNode } from "react";

interface SourceTabsProps {
  value?: "claude" | "opencode";
  defaultValue?: "claude" | "opencode";
  onTabChange?: (value: "claude" | "opencode") => void;
  claudeContent: ReactNode;
  opencodeContent: ReactNode;
}

export function SourceTabs({
  value,
  defaultValue = "claude",
  onTabChange,
  claudeContent,
  opencodeContent,
}: SourceTabsProps) {
  return (
    <Tabs 
      value={value}
      defaultValue={defaultValue} 
      className="w-full h-full flex flex-col"
      onValueChange={(val) => onTabChange?.(val as "claude" | "opencode")}
    >
      <div className="border-b px-4 bg-background">
        <TabsList className="h-12 w-auto justify-start bg-transparent p-0">
          <TabsTrigger 
            value="claude" 
            className="data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none relative h-12 rounded-none border-b-2 border-transparent px-4 pb-3 pt-3 font-semibold text-muted-foreground data-[state=active]:text-foreground bg-transparent hover:text-foreground transition-colors"
          >
            Claude Desktop
          </TabsTrigger>
          <TabsTrigger 
            value="opencode" 
            className="data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none relative h-12 rounded-none border-b-2 border-transparent px-4 pb-3 pt-3 font-semibold text-muted-foreground data-[state=active]:text-foreground bg-transparent hover:text-foreground transition-colors"
          >
            OpenCode (OhMyOpenCode)
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="claude" className="flex-1 p-4 m-0 overflow-auto outline-none data-[state=inactive]:hidden">
        {claudeContent}
      </TabsContent>
      <TabsContent value="opencode" className="flex-1 p-4 m-0 overflow-auto outline-none data-[state=inactive]:hidden">
        {opencodeContent}
      </TabsContent>
    </Tabs>
  );
}
