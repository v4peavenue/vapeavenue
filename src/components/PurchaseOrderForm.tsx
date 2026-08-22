import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Product, Location, Supplier, PaymentOption } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { db } from '@/lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { OperationType, handleFirestoreError } from '@/lib/firestore-utils';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { logAction } from '@/lib/audit';
import { cn } from '@/lib/utils';
import { 
  Plus, 
  Trash2, 
  ShoppingBag, 
  X, 
  Building2, 
  MapPin, 
  CreditCard, 
  Receipt, 
  Layers, 
  Search, 
  Check, 
  Package 
} from 'lucide-react';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { SearchableProductSelect } from './SearchableProductSelect';

interface PurchaseOrderFormProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  locations: Location[];
  suppliers: Supplier[];
  paymentOptions: PaymentOption[];
}

interface POFormData {
  poNumber: string;
  supplierId: string;
  locationId: string;
  paymentAccountId: string;
  paymentMethod: string;
  paymentCategory: 'Cash' | 'Digital' | 'Card';
  paymentReference: string;
  isSplitPayment: boolean;
  paymentSplits: {
    methodId: string;
    methodName: string;
    amount: number;
    reference?: string;
  }[];
  notes: string;
  items: {
    productId: string;
    quantity: number;
    cost: number;
  }[];
}

export const PurchaseOrderForm: React.FC<PurchaseOrderFormProps> = ({ 
  isOpen, 
  onClose,
  products,
  locations,
  suppliers,
  paymentOptions
}) => {
  const { profile, isAdmin } = useAuth();
  const { settings } = useSettings();
  const [loading, setLoading] = useState(false);
  
  const { register, handleSubmit, reset, control, watch, setValue } = useForm<POFormData>({
    defaultValues: {
      poNumber: `PO-${Date.now().toString().slice(-6)}`,
      supplierId: '',
      locationId: '',
      paymentAccountId: '',
      paymentMethod: 'cash',
      paymentCategory: 'Cash',
      paymentReference: '',
      isSplitPayment: false,
      paymentSplits: [],
      notes: '',
      items: [{ productId: '', quantity: 1, cost: 0 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items"
  });

  const { fields: splitFields, append: appendSplit, remove: removeSplit } = useFieldArray({
    control,
    name: "paymentSplits"
  });

  const watchSupplierId = watch('supplierId');
  const watchLocationId = watch('locationId');
  const watchAccountId = watch('paymentAccountId');
  const watchItems = watch('items') || [];
  const watchSplits = watch('paymentSplits') || [];
  const isSplitPayment = watch('isSplitPayment');

  const totalAmount = watchItems.reduce((sum, item) => sum + (Number(item?.quantity || 0) * Number(item?.cost || 0)), 0);
  const totalUnits = watchItems.reduce((sum, item) => sum + Number(item?.quantity || 0), 0);
  const totalSplitAmount = watchSplits.reduce((sum, split) => sum + Number(split?.amount || 0), 0);
  const validItemsCount = watchItems.filter(item => Boolean(item?.productId)).length;

  useEffect(() => {
    if (isOpen) {
      reset({
        poNumber: `PO-${Date.now().toString().slice(-6)}`,
        supplierId: suppliers[0]?.id || '',
        locationId: locations[0]?.id || '',
        paymentAccountId: paymentOptions[0]?.id || '',
        paymentMethod: paymentOptions[0]?.type || 'cash',
        paymentCategory: paymentOptions[0]?.type === 'card' ? 'Card' : paymentOptions[0]?.type === 'cash' ? 'Cash' : 'Digital',
        paymentReference: '',
        isSplitPayment: false,
        paymentSplits: [],
        notes: '',
        items: [{ productId: '', quantity: 1, cost: 0 }]
      });
    }
  }, [isOpen, suppliers, locations, paymentOptions, reset]);

  useEffect(() => {
    if (watchAccountId) {
      const account = paymentOptions.find(opt => opt.id === watchAccountId);
      if (account) {
        setValue('paymentMethod', account.type);
        if (account.type === 'cash') setValue('paymentCategory', 'Cash');
        else if (account.type === 'card') setValue('paymentCategory', 'Card');
        else setValue('paymentCategory', 'Digital');
      }
    }
  }, [watchAccountId, paymentOptions, setValue]);

  const onSubmit = async (data: POFormData) => {
    if (data.items.length === 0 || data.items.some(i => !i.productId)) {
      toast.error('Each line item must have a product selected');
      return;
    }

    if (data.isSplitPayment) {
      if (Math.abs(totalSplitAmount - totalAmount) > 0.01) {
        toast.error(`Split amounts (${settings.currency}${totalSplitAmount.toFixed(2)}) must equal total (${settings.currency}${totalAmount.toFixed(2)})`);
        return;
      }
    }

    setLoading(true);
    try {
      const supplier = suppliers.find(s => s.id === data.supplierId);
      
      const poData = {
        poNumber: data.poNumber,
        supplierId: data.supplierId,
        supplierName: supplier?.name || 'Unknown',
        locationId: data.locationId,
        paymentAccountId: data.isSplitPayment ? null : data.paymentAccountId,
        paymentMethod: data.isSplitPayment ? 'split' : data.paymentMethod,
        paymentCategory: data.paymentCategory,
        paymentReference: data.paymentReference,
        isSplitPayment: data.isSplitPayment,
        paymentSplits: data.isSplitPayment ? data.paymentSplits : null,
        notes: data.notes,
        status: 'ordered' as const,
        totalAmount,
        items: data.items.map((item: any) => {
          const product = products.find(p => p.id === item.productId);
          return {
            productId: item.productId,
            name: product?.name || 'Unknown',
            sku: product?.sku || 'N/A',
            quantity: Number(item.quantity),
            cost: Number(item.cost),
            receivedQuantity: 0
          };
        }),
        createdBy: profile?.id || 'Unknown',
        orderedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, 'purchaseOrders'), poData);
      await logAction(profile, 'CREATE_PO', `Created Purchase Order: ${poData.poNumber} (${poData.items.length} items, Total: ${settings.currency}${totalAmount.toFixed(2)})`, docRef.id, 'purchaseOrder');
      
      toast.success('Purchase order created and items successfully ordered');
      reset();
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'purchaseOrders');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl lg:max-w-5xl w-full max-h-[90vh] flex flex-col rounded-3xl p-6 sm:p-8 bg-white/95 backdrop-blur-md border-[#D4AF37]/20 shadow-2xl overflow-hidden">
        {/* Header */}
        <DialogHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Create Purchase Order
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-slate-500">
                  Generate supplier purchase orders, schedule inbound shipments, and allocate payment accounts.
                </DialogDescription>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs text-indigo-700 bg-indigo-50 border-indigo-200">
                {watch('poNumber')}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden pt-4">
          <div className="flex-1 overflow-y-auto space-y-6 pr-1 pb-4">
            
            {/* Top Order Information Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80">
              {/* PO Number */}
              <div className="space-y-1.5">
                <Label htmlFor="poNumber" className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-indigo-500" />
                  PO Number
                </Label>
                <Input 
                  id="poNumber" 
                  {...register('poNumber', { required: true })} 
                  className="bg-white rounded-xl border-slate-200 shadow-2xs font-mono text-xs sm:text-sm"
                />
              </div>

              {/* Supplier */}
              <div className="space-y-1.5">
                <Label htmlFor="supplierId" className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-500" />
                  Supplier / Vendor
                </Label>
                <Select 
                  required 
                  value={watchSupplierId} 
                  onValueChange={(val: string) => setValue('supplierId', val)}
                >
                  <SelectTrigger id="supplierId" className="bg-white rounded-xl border-slate-200 shadow-2xs font-medium">
                    <SelectValue placeholder="Select supplier">
                      {suppliers.find(s => s.id === watchSupplierId)?.name || 'Select supplier'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Destination Location */}
              <div className="space-y-1.5">
                <Label htmlFor="locationId" className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                  Receiving Branch / Warehouse
                </Label>
                <Select 
                  required 
                  value={watchLocationId} 
                  onValueChange={(val: string) => setValue('locationId', val)}
                >
                  <SelectTrigger id="locationId" className="bg-white rounded-xl border-slate-200 shadow-2xs font-medium">
                    <SelectValue placeholder="Select destination branch">
                      {locations.find(l => l.id === watchLocationId)?.name || 'Select branch'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name} {l.isWarehouse ? '(Warehouse)' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Payment & Settlement Section */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  <Label className="text-sm font-bold text-slate-800">Payment & Settlement Method</Label>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-500">Split across multiple accounts?</span>
                  <Switch 
                    checked={isSplitPayment}
                    onCheckedChange={(checked) => {
                      setValue('isSplitPayment', checked);
                      if (checked && splitFields.length === 0) {
                        appendSplit({ methodId: paymentOptions[0]?.id || 'cash', methodName: paymentOptions[0]?.name || 'Cash', amount: totalAmount });
                      }
                    }}
                  />
                </div>
              </div>

              {!isSplitPayment ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="paymentAccountId" className="text-xs font-bold text-slate-600">Disbursing Account</Label>
                    <Select 
                      required={!isSplitPayment} 
                      value={watchAccountId} 
                      onValueChange={(val: string) => setValue('paymentAccountId', val)}
                    >
                      <SelectTrigger id="paymentAccountId" className="bg-slate-50/50 rounded-xl border-slate-200">
                        <SelectValue placeholder="Select account">
                          {paymentOptions.find(opt => opt.id === watchAccountId)?.name || 'Select account'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {paymentOptions.map(opt => (
                          <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="paymentMethod" className="text-xs font-bold text-slate-600">Settlement Type</Label>
                    <Select 
                      value={watch('paymentMethod')} 
                      onValueChange={(val: string) => setValue('paymentMethod', val)}
                    >
                      <SelectTrigger className="bg-slate-50/50 rounded-xl border-slate-200">
                        <SelectValue placeholder="Select method">
                          {watch('paymentMethod') ? (
                            watch('paymentMethod') === 'cash' ? 'Cash' :
                            watch('paymentMethod') === 'card' ? 'Card' :
                            watch('paymentMethod') === 'bank' ? 'Bank Transfer' :
                            watch('paymentMethod') === 'ewallet' ? 'E-Wallet' :
                            watch('paymentMethod')
                          ) : 'Select method'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="bank">Bank Transfer</SelectItem>
                        <SelectItem value="ewallet">E-Wallet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="paymentReference" className="text-xs font-bold text-slate-600">Reference / Check #</Label>
                    <Input 
                      id="paymentReference" 
                      {...register('paymentReference')} 
                      placeholder="Optional reference number" 
                      className="bg-slate-50/50 rounded-xl border-slate-200 text-xs sm:text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-600">Allocated Split Payment Methods</Label>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-xs rounded-lg" 
                      onClick={() => appendSplit({ methodId: paymentOptions[0]?.id || 'cash', methodName: paymentOptions[0]?.name || 'Cash', amount: 0 })}
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Payment Split
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {splitFields.map((field, index) => (
                      <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-5 space-y-1">
                          <Label className="text-[10px] text-slate-500">Method / Account</Label>
                          <Select 
                            value={watchSplits?.[index]?.methodId} 
                            onValueChange={(v) => {
                              const opt = paymentOptions.find(o => o.id === v);
                              setValue(`paymentSplits.${index}.methodId` as any, v);
                              setValue(`paymentSplits.${index}.methodName` as any, v === 'cash' ? 'Cash' : v === 'card' ? 'Card' : opt?.name || v);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs bg-white rounded-lg">
                              <SelectValue placeholder="Method" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="card">Card</SelectItem>
                              {paymentOptions.map(o => (
                                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-3 space-y-1">
                          <Label className="text-[10px] text-slate-500">Amount ({settings.currency})</Label>
                          <Input 
                            type="number" 
                            step="0.01"
                            className="h-8 text-xs bg-white rounded-lg" 
                            {...register(`paymentSplits.${index}.amount` as any, { required: true, min: 0 })}
                          />
                        </div>
                        <div className="col-span-3 space-y-1">
                          <Label className="text-[10px] text-slate-500">Ref / Check #</Label>
                          <Input 
                            className="h-8 text-xs bg-white rounded-lg" 
                            placeholder="Ref #" 
                            {...register(`paymentSplits.${index}.reference` as any)}
                          />
                        </div>
                        <div className="col-span-1">
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-rose-500 rounded-lg hover:bg-rose-50"
                            onClick={() => removeSplit(index)}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className={cn(
                    "text-xs text-right font-bold pt-1",
                    Math.abs(totalSplitAmount - totalAmount) < 0.01 ? "text-emerald-600" : "text-rose-500"
                  )}>
                    Total Allocated: {settings.currency}{totalSplitAmount.toFixed(2)} / Required: {settings.currency}{totalAmount.toFixed(2)}
                  </div>
                </div>
              )}

              {/* Order Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs font-bold text-slate-600">Order Remarks / Instructions</Label>
                <Input 
                  id="notes" 
                  {...register('notes')} 
                  placeholder="e.g. Urgent shipment, include warranty cards, deliver before 5 PM" 
                  className="bg-slate-50/50 rounded-xl border-slate-200 text-xs sm:text-sm"
                />
              </div>
            </div>

            {/* Order Items Table Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <Label className="text-sm font-bold text-slate-800">Order Items</Label>
                  <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5">
                    {validItemsCount} of {fields.length} {fields.length === 1 ? 'item' : 'items'}
                  </Badge>
                </div>
                <Button 
                  type="button" 
                  variant="default" 
                  size="sm" 
                  onClick={() => append({ productId: '', quantity: 1, cost: 0 })}
                  className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Item
                </Button>
              </div>

              {/* Line Items List */}
              <div className="space-y-2.5">
                {fields.map((field, index) => {
                  const currentProductId = watchItems[index]?.productId;
                  const currentQty = Number(watchItems[index]?.quantity) || 0;
                  const currentCost = Number(watchItems[index]?.cost) || 0;
                  const lineTotal = currentQty * currentCost;
                  const selectedProd = products.find(p => p.id === currentProductId);

                  return (
                    <div 
                      key={field.id} 
                      className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center gap-3 transition-all hover:border-slate-300"
                    >
                      <span className="hidden md:flex w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold items-center justify-center shrink-0">
                        {index + 1}
                      </span>

                      {/* Searchable Product Typeahead Selector */}
                      <SearchableProductSelect
                        products={products}
                        value={currentProductId || ''}
                        onChange={(prod) => {
                          if (prod && prod !== 'all') {
                            setValue(`items.${index}.productId` as any, prod.id);
                            setValue(`items.${index}.cost` as any, prod.cost || 0);
                          } else {
                            setValue(`items.${index}.productId` as any, '');
                          }
                        }}
                        label="Product (Name / SKU)"
                        placeholder="Type SKU or product name..."
                        showStock={true}
                        required={true}
                      />

                      {/* Quantity */}
                      <div className="w-full md:w-28 space-y-1 shrink-0">
                        <Label className="text-[10px] uppercase font-bold text-slate-400">Quantity</Label>
                        <Input 
                          type="number" 
                          min={1}
                          className="h-9 bg-slate-50/50 border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-center"
                          {...register(`items.${index}.quantity` as const, { required: true, min: 1, valueAsNumber: true })} 
                        />
                      </div>

                      {/* Unit Cost (Admin Only) */}
                      {isAdmin ? (
                        <div className="w-full md:w-36 space-y-1 shrink-0">
                          <Label className="text-[10px] uppercase font-bold text-slate-400">Unit Cost ({settings.currency})</Label>
                          <Input 
                            type="number" 
                            step="0.01" 
                            min={0}
                            className="h-9 bg-slate-50/50 border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-right"
                            {...register(`items.${index}.cost` as const, { required: true, min: 0, valueAsNumber: true })} 
                          />
                        </div>
                      ) : (
                        <input type="hidden" {...register(`items.${index}.cost` as const)} />
                      )}

                      {/* Line Subtotal */}
                      {isAdmin && (
                        <div className="hidden md:flex flex-col items-end justify-center w-28 shrink-0 space-y-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Subtotal</span>
                          <span className="text-xs font-bold text-slate-800">
                            {settings.currency}{lineTotal.toFixed(2)}
                          </span>
                        </div>
                      )}

                      {/* Delete Item */}
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
                              setValue(`items.0.cost` as any, 0);
                            } else {
                              remove(index);
                            }
                          }}
                          title="Remove item"
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
              <div>
                <span><strong>{validItemsCount}</strong> Product Line{validItemsCount !== 1 ? 's' : ''} ({totalUnits} Total Units)</span>
              </div>
              {isAdmin && (
                <>
                  <div className="h-4 w-px bg-indigo-200" />
                  <div>
                    <span>Total Purchase Cost: <strong className="text-sm sm:text-base font-black text-indigo-700">{settings.currency}{totalAmount.toFixed(2)}</strong></span>
                  </div>
                </>
              )}
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
                disabled={loading || validItemsCount === 0 || totalAmount <= 0} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-9 px-5 text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20"
              >
                {loading ? 'Creating Order...' : `Create & Order (${settings.currency}${totalAmount.toFixed(2)})`}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
