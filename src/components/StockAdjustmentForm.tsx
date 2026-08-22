import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Scan, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  ClipboardCheck, 
  Sparkles, 
  RotateCcw, 
  PackageMinus, 
  PackagePlus, 
  SlidersHorizontal,
  Flame,
  Search,
  Check,
  Package,
  X
} from 'lucide-react';
import { BarcodeScanner } from './BarcodeScanner';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Product, Location, StockAdjustment } from '@/types';
import { db } from '@/lib/firebase';
import { doc, updateDoc, collection, addDoc, Timestamp, increment, arrayUnion } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { logAction } from '@/lib/audit';
import { toast } from 'sonner';
import { OperationType, handleFirestoreError } from '@/lib/firestore-utils';

interface StockAdjustmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  locations: Location[];
  initialProductId?: string;
}

export type AdjustmentReasonCategory = 
  | 'defective' 
  | 'audit' 
  | 'loss' 
  | 'expiry' 
  | 'rtv' 
  | 'tester' 
  | 'restock' 
  | 'other';

interface FormData {
  productId: string;
  locationId: string;
  reasonCategory: AdjustmentReasonCategory;
  type: 'subtract' | 'add' | 'set';
  quantity: number;
  reason: string;
}

const REASON_CATEGORIES: {
  value: AdjustmentReasonCategory;
  label: string;
  description: string;
  defaultType: 'subtract' | 'add' | 'set';
  icon: React.ElementType;
  colorClass: string;
  badgeClass: string;
  placeholder: string;
  quickTags: string[];
}[] = [
  {
    value: 'defective',
    label: 'Damaged / Defective Product',
    description: 'Factory defect, leaking pod, dead battery, burnt coil, or damaged seal',
    defaultType: 'subtract',
    icon: Flame,
    colorClass: 'text-rose-600',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    placeholder: 'e.g. Leaking pod in pack, dead battery out of box, broken seal...',
    quickTags: ['Leaking Pod / Cartridge', 'Dead Battery / No Fire', 'Burnt Coil on Unbox', 'Broken Packaging', 'Defective Chip / Sensor']
  },
  {
    value: 'audit',
    label: 'Physical Count / Inventory Audit',
    description: 'Correction following physical cycle count or stock audit',
    defaultType: 'set',
    icon: ClipboardCheck,
    colorClass: 'text-blue-600',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    placeholder: 'e.g. Weekly physical inventory count discrepancy...',
    quickTags: ['Monthly Physical Count', 'Cycle Count Variance', 'Barcode Miscount']
  },
  {
    value: 'loss',
    label: 'Loss / Shrinkage / Missing Stock',
    description: 'Unaccounted physical loss, theft, or misplacement',
    defaultType: 'subtract',
    icon: ShieldAlert,
    colorClass: 'text-amber-600',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    placeholder: 'e.g. Unaccounted stock shrinkage during shift audit...',
    quickTags: ['Unaccounted Shrinkage', 'Missing from Display', 'Transit Loss']
  },
  {
    value: 'expiry',
    label: 'Expired / Deteriorated Product',
    description: 'Past shelf life or discolored/oxidized e-liquid',
    defaultType: 'subtract',
    icon: AlertTriangle,
    colorClass: 'text-orange-600',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
    placeholder: 'e.g. E-liquid past expiry date, oxidized flavor...',
    quickTags: ['Past Best Before Date', 'Discolored Juice', 'Degraded Pod']
  },
  {
    value: 'rtv',
    label: 'Return to Vendor / Supplier (RTV)',
    description: 'Defective or overstock unit returned to supplier for warranty',
    defaultType: 'subtract',
    icon: RotateCcw,
    colorClass: 'text-purple-600',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    placeholder: 'e.g. RMA batch #78 returned to supplier for replacement credit...',
    quickTags: ['RMA Supplier Claim', 'Batch Recall Return', 'Warranty Exchange']
  },
  {
    value: 'tester',
    label: 'Store Tester / Customer Demo',
    description: 'Allocated as store sampling unit or display demonstration',
    defaultType: 'subtract',
    icon: Sparkles,
    colorClass: 'text-emerald-600',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    placeholder: 'e.g. Unboxed for cashier counter customer flavor testing...',
    quickTags: ['Flavor Sampling Tester', 'Display Shelf Demo', 'Staff Demonstration']
  },
  {
    value: 'restock',
    label: 'Manual Restock / Inbound Unrecorded',
    description: 'Emergency stock received or unrecorded shipment intake',
    defaultType: 'add',
    icon: PackagePlus,
    colorClass: 'text-indigo-600',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    placeholder: 'e.g. Supplementary stock received directly from warehouse...',
    quickTags: ['Found Stock in Backroom', 'Unrecorded Stock Inflow', 'Delivery Surplus']
  },
  {
    value: 'other',
    label: 'Other / Custom Adjustment',
    description: 'Special operational adjustment or administrative calibration',
    defaultType: 'subtract',
    icon: SlidersHorizontal,
    colorClass: 'text-slate-600',
    badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
    placeholder: 'Describe the specific reason for stock adjustment...',
    quickTags: ['System Synchronization', 'Location Transfer Correction', 'Manager Override']
  }
];

export const StockAdjustmentForm: React.FC<StockAdjustmentFormProps> = ({ 
  isOpen, 
  onClose, 
  products, 
  locations, 
  initialProductId 
}) => {
  const { profile, user } = useAuth();
  const { register, handleSubmit, watch, setValue, reset, formState: { isSubmitting, errors } } = useForm<FormData>({
    defaultValues: {
      productId: initialProductId || '',
      locationId: '',
      reasonCategory: 'defective',
      type: 'subtract',
      quantity: 1,
      reason: ''
    }
  });

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const watchProductId = watch('productId');
  const watchLocationId = watch('locationId');
  const watchReasonCategory = watch('reasonCategory');
  const watchType = watch('type');
  const watchQuantity = watch('quantity');
  const watchReason = watch('reason');

  const selectedProduct = products.find(p => p.id === watchProductId);
  const currentStockAtLocation = selectedProduct?.stocks?.[watchLocationId] || 0;

  const currentCategoryConfig = useMemo(() => {
    return REASON_CATEGORIES.find(c => c.value === watchReasonCategory) || REASON_CATEGORIES[0];
  }, [watchReasonCategory]);

  // Sync search input when selectedProduct or initialProductId changes
  useEffect(() => {
    if (selectedProduct) {
      setProductSearchQuery(`${selectedProduct.name} (${selectedProduct.sku})`);
    } else if (!watchProductId) {
      setProductSearchQuery('');
    }
  }, [selectedProduct, watchProductId]);

  useEffect(() => {
    if (initialProductId) {
      setValue('productId', initialProductId);
    }
  }, [initialProductId, setValue]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsProductDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Filtered product suggestions based on user typed product name, SKU, flavor, or barcode
  const filteredProducts = useMemo(() => {
    const query = productSearchQuery.toLowerCase().trim();
    if (!query) return products.slice(0, 15);

    // If query matches the selected product string exactly, still show top products
    if (selectedProduct && `${selectedProduct.name} (${selectedProduct.sku})`.toLowerCase() === query) {
      return products.slice(0, 15);
    }

    return products.filter(p => 
      p.name.toLowerCase().includes(query) ||
      p.sku.toLowerCase().includes(query) ||
      (p.barcode && p.barcode.toLowerCase().includes(query)) ||
      (p.category && p.category.toLowerCase().includes(query)) ||
      (p.brand && p.brand.toLowerCase().includes(query))
    ).slice(0, 20);
  }, [products, productSearchQuery, selectedProduct]);

  const handleSelectProduct = (product: Product) => {
    setValue('productId', product.id);
    setProductSearchQuery(`${product.name} (${product.sku})`);
    setIsProductDropdownOpen(false);
  };

  const handleClearProduct = () => {
    setValue('productId', '');
    setProductSearchQuery('');
    setIsProductDropdownOpen(true);
  };

  // When reason category changes, auto-set appropriate operation type if user hasn't overridden
  const handleCategoryChange = (categoryValue: AdjustmentReasonCategory) => {
    setValue('reasonCategory', categoryValue);
    const config = REASON_CATEGORIES.find(c => c.value === categoryValue);
    if (config) {
      setValue('type', config.defaultType);
    }
  };

  const handleQuickTagClick = (tag: string) => {
    if (!watchReason?.trim()) {
      setValue('reason', tag);
    } else if (!watchReason.includes(tag)) {
      setValue('reason', `${watchReason.trim()}; ${tag}`);
    }
  };

  // Calculate live preview stock
  const calculatedNewStock = useMemo(() => {
    const qty = Number(watchQuantity) || 0;
    if (watchType === 'add') {
      return currentStockAtLocation + qty;
    } else if (watchType === 'subtract') {
      return currentStockAtLocation - qty;
    } else if (watchType === 'set') {
      return qty;
    }
    return currentStockAtLocation;
  }, [currentStockAtLocation, watchQuantity, watchType]);

  const adjustmentDifference = useMemo(() => {
    return calculatedNewStock - currentStockAtLocation;
  }, [calculatedNewStock, currentStockAtLocation]);

  const onSubmit = async (data: FormData) => {
    if (!profile || !user) return;
    if (!selectedProduct) {
      toast.error('Please select a product from the suggestion list');
      return;
    }

    const selectedLocation = locations.find(l => l.id === data.locationId);
    if (!selectedLocation) {
      toast.error('Please select a location');
      return;
    }

    const qty = Number(data.quantity);
    if (isNaN(qty) || qty < 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    if (data.type === 'subtract' && qty === 0) {
      toast.error('Quantity to deduct must be greater than 0');
      return;
    }

    let newStockAtLocation = currentStockAtLocation;
    let adjustmentAmount = 0;

    if (data.type === 'add') {
      adjustmentAmount = qty;
      newStockAtLocation += adjustmentAmount;
    } else if (data.type === 'subtract') {
      adjustmentAmount = -qty;
      newStockAtLocation += adjustmentAmount;
    } else if (data.type === 'set') {
      adjustmentAmount = qty - currentStockAtLocation;
      newStockAtLocation = qty;
    }

    if (newStockAtLocation < 0) {
      const confirmNegative = window.confirm(
        `Warning: This adjustment will result in negative stock (${newStockAtLocation} units) at ${selectedLocation.name}. Do you wish to proceed?`
      );
      if (!confirmNegative) return;
    }

    try {
      const toastId = toast.loading('Recording stock adjustment...');

      // Update Product in Firestore
      const productRef = doc(db, 'products', data.productId);
      const updateData: any = {
        stock: increment(adjustmentAmount),
        locationIds: arrayUnion(data.locationId),
        updatedAt: Timestamp.now()
      };

      if (data.type === 'set') {
        updateData[`stocks.${data.locationId}`] = newStockAtLocation;
      } else {
        updateData[`stocks.${data.locationId}`] = increment(adjustmentAmount);
      }

      await updateDoc(productRef, updateData);

      // Record Adjustment Log
      const fullReasonText = data.reason?.trim() 
        ? `[${currentCategoryConfig.label}] ${data.reason.trim()}`
        : currentCategoryConfig.label;

      const adjustment: Omit<StockAdjustment, 'id'> = {
        productId: data.productId,
        productName: selectedProduct.name,
        locationId: data.locationId,
        locationName: selectedLocation.name,
        previousStock: currentStockAtLocation,
        adjustmentQuantity: adjustmentAmount,
        newStock: newStockAtLocation,
        type: data.type,
        reasonCategory: data.reasonCategory,
        reason: fullReasonText,
        adjustedBy: user.uid,
        adjustedByName: profile.name || user.email || 'Unknown',
        timestamp: Timestamp.now()
      };

      await addDoc(collection(db, 'stockAdjustments'), adjustment);

      await logAction(
        profile, 
        'STOCK_ADJUSTMENT', 
        `Adjusted stock for ${selectedProduct.name} at ${selectedLocation.name} (${currentCategoryConfig.label}): ${data.type === 'subtract' ? '-' : data.type === 'add' ? '+' : '='}${qty} (Stock: ${currentStockAtLocation} -> ${newStockAtLocation})`,
        data.productId,
        'product'
      );

      toast.dismiss(toastId);
      toast.success(
        data.reasonCategory === 'defective' 
          ? `Defective stock adjusted (-${qty} units logged)` 
          : 'Stock adjusted successfully'
      );
      reset({
        productId: '',
        locationId: '',
        reasonCategory: 'defective',
        type: 'subtract',
        quantity: 1,
        reason: ''
      });
      setProductSearchQuery('');
      onClose();
    } catch (error) {
      toast.dismiss();
      handleFirestoreError(error, OperationType.UPDATE, 'products');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        id="stock-adjustment-modal"
        className="w-full max-w-[95vw] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl rounded-3xl p-6 sm:p-8 md:p-10 bg-white/98 backdrop-blur-xl border border-[#D4AF37]/30 shadow-2xl overflow-visible"
      >
        <DialogHeader className="pb-4 border-b border-slate-100/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] shadow-inner">
                <Flame className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <DialogTitle className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Stock Adjustment & Defect Logger
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Type to search SKU/name or calibrate inventory for defective items, audits, and write-offs.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pt-4">
          {/* Two-Column Wide Layout to fit everything comfortably without scrolling */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Typeahead Product Search, Location, Reason Category & Quick Chips (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              
              {/* Product & Location Selector (Side by side) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Typeahead Searchable Product Selection */}
                <div className="space-y-1.5 relative" ref={searchContainerRef}>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-700">Search Product (Name / SKU) *</Label>
                    {selectedProduct && (
                      <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Selected
                      </span>
                    )}
                  </div>
                  
                  <div className="flex gap-1.5 relative">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        type="text"
                        value={productSearchQuery}
                        onChange={(e) => {
                          setProductSearchQuery(e.target.value);
                          setIsProductDropdownOpen(true);
                          if (selectedProduct && e.target.value !== `${selectedProduct.name} (${selectedProduct.sku})`) {
                            setValue('productId', '');
                          }
                        }}
                        onFocus={() => setIsProductDropdownOpen(true)}
                        placeholder="Type name, SKU, or barcode..."
                        className="pl-9 pr-8 h-10.5 bg-slate-50/90 border-slate-200 text-xs sm:text-sm rounded-xl focus:bg-white transition-all font-medium"
                      />
                      {productSearchQuery && (
                        <button
                          type="button"
                          onClick={handleClearProduct}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200/50 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10.5 w-10.5 border-[#D4AF37] hover:bg-[#D4AF37]/10 rounded-xl flex-shrink-0 cursor-pointer"
                      onClick={() => setIsScannerOpen(true)}
                      title="Scan Product Barcode"
                    >
                      <Scan className="w-4.5 h-4.5 text-[#D4AF37]" />
                    </Button>
                  </div>

                  {/* Autocomplete / Suggested Product Dropdown */}
                  {isProductDropdownOpen && (
                    <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-2xl max-h-64 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
                      {filteredProducts.length > 0 ? (
                        filteredProducts.map((p) => {
                          const isSelected = p.id === watchProductId;
                          const totalStock = Object.values(p.stocks || {}).reduce((a, b) => a + b, 0);
                          return (
                            <div
                              key={p.id}
                              onClick={() => handleSelectProduct(p)}
                              className={`p-3 text-xs sm:text-sm hover:bg-amber-50/60 cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                                isSelected ? 'bg-amber-50/80 border-l-4 border-[#D4AF37]' : ''
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-slate-900 truncate flex items-center gap-1.5">
                                  {p.name}
                                  {isSelected && <Check className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                                  <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-bold">{p.sku}</span>
                                  {p.brand && <span>Flavor: {p.brand}</span>}
                                  {p.category && <span>• {p.category}</span>}
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-xs font-bold text-slate-800">
                                  {watchLocationId ? (p.stocks?.[watchLocationId] ?? 0) : totalStock} in stock
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {watchLocationId ? 'at selected location' : 'total across branches'}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-4 text-center text-xs text-slate-500">
                          <Package className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                          No products found matching "<span className="font-bold text-slate-700">{productSearchQuery}</span>"
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Location Selection */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Target Branch / Location *</Label>
                  <Select 
                    value={watchLocationId} 
                    onValueChange={(val) => setValue('locationId', val)}
                  >
                    <SelectTrigger className="h-10.5 bg-slate-50/70 border-slate-200 text-xs sm:text-sm rounded-xl">
                      <SelectValue placeholder="Select location">
                        {locations.find(l => l.id === watchLocationId)?.name || 'Select branch location'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map(l => (
                        <SelectItem key={l.id} value={l.id} className="text-xs sm:text-sm py-2">{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Reason Category Selection (Includes Damaged / Defective) */}
              <div className="space-y-2 bg-slate-50/90 p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <currentCategoryConfig.icon className={`w-4 h-4 ${currentCategoryConfig.colorClass}`} />
                    Adjustment Reason / Category *
                  </Label>
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${currentCategoryConfig.badgeClass}`}>
                    {currentCategoryConfig.label}
                  </span>
                </div>
                
                <Select 
                  value={watchReasonCategory} 
                  onValueChange={(val: AdjustmentReasonCategory) => handleCategoryChange(val)}
                >
                  <SelectTrigger className="h-11 bg-white border-slate-200 text-xs sm:text-sm font-medium rounded-xl">
                    <SelectValue placeholder="Select adjustment reason">
                      <div className="flex items-center gap-2">
                        <currentCategoryConfig.icon className={`w-4 h-4 ${currentCategoryConfig.colorClass}`} />
                        <span className="font-semibold text-slate-900">{currentCategoryConfig.label}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {REASON_CATEGORIES.map(cat => {
                      const Icon = cat.icon;
                      return (
                        <SelectItem key={cat.value} value={cat.value} className="py-2.5">
                          <div className="flex items-start gap-2.5">
                            <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cat.colorClass}`} />
                            <div>
                              <div className="font-semibold text-slate-900 text-xs sm:text-sm">{cat.label}</div>
                              <div className="text-[11px] text-slate-500">{cat.description}</div>
                            </div>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                {/* Quick Reason / Defect Presets */}
                {currentCategoryConfig.quickTags.length > 0 && (
                  <div className="pt-2">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Quick Defect / Note Presets:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {currentCategoryConfig.quickTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleQuickTagClick(tag)}
                          className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:border-[#D4AF37] hover:text-[#1A2B4B] hover:bg-amber-50/50 transition-all shadow-2xs cursor-pointer"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Custom Specific Note */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Defect Description / Audit Reference (Optional)
                </Label>
                <Input 
                  {...register('reason')} 
                  placeholder={currentCategoryConfig.placeholder}
                  className="h-10.5 text-xs sm:text-sm bg-slate-50/70 border-slate-200 rounded-xl"
                />
              </div>

            </div>

            {/* Right Column: Adjustment Action, Quantity, & Real-Time Stock Preview Card (5 cols) */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
              
              <div className="space-y-4">
                {/* Adjustment Action & Quantity Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3.5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Action Type *</Label>
                    <Select 
                      value={watchType} 
                      onValueChange={(val: any) => setValue('type', val)}
                    >
                      <SelectTrigger className="h-10.5 bg-slate-50/70 border-slate-200 text-xs sm:text-sm font-medium rounded-xl">
                        <SelectValue>
                          {watchType === 'subtract' ? 'Subtract (-) Deduct Stock' : 
                           watchType === 'add' ? 'Add (+) Increase Stock' : 
                           watchType === 'set' ? 'Set To (=) Override Count' : watchType}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="subtract" className="text-xs sm:text-sm py-2">
                          <div className="flex items-center gap-2 text-rose-600 font-semibold">
                            <PackageMinus className="w-4 h-4" />
                            Subtract (-) Deduct Stock
                          </div>
                        </SelectItem>
                        <SelectItem value="add" className="text-xs sm:text-sm py-2">
                          <div className="flex items-center gap-2 text-emerald-600 font-semibold">
                            <PackagePlus className="w-4 h-4" />
                            Add (+) Increase Stock
                          </div>
                        </SelectItem>
                        <SelectItem value="set" className="text-xs sm:text-sm py-2">
                          <div className="flex items-center gap-2 text-blue-600 font-semibold">
                            <SlidersHorizontal className="w-4 h-4" />
                            Set To (=) Exact Override
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">
                      {watchType === 'set' ? 'New Target Stock Count *' : 'Quantity to Adjust *'}
                    </Label>
                    <Input 
                      type="number" 
                      {...register('quantity', { 
                        required: 'Quantity is required', 
                        min: { value: 0, message: 'Quantity must be at least 0' },
                        valueAsNumber: true
                      })} 
                      placeholder="1"
                      min="0"
                      className="h-10.5 text-base font-bold bg-slate-50/70 border-slate-200 rounded-xl"
                    />
                    {errors.quantity && <p className="text-xs text-rose-500">{errors.quantity.message}</p>}
                  </div>
                </div>

                {/* Stock Calibration Preview Card */}
                <div className="bg-gradient-to-br from-slate-900 via-[#1A2B4B] to-slate-950 text-white p-4.5 rounded-2xl border border-slate-800 shadow-lg">
                  <div className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-3 flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      Real-Time Stock Calibration
                    </span>
                    <span className="font-mono text-slate-300 text-[11px] truncate max-w-[140px]">
                      {selectedProduct ? selectedProduct.sku : 'No Product'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center items-center divide-x divide-white/10 py-1">
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">Current</div>
                      <div className="text-xl font-bold text-white mt-0.5">
                        {watchProductId && watchLocationId ? currentStockAtLocation : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">Adjustment</div>
                      <div className={`text-xl font-bold mt-0.5 font-mono ${
                        adjustmentDifference < 0 ? 'text-rose-400' : adjustmentDifference > 0 ? 'text-emerald-400' : 'text-slate-300'
                      }`}>
                        {watchProductId && watchLocationId ? (adjustmentDifference > 0 ? `+${adjustmentDifference}` : adjustmentDifference) : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">New Total</div>
                      <div className={`text-xl font-extrabold mt-0.5 ${
                        calculatedNewStock < 0 ? 'text-rose-400 animate-pulse' : calculatedNewStock === 0 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {watchProductId && watchLocationId ? calculatedNewStock : '—'}
                      </div>
                    </div>
                  </div>

                  {watchProductId && watchLocationId && calculatedNewStock < 0 && (
                    <div className="mt-3 pt-2.5 border-t border-white/10 text-[11px] text-rose-300 flex items-center gap-1.5 justify-center bg-rose-500/10 rounded-lg py-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      Warning: Adjustment will result in negative branch inventory!
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onClose} 
                  className="rounded-xl px-5 h-11 border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer font-semibold"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="bg-gradient-to-r from-amber-600 to-[#1A2B4B] hover:from-amber-700 hover:to-[#0F1A2E] text-white font-bold rounded-xl shadow-md h-11 px-6 gap-2 cursor-pointer transition-all"
                >
                  {isSubmitting ? 'Recording Adjustment...' : (
                    <>
                      <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
                      Confirm Stock Adjustment
                    </>
                  )}
                </Button>
              </div>

            </div>

          </div>
        </form>

        <BarcodeScanner 
          isOpen={isScannerOpen} 
          onClose={() => setIsScannerOpen(false)} 
          onScan={(scanned) => {
            const matched = products.find(p => 
              p.barcode?.toLowerCase() === scanned.toLowerCase() ||
              p.sku?.toLowerCase() === scanned.toLowerCase()
            );
            if (matched) {
              handleSelectProduct(matched);
              toast.success(`Matched: ${matched.name}`);
            } else {
              toast.error(`No product found matching barcode "${scanned}"`);
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
};
