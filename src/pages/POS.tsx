import React, { useState, useEffect } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  Banknote, 
  Wallet,
  CheckCircle2,
  Printer,
  X,
  Package,
  Ticket,
  Percent,
  Building,
  Scan
} from 'lucide-react';

import { collection, onSnapshot, query, orderBy, addDoc, Timestamp, doc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Product, Sale, SaleItem, Location, Customer, PromoCode, PaymentOption, PriceTier, PaymentSplit } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useLocations } from '@/contexts/LocationContext';
import { useSettings } from '@/contexts/SettingsContext';
import { toast } from 'sonner';
import { BarcodeScanner } from '@/components/BarcodeScanner';

import { OperationType, handleFirestoreError } from '@/lib/firestore-utils';
import { logAction } from '@/lib/audit';
import { cn } from '@/lib/utils';
import { MapPin } from 'lucide-react';
import { motion } from 'motion/react';

export const POS: React.FC = () => {
  const { user, profile } = useAuth();
  const { locations, selectedLocationId } = useLocations();
  const { settings } = useSettings();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [lastSaleId, setLastSaleId] = useState('');
  const [processing, setProcessing] = useState(false);
  const [isPendingCheckout, setIsPendingCheckout] = useState(false);
  const [checkoutLocationId, setCheckoutLocationId] = useState<string>('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([]);
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('walk-in');
  const [selectedTierId, setSelectedTierId] = useState<string>('');
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'cash' | 'card' | 'digital'>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [addQtyMulti, setAddQtyMulti] = useState<number>(1);
  const [customerDetails, setCustomerDetails] = useState({
    name: '',
    billingAddress: '',
    shippingAddress: '',
    municipality: '',
    city: '',
    country: 'Philippines',
    zip: ''
  });

  const [activeTab, setActiveTab] = useState<'products' | 'cart'>('products');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];
  const brandsForCategory = Array.from(new Set(
    products
      .filter(p => selectedCategory === 'all' || p.category === selectedCategory)
      .map(p => p.brand)
      .filter(Boolean)
  )) as string[];

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setSelectedBrand('all');
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesLocation = selectedLocationId === 'all' || 
                            (p.locationIds && p.locationIds.includes(selectedLocationId)) ||
                            (p.stocks && p.stocks[selectedLocationId] !== undefined && Number(p.stocks[selectedLocationId]) > 0);
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesBrand = selectedBrand === 'all' || p.brand === selectedBrand;
    
    return matchesSearch && matchesLocation && matchesCategory && matchesBrand;
  });

  const getProductStock = (product: Product) => {
    if (!selectedLocationId) return 0;
    if (selectedLocationId === 'all') {
      return Object.values(product.stocks || {}).reduce((sum, val) => (sum as number) + Number(val), 0) as number;
    }
    return Number(product.stocks?.[selectedLocationId] || 0);
  };

  const addToCart = (product: Product, quantityToUse: number = addQtyMulti) => {
    const currentStock = getProductStock(product);
    if (currentStock <= 0) {
      toast.error('Product out of stock at this location');
      return;
    }

    if (quantityToUse <= 0) {
      toast.error('Please specify a valid quantity');
      return;
    }

    // Lookup customer's price tier
    let salePrice = product.price;

    if (selectedTierId && product.tierPrices?.[selectedTierId]) {
      salePrice = product.tierPrices[selectedTierId];
    }

    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        const totalQty = existing.quantity + quantityToUse;
        if (totalQty > currentStock) {
          toast.error(`Cannot select more than available stock (${currentStock})`);
          return prev;
        }
        return prev.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: totalQty, subtotal: totalQty * salePrice, price: salePrice }
            : item
        );
      }
      
      if (quantityToUse > currentStock) {
        toast.error(`Cannot select more than available stock (${currentStock})`);
        return prev;
      }

      const newItem: SaleItem = {
        productId: product.id,
        name: product.name,
        quantity: quantityToUse,
        price: salePrice,
        subtotal: quantityToUse * salePrice,
        originalPrice: product.price
      };
      
      if (selectedTierId) {
        newItem.tierId = selectedTierId;
      }
      
      return [...prev, newItem];
    });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const term = searchTerm.trim().toLowerCase();
      if (!term) return;
      e.preventDefault();

      const matched = products.find(p => 
        p.barcode?.toLowerCase() === term ||
        p.sku?.toLowerCase() === term
      );

      if (matched) {
        addToCart(matched, addQtyMulti);
        setSearchTerm('');
        toast.success(`Scanned and added ${matched.name} to cart`);
      } else {
        if (filteredProducts.length === 1) {
          addToCart(filteredProducts[0], addQtyMulti);
          setSearchTerm('');
          toast.success(`Scanned and added ${filteredProducts[0].name} to cart`);
        } else {
          toast.error(`No unique product found matching "${searchTerm}"`);
        }
      }
    }
  };

  // Support Hardware Barcode Scanners (automatically listening to fast sequential global entries)
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isInput && target.id !== 'global-scanner-stub') {
        return;
      }

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 50) {
        buffer = '';
      }
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (buffer.length >= 3) {
          const matched = products.find(p => 
            p.barcode?.toLowerCase() === buffer.toLowerCase() ||
            p.sku?.toLowerCase() === buffer.toLowerCase()
          );

          if (matched) {
            addToCart(matched, addQtyMulti);
            toast.success(`Scanned hardware: ${matched.name} added to cart`);
            e.preventDefault();
          }
          buffer = '';
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [products, selectedLocationId, addQtyMulti]);

  const handleCustomerSelect = (id: string) => {
    setSelectedCustomerId(id);
    const activeLocationId = selectedLocationId === 'all' ? checkoutLocationId : selectedLocationId;
    const location = locations.find(l => l.id === activeLocationId);

    if (id === 'walk-in') {
      setSelectedTierId('');
      setCustomerDetails({
        name: 'Walk-In Customer',
        billingAddress: location?.addressLine1 || '',
        shippingAddress: location?.addressLine1 || '',
        municipality: location?.municipality || '',
        city: location?.city || '',
        country: location?.country || 'Philippines',
        zip: ''
      });
    } else if (id === 'new') {
      setSelectedTierId('');
      setCustomerDetails({
        name: '',
        billingAddress: location?.addressLine1 || '',
        shippingAddress: location?.addressLine1 || '',
        municipality: location?.municipality || '',
        city: location?.city || '',
        country: location?.country || 'Philippines',
        zip: ''
      });
    } else {
      const customer = customers.find(c => c.id === id);
      if (customer) {
        setSelectedTierId(customer.priceTierId || '');
        setCustomerDetails({
          name: customer.name,
          billingAddress: customer.billingAddress,
          shippingAddress: customer.shippingAddress,
          municipality: customer.municipality,
          city: customer.city,
          country: customer.country,
          zip: customer.zip
        });
      }
    }
  };

  useEffect(() => {
    if (!profile) return;

    const q = query(collection(db, 'products'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => {
      console.warn("POS: Error listening to products collection:", error);
    });

    const unsubscribeCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    }, (error) => {
      console.warn("POS: Error listening to customers collection:", error);
    });

    const unsubscribePromos = onSnapshot(collection(db, 'promos'), (snapshot) => {
      setPromos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PromoCode)));
    }, (error) => {
      console.warn("POS: Error listening to promos collection:", error);
    });

    const unsubscribePayments = onSnapshot(collection(db, 'paymentOptions'), (snapshot) => {
      setPaymentOptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentOption)));
    }, (error) => {
      console.warn("POS: Error listening to paymentOptions collection:", error);
    });

    let unsubscribeAccounts: (() => void) | null = null;
    const isStaffUser = ['admin', 'manager', 'staff'].includes(profile.role) || 
                        user?.email?.toLowerCase() === 'vanhuxley24@gmail.com' || 
                        user?.email?.toLowerCase() === 'v4peavenue@gmail.com';

    if (isStaffUser) {
      unsubscribeAccounts = onSnapshot(collection(db, 'accounts'), (snapshot) => {
        setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        console.warn("POS: Error listening to accounts collection:", error);
      });
    }

    const unsubscribeTiers = onSnapshot(collection(db, 'priceTiers'), (snapshot) => {
      setPriceTiers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PriceTier)));
    }, (error) => {
      console.warn("POS: Error listening to priceTiers collection:", error);
    });

    return () => {
      unsubscribe();
      unsubscribeCustomers();
      unsubscribePromos();
      unsubscribePayments();
      unsubscribeTiers();
      if (unsubscribeAccounts) unsubscribeAccounts();
    };
  }, [profile, user]);

  useEffect(() => {
    if (selectedLocationId && selectedLocationId !== 'all') {
      setCheckoutLocationId(selectedLocationId);
    }
    // Removed the else { setCheckoutLocationId(''); } to prevent resetting when user selects in dialog

    const activeLocationId = selectedLocationId === 'all' ? checkoutLocationId : selectedLocationId;
    if (activeLocationId && (selectedCustomerId === 'new' || selectedCustomerId === 'walk-in')) {
      const location = locations.find(l => l.id === activeLocationId);
      if (location) {
        setCustomerDetails(prev => ({
          ...prev,
          name: selectedCustomerId === 'walk-in' ? 'Walk-In Customer' : prev.name,
          billingAddress: location.addressLine1 || '',
          shippingAddress: location.addressLine1 || '',
          municipality: location.municipality || '',
          city: location.city || '',
          country: location.country || 'Philippines'
        }));
      }
    }
  }, [selectedLocationId, checkoutLocationId, locations, selectedCustomerId]);

  useEffect(() => {
    // If selectedTierId changes, update all existing items in the cart to reflect new tier pricing
    setCart(prev => prev.map(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product) return item;
      
      let price = product.price;
      if (selectedTierId && product.tierPrices?.[selectedTierId]) {
        price = product.tierPrices[selectedTierId];
      }
      
      return {
        ...item,
        price,
        subtotal: item.quantity * price,
        tierId: selectedTierId || undefined
      };
    }));
  }, [selectedTierId, products]);

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      const item = prev.find(i => i.productId === productId);
      if (!item) return prev;

      const product = products.find(p => p.id === productId);
      const currentStock = product ? getProductStock(product) : 0;
      const newQty = item.quantity + delta;

      if (newQty <= 0) {
        return prev.filter(i => i.productId !== productId);
      }

      if (newQty > currentStock) {
        toast.error('Cannot exceed available stock');
        return prev;
      }

      return prev.map(i => 
        i.productId === productId 
          ? { ...i, quantity: newQty, subtotal: newQty * i.price }
          : i
      );
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const discount = appliedPromo ? appliedPromo.amount : 0;
  const total = Math.max(0, subtotal - discount);
  const tax = total * (12/112); // 12% VAT portion included in the price

  const applyPromo = () => {
    if (!promoCodeInput.trim()) {
      setAppliedPromo(null);
      return;
    }
    const code = promoCodeInput.trim().toUpperCase();
    const promo = promos.find(p => p.code === code && p.isActive);
    
    if (!promo) {
      toast.error('Invalid promo code');
      setAppliedPromo(null);
      return;
    }

    // Check dates
    if (!promo.isPermanent) {
      const now = new Date();
      if (promo.startDate && now < promo.startDate.toDate()) {
        toast.error('Promo has not started yet');
        return;
      }
      if (promo.endDate && now > promo.endDate.toDate()) {
        toast.error('Promo has expired');
        return;
      }
    }

    setAppliedPromo(promo);
    toast.success(`Promo code ${code} applied (-${settings.currency}${promo.amount})`);
  };

  const handleCheckout = async (isPending: boolean = false) => {
    if (cart.length === 0) return;
    if (!customerDetails.name.trim()) {
      toast.error('Customer name is required');
      return;
    }
    if (!checkoutLocationId || checkoutLocationId === 'all') {
      toast.error('Please select a specific location for this sale');
      return;
    }

    // Validate stock for the selected checkout location
    for (const item of cart) {
      const product = products.find(p => p.id === item.productId);
      const locationStock = product?.stocks?.[checkoutLocationId] || 0;
      if (locationStock < item.quantity) {
        toast.error(`Insufficient stock for ${item.name} at the selected location (${locationStock} available)`);
        return;
      }
    }

    setProcessing(true);
    try {
      let finalCustomerId = selectedCustomerId;

      // Create new customer if 'new' or 'walk-in' is selected
      if (selectedCustomerId === 'new' || selectedCustomerId === 'walk-in') {
        const customerRef = await addDoc(collection(db, 'customers'), {
          ...customerDetails,
          createdAt: Timestamp.now()
        });
        finalCustomerId = customerRef.id;
      }

      // Resolve/Create accounts for payments to ensure everything is tracked in Finance
      const resolvedSplits: any[] = [];
      let resolvedPaymentMethod = paymentMethod;

      if (!isPending) {
        const rawSplits = isSplitPayment ? paymentSplits : [{ 
          methodId: paymentMethod, 
          amount: total,
          reference: paymentReference
        }];

        for (const split of rawSplits) {
          if (!split.methodId) continue;

          let accountName = '';
          let accountType: 'bank' | 'ewallet' | 'cash' | 'card' = 'cash';

          if (split.methodId === 'cash') {
            accountName = 'Cash';
            accountType = 'cash';
          } else if (split.methodId === 'card') {
            accountName = 'Generic Card';
            accountType = 'card';
          } else if (split.methodId === 'digital') {
            accountName = 'Generic Digital';
            accountType = 'ewallet';
          } else {
            // Find in current paymentOptions/accounts
            const opt = paymentOptions.find(o => o.id === split.methodId);
            if (opt) {
              accountName = opt.name;
              accountType = opt.type;
            } else {
              const acc = accounts.find(a => a.id === split.methodId);
              if (acc) {
                accountName = acc.name;
                accountType = acc.type;
              } else {
                accountName = split.methodId.charAt(0).toUpperCase() + split.methodId.slice(1);
                accountType = 'cash';
              }
            }
          }

          // See if an account with this name or ID already exists in the accounts collection
          let targetAccount = accounts.find(a => 
            a.id === split.methodId || 
            a.name.toLowerCase() === accountName.toLowerCase()
          );

          let resolvedId = targetAccount?.id || '';

          if (!targetAccount) {
            // Create payment option first to keep it in sync
            const paymentRef = await addDoc(collection(db, 'paymentOptions'), {
              name: accountName,
              type: accountType,
              active: true
            });
            resolvedId = paymentRef.id;

            // Create account with the same ID
            await setDoc(doc(db, 'accounts', resolvedId), {
              name: accountName,
              type: accountType,
              balance: 0,
              lastUpdated: Timestamp.now()
            });

            targetAccount = {
              id: resolvedId,
              name: accountName,
              type: accountType,
              balance: 0
            };
          }

          resolvedSplits.push({
            methodId: resolvedId,
            methodName: accountName,
            amount: split.amount,
            reference: split.reference || ''
          });
        }

        // If not a split payment, the main paymentMethod is the single resolved account ID
        if (!isSplitPayment && resolvedSplits.length > 0) {
          resolvedPaymentMethod = resolvedSplits[0].methodId;
        }
      }

      const saleData: any = {
        items: cart.map(item => {
          const cleanedItem: any = { ...item };
          Object.keys(cleanedItem).forEach(key => {
            if (cleanedItem[key] === undefined) delete cleanedItem[key];
          });
          return cleanedItem;
        }),
        subtotal,
        total,
        tax,
        discount,
        paymentMethod: isPending ? 'pending' : (isSplitPayment ? 'split' : resolvedPaymentMethod),
        paymentSplits: isPending ? [] : resolvedSplits,
        status: isPending ? 'pending' : 'completed',
        staffId: profile?.id || 'anonymous',
        locationId: checkoutLocationId,
        customerId: finalCustomerId,
        customerDetails: {
          name: customerDetails.name,
          billingAddress: customerDetails.billingAddress,
          shippingAddress: customerDetails.shippingAddress,
          municipality: customerDetails.municipality,
          city: customerDetails.city,
          country: customerDetails.country,
          zip: customerDetails.zip
        },
        timestamp: Timestamp.now()
      };

      if (appliedPromo) {
        saleData.promoId = appliedPromo.id;
        saleData.promoCode = appliedPromo.code;
      }

      // 1. Record the sale
      const saleRef = await addDoc(collection(db, 'sales'), saleData);
      setLastSaleId(saleRef.id);

      // 4. Update financial accounts (ONLY IF NOT PENDING)
      if (!isPending) {
        for (const split of resolvedSplits) {
          const account = accounts.find(a => a.id === split.methodId) || { name: split.methodName, balance: 0 };
          const currentBalance = account.balance || 0;
          const newBalance = currentBalance + split.amount;

          const accountRef = doc(db, 'accounts', split.methodId);
          await updateDoc(accountRef, {
            balance: increment(split.amount),
            lastUpdated: Timestamp.now()
          });

          // Create financial transaction record for Finance history
          await addDoc(collection(db, 'financialTransactions'), {
            amount: split.amount,
            type: 'income',
            accountId: split.methodId,
            accountName: split.methodName,
            locationId: checkoutLocationId || null,
            locationName: locations.find(l => l.id === checkoutLocationId)?.name || null,
            category: 'Sales',
            description: `Sale record: ${customerDetails.name}`,
            timestamp: Timestamp.now(),
            createdBy: profile?.id || 'anonymous',
            createdByName: profile?.name || 'Staff',
            accountBalance: newBalance
          });
        }
      }

      // 2. Update inventory stock
      for (const item of cart) {
        const product = products.find(p => p.id === item.productId);
        if (!product) continue;

        const productRef = doc(db, 'products', item.productId);
        const newStocks = { ...product.stocks };
        newStocks[checkoutLocationId] = (newStocks[checkoutLocationId] || 0) - item.quantity;
        
        await updateDoc(productRef, {
          stock: increment(-item.quantity),
          stocks: newStocks,
          updatedAt: Timestamp.now()
        });
      }

      await logAction(profile, isPending ? 'CREATE_PENDING_SALE' : 'CREATE_SALE', `Processed ${isPending ? 'pending ' : ''}sale: Total ${(total ?? 0).toFixed(2)} (${cart.length} items)`, saleRef.id, 'sale');

      setCart([]);
      setAppliedPromo(null);
      setPromoCodeInput('');
      setPaymentSplits([]);
      setPaymentReference('');
      setActiveCategory('cash');
      setIsSplitPayment(false);
      setIsCheckoutOpen(false);
      setIsSuccessOpen(true);
      toast.success(isPending ? 'Sale marked as pending' : 'Sale completed successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'sales');
    } finally {
      setProcessing(false);
    }
  };


  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="h-full min-h-0 lg:h-[calc(100vh-120px)] flex flex-col lg:flex-row gap-6 lg:gap-8"
    >
      {/* Mobile Tab Switcher */}
      <div className="flex lg:hidden bg-slate-100 p-1.5 rounded-2xl gap-2 shadow-sm shrink-0 border border-slate-200">
        <Button
          variant="ghost"
          onClick={() => setActiveTab('products')}
          className={cn(
            "flex-1 h-11 text-xs font-bold rounded-xl transition-all gap-2",
            activeTab === 'products'
              ? "bg-[#1A2B4B] text-white shadow-md shadow-[#1A2B4B]/10 hover:bg-[#1A2B4B]"
              : "text-slate-600 hover:bg-slate-200"
          )}
        >
          <Package className="w-4 h-4" />
          Products ({filteredProducts.length})
        </Button>
        <Button
          variant="ghost"
          onClick={() => setActiveTab('cart')}
          className={cn(
            "flex-1 h-11 text-xs font-bold rounded-xl transition-all gap-2 relative",
            activeTab === 'cart'
              ? "bg-[#1A2B4B] text-white shadow-[#1A2B4B]/10 hover:bg-[#1A2B4B] hover:text-white font-black"
              : "text-slate-600 hover:bg-slate-200"
          )}
        >
          <ShoppingCart className="w-4 h-4" />
          Cart ({cart.reduce((sum, i) => sum + i.quantity, 0)})
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-black text-[9px] h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center border-2 border-white animate-bounce animate-duration-1000">
              {cart.reduce((sum, i) => sum + i.quantity, 0)}
            </span>
          )}
        </Button>
      </div>

      {/* Product Selection Area */}
      <div className={cn("flex-1 flex flex-col gap-6 min-h-0", activeTab !== 'products' && "hidden lg:flex")}>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {selectedLocationId === 'all' && (
            <div className="bg-[#1A2B4B]/5 border border-[#1A2B4B]/10 p-3 rounded-xl flex items-center gap-3 text-[#1A2B4B] text-sm backdrop-blur-sm">
              <MapPin className="w-5 h-5 text-[#D4AF37]" />
              <p className="font-bold">Viewing all locations. You will need to select a specific branch at checkout.</p>
            </div>
          )}
          <div className="relative flex-1 w-full flex items-center gap-3">
            <div className="relative flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input 
                  className="pl-12 h-12 text-base bg-white/50 border-slate-200 shadow-sm rounded-xl focus-visible:ring-[#D4AF37] backdrop-blur-sm" 
                  placeholder="Search by name, SKU, or Barcode..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-12 border-slate-200 bg-white/50 rounded-xl hover:bg-[#D4AF37]/10 flex items-center justify-center group active:scale-95 shadow-sm shrink-0"
                onClick={() => setIsScannerOpen(true)}
                title="Scan Barcode with Camera"
              >
                <Scan className="w-5 h-5 text-[#1A2B4B] group-hover:text-[#D4AF37] transition-colors" />
              </Button>
            </div>

            <div className="flex items-center gap-1 bg-white/95 border border-slate-200/80 rounded-xl p-1 shadow-sm h-12 shrink-0 select-none">

              <span className="text-[10px] font-black uppercase text-[#1A2B4B] tracking-wider pl-2 pr-1">Add Qty:</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 hover:bg-slate-100 rounded-lg shrink-0 text-slate-600 active:scale-95"
                type="button"
                onClick={() => setAddQtyMulti(prev => Math.max(1, prev - 1))}
              >
                <Minus className="w-3.5 h-3.5" />
              </Button>
              <Input 
                type="number"
                className="w-10 h-8 text-center font-black text-sm border-none bg-transparent focus-visible:ring-0 p-0 text-[#1A2B4B]"
                value={addQtyMulti}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val >= 1) {
                    setAddQtyMulti(val);
                  }
                }}
                min={1}
              />
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 hover:bg-slate-100 rounded-lg shrink-0 text-slate-600 active:scale-95"
                type="button"
                onClick={() => setAddQtyMulti(prev => prev + 1)}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Category & Brand Hierarchy Filter */}
        <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 backdrop-blur-sm shrink-0">
          {/* Category Level */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Category</span>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar pr-1">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleCategoryChange('all')}
                className={cn(
                  "h-8 text-xs font-semibold px-3 rounded-lg border-slate-200/80 shadow-sm transition-all",
                  selectedCategory === 'all'
                    ? "bg-[#1A2B4B] text-white hover:bg-[#1A2B4B]"
                    : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                )}
              >
                All Categories
              </Button>
              {categories.map(cat => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleCategoryChange(cat)}
                  className={cn(
                    "h-8 text-xs font-semibold px-3 rounded-lg border-slate-200/80 shadow-sm transition-all",
                    selectedCategory === cat
                      ? "bg-[#1A2B4B] text-white hover:bg-[#1A2B4B]"
                      : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                  )}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>

          {/* Brand Level */}
          <div className="flex flex-col gap-1.5 border-t border-slate-200/50 pt-2.5">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
              Brand
              {selectedCategory !== 'all' && (
                <span className="text-slate-400/80 font-medium normal-case font-sans">under {selectedCategory}</span>
              )}
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar pr-1">
              <Button
                variant={selectedBrand === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedBrand('all')}
                className={cn(
                  "h-8 text-xs font-semibold px-3 rounded-lg border-slate-200/80 shadow-sm transition-all",
                  selectedBrand === 'all'
                    ? "bg-[#D4AF37] text-[#1A2B4B] hover:bg-[#D4AF37] font-bold"
                    : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                )}
              >
                All Brands
              </Button>
              {brandsForCategory.map(brand => (
                <Button
                  key={brand}
                  variant={selectedBrand === brand ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedBrand(brand)}
                  className={cn(
                    "h-8 text-xs font-semibold px-3 rounded-lg border-slate-200/80 shadow-sm transition-all",
                    selectedBrand === brand
                      ? "bg-[#D4AF37] text-[#1A2B4B] hover:bg-[#D4AF37] font-bold"
                      : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                  )}
                >
                  {brand}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-5 pb-6">
            {filteredProducts.map((product, index) => {
              const currentStock = getProductStock(product);
              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                >
                  <Card 
                    className={cn(
                      "cursor-pointer transition-all duration-300 hover:shadow-xl active:scale-95 group relative overflow-hidden border-slate-200/60 rounded-2xl bg-white/50 backdrop-blur-sm",
                      currentStock <= 0 ? "opacity-60 grayscale cursor-not-allowed" : "hover:border-[#D4AF37]/50 hover:-translate-y-1"
                    )}
                    onClick={() => currentStock > 0 && addToCart(product)}
                  >
                    <CardContent className="p-0">
                      <div className="aspect-[4/3] bg-slate-50 flex items-center justify-center text-slate-300 overflow-hidden relative">
                        {product.imageUrl ? (
                          <img 
                            src={product.imageUrl} 
                            alt={product.name} 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Package className="w-12 h-12" />
                        )}
                        <div className="absolute top-2 right-2">
                          <Badge className={cn(
                            "shadow-sm border-none",
                            currentStock <= 5 ? "bg-rose-500" : "bg-[#1A2B4B]"
                          )}>
                            {currentStock}
                          </Badge>
                        </div>
                      </div>
                      <div className="p-4">
                        <p className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider mb-1">{product.category}</p>
                        <h3 className="font-bold text-[#1A2B4B] truncate text-sm mb-2">{product.name}</h3>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-black text-[#1A2B4B]">{settings.currency}{(product.price ?? 0).toFixed(2)}</span>
                          <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center group-hover:bg-[#1A2B4B] group-hover:text-white transition-colors shadow-sm">
                            <Plus className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cart Area */}
      <Card className={cn(
        "w-full lg:w-[420px] flex flex-col shadow-2xl border-slate-200 bg-white/80 backdrop-blur-md rounded-3xl overflow-hidden",
        activeTab !== 'cart' && "hidden lg:flex"
      )}>
        <CardHeader className="border-b bg-[#1A2B4B]/5 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#1A2B4B] rounded-xl flex items-center justify-center shadow-lg shadow-[#1A2B4B]/20">
                <ShoppingCart className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg font-heading text-[#1A2B4B]">Current Order</CardTitle>
                <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-[#D4AF37]">Checkout Session</CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="bg-white border border-slate-200 text-slate-700 px-3 py-1">
              {cart.reduce((sum, i) => sum + i.quantity, 0)} items
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-y-auto p-0 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-12 text-center">
              <div className="w-20 h-20 bg-[#1A2B4B]/5 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <ShoppingCart className="w-10 h-10 text-[#1A2B4B]/20" />
              </div>
              <p className="text-base font-bold text-[#1A2B4B]">Your cart is empty</p>
              <p className="text-xs mt-2 max-w-[200px] mx-auto">Add products from the inventory to start building an order.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {cart.map((item) => (
                <div key={item.productId} className="p-5 hover:bg-[#FDFCF8] transition-colors group">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-[#1A2B4B] truncate text-sm">{item.name}</h4>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-slate-500 font-medium">{settings.currency}{(item.price ?? 0).toFixed(2)} per unit</p>
                        {item.tierId ? (
                          <Badge variant="outline" className="text-[8px] h-3 px-1 border-[#D4AF37] text-[#D4AF37] bg-[#D4AF37]/5 font-bold uppercase">
                            {priceTiers.find(t => t.id === item.tierId)?.name || 'Tier Price'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[8px] h-3 px-1 border-slate-200 text-slate-400 font-bold uppercase">Retail</Badge>
                        )}
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromCart(item.productId);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 hover:bg-slate-50 rounded-lg"
                        onChange={(e) => { e.preventDefault(); }}
                        onClick={() => updateQuantity(item.productId, -1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <Input
                        type="number"
                        className="w-11 h-8 text-center font-black text-sm border-none bg-transparent focus-visible:ring-0 p-0 text-[#1A2B4B]"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 1) {
                            const diff = val - item.quantity;
                            updateQuantity(item.productId, diff);
                          }
                        }}
                      />
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 hover:bg-slate-50 rounded-lg"
                        onChange={(e) => { e.preventDefault(); }}
                        onClick={() => updateQuantity(item.productId, 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    <span className="font-black text-[#1A2B4B] text-base">{settings.currency}{(item.subtotal ?? 0).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex-col gap-6 border-t p-8 bg-[#FDFCF8]/80">
          <div className="w-full space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#D4AF37]" />
                <Input 
                  placeholder="Promo Code" 
                  className="pl-9 h-10 bg-white border-[#D4AF37]/20 uppercase focus-visible:ring-[#D4AF37]"
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value)}
                />
              </div>
              <Button 
                variant="outline" 
                className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-white"
                onClick={applyPromo}
              >
                Apply
              </Button>
            </div>
            <div className="flex justify-between text-sm font-medium text-slate-500">
              <span>Subtotal</span>
              <span className="text-[#1A2B4B]">{settings.currency}{(subtotal ?? 0).toFixed(2)}</span>
            </div>
            {appliedPromo && (
              <div className="flex justify-between text-sm font-bold text-emerald-600">
                <span className="flex items-center gap-1"><Ticket className="w-3 h-3" /> Promo: {appliedPromo.code}</span>
                <span>-{settings.currency}{(appliedPromo.amount ?? 0).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs font-medium text-slate-400 italic">
              <span>VAT Portion (12% Incl.)</span>
              <span>{settings.currency}{(tax ?? 0).toFixed(2)}</span>
            </div>
            <div className="pt-3 border-t border-slate-200 flex justify-between items-end">
              <div>
                <p className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-widest mb-1">Total Amount</p>
                <span className="text-3xl font-black text-[#1A2B4B]">{settings.currency}{(total ?? 0).toFixed(2)}</span>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Items</p>
                <span className="text-lg font-bold text-[#1A2B4B]">{cart.reduce((sum, i) => sum + i.quantity, 0)}</span>
              </div>
            </div>
          </div>
          <Button 
            className="w-full h-16 text-lg font-black bg-[#1A2B4B] hover:bg-[#2C3E50] text-white shadow-xl shadow-[#1A2B4B]/10 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            disabled={cart.length === 0}
            onClick={() => setIsCheckoutOpen(true)}
          >
            Process Checkout
          </Button>
        </CardFooter>
      </Card>

      {/* Checkout Dialog */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="sm:max-w-[600px] md:min-h-[650px] max-h-[95vh] flex flex-col overflow-y-auto bg-white/95 backdrop-blur-md border-[#D4AF37]/20">
          <DialogHeader>
            <DialogTitle className="text-[#1A2B4B] font-heading text-2xl">Complete Sale</DialogTitle>
            <DialogDescription>Enter customer details and select payment method.</DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
              {selectedLocationId === 'all' && (
              <div className="space-y-2">
                <Label htmlFor="checkout-loc" className="text-[#D4AF37] font-bold">Sale Location</Label>
                <Select required value={checkoutLocationId} onValueChange={setCheckoutLocationId}>
                  <SelectTrigger id="checkout-loc" className="border-[#D4AF37]/20 bg-[#FDFCF8]">
                    <SelectValue placeholder="Select Location">
                      {locations.find(l => l.id === checkoutLocationId)?.name || 'Select Location'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                      {locations.map(l => (
                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="checkout-customer">Customer</Label>
                <Select required value={selectedCustomerId} onValueChange={handleCustomerSelect}>
                  <SelectTrigger id="checkout-customer" className="bg-[#FDFCF8]">
                    <SelectValue placeholder="Select Customer">
                      {selectedCustomerId === 'walk-in' ? '🚶 Walk-In Customer' : 
                       selectedCustomerId === 'new' ? '+ New Customer' : 
                       (customers.find(c => c.id === selectedCustomerId)?.name || 'Select Customer')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walk-in">🚶 Walk-In Customer</SelectItem>
                    <SelectItem value="new">+ New Customer</SelectItem>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cust-name">Customer Name</Label>
                <Input 
                  id="cust-name"
                  className="bg-[#FDFCF8]"
                  value={customerDetails.name}
                  onChange={(e) => setCustomerDetails({ ...customerDetails, name: e.target.value })}
                  placeholder="Full Name"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Billing Address</Label>
                  <Input 
                    className="bg-[#FDFCF8]"
                    value={customerDetails.billingAddress}
                    onChange={(e) => setCustomerDetails({ ...customerDetails, billingAddress: e.target.value })}
                    placeholder="Billing"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Shipping Address</Label>
                  <Input 
                    className="bg-[#FDFCF8]"
                    value={customerDetails.shippingAddress}
                    onChange={(e) => setCustomerDetails({ ...customerDetails, shippingAddress: e.target.value })}
                    placeholder="Shipping"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Municipality</Label>
                  <Input 
                    className="bg-[#FDFCF8]"
                    value={customerDetails.municipality}
                    onChange={(e) => setCustomerDetails({ ...customerDetails, municipality: e.target.value })}
                    placeholder="Municipality"
                  />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input 
                    className="bg-[#FDFCF8]"
                    value={customerDetails.city}
                    onChange={(e) => setCustomerDetails({ ...customerDetails, city: e.target.value })}
                    placeholder="City"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input 
                    className="bg-[#FDFCF8]"
                    value={customerDetails.country}
                    onChange={(e) => setCustomerDetails({ ...customerDetails, country: e.target.value })}
                    placeholder="Country"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Zip Code</Label>
                  <Input 
                    className="bg-[#FDFCF8]"
                    value={customerDetails.zip}
                    onChange={(e) => setCustomerDetails({ ...customerDetails, zip: e.target.value })}
                    placeholder="Zip"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Applied Price Tier</Label>
                <Select value={selectedTierId || 'none'} onValueChange={(v) => setSelectedTierId(v === 'none' ? '' : v)}>
                  <SelectTrigger className="bg-[#FDFCF8] border-[#D4AF37]/20">
                    <SelectValue placeholder="Price Tier">
                      {selectedTierId 
                        ? (priceTiers.find(t => t.id === selectedTierId)?.name || 'Price Tier') 
                        : 'Standard Retail Price'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Standard Retail Price</SelectItem>
                    {priceTiers.map(tier => (
                      <SelectItem key={tier.id} value={tier.id}>{tier.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground italic">
                  Automatic tier based on customer selection, but can be manually overridden.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Full Payment</span>
                  <div className="flex items-center gap-2">
                    <Label className="text-[10px] font-bold uppercase transition-colors" style={{ color: isSplitPayment ? '#94a3b8' : '#1A2B4B' }}>Single</Label>
                    <button 
                      className={cn(
                        "w-10 h-5 rounded-full p-1 transition-colors relative",
                        isSplitPayment ? "bg-indigo-600" : "bg-slate-300"
                      )}
                      onClick={() => {
                        setIsSplitPayment(!isSplitPayment);
                        if (!isSplitPayment) {
                          setPaymentSplits([
                            { methodId: 'cash', methodName: 'Cash', amount: total },
                          ]);
                        }
                      }}
                    >
                      <div className={cn(
                        "w-3 h-3 bg-white rounded-full transition-transform",
                        isSplitPayment ? "translate-x-5" : "translate-x-0"
                      )} />
                    </button>
                    <Label className="text-[10px] font-bold uppercase transition-colors" style={{ color: isSplitPayment ? '#1A2B4B' : '#94a3b8' }}>Split</Label>
                  </div>
                </div>

                {!isSplitPayment ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      <Button 
                        variant={activeCategory === 'cash' ? 'default' : 'outline'}
                        className={cn("h-14 flex-col gap-1 px-1", activeCategory === 'cash' ? "bg-[#1A2B4B] text-white" : "bg-[#FDFCF8] border-slate-200")}
                        onClick={() => {
                          setActiveCategory('cash');
                          setPaymentMethod('cash');
                        }}
                      >
                        <Banknote className="w-5 h-5" />
                        <span className="text-[10px] font-bold">CASH</span>
                      </Button>
                      <Button 
                        variant={activeCategory === 'card' ? 'default' : 'outline'}
                        className={cn("h-14 flex-col gap-1 px-1", activeCategory === 'card' ? "bg-[#1A2B4B] text-white" : "bg-[#FDFCF8] border-slate-200")}
                        onClick={() => {
                          setActiveCategory('card');
                          // If there are specific card types, pick the first one, else default to 'card'
                          const cardOpts = paymentOptions.filter(o => o.type === 'card' && o.active);
                          setPaymentMethod(cardOpts.length > 0 ? cardOpts[0].id : 'card');
                        }}
                      >
                        <CreditCard className="w-5 h-5" />
                        <span className="text-[10px] font-bold">CARD</span>
                      </Button>
                      <Button 
                        variant={activeCategory === 'digital' ? 'default' : 'outline'}
                        className={cn("h-14 flex-col gap-1 px-1", activeCategory === 'digital' ? "bg-[#1A2B4B] text-white" : "bg-[#FDFCF8] border-slate-200")}
                        onClick={() => {
                          setActiveCategory('digital');
                          const digitalOpts = paymentOptions.filter(o => (o.type === 'ewallet' || o.type === 'bank') && o.active);
                          if (digitalOpts.length > 0) {
                            setPaymentMethod(digitalOpts[0].id);
                          } else {
                            setPaymentMethod('digital'); // Fallback
                          }
                        }}
                      >
                        <Wallet className="w-5 h-5" />
                        <span className="text-[10px] font-bold">DIGITAL</span>
                      </Button>
                    </div>

                    {/* Sub-options as "radio buttons" (selectable badges/items) */}
                    {activeCategory !== 'cash' && (
                      <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 space-y-3">
                        <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Select Option</Label>
                        <div className="flex flex-wrap gap-2">
                          {activeCategory === 'card' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setPaymentMethod('card')}
                                className={cn(
                                  "px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border",
                                  paymentMethod === 'card' 
                                    ? "bg-[#1A2B4B] text-white border-[#1A2B4B] shadow-md" 
                                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                )}
                              >
                                Generic Card
                              </button>
                              {paymentOptions.filter(o => o.type === 'card' && o.active).map(opt => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => setPaymentMethod(opt.id)}
                                  className={cn(
                                    "px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border",
                                    paymentMethod === opt.id 
                                      ? "bg-[#1A2B4B] text-white border-[#1A2B4B] shadow-md" 
                                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                  )}
                                >
                                  {opt.name}
                                </button>
                              ))}
                            </>
                          ) : (
                            paymentOptions.filter(o => (o.type === 'ewallet' || o.type === 'bank') && o.active).map(opt => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setPaymentMethod(opt.id)}
                                className={cn(
                                  "px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border flex items-center gap-1.5",
                                  paymentMethod === opt.id 
                                    ? "bg-[#1A2B4B] text-white border-[#1A2B4B] shadow-md" 
                                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                )}
                              >
                                {opt.type === 'ewallet' ? <Wallet className="w-2.5 h-2.5" /> : <Building className="w-2.5 h-2.5" />}
                                {opt.name}
                              </button>
                            ))
                          )}
                        </div>
                        
                        {/* Reference input for non-cash payments */}
                        <div className="space-y-1.5 pt-1">
                          <Label htmlFor="checkout-ref" className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Reference Info</Label>
                          <Input 
                            id="checkout-ref"
                            value={paymentReference}
                            onChange={(e) => setPaymentReference(e.target.value)}
                            placeholder="Ref # / Trans details"
                            className="h-8 text-xs bg-white border-slate-200"
                            required
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paymentSplits.map((split, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-4 space-y-1">
                          <Label className="text-[10px]">Method</Label>
                          <Select 
                            value={split.methodId} 
                            onValueChange={(v) => {
                              const opt = paymentOptions.find(o => o.id === v);
                              const newSplits = [...paymentSplits];
                              newSplits[index].methodId = v;
                              newSplits[index].methodName = v === 'cash' ? 'Cash' : v === 'card' ? 'Card' : opt?.name || v;
                              setPaymentSplits(newSplits);
                            }}
                          >
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="Method">
                                {split.methodId === 'cash' ? 'Cash' : 
                                 split.methodId === 'card' ? 'Card' : 
                                 (paymentOptions.find(o => o.id === split.methodId)?.name || split.methodId)}
                              </SelectValue>
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
                          <Label className="text-[10px]">Amount</Label>
                          <Input 
                            type="number" 
                            className="h-9 text-xs" 
                            value={split.amount}
                            onChange={(e) => {
                              const newSplits = [...paymentSplits];
                              newSplits[index].amount = Number(e.target.value);
                              setPaymentSplits(newSplits);
                            }}
                          />
                        </div>
                        <div className="col-span-4 space-y-1">
                          <Label className="text-[10px]">Reference</Label>
                          <Input 
                            className="h-9 text-xs" 
                            placeholder="Ref #" 
                            value={split.reference || ''}
                            onChange={(e) => {
                              const newSplits = [...paymentSplits];
                              newSplits[index].reference = e.target.value;
                              setPaymentSplits(newSplits);
                            }}
                          />
                        </div>
                        <div className="col-span-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 text-rose-500"
                            onClick={() => setPaymentSplits(prev => prev.filter((_, i) => i !== index))}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button 
                      variant="outline" 
                      className="w-full h-8 text-xs gap-1 border-dashed"
                      onClick={() => setPaymentSplits([...paymentSplits, { methodId: 'cash', methodName: 'Cash', amount: 0 }])}
                    >
                      <Plus className="w-3 h-3" /> Add Split Method
                    </Button>
                    <div className={cn(
                      "text-[10px] text-right font-bold",
                      Math.abs(paymentSplits.reduce((s, i) => s + i.amount, 0) - total) < 0.01 ? "text-emerald-600" : "text-rose-500"
                    )}>
                      Total Covered: {settings.currency}{(paymentSplits.reduce((s, i) => s + (i.amount ?? 0), 0)).toFixed(2)} / {settings.currency}{(total ?? 0).toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-[#FDFCF8] p-4 rounded-xl border border-[#D4AF37]/10 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Items:</span>
              <span className="font-medium text-[#1A2B4B]">{cart.reduce((sum, i) => sum + i.quantity, 0)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span className="text-[#1A2B4B]">Total Amount:</span>
              <span className="text-[#D4AF37]">{settings.currency}{(total ?? 0).toFixed(2)}</span>
            </div>
          </div>

          <DialogFooter className="gap-2 mt-auto border-t pt-4">
            <Button variant="outline" className="rounded-xl" onClick={() => setIsCheckoutOpen(false)}>Cancel</Button>
            <Button 
              variant="outline"
              className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-white rounded-xl"
              onClick={() => handleCheckout(true)}
              disabled={processing}
            >
              Mark as Pending
            </Button>
            <Button 
              className="bg-[#1A2B4B] hover:bg-[#2C3E50] text-white rounded-xl px-8" 
              onClick={() => handleCheckout(false)}
              disabled={processing}
            >
              {processing ? 'Processing...' : 'Confirm Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={isSuccessOpen} onOpenChange={setIsSuccessOpen}>
        <DialogContent className="sm:max-w-[400px] md:min-h-[400px] max-h-[95vh] overflow-y-auto flex flex-col justify-center text-center bg-white/95 backdrop-blur-md border-[#D4AF37]/20">
          <div className="py-8 flex flex-col items-center">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 10 }}
              className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6"
            >
              <CheckCircle2 className="w-12 h-12 text-emerald-600" />
            </motion.div>
            <h2 className="text-2xl font-bold text-[#1A2B4B] mb-2 font-heading">Sale Successful!</h2>
            <p className="text-slate-500 mb-8 text-sm">Transaction ID: {lastSaleId}</p>
            
            <div className="grid grid-cols-2 gap-3 w-full">
              <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setIsSuccessOpen(false)}>
                <Plus className="w-4 h-4" />
                New Sale
              </Button>
              <Button className="gap-2 bg-[#1A2B4B] hover:bg-[#2C3E50] text-white rounded-xl">
                <Printer className="w-4 h-4" />
                Print Receipt
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(scanned) => {
          const matched = products.find(p => 
            p.barcode?.toLowerCase() === scanned.toLowerCase() ||
            p.sku?.toLowerCase() === scanned.toLowerCase()
          );
          if (matched) {
            addToCart(matched, addQtyMulti);
            toast.success(`Scanned: ${matched.name} added to cart`);
          } else {
            toast.error(`No product found with barcode "${scanned}"`);
          }
        }}
      />

      <style dangerouslySetInnerHTML={{ __html: `

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}} />
    </motion.div>
  );
};
