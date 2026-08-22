import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Check, Package, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchableProductSelectProps {
  products: Product[];
  value: string; // productId or 'all'
  onChange: (product: Product | null | 'all') => void;
  label?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  locationId?: string; // Optional: show stock at specific location
  showStock?: boolean;
  currency?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  allowAll?: boolean;
  allLabel?: string;
}

export const SearchableProductSelect: React.FC<SearchableProductSelectProps> = ({
  products,
  value,
  onChange,
  label,
  placeholder = 'Type SKU or product name...',
  className,
  inputClassName,
  locationId,
  showStock = true,
  currency,
  disabled = false,
  required = false,
  error,
  allowAll = false,
  allLabel = 'All Products'
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedProduct = useMemo(() => {
    if (value === 'all') return null;
    return products.find(p => p.id === value);
  }, [products, value]);

  // Sync display text when value changes externally
  useEffect(() => {
    if (value === 'all') {
      setQuery(allLabel);
    } else if (selectedProduct) {
      setQuery(`${selectedProduct.name} (${selectedProduct.sku})`);
    } else if (!value) {
      setQuery('');
    }
  }, [selectedProduct, value, allLabel]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredProducts = useMemo(() => {
    const trimmed = query.toLowerCase().trim();
    
    // If empty or matches 'All Products' or exact product string, return initial slice
    if (!trimmed || (allowAll && trimmed === allLabel.toLowerCase())) {
      return products.slice(0, 20);
    }

    if (selectedProduct && `${selectedProduct.name} (${selectedProduct.sku})`.toLowerCase() === trimmed) {
      return products.slice(0, 20);
    }

    return products.filter(p => 
      (p.sku && p.sku.toLowerCase().includes(trimmed)) ||
      (p.name && p.name.toLowerCase().includes(trimmed)) ||
      (p.barcode && p.barcode.toLowerCase().includes(trimmed)) ||
      (p.brand && p.brand.toLowerCase().includes(trimmed)) ||
      (p.category && p.category.toLowerCase().includes(trimmed))
    ).slice(0, 30);
  }, [products, query, selectedProduct, allowAll, allLabel]);

  const handleSelect = (product: Product) => {
    onChange(product);
    setQuery(`${product.name} (${product.sku})`);
    setIsOpen(false);
  };

  const handleSelectAll = () => {
    onChange('all');
    setQuery(allLabel);
    setIsOpen(false);
  };

  const handleClear = () => {
    if (allowAll) {
      onChange('all');
      setQuery('');
    } else {
      onChange(null);
      setQuery('');
    }
    setIsOpen(true);
  };

  return (
    <div className={cn("relative flex-1 space-y-1", className)} ref={containerRef}>
      {label && (
        <div className="flex items-center justify-between">
          <Label className="text-[10px] uppercase font-bold text-slate-500">
            {label} {required && <span className="text-rose-500">*</span>}
          </Label>
          {selectedProduct && (
            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
              <Check className="w-3 h-3" /> Selected
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
            setQuery(e.target.value);
            setIsOpen(true);
            const val = e.target.value;
            if (selectedProduct && val !== `${selectedProduct.name} (${selectedProduct.sku})`) {
              if (allowAll && val === '') {
                onChange('all');
              } else {
                onChange(null);
              }
            }
          }}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          placeholder={placeholder}
          className={cn(
            "pl-8 pr-7 h-9 bg-slate-50/70 border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white transition-all",
            error && "border-rose-400 focus:ring-rose-400",
            inputClassName
          )}
        />
        {query && !disabled ? (
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

      {error && <p className="text-[11px] text-rose-500 font-medium">{error}</p>}

      {isOpen && !disabled && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-2xl max-h-64 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
          {allowAll && (
            <div
              onClick={handleSelectAll}
              className={cn(
                "p-2.5 text-xs font-semibold hover:bg-indigo-50/70 cursor-pointer transition-colors flex items-center justify-between text-slate-800",
                value === 'all' && "bg-indigo-50/90 text-indigo-700 border-l-4 border-indigo-600"
              )}
            >
              <span>{allLabel}</span>
              {value === 'all' && <Check className="w-3.5 h-3.5 text-indigo-600" />}
            </div>
          )}

          {filteredProducts.length > 0 ? (
            filteredProducts.map((p) => {
              const isSelected = p.id === value;
              const stockCount = locationId 
                ? (p.stocks?.[locationId] ?? 0) 
                : Object.values(p.stocks || {}).reduce((a, b) => a + b, 0);

              return (
                <div
                  key={p.id}
                  onClick={() => handleSelect(p)}
                  className={cn(
                    "p-2.5 text-xs hover:bg-indigo-50/70 cursor-pointer transition-colors flex items-center justify-between gap-2.5",
                    isSelected && "bg-indigo-50/90 border-l-4 border-indigo-600"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 truncate flex items-center gap-1.5">
                      {p.name}
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 flex-wrap">
                      <span className="font-mono bg-slate-100 px-1 py-0.2 rounded text-slate-700 font-bold">{p.sku}</span>
                      {p.brand && <span>Flavor: {p.brand}</span>}
                      {p.category && <span>• {p.category}</span>}
                    </div>
                  </div>
                  
                  {showStock && (
                    <div className="text-right flex-shrink-0">
                      <div className={cn(
                        "text-xs font-bold",
                        stockCount <= (p.locationThresholds?.[locationId || ''] ?? p.lowStockThreshold ?? 5) ? "text-amber-600" : "text-slate-700"
                      )}>
                        {stockCount} in stock
                      </div>
                      {currency && p.price !== undefined && (
                        <div className="text-[10px] text-slate-400">
                          {currency}{p.price.toFixed(2)}
                        </div>
                      )}
                      {locationId && (
                        <div className="text-[9px] text-slate-400">
                          at selected branch
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="p-3.5 text-center text-xs text-slate-500">
              <Package className="w-5 h-5 text-slate-300 mx-auto mb-1" />
              No products found matching "<span className="font-bold text-slate-700">{query}</span>"
            </div>
          )}
        </div>
      )}
    </div>
  );
};
