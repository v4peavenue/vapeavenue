import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
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
  ArrowRight, 
  Plus, 
  Trash2, 
  ArrowRightLeft, 
  AlertCircle, 
  CheckCircle2, 
  Boxes, 
  Building2,
  PackageCheck
} from 'lucide-react';
import { BarcodeScanner } from './BarcodeScanner';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Product, Location, StockTransferItem } from '@/types';
import { db } from '@/lib/firebase';
import { doc, updateDoc, collection, addDoc, Timestamp, arrayUnion, increment } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { logAction } from '@/lib/audit';
import { toast } from 'sonner';
import { OperationType, handleFirestoreError } from '@/lib/firestore-utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface StockTransferFormProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  locations: Location[];
}

interface TransferItemFormInput {
  productId: string;
  quantity: number;
}

interface TransferFormData {
  transferNumber: string;
  fromLocationId: string;
  toLocationId: string;
  reason: string;
  items: TransferItemFormInput[];
}

export const StockTransferForm: React.FC<StockTransferFormProps> = ({ 
  isOpen, 
  onClose, 
  products, 
  locations 
}) => {
  const { profile, user } = useAuth();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeScanningIndex, setActiveScanningIndex] = useState<number | null>(null);

  const { 
    register, 
    handleSubmit, 
    watch, 
    setValue, 
    reset, 
    control,
    formState: { isSubmitting } 
  } = useForm<TransferFormData>({
    defaultValues: {
      transferNumber: `TR-${Date.now().toString().slice(-6)}`,
      fromLocationId: '',
      toLocationId: '',
      reason: '',
      items: [{ productId: '', quantity: 1 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items"
  });

  const watchFromLocationId = watch('fromLocationId');
  const watchToLocationId = watch('toLocationId');
  const watchItems = watch('items') || [];
  const watchReason = watch('reason');

  // Reset form with new transfer number when opening
  useEffect(() => {
    if (isOpen) {
      reset({
        transferNumber: `TR-${Date.now().toString().slice(-6)}`,
        fromLocationId: locations[0]?.id || '',
        toLocationId: locations[1]?.id || '',
        reason: '',
        items: [{ productId: '', quantity: 1 }]
      });
    }
  }, [isOpen, locations, reset]);

  const fromLocation = locations.find(l => l.id === watchFromLocationId);
  const toLocation = locations.find(l => l.id === watchToLocationId);

  // Compute total units to transfer
  const totalUnits = watchItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const validItemsCount = watchItems.filter(item => Boolean(item.productId)).length;

  // Helper to get source and destination stock for a specific product
  const getProductStock = (productId: string, locationId?: string) => {
    if (!productId || !locationId) return 0;
    const prod = products.find(p => p.id === productId);
    return Number(prod?.stocks?.[locationId] || 0);
  };

  // Add low-stock products at destination location automatically
  const handleAutoAddLowStock = () => {
    if (!watchToLocationId || !watchFromLocationId) {
      toast.error('Please select both source and destination branches first');
      return;
    }

    const lowStockProducts = products.filter(p => {
      const destStock = Number(p.stocks?.[watchToLocationId] || 0);
      const sourceStock = Number(p.stocks?.[watchFromLocationId] || 0);
      const threshold = p.locationThresholds?.[watchToLocationId] ?? p.lowStockThreshold ?? 5;
      return destStock <= threshold && sourceStock > 0;
    });

    if (lowStockProducts.length === 0) {
      toast.info('No low-stock items detected at the destination branch that are available in source');
      return;
    }

    // Filter out already added products
    const existingProductIds = new Set(watchItems.map(i => i.productId).filter(Boolean));
    const itemsToAdd = lowStockProducts.filter(p => !existingProductIds.has(p.id));

    if (itemsToAdd.length === 0) {
      toast.info('All qualifying low-stock items are already added in the transfer list');
      return;
    }

    itemsToAdd.forEach(p => {
      const sourceStock = Number(p.stocks?.[watchFromLocationId] || 0);
      const suggestedQty = Math.min(Math.max(1, (p.lowStockThreshold || 5) * 2), sourceStock);
      append({ productId: p.id, quantity: suggestedQty });
    });

    toast.success(`Added ${itemsToAdd.length} low-stock item(s) to transfer queue`);
  };

  const onSubmit = async (data: TransferFormData) => {
    if (!profile || !user) return;

    if (!data.fromLocationId || !data.toLocationId) {
      toast.error('Please specify both source and destination branches');
      return;
    }

    if (data.fromLocationId === data.toLocationId) {
      toast.error('Source and destination branches must be different');
      return;
    }

    if (data.items.length === 0 || data.items.some(i => !i.productId)) {
      toast.error('Please select valid products for all transfer items');
      return;
    }

    // Check for duplicate products in list
    const productIds = data.items.map(i => i.productId);
    const hasDuplicates = new Set(productIds).size !== productIds.length;
    if (hasDuplicates) {
      toast.error('Duplicate products detected in transfer list. Please consolidate quantities into a single item line.');
      return;
    }

    // Validate quantities and stock availability at source
    for (const item of data.items) {
      const prod = products.find(p => p.id === item.productId);
      const sourceStock = Number(prod?.stocks?.[data.fromLocationId] || 0);
      const qty = Number(item.quantity) || 0;

      if (qty <= 0) {
        toast.error(`Transfer quantity for "${prod?.name || 'Item'}" must be at least 1 unit.`);
        return;
      }

      if (sourceStock < qty) {
        toast.error(`Insufficient stock for "${prod?.name || 'Item'}" at ${fromLocation?.name || 'source'}. Available: ${sourceStock}, Requested: ${qty}`);
        return;
      }
    }

    const toastId = toast.loading('Executing multi-item stock transfer...');

    try {
      // 1. Prepare items payload
      const transferItems: StockTransferItem[] = data.items.map(item => {
        const prod = products.find(p => p.id === item.productId)!;
        const sourceStock = Number(prod.stocks?.[data.fromLocationId] || 0);
        const destStock = Number(prod.stocks?.[data.toLocationId] || 0);
        return {
          productId: item.productId,
          productName: prod.name,
          productSku: prod.sku,
          quantity: Number(item.quantity),
          sourceStock,
          destStock
        };
      });

      // 2. Atomically update all products in Firestore
      await Promise.all(
        data.items.map(item => {
          const productRef = doc(db, 'products', item.productId);
          const qty = Number(item.quantity);
          return updateDoc(productRef, {
            [`stocks.${data.fromLocationId}`]: increment(-qty),
            [`stocks.${data.toLocationId}`]: increment(qty),
            locationIds: arrayUnion(data.toLocationId),
            updatedAt: Timestamp.now()
          });
        })
      );

      // 3. Record transfer record in stockTransfers collection
      const transferRecord = {
        transferNumber: data.transferNumber || `TR-${Date.now().toString().slice(-6)}`,
        fromLocationId: data.fromLocationId,
        fromLocationName: fromLocation?.name || 'Unknown',
        toLocationId: data.toLocationId,
        toLocationName: toLocation?.name || 'Unknown',
        items: transferItems,
        totalUnits,
        reason: data.reason || 'Branch stock replenishment',
        transferredBy: user.uid,
        transferredByName: profile.name || user.email || 'Unknown',
        timestamp: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, 'stockTransfers'), transferRecord);

      // 4. Log audit trail
      await logAction(
        profile, 
        'STOCK_TRANSFER', 
        `Transferred ${totalUnits} units (${transferItems.length} products) from ${fromLocation?.name} to ${toLocation?.name} [${transferRecord.transferNumber}]`,
        docRef.id,
        'stockTransfer'
      );

      toast.dismiss(toastId);
      toast.success(`Successfully transferred ${totalUnits} unit(s) across ${transferItems.length} product(s)!`);
      reset();
      onClose();
    } catch (error) {
      toast.dismiss(toastId);
      handleFirestoreError(error, OperationType.UPDATE, 'products');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl lg:max-w-5xl w-full max-h-[90vh] flex flex-col rounded-3xl p-6 sm:p-8 bg-white/95 backdrop-blur-md border-[#D4AF37]/20 shadow-2xl overflow-hidden">
        {/* Header */}
        <DialogHeader className="pb-2 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Branch Stock Transfer
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-slate-500">
                  Transfer multiple inventory items between branches with real-time stock verification.
                </DialogDescription>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs text-indigo-700 bg-indigo-50 border-indigo-200">
                {watch('transferNumber')}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden pt-4">
          <div className="flex-1 overflow-y-auto space-y-6 pr-1 pb-4">
            
            {/* Top Branch Routing Controls */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80">
              {/* From Branch */}
              <div className="md:col-span-4 space-y-1.5">
                <Label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-rose-500" />
                  From Branch (Source)
                </Label>
                <Select 
                  value={watchFromLocationId} 
                  onValueChange={(val) => setValue('fromLocationId', val)}
                >
                  <SelectTrigger className="bg-white rounded-xl border-slate-200 shadow-2xs font-medium">
                    <SelectValue placeholder="Select origin branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(l => (
                      <SelectItem key={l.id} value={l.id} disabled={l.id === watchToLocationId}>
                        {l.name} {l.isWarehouse ? '(Warehouse)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Transfer Arrow Indicator */}
              <div className="hidden md:flex md:col-span-1 items-center justify-center pt-5">
                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-2xs">
                  <ArrowRight className="w-4 h-4 text-indigo-600" />
                </div>
              </div>

              {/* To Branch */}
              <div className="md:col-span-4 space-y-1.5">
                <Label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                  To Branch (Destination)
                </Label>
                <Select 
                  value={watchToLocationId} 
                  onValueChange={(val) => setValue('toLocationId', val)}
                >
                  <SelectTrigger className="bg-white rounded-xl border-slate-200 shadow-2xs font-medium">
                    <SelectValue placeholder="Select destination branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(l => (
                      <SelectItem key={l.id} value={l.id} disabled={l.id === watchFromLocationId}>
                        {l.name} {l.isWarehouse ? '(Warehouse)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reason / Reference */}
              <div className="md:col-span-3 space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">Transfer Reason / Notes</Label>
                <Input 
                  {...register('reason')} 
                  placeholder="e.g. Branch replenishment"
                  className="bg-white rounded-xl border-slate-200 shadow-2xs text-xs sm:text-sm"
                />
              </div>
            </div>

            {/* Same Location Alert */}
            {watchFromLocationId && watchToLocationId && watchFromLocationId === watchToLocationId && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Source and destination branches cannot be the same. Please select different branches.</span>
              </div>
            )}

            {/* Transfer Items Table Section */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-indigo-600" />
                  <Label className="text-sm font-bold text-slate-800">Transfer Items List</Label>
                  <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5">
                    {validItemsCount} of {fields.length} {fields.length === 1 ? 'item' : 'items'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={handleAutoAddLowStock}
                    className="text-xs h-8 border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg gap-1.5"
                    title="Automatically find items below threshold at destination branch"
                  >
                    <PackageCheck className="w-3.5 h-3.5 text-amber-500" />
                    Add Low Stock Items
                  </Button>
                  <Button 
                    type="button" 
                    variant="default" 
                    size="sm" 
                    onClick={() => append({ productId: '', quantity: 1 })}
                    className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Item
                  </Button>
                </div>
              </div>

              {/* Items List Rows */}
              <div className="space-y-2.5">
                {fields.map((field, index) => {
                  const currentProductId = watchItems[index]?.productId;
                  const currentQty = Number(watchItems[index]?.quantity) || 0;
                  const selectedProd = products.find(p => p.id === currentProductId);
                  const sourceStock = getProductStock(currentProductId, watchFromLocationId);
                  const destStock = getProductStock(currentProductId, watchToLocationId);
                  const isExceeding = currentQty > sourceStock;
                  const isOutOfStock = currentProductId && sourceStock <= 0;

                  return (
                    <div 
                      key={field.id} 
                      className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center gap-3 transition-all hover:border-slate-300"
                    >
                      {/* Item Index */}
                      <span className="hidden md:flex w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold items-center justify-center shrink-0">
                        {index + 1}
                      </span>

                      {/* Product Selector */}
                      <div className="flex-1 space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-slate-400">Product</Label>
                        <div className="flex gap-1.5">
                          <Select 
                            value={currentProductId || ''} 
                            onValueChange={(val: string) => {
                              setValue(`items.${index}.productId` as any, val);
                              const prod = products.find(p => p.id === val);
                              const stock = Number(prod?.stocks?.[watchFromLocationId] || 0);
                              if (stock > 0 && currentQty === 0) {
                                setValue(`items.${index}.quantity` as any, 1);
                              }
                            }}
                          >
                            <SelectTrigger className="bg-slate-50/50 border-slate-200 h-9 rounded-xl text-xs sm:text-sm font-medium">
                              <SelectValue placeholder="Select product to transfer">
                                {selectedProd ? `${selectedProd.name} (${selectedProd.sku})` : 'Select product'}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              {products.map(p => {
                                const pStock = Number(p.stocks?.[watchFromLocationId] || 0);
                                return (
                                  <SelectItem key={p.id} value={p.id}>
                                    <div className="flex items-center justify-between gap-4 w-full">
                                      <span>{p.name} <span className="text-slate-400 font-mono text-xs">({p.sku})</span></span>
                                      <span className={pStock > 0 ? "text-emerald-600 font-bold text-xs" : "text-rose-500 font-bold text-xs"}>
                                        {pStock} in source
                                      </span>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>

                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 border-slate-200 hover:bg-slate-50 rounded-xl shrink-0"
                            onClick={() => {
                              setActiveScanningIndex(index);
                              setIsScannerOpen(true);
                            }}
                            title="Scan Barcode for this item"
                          >
                            <Scan className="w-4 h-4 text-indigo-600" />
                          </Button>
                        </div>
                      </div>

                      {/* Stock Indicators */}
                      <div className="grid grid-cols-2 gap-2 md:w-56 shrink-0 bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                        <div className="text-center">
                          <span className="block text-[9px] uppercase font-bold text-slate-400">Available</span>
                          <span className={isOutOfStock ? "text-rose-600 font-black text-xs" : "text-slate-800 font-black text-xs"}>
                            {watchFromLocationId ? sourceStock : '-'}
                          </span>
                        </div>
                        <div className="text-center border-l border-slate-200">
                          <span className="block text-[9px] uppercase font-bold text-slate-400">At Dest</span>
                          <span className="text-slate-700 font-bold text-xs">
                            {watchToLocationId ? destStock : '-'}
                          </span>
                        </div>
                      </div>

                      {/* Transfer Quantity */}
                      <div className="w-full md:w-32 space-y-1 shrink-0">
                        <Label className="text-[10px] uppercase font-bold text-slate-400">Transfer Qty</Label>
                        <Input 
                          type="number" 
                          min={1}
                          max={sourceStock > 0 ? sourceStock : undefined}
                          className={`h-9 bg-slate-50/50 rounded-xl text-xs sm:text-sm font-bold text-center ${
                            isExceeding ? 'border-rose-400 bg-rose-50/50 text-rose-700' : 'border-slate-200'
                          }`}
                          {...register(`items.${index}.quantity` as const, { 
                            required: true, 
                            min: 1, 
                            valueAsNumber: true 
                          })}
                        />
                      </div>

                      {/* Delete Action Button */}
                      <div className="flex md:items-end justify-end shrink-0 md:pt-4">
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl"
                          onClick={() => {
                            if (fields.length === 1) {
                              setValue(`items.0.productId` as any, '');
                              setValue(`items.0.quantity` as any, 1);
                            } else {
                              remove(index);
                            }
                          }}
                          title="Remove item from transfer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Bottom Summary Bar */}
          <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-auto">
            <div className="flex items-center gap-4 text-xs font-semibold text-indigo-900">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span><strong>{validItemsCount}</strong> Product Line{validItemsCount !== 1 ? 's' : ''}</span>
              </div>
              <div className="h-4 w-px bg-indigo-200" />
              <div>
                <span>Total Units to Move: <strong className="text-sm font-black text-indigo-700">{totalUnits}</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose} 
                className="rounded-xl h-9 text-xs sm:text-sm border-slate-200"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting || validItemsCount === 0 || totalUnits <= 0} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-9 px-5 text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20"
              >
                {isSubmitting ? 'Transferring...' : `Execute Transfer (${totalUnits} Units)`}
              </Button>
            </div>
          </div>
        </form>

        {/* Barcode Scanner Modal */}
        <BarcodeScanner 
          isOpen={isScannerOpen} 
          onClose={() => {
            setIsScannerOpen(false);
            setActiveScanningIndex(null);
          }} 
          onScan={(scanned) => {
            const matched = products.find(p => 
              p.barcode?.toLowerCase() === scanned.toLowerCase() ||
              p.sku?.toLowerCase() === scanned.toLowerCase()
            );

            if (matched) {
              if (activeScanningIndex !== null && activeScanningIndex < fields.length) {
                // Assign to active line
                setValue(`items.${activeScanningIndex}.productId` as any, matched.id);
                toast.success(`Matched: ${matched.name}`);
              } else {
                // Check if already in list -> increment qty, else append
                const existingIndex = watchItems.findIndex(i => i.productId === matched.id);
                if (existingIndex >= 0) {
                  const currentQty = Number(watchItems[existingIndex].quantity) || 1;
                  setValue(`items.${existingIndex}.quantity` as any, currentQty + 1);
                  toast.success(`Incremented quantity for ${matched.name}`);
                } else {
                  append({ productId: matched.id, quantity: 1 });
                  toast.success(`Added ${matched.name} to transfer list`);
                }
              }
            } else {
              toast.error(`No product matches barcode: "${scanned}"`);
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
};
