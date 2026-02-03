import { useState } from 'react';
import { SyncMode, SyncModeOption, SyncModeSelection, SyncEndpoint, SYNC_MODE_OPTIONS, SYNC_ENDPOINTS } from '@/types/sync';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ArrowLeftRight, ArrowRight, GitMerge, GitFork } from 'lucide-react';

interface SyncModeSelectorProps {
  open: boolean;
  onSelect: (selection: SyncModeSelection) => void;
  onCancel: () => void;
}

const ICON_MAP = {
  'arrows-both': ArrowLeftRight,
  'arrow-right': ArrowRight,
  'arrows-merge': GitMerge,
  'arrows-split': GitFork,
} as const;

function OneWayConfig({
  source,
  destination,
  onSourceChange,
  onDestinationChange,
}: {
  source: SyncEndpoint;
  destination: SyncEndpoint;
  onSourceChange: (value: SyncEndpoint) => void;
  onDestinationChange: (value: SyncEndpoint) => void;
}) {
  return (
    <div 
      className="ml-10 mt-3 p-3 bg-muted/50 rounded-md border border-border/50 space-y-3"
      data-testid="one-way-config"
    >
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-muted-foreground w-20">Source:</label>
        <Select value={source} onValueChange={onSourceChange}>
          <SelectTrigger className="w-40 h-8 text-sm" data-testid="source-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SYNC_ENDPOINTS.map((endpoint) => (
              <SelectItem 
                key={endpoint.id} 
                value={endpoint.id}
              >
                {endpoint.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-muted-foreground w-20">Destination:</label>
        <Select value={destination} onValueChange={onDestinationChange}>
          <SelectTrigger className="w-40 h-8 text-sm" data-testid="destination-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SYNC_ENDPOINTS.map((endpoint) => (
              <SelectItem 
                key={endpoint.id} 
                value={endpoint.id}
              >
                {endpoint.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
        <ArrowRight className="h-3 w-3" />
        <span>
          {SYNC_ENDPOINTS.find(e => e.id === source)?.label} → {SYNC_ENDPOINTS.find(e => e.id === destination)?.label}
        </span>
      </div>
    </div>
  );
}

function SyncModeOptionCard({ 
  option, 
  isSelected,
  onSelect, 
  isRecommended,
  children,
}: { 
  option: SyncModeOption; 
  isSelected: boolean;
  onSelect: (mode: SyncMode) => void;
  isRecommended: boolean;
  children?: React.ReactNode;
}) {
  const Icon = ICON_MAP[option.icon];
  
  const handleClick = () => {
    if (!option.disabled) {
      onSelect(option.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !option.disabled) {
      e.preventDefault();
      onSelect(option.id);
    }
  };

  return (
    <div>
      <button
        type="button"
        data-testid="sync-mode-option"
        role="option"
        aria-disabled={option.disabled}
        aria-selected={isSelected}
        tabIndex={option.disabled ? -1 : 0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full text-left p-4 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          option.disabled 
            ? "opacity-50 cursor-not-allowed bg-muted/30 border-muted" 
            : "hover:bg-accent hover:border-primary/50 cursor-pointer border-border",
          isRecommended && !option.disabled && !isSelected && "ring-2 ring-primary/30 border-primary/50 bg-primary/5",
          isSelected && !option.disabled && "ring-2 ring-primary border-primary bg-primary/10"
        )}
      >
        <div className="flex items-start gap-3">
          <div className={cn(
            "p-2 rounded-md shrink-0",
            option.disabled 
              ? "bg-muted text-muted-foreground" 
              : isSelected
                ? "bg-primary text-primary-foreground"
                : "bg-primary/10 text-primary"
          )}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                "font-medium text-sm",
                option.disabled && "text-muted-foreground"
              )}>
                {option.label}
              </span>
              {isRecommended && (
                <Badge 
                  variant="secondary" 
                  className="bg-primary/10 text-primary text-[10px] px-1.5 py-0"
                  data-testid="recommended-badge"
                >
                  Recommended
                </Badge>
              )}
              {option.disabled && (
                <Badge 
                  variant="outline" 
                  className="text-muted-foreground text-[10px] px-1.5 py-0"
                >
                  Coming Soon
                </Badge>
              )}
            </div>
            <p className={cn(
              "text-xs mt-1",
              option.disabled ? "text-muted-foreground/70" : "text-muted-foreground"
            )}>
              {option.description}
            </p>
            {option.disabledReason && (
              <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-1">
                {option.disabledReason}
              </p>
            )}
          </div>
        </div>
      </button>
      {isSelected && children}
    </div>
  );
}

export function SyncModeSelector({ open, onSelect, onCancel }: SyncModeSelectorProps) {
  const [selectedMode, setSelectedMode] = useState<SyncMode | null>(null);
  const [oneWaySource, setOneWaySource] = useState<SyncEndpoint>('claude');
  const [oneWayDestination, setOneWayDestination] = useState<SyncEndpoint>('opencode');

  const handleModeSelect = (mode: SyncMode) => {
    setSelectedMode(mode);
    // All modes now require clicking Continue button
  };

  const handleConfirm = () => {
    if (!selectedMode) return;
    
    if (selectedMode === 'one-way') {
      onSelect({
        mode: 'one-way',
        oneWayConfig: {
          source: oneWaySource,
          destination: oneWayDestination,
        },
      });
    } else {
      onSelect({ mode: selectedMode });
    }
  };

  const handleSourceChange = (value: SyncEndpoint) => {
    // With only 2 endpoints, selecting a source automatically sets the other as destination
    const otherEndpoint = SYNC_ENDPOINTS.find(e => e.id !== value);
    setOneWaySource(value);
    if (otherEndpoint) {
      setOneWayDestination(otherEndpoint.id);
    }
  };

  const handleDestinationChange = (value: SyncEndpoint) => {
    // With only 2 endpoints, selecting a destination automatically sets the other as source
    const otherEndpoint = SYNC_ENDPOINTS.find(e => e.id !== value);
    setOneWayDestination(value);
    if (otherEndpoint) {
      setOneWaySource(otherEndpoint.id);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset state when closing
      setSelectedMode(null);
      setOneWaySource('claude');
      setOneWayDestination('opencode');
      onCancel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Sync Mode</DialogTitle>
          <DialogDescription>
            Choose how you want to synchronize your MCP configurations between Claude Desktop and OpenCode.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-2 py-4" role="listbox" aria-label="Sync mode options">
          {SYNC_MODE_OPTIONS.map((option) => (
            <SyncModeOptionCard
              key={option.id}
              option={option}
              isSelected={selectedMode === option.id}
              onSelect={handleModeSelect}
              isRecommended={option.id === 'bidirectional'}
            >
              {option.id === 'one-way' && selectedMode === 'one-way' && (
                <OneWayConfig
                  source={oneWaySource}
                  destination={oneWayDestination}
                  onSourceChange={handleSourceChange}
                  onDestinationChange={handleDestinationChange}
                />
              )}
            </SyncModeOptionCard>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          {selectedMode && !SYNC_MODE_OPTIONS.find(o => o.id === selectedMode)?.disabled && (
            <Button onClick={handleConfirm} data-testid="confirm-sync-mode">
              Continue
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
