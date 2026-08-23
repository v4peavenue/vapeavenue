import React from 'react';
import { Save, Clock, Trash2, CheckCircle2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DraftStatusBannerProps {
  hasDraft: boolean;
  lastSaved: Date | null;
  onClearDraft: () => void;
  className?: string;
  itemCount?: number;
  itemLabel?: string;
}

export const DraftStatusBanner: React.FC<DraftStatusBannerProps> = ({
  hasDraft,
  lastSaved,
  onClearDraft,
  className,
  itemCount,
  itemLabel = 'item'
}) => {
  if (!hasDraft && !lastSaved) {
    return null;
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className={cn(
      "flex items-center justify-between gap-2 px-3 py-2 bg-amber-50/90 border border-amber-200/80 rounded-xl text-xs text-amber-900 animate-in fade-in duration-200",
      className
    )}>
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-200 text-amber-800 shrink-0">
          <Save className="w-3 h-3" />
        </div>
        <div className="truncate">
          <span className="font-semibold text-amber-950">Auto-saved draft</span>
          {itemCount !== undefined && itemCount > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-100 font-medium text-amber-800 text-[10px]">
              {itemCount} {itemCount === 1 ? itemLabel : `${itemLabel}s`}
            </span>
          )}
          {lastSaved && (
            <span className="ml-1.5 text-amber-700/80 text-[11px] inline-flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5 inline" /> {formatTime(lastSaved)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClearDraft}
          className="h-6 px-2 text-[11px] text-amber-800 hover:text-rose-700 hover:bg-amber-100/80 rounded-lg cursor-pointer flex items-center gap-1"
        >
          <Trash2 className="w-3 h-3" />
          Clear Draft
        </Button>
      </div>
    </div>
  );
};
