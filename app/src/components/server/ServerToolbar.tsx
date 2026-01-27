import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, LayoutGrid, List, ArrowUpDown, Plus, RotateCcw } from "lucide-react";

export type SortOption = "name-asc" | "name-desc" | "status" | "source";
export type ViewMode = "grid" | "list";

interface ServerToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sortBy: SortOption;
  onSortChange: (value: SortOption) => void;
  viewMode: ViewMode;
  onViewChange: (value: ViewMode) => void;
  onAdd: () => void;
  onRestart?: () => void;
}

export function ServerToolbar({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewChange,
  onAdd,
  onRestart,
}: ServerToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between py-4">
      <div className="relative w-full sm:w-72">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search servers..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8"
        />
      </div>
      
      <div className="flex items-center gap-2 w-full sm:w-auto">
        {onRestart && (
          <Button variant="outline" size="sm" onClick={onRestart} className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700 dark:text-orange-400 dark:border-orange-800 dark:hover:bg-orange-950">
             <RotateCcw className="h-4 w-4" />
             Restart Host
          </Button>
        )}

        <Select value={sortBy} onValueChange={(v) => onSortChange(v as SortOption)}>
          <SelectTrigger className="w-[160px]">
            <ArrowUpDown className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">Name (A-Z)</SelectItem>
            <SelectItem value="name-desc">Name (Z-A)</SelectItem>
            <SelectItem value="status">Status</SelectItem>
            <SelectItem value="source">Source</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center border rounded-md mr-2">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="rounded-none rounded-l-md h-9 w-9"
            onClick={() => onViewChange("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            className="rounded-none rounded-r-md h-9 w-9"
            onClick={() => onViewChange("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>

        <Button onClick={onAdd} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add
        </Button>
      </div>
    </div>
  );
}
