import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Check, X, ChevronDown, CheckSquare, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchableMultiOption {
  id: string;
  label: string;
  subLabel?: string;
  badge?: string;
  badgeClassName?: string;
}

export interface SearchableMultiSelectProps {
  options: SearchableMultiOption[];
  values: string[]; // Selected option ids (empty means all)
  onChange: (values: string[]) => void;
  label?: string;
  placeholder?: string;
  allLabel?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  maxDisplayedBadges?: number;
}

export const SearchableMultiSelect: React.FC<SearchableMultiSelectProps> = ({
  options,
  values = [],
  onChange,
  label,
  placeholder = 'Select...',
  allLabel = 'All',
  className,
  inputClassName,
  disabled = false,
  icon,
  maxDisplayedBadges = 2
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const selectedOptions = useMemo(() => {
    if (!values || values.length === 0) return [];
    const valSet = new Set(values);
    return options.filter(o => valSet.has(o.id));
  }, [options, values]);

  const filteredOptions = useMemo(() => {
    const trimmed = searchQuery.toLowerCase().trim();
    if (!trimmed) return options;
    return options.filter(o =>
      o.label.toLowerCase().includes(trimmed) ||
      (o.subLabel && o.subLabel.toLowerCase().includes(trimmed)) ||
      (o.badge && o.badge.toLowerCase().includes(trimmed))
    );
  }, [options, searchQuery]);

  const handleToggle = (optId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const isSelected = values.includes(optId);
    let nextValues: string[];
    if (isSelected) {
      nextValues = values.filter(id => id !== optId);
    } else {
      nextValues = [...values, optId];
    }
    onChange(nextValues);
  };

  const handleSelectAllFiltered = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const visibleIds = filteredOptions.map(o => o.id);
    const combined = Array.from(new Set([...values, ...visibleIds]));
    onChange(combined);
  };

  const handleClearAll = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange([]);
  };

  const handleRemoveOne = (optId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(values.filter(id => id !== optId));
  };

  const isAllSelected = options.length > 0 && options.every(o => values.includes(o.id));

  return (
    <div className={cn("relative flex-1 space-y-1 text-left", className)} ref={containerRef}>
      {label && (
        <div className="flex items-center justify-between">
          <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
            {icon}
            {label}
          </Label>
          {values.length > 0 && (
            <Badge
              variant="outline"
              className="text-[9px] font-bold bg-indigo-50 text-indigo-700 border-indigo-200 px-1.5 py-0 h-4 rounded-full flex items-center gap-0.5"
            >
              <Check className="w-2.5 h-2.5" />
              {values.length} selected
            </Badge>
          )}
        </div>
      )}

      {/* Trigger Box */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!disabled) setIsOpen(!isOpen);
          } else if (e.key === 'Escape') {
            setIsOpen(false);
          }
        }}
        className={cn(
          "min-h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs shadow-xs transition-colors flex items-center justify-between gap-1.5 cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500",
          isOpen && "ring-1 ring-indigo-500 border-indigo-500",
          disabled && "opacity-50 cursor-not-allowed bg-slate-50",
          inputClassName
        )}
      >
        <div className="flex flex-wrap items-center gap-1 overflow-hidden flex-1 py-0.5">
          {values.length === 0 ? (
            <span className="text-slate-500 font-normal truncate">
              {allLabel || placeholder}
            </span>
          ) : (
            <>
              {selectedOptions.slice(0, maxDisplayedBadges).map(opt => (
                <span
                  key={opt.id}
                  className="inline-flex items-center gap-1 bg-indigo-50/90 text-indigo-900 border border-indigo-200/80 text-[11px] font-medium px-1.5 py-0.5 rounded"
                >
                  <span className="truncate max-w-[110px]">{opt.label}</span>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveOne(opt.id, e)}
                    className="hover:bg-indigo-200/60 rounded-full p-0.5 text-indigo-600 hover:text-indigo-950 transition-colors"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}

              {values.length > maxDisplayedBadges && (
                <span className="inline-flex items-center bg-slate-100 text-slate-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-200">
                  +{values.length - maxDisplayedBadges} more
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {values.length > 0 && !disabled && (
            <button
              type="button"
              onClick={handleClearAll}
              title="Clear selection"
              className="p-1 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
            >
              <X className="w-3 h-3 text-slate-400 hover:text-rose-500" />
            </button>
          )}
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", isOpen && "rotate-180")} />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 min-w-[240px] max-w-sm rounded-lg border border-slate-200 bg-white shadow-xl animate-in fade-in-50 zoom-in-95 duration-100 overflow-hidden">
          {/* Search Header */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/80">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search options..."
                className="w-full pl-8 pr-7 py-1 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between pt-2 px-0.5 text-[11px]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="text-indigo-600 hover:text-indigo-800 font-semibold hover:underline flex items-center gap-1"
                >
                  <CheckSquare className="w-3 h-3" />
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-slate-500 hover:text-rose-600 font-semibold hover:underline flex items-center gap-1"
                >
                  <Square className="w-3 h-3" />
                  Clear
                </button>
              </div>

              <span className="text-slate-400 text-[10px] font-medium">
                {values.length} of {options.length} selected
              </span>
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-1 divide-y divide-slate-50">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 italic">
                No matching options found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = values.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    onClick={(e) => handleToggle(opt.id, e)}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md cursor-pointer transition-colors text-xs select-none",
                      isSelected
                        ? "bg-indigo-50/70 hover:bg-indigo-50 text-indigo-950 font-medium"
                        : "hover:bg-slate-50 text-slate-700"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                      isSelected
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "border-slate-300 bg-white"
                    )}>
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="truncate">{opt.label}</span>
                        {opt.badge && (
                          <span className={cn(
                            "text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0",
                            opt.badgeClassName || "bg-slate-100 text-slate-600"
                          )}>
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.subLabel && (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{opt.subLabel}</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Bar */}
          <div className="p-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 pl-1">
              {values.length === 0 ? allLabel : `${values.length} active`}
            </span>
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={() => setIsOpen(false)}
              className="h-6 text-[11px] px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium"
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
