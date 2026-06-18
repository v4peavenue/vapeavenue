import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Package, 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  AlertTriangle,
  MoreVertical,
  ArrowUpDown,
  ShoppingCart
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Product, Category, Brand, Supplier, Location } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useLocations } from '@/contexts/LocationContext';
import { useSettings } from '@/contexts/SettingsContext';
import { logAction } from '@/lib/audit';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ProductForm } from '@/components/ProductForm';
import { StockAdjustmentForm } from '@/components/StockAdjustmentForm';
import { toast } from 'sonner';
import { OperationType, handleFirestoreError } from '@/lib/firestore-utils';
import { cn } from '@/lib/utils';
import { 
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MapPin } from 'lucide-react';
import { motion } from 'motion/react';

export const Inventory: React.FC = () => {
  const { profile, isAdmin, isManager } = useAuth();
  const { selectedLocationId, locations } = useLocations();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adjustingProductId, setAdjustingProductId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!profile) return;

    const q = query(collection(db, 'products'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(productList);
      setLoading(false);
    }, (error) => {
      console.warn("Inventory: Error listening to products:", error);
      setLoading(false);
    });

    const unsubscribeCats = onSnapshot(collection(db, 'categories'), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    }, (error) => {
      console.warn("Inventory: Error listening to categories:", error);
    });

    const unsubscribeSups = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    }, (error) => {
      console.warn("Inventory: Error listening to suppliers:", error);
    });

    const unsubscribeBrands = onSnapshot(collection(db, 'brands'), (snapshot) => {
      setBrands(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brand)));
    }, (error) => {
      console.warn("Inventory: Error listening to brands:", error);
    });

    return () => {
      unsubscribe();
      unsubscribeCats();
      unsubscribeSups();
      unsubscribeBrands();
    };
  }, [profile]);

  const handleDelete = async (id: string) => {
    if (!isManager) {
      toast.error('You do not have permission to delete products');
      return;
    }
    const product = products.find(p => p.id === id);
    if (window.confirm(`Are you sure you want to delete "${product?.name}"?`)) {
      try {
        await deleteDoc(doc(db, 'products', id));
        await logAction(profile, 'DELETE_PRODUCT', `Deleted product: ${product?.name} (SKU: ${product?.sku})`, id, 'product');
        toast.success('Product deleted');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'products');
      }
    }
  };

  const getDisplayStock = (product: Product) => {
    if (selectedLocationId === 'all') {
      return Object.values(product.stocks || {}).reduce((sum, val) => (sum as number) + Number(val), 0) as number;
    }
    return Number(product.stocks?.[selectedLocationId] || 0);
  };

  const isLowStock = (product: Product, locationId: string) => {
    const stock = locationId === 'all' 
      ? Object.values(product.stocks || {}).reduce((sum, val) => (sum as number) + Number(val), 0) as number
      : Number(product.stocks?.[locationId] || 0);
    
    const threshold = locationId === 'all' 
      ? product.lowStockThreshold 
      : (product.locationThresholds?.[locationId] ?? product.lowStockThreshold);
      
    return stock > 0 && stock <= threshold;
  };

  const isOutOfStock = (product: Product, locationId: string) => {
    const stock = locationId === 'all' 
      ? Object.values(product.stocks || {}).reduce((sum, val) => (sum as number) + Number(val), 0) as number
      : Number(product.stocks?.[locationId] || 0);
    return stock <= 0;
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    const matchesBrand = brandFilter === 'all' || p.brand === brandFilter;
    
    // Filter by global location
    const matchesLocation = selectedLocationId === 'all' || (p.locationIds && p.locationIds.includes(selectedLocationId));
    
    return matchesSearch && matchesCategory && matchesBrand && matchesLocation;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1A2B4B] tracking-tight">Inventory</h1>
          <p className="text-slate-500">Manage your products and stock levels.</p>
        </div>
        {isManager && (
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 border-[#D4AF37]/20 hover:bg-[#D4AF37]/5" onClick={() => {
              setAdjustingProductId(undefined);
              setIsAdjustmentOpen(true);
            }}>
              <ArrowUpDown className="w-4 h-4" />
              Adjust Stock
            </Button>
            <Button variant="outline" className="gap-2 border-[#D4AF37]/20 hover:bg-[#D4AF37]/5" onClick={() => navigate('/purchasing')}>
              <ShoppingCart className="w-4 h-4" />
              Purchase Stock
            </Button>
            <Button className="gap-2 bg-[#1A2B4B] hover:bg-[#2C3E50] text-white" onClick={() => {
              setEditingProduct(null);
              setIsFormOpen(true);
            }}>
              <Plus className="w-4 h-4" />
              Add Product
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            className="pl-10 bg-white/50 border-slate-200 focus:border-[#D4AF37] focus:ring-[#D4AF37]" 
            placeholder="Search products by name, SKU, or Barcode..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px] bg-white/50 border-slate-200">
              <SelectValue placeholder="Category">
                {categoryFilter === 'all' ? 'All Categories' : categoryFilter}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-[160px] bg-white/50 border-slate-200">
              <SelectValue placeholder="Brand">
                {brandFilter === 'all' ? 'All Brands' : brandFilter}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {brands.map(brand => (
                <SelectItem key={brand.id} value={brand.name}>{brand.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white/50 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow>
              <TableHead className="w-[300px] text-[#1A2B4B] font-semibold">Product</TableHead>
              <TableHead className="text-[#1A2B4B] font-semibold">SKU</TableHead>
              <TableHead className="text-[#1A2B4B] font-semibold">Category</TableHead>
              <TableHead className="text-[#1A2B4B] font-semibold">Brand</TableHead>
              <TableHead className="text-[#1A2B4B] font-semibold">Price</TableHead>
              <TableHead className="text-[#1A2B4B] font-semibold">Stock</TableHead>
              <TableHead className="text-[#1A2B4B] font-semibold">Status</TableHead>
              <TableHead className="text-right text-[#1A2B4B] font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">Loading inventory...</TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-slate-500">
                  {searchTerm ? 'No products found matching your search.' : 'No products in inventory yet.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product, index) => {
                return (
                  <motion.tr 
                    key={product.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="group hover:bg-[#FDFCF8] transition-colors border-b last:border-0"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white flex-shrink-0 overflow-hidden border border-slate-100 group-hover:border-[#D4AF37]/30 transition-colors">
                          {product.imageUrl ? (
                            <img 
                              src={product.imageUrl} 
                              alt={product.name} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <Package className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-[#1A2B4B]">{product.name}</div>
                          <div className="text-xs text-slate-500">Cost: {settings.currency}{(product.cost ?? 0).toFixed(2)}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-xs text-slate-600">{product.sku}</div>
                      {product.barcode && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5" title="Barcode">
                          ║ {product.barcode}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal bg-slate-100 text-slate-600 border-none">
                        {product.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal border-indigo-100 bg-indigo-50 text-indigo-600">
                        {product.brand || 'No Brand'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-[#1A2B4B]">{settings.currency}{(product.price ?? 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "font-medium",
                          isOutOfStock(product, selectedLocationId) 
                            ? "text-rose-600" 
                            : isLowStock(product, selectedLocationId) 
                              ? "text-amber-600 font-bold" 
                              : "text-[#1A2B4B]"
                        )}>
                          {getDisplayStock(product)}
                        </div>
                        <Tooltip>
                          <TooltipTrigger 
                            render={
                              <div className="h-6 w-6 flex items-center justify-center text-slate-400 hover:bg-white hover:text-[#D4AF37] rounded-md cursor-pointer transition-colors">
                                <MapPin className="w-3 h-3" />
                              </div>
                            }
                          />
                          <TooltipContent side="right" className="bg-white border-slate-200">
                              <div className="space-y-1.5 p-2 min-w-[150px]">
                                <p className="text-[10px] font-black uppercase text-[#D4AF37] border-b border-[#D4AF37]/20 pb-1 mb-2 tracking-widest text-center">Stock & Alert Levels</p>
                                {locations.map(loc => {
                                  const threshold = product.locationThresholds?.[loc.id] ?? product.lowStockThreshold;
                                  const stock = product.stocks?.[loc.id] || 0;
                                  const isLow = stock > 0 && stock <= threshold;
                                  
                                  return (
                                    <div key={loc.id} className="flex flex-col gap-0.5 mb-2 last:mb-0">
                                      <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-slate-600 truncate max-w-[100px]">{loc.name}</span>
                                        <span className={cn(
                                          "font-black tracking-tight",
                                          stock <= 0 ? "text-rose-500" : isLow ? "text-amber-600" : "text-[#1A2B4B]"
                                        )}>{stock}</span>
                                      </div>
                                      <div className="flex justify-between items-center text-[9px] text-slate-400">
                                        <span>Alert Level:</span>
                                        <span>{threshold}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                    </TableCell>
                    <TableCell>
                      {isOutOfStock(product, selectedLocationId) ? (
                        <Badge variant="destructive" className="gap-1 bg-rose-50 text-rose-700 border-rose-100 shadow-sm">
                          <AlertTriangle className="w-3 h-3" />
                          Out of Stock
                        </Badge>
                      ) : isLowStock(product, selectedLocationId) ? (
                        <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-amber-700 shadow-sm">
                          <AlertTriangle className="w-3 h-3" />
                          Low Stock
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm font-bold">
                          Healthy
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isManager && (
                        <DropdownMenu>
                          <DropdownMenuTrigger 
                            render={
                              <Button variant="ghost" size="icon" className="hover:bg-white hover:text-[#1A2B4B]">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end" className="bg-white border-slate-200">
                            <DropdownMenuItem onClick={() => {
                              setAdjustingProductId(product.id);
                              setIsAdjustmentOpen(true);
                            }}>
                              <ArrowUpDown className="w-4 h-4 mr-2" />
                              Adjust Stock
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setEditingProduct(product);
                              setIsFormOpen(true);
                            }}>
                              <Edit2 className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-rose-600" onClick={() => handleDelete(product.id)}>
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </motion.tr>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ProductForm 
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        product={editingProduct}
        products={products}
        categories={categories}
        brands={brands}
        suppliers={suppliers}
      />

      <StockAdjustmentForm
        isOpen={isAdjustmentOpen}
        onClose={() => setIsAdjustmentOpen(false)}
        products={products}
        locations={locations}
        initialProductId={adjustingProductId}
      />
    </motion.div>
  );
};
