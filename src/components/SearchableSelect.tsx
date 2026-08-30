import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Check, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchableOption {
  id: string;
  label: string;
  subLabel?: string;
  badge?: string;
  badgeClassName?: string;
}

export interface SearchableSelectProps {
  options: SearchableOption[];
  value: string; // option id or 'all'
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  allowAll?: boolean;
  allLabel?: string;
  allSubLabel?: string;
  icon?: React.ReactNode;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  label,
  placeholder = 'Type to search or select...',
  className,
  inputClassName,
  disabled = false,
  allowAll = true,
  allLabel = 'All',
  allSubLabel,
  icon
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(() => {
    if (value === 'all') return null;
    return options.find(o => o.id === value);
  }, [options, value]);

  // Sync display text when value changes externally (only when not actively typing/focused)
  useEffect(() => {
    if (isFocused) return;
    if (value === 'all') {
      setQuery(allLabel);
    } else if (selectedOption) {
      setQuery(selectedOption.label);
    } else if (!value) {
      setQuery('');
    }
  }, [selectedOption, value, allLabel, isFocused]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    const trimmed = query.toLowerCase().trim();

    // If empty or matches 'All' or exact selected label, return initial slice
    if (!trimmed || (allowAll && trimmed === allLabel.toLowerCase())) {
      return options.slice(0, 40);
    }

    if (selectedOption && selectedOption.label.toLowerCase() === trimmed) {
      return options.slice(0, 40);
    }

    return options.filter(o => 
      o.label.toLowerCase().includes(trimmed) ||
      (o.subLabel && o.subLabel.toLowerCase().includes(trimmed)) ||
      (o.badge && o.badge.toLowerCase().includes(trimmed))
    ).slice(0, 40);
  }, [options, query, selectedOption, allowAll, allLabel]);

  const handleSelect = (optId: string, optLabel: string) => {
    onChange(optId);
    setQuery(optLabel);
    setIsOpen(false);
    setIsFocused(false);
  };

  const handleSelectAll = () => {
    onChange('all');
    setQuery(allLabel);
    setIsOpen(false);
    setIsFocused(false);
  };

  const handleClear = () => {
    if (allowAll) {
      onChange('all');
      setQuery('');
    } else {
      onChange('');
      setQuery('');
    }
    setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions.length > 0) {
        handleSelect(filteredOptions[0].id, filteredOptions[0].label);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className={cn("relative flex-1 space-y-1", className)} ref={containerRef}>
      {label && (
        <div className="flex items-center justify-between">
          <Label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
            {icon}
            {label}
          </Label>
          {selectedOption && value !== 'all' && (
            <span className="text-[9px] font-bold text-indigo-600 flex items-center gap-0.5">
              <Check className="w-2.5 h-2.5" /> Filtered
            </span>
          )}
        </div>
      )}

      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <Input
          type="text"
          disabled={disabled}
          value={query}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            setIsOpen(true);
            if (selectedOption && val !== selectedOption.label) {
              if (allowAll && val === '') {
                onChange('all');
              }
            }
          }}
          onFocus={() => {
            if (!disabled) {
              setIsFocused(true);
              setIsOpen(true);
            }
          }}
          onBlur={() => {
            setTimeout(() => {
              setIsFocused(false);
              const trimmed = query.trim().toLowerCase();
              if (trimmed && !selectedOption && value !== 'all') {
                const exactMatch = options.find(o => o.label.toLowerCase() === trimmed);
                if (exactMatch) {
                  handleSelect(exactMatch.id, exactMatch.label);
                }
              }
            }, 200);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "pl-8 pr-7 h-9 bg-white border-slate-200 rounded-xl text-xs font-medium focus:bg-white transition-all shadow-none",
            inputClassName
          )}
        />
        {query && query !== allLabel && !disabled ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200/50 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
        )}
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-2xl max-h-64 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
          {allowAll && (
            <div
              onClick={handleSelectAll}
              className={cn(
                "p-2.5 text-xs font-semibold hover:bg-indigo-50/70 cursor-pointer transition-colors flex items-center justify-between text-slate-800",
                value === 'all' && "bg-indigo-50/90 text-indigo-700 border-l-4 border-indigo-600 font-bold"
              )}
            >
              <div>
                <span>{allLabel}</span>
                {allSubLabel && <p className="text-[10px] text-slate-400 font-normal">{allSubLabel}</p>}
              </div>
              {value === 'all' && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
            </div>
          )}

          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => {
              const isSelected = opt.id === value;
              return (
                <div
                  key={opt.id}
                  onClick={() => handleSelect(opt.id, opt.label)}
                  className={cn(
                    "p-2.5 text-xs hover:bg-indigo-50/70 cursor-pointer transition-colors flex items-center justify-between gap-2",
                    isSelected && "bg-indigo-50/90 border-l-4 border-indigo-600 text-indigo-900 font-semibold"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-900 truncate flex items-center gap-1.5">
                      <span className={cn("truncate", isSelected && "text-indigo-950 font-bold")}>{opt.label}</span>
                      {opt.badge && (
                        <span className={cn(
                          "text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase shrink-0 bg-slate-100 text-slate-600",
                          opt.badgeClassName
                        )}>
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    {opt.subLabel && (
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">{opt.subLabel}</p>
                    )}
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                </div>
              );
            })
          ) : (
            <div className="p-3.5 text-center text-xs text-slate-500">
              No matches found for "<span className="font-bold text-slate-700">{query}</span>"
            </div>
          )}
        </div>
      )}
    </div>
  );
};
