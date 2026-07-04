import React, { useEffect, useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Building2,
  Tags,
  Edit2,
  Users,
  MapPin,
  Search,
  BookOpen,
  TrendingUp,
  LayoutGrid
} from 'lucide-react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Category, Brand, Supplier, Location, Customer, PriceTier } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { OperationType, handleFirestoreError } from '@/lib/firestore-utils';
import { useAuth } from '@/contexts/AuthContext';
import { logAction } from '@/lib/audit';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
export const Directory: React.FC = () => {
  const { profile, isAdmin, isManager } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([]);
  
  const [newCategory, setNewCategory] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newSupplier, setNewSupplier] = useState({ name: '', contact: '', email: '', address: '' });
  const [newLocation, setNewLocation] = useState({ 
    name: '', 
    addressLine1: '', 
    addressLine2: '', 
    municipality: '', 
    city: 'Pampanga', 
    country: 'Philippines' 
  });
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    billingAddress: '',
    shippingAddress: '',
    municipality: '',
    city: '',
    country: 'Philippines',
    zip: '',
    email: '',
    phone: '',
    priceTierId: ''
  });
  const [newPriceTier, setNewPriceTier] = useState({ name: '', description: '' });

  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingPriceTier, setEditingPriceTier] = useState<PriceTier | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!profile) return;

    const unsubscribeCats = onSnapshot(collection(db, 'categories'), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    }, (error) => {
      console.warn("Directory: Error listening to categories:", error);
    });
    const unsubscribeBrands = onSnapshot(collection(db, 'brands'), (snapshot) => {
      setBrands(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brand)));
    }, (error) => {
      console.warn("Directory: Error listening to brands:", error);
    });
    const unsubscribeSups = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    }, (error) => {
      console.warn("Directory: Error listening to suppliers:", error);
    });
    const unsubscribeLocs = onSnapshot(collection(db, 'locations'), (snapshot) => {
      setLocations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Location)));
    }, (error) => {
      console.warn("Directory: Error listening to locations:", error);
    });
    const unsubscribeCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    }, (error) => {
      console.warn("Directory: Error listening to customers:", error);
    });
    const unsubscribeTiers = onSnapshot(collection(db, 'priceTiers'), (snapshot) => {
      setPriceTiers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PriceTier)));
    }, (error) => {
      console.warn("Directory: Error listening to priceTiers:", error);
    });

    return () => {
      unsubscribeCats();
      unsubscribeBrands();
      unsubscribeSups();
      unsubscribeLocs();
      unsubscribeCustomers();
      unsubscribeTiers();
    };
  }, [profile]);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) return;
    
    if (categories.some(c => c.name.toLowerCase() === newCategory.trim().toLowerCase())) {
      toast.error('Category with this name already exists');
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'categories'), { name: newCategory });
      await logAction(profile, 'CREATE_CATEGORY', `Created category: ${newCategory}`, docRef.id, 'category');
      setNewCategory('');
      toast.success('Category added');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'categories');
    }
  };

  const handleAddBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrand.trim()) return;
    
    if (brands.some(b => b.name.toLowerCase() === newBrand.trim().toLowerCase())) {
      toast.error('Brand with this name already exists');
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'brands'), { name: newBrand });
      await logAction(profile, 'CREATE_BRAND', `Created brand: ${newBrand}`, docRef.id, 'brand');
      setNewBrand('');
      toast.success('Brand added');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'brands');
    }
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.name.trim()) return;

    if (suppliers.some(s => s.name.toLowerCase() === newSupplier.name.trim().toLowerCase())) {
      toast.error('Supplier with this name already exists');
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'suppliers'), newSupplier);
      await logAction(profile, 'CREATE_SUPPLIER', `Created supplier: ${newSupplier.name}`, docRef.id, 'supplier');
      setNewSupplier({ name: '', contact: '', email: '', address: '' });
      toast.success('Supplier added');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'suppliers');
    }
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocation.name.trim()) return;

    if (locations.some(l => l.name.toLowerCase() === newLocation.name.trim().toLowerCase())) {
      toast.error('Location with this name already exists');
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'locations'), newLocation);
      await logAction(profile, 'CREATE_LOCATION', `Created location: ${newLocation.name}`, docRef.id, 'location');
      setNewLocation({ 
        name: '', 
        addressLine1: '', 
        addressLine2: '', 
        municipality: '', 
        city: 'Pampanga', 
        country: 'Philippines' 
      });
      toast.success('Location added');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'locations');
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name.trim()) return;

    if (customers.some(c => c.name.toLowerCase() === newCustomer.name.trim().toLowerCase())) {
      toast.error('Customer with this name already exists');
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'customers'), {
        ...newCustomer,
        createdAt: new Date()
      });
      await logAction(profile, 'CREATE_CUSTOMER', `Created customer: ${newCustomer.name}`, docRef.id, 'customer');
      setNewCustomer({
        name: '',
        billingAddress: '',
        shippingAddress: '',
        municipality: '',
        city: '',
        country: 'Philippines',
        zip: '',
        email: '',
        phone: '',
        priceTierId: ''
      });
      toast.success('Customer added');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'customers');
    }
  };

  const handleAddPriceTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPriceTier.name.trim()) return;

    if (priceTiers.some(t => t.name.toLowerCase() === newPriceTier.name.trim().toLowerCase())) {
      toast.error('Price tier with this name already exists');
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'priceTiers'), newPriceTier);
      await logAction(profile, 'CREATE_PRICE_TIER', `Created price tier: ${newPriceTier.name}`, docRef.id, 'priceTier');
      setNewPriceTier({ name: '', description: '' });
      toast.success('Price tier created');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'priceTiers');
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editingCategory.name.trim()) return;
    try {
      await updateDoc(doc(db, 'categories', editingCategory.id), { name: editingCategory.name });
      await logAction(profile, 'UPDATE_CATEGORY', `Updated category: ${editingCategory.name}`, editingCategory.id, 'category');
      setEditingCategory(null);
      toast.success('Category updated');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'categories');
    }
  };

  const handleUpdateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBrand || !editingBrand.name.trim()) return;
    try {
      await updateDoc(doc(db, 'brands', editingBrand.id), { name: editingBrand.name });
      await logAction(profile, 'UPDATE_BRAND', `Updated brand: ${editingBrand.name}`, editingBrand.id, 'brand');
      setEditingBrand(null);
      toast.success('Brand updated');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'brands');
    }
  };

  const handleUpdateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier || !editingSupplier.name.trim()) return;
    try {
      const { id, ...data } = editingSupplier;
      await updateDoc(doc(db, 'suppliers', id), data);
      await logAction(profile, 'UPDATE_SUPPLIER', `Updated supplier: ${data.name}`, id, 'supplier');
      setEditingSupplier(null);
      toast.success('Supplier updated');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'suppliers');
    }
  };

  const handleUpdateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLocation || !editingLocation.name.trim()) return;
    try {
      const { id, ...data } = editingLocation;
      await updateDoc(doc(db, 'locations', id), data);
      await logAction(profile, 'UPDATE_LOCATION', `Updated location: ${data.name}`, id, 'location');
      setEditingLocation(null);
      toast.success('Location updated');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'locations');
    }
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer || !editingCustomer.name.trim()) return;
    try {
      const { id, ...data } = editingCustomer;
      await updateDoc(doc(db, 'customers', id), data);
      await logAction(profile, 'UPDATE_CUSTOMER', `Updated customer: ${data.name}`, id, 'customer');
      setEditingCustomer(null);
      toast.success('Customer updated');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'customers');
    }
  };

  const handleUpdatePriceTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPriceTier || !editingPriceTier.name.trim()) return;
    try {
      const { id, ...data } = editingPriceTier;
      await updateDoc(doc(db, 'priceTiers', id), data);
      await logAction(profile, 'UPDATE_PRICE_TIER', `Updated price tier: ${data.name}`, id, 'priceTier');
      setEditingPriceTier(null);
      toast.success('Price tier updated');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'priceTiers');
    }
  };

  const handleDelete = async (collectionName: string, id: string) => {
    const isAuthorized = isAdmin || isManager;
    
    if (!isAuthorized) {
      toast.error('You do not have permission to delete this');
      return;
    }
    
    let details = `Deleted item from ${collectionName}`;
    if (collectionName === 'categories') {
      const item = categories.find(c => c.id === id);
      details = `Deleted category: ${item?.name}`;
    } else if (collectionName === 'brands') {
      const item = brands.find(b => b.id === id);
      details = `Deleted brand: ${item?.name}`;
    } else if (collectionName === 'suppliers') {
      const item = suppliers.find(s => s.id === id);
      details = `Deleted supplier: ${item?.name}`;
    } else if (collectionName === 'locations') {
      const item = locations.find(l => l.id === id);
      details = `Deleted location: ${item?.name}`;
    } else if (collectionName === 'customers') {
      const item = customers.find(c => c.id === id);
      details = `Deleted customer: ${item?.name}`;
    } else if (collectionName === 'priceTiers') {
      const item = priceTiers.find(p => p.id === id);
      details = `Deleted price tier: ${item?.name}`;
    }

    if (window.confirm('Are you sure you want to delete this?')) {
      try {
        await deleteDoc(doc(db, collectionName, id));
        await logAction(profile, `DELETE_${collectionName.toUpperCase().replace(/S$/, '')}`, details, id, collectionName.slice(0, -1));
        toast.success(`${collectionName.charAt(0).toUpperCase() + collectionName.slice(1, -1)} deleted successfully`);
      } catch (error) {
        console.error(`Error deleting from ${collectionName}:`, error);
        toast.error(`Failed to delete. Please try again.`);
        handleFirestoreError(error, OperationType.DELETE, collectionName);
      }
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-primary tracking-tight font-heading">Directory</h1>
          <p className="text-muted-foreground">Manage your business master data and contacts.</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search directory..." 
            className="pl-10 bg-white border-border"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Tabs defaultValue="categories" className="space-y-6">
        <TabsList className="bg-secondary p-1 rounded-xl w-full md:w-auto overflow-x-auto flex-nowrap justify-start">
          <TabsTrigger value="categories" className="gap-2 rounded-lg px-6">
            <Tags className="w-4 h-4" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="brands" className="gap-2 rounded-lg px-6">
            <BookOpen className="w-4 h-4" />
            Brands
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-2 rounded-lg px-6">
            <Building2 className="w-4 h-4" />
            Suppliers
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="locations" className="gap-2 rounded-lg px-6">
              <MapPin className="w-4 h-4" />
              Locations
            </TabsTrigger>
          )}
          <TabsTrigger value="customers" className="gap-2 rounded-lg px-6">
            <Users className="w-4 h-4" />
            Customers
          </TabsTrigger>
          <TabsTrigger value="priceTiers" className="gap-2 rounded-lg px-6">
            <TrendingUp className="w-4 h-4" />
            Price Tiers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-1 border-none shadow-sm bg-white/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="font-heading text-2xl">Add Category</CardTitle>
                <CardDescription>Organize your products by type.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddCategory} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Category Name</Label>
                    <Input 
                      placeholder="e.g. Beverages" 
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Category
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="md:col-span-2 border-none shadow-sm">
              <CardHeader>
                <CardTitle className="font-heading text-2xl">Category List</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto border border-border rounded-xl">
                  <Table>
                    <TableHeader className="bg-secondary/30">
                      <TableRow>
                        <TableHead className="font-heading">Category Name</TableHead>
                        <TableHead className="text-right font-heading w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                            No categories found
                          </TableCell>
                        </TableRow>
                      ) : (
                        categories
                          .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map((cat) => (
                            <TableRow key={cat.id} className="group hover:bg-secondary/20">
                              <TableCell className="font-semibold text-primary">{cat.name}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                    onClick={() => setEditingCategory(cat)}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete('categories', cat.id);
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="brands" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-1 border-none shadow-sm bg-white/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="font-heading text-2xl">Add Brand</CardTitle>
                <CardDescription>Group products by manufacturer or brand name.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddBrand} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Brand Name</Label>
                    <Input 
                      placeholder="e.g. Nike, Apple" 
                      value={newBrand}
                      onChange={(e) => setNewBrand(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Brand
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="md:col-span-2 border-none shadow-sm">
              <CardHeader>
                <CardTitle className="font-heading text-2xl">Brand List</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto border border-border rounded-xl">
                  <Table>
                    <TableHeader className="bg-secondary/30">
                      <TableRow>
                        <TableHead className="font-heading">Brand Name</TableHead>
                        <TableHead className="text-right font-heading w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {brands.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                            No brands found
                          </TableCell>
                        </TableRow>
                      ) : (
                        brands
                          .filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map((brand) => (
                            <TableRow key={brand.id} className="group hover:bg-secondary/20">
                              <TableCell className="font-semibold text-primary">{brand.name}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                    onClick={() => setEditingBrand(brand)}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete('brands', brand.id);
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="suppliers" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-1 border-none shadow-sm bg-white/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="font-heading text-2xl">Add Supplier</CardTitle>
                <CardDescription>Register a new business partner.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddSupplier} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Supplier Name</Label>
                    <Input 
                      value={newSupplier.name}
                      onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                      placeholder="e.g. Agos Wholesale"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Person</Label>
                    <Input 
                      value={newSupplier.contact}
                      onChange={(e) => setNewSupplier({ ...newSupplier, contact: e.target.value })}
                      placeholder="e.g. Juan Dela Cruz"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input 
                      type="email"
                      value={newSupplier.email}
                      onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                      placeholder="juan@agos.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Supplier Address</Label>
                    <Input 
                      value={newSupplier.address}
                      onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                      placeholder="Company address"
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Register Supplier
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="md:col-span-2 border-none shadow-sm">
              <CardHeader>
                <CardTitle className="font-heading text-2xl">Supplier Directory</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto border border-border rounded-xl">
                  <Table>
                    <TableHeader className="bg-secondary/30">
                      <TableRow>
                        <TableHead className="font-heading">Supplier Name</TableHead>
                        <TableHead className="font-heading">Contact Person</TableHead>
                        <TableHead className="font-heading">Email</TableHead>
                        <TableHead className="font-heading">Address</TableHead>
                        <TableHead className="text-right font-heading w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suppliers.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No suppliers found
                          </TableCell>
                        </TableRow>
                      ) : (
                        suppliers
                          .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map((sup) => (
                            <TableRow key={sup.id} className="group hover:bg-secondary/20">
                              <TableCell className="font-semibold text-primary">{sup.name}</TableCell>
                              <TableCell className="text-muted-foreground">{sup.contact || '-'}</TableCell>
                              <TableCell className="text-muted-foreground">{sup.email || '-'}</TableCell>
                              <TableCell className="text-muted-foreground">{sup.address || '-'}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                    onClick={() => setEditingSupplier(sup)}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete('suppliers', sup.id);
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="locations" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="md:col-span-1 border-none shadow-sm bg-white/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="font-heading text-2xl">Add Location</CardTitle>
                  <CardDescription>Branches and warehouses.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddLocation} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Location Name</Label>
                      <Input 
                        value={newLocation.name}
                        onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                        placeholder="e.g. Quezon City Hub"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Address</Label>
                      <Input 
                        value={newLocation.addressLine1}
                        onChange={(e) => setNewLocation({ ...newLocation, addressLine1: e.target.value })}
                        placeholder="Street address"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Municipality</Label>
                        <Input 
                          value={newLocation.municipality}
                          onChange={(e) => setNewLocation({ ...newLocation, municipality: e.target.value })}
                          placeholder="District"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>City</Label>
                        <Input 
                          value={newLocation.city}
                          onChange={(e) => setNewLocation({ ...newLocation, city: e.target.value })}
                          placeholder="City"
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Location
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="md:col-span-2 border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="font-heading text-2xl">Business Locations</CardTitle>
                </CardHeader>
                <CardContent>
                <div className="overflow-x-auto border border-border rounded-xl">
                  <Table>
                    <TableHeader className="bg-secondary/30">
                      <TableRow>
                        <TableHead className="font-heading">Location Name</TableHead>
                        <TableHead className="font-heading">Address</TableHead>
                        <TableHead className="font-heading">Municipality & City</TableHead>
                        <TableHead className="text-right font-heading w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {locations.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            No locations found
                          </TableCell>
                        </TableRow>
                      ) : (
                        locations
                          .filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map((loc) => (
                            <TableRow key={loc.id} className="group hover:bg-secondary/20">
                              <TableCell className="font-semibold text-primary">{loc.name}</TableCell>
                              <TableCell className="text-muted-foreground">{loc.addressLine1 || '-'}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {loc.municipality ? `${loc.municipality}, ` : ''}{loc.city || ''}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                    onClick={() => setEditingLocation(loc)}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete('locations', loc.id);
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        <TabsContent value="customers" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-1 border-none shadow-sm bg-white/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="font-heading text-2xl">New Customer</CardTitle>
                <CardDescription>Build your customer database.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddCustomer} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input 
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                      placeholder="Customer Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input 
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                      placeholder="0912 345 6789"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input 
                      type="email"
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                      placeholder="customer@email.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Assigned Price Tier</Label>
                    <Select 
                      value={newCustomer.priceTierId || 'none'} 
                      onValueChange={(v) => setNewCustomer({ ...newCustomer, priceTierId: v === 'none' ? '' : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Tier">
                          {newCustomer.priceTierId ? (priceTiers.find(t => t.id === newCustomer.priceTierId)?.name || 'Select Tier') : 'Default Retail Price'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Default Retail Price</SelectItem>
                        {priceTiers.map(tier => (
                          <SelectItem key={tier.id} value={tier.id}>{tier.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Save Customer
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="md:col-span-2 border-none shadow-sm">
              <CardHeader>
                <CardTitle className="font-heading text-2xl">Customer Database</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto border border-border rounded-xl">
                  <Table>
                    <TableHeader className="bg-secondary/30">
                      <TableRow>
                        <TableHead className="font-heading">Customer Name</TableHead>
                        <TableHead className="font-heading">Phone</TableHead>
                        <TableHead className="font-heading">Email</TableHead>
                        <TableHead className="font-heading">Price Tier</TableHead>
                        <TableHead className="text-right font-heading w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No customers found
                          </TableCell>
                        </TableRow>
                      ) : (
                        customers
                          .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map((cust) => (
                            <TableRow key={cust.id} className="group hover:bg-secondary/20">
                              <TableCell className="font-semibold text-primary">{cust.name}</TableCell>
                              <TableCell className="text-muted-foreground">{cust.phone || '-'}</TableCell>
                              <TableCell className="text-muted-foreground">{cust.email || '-'}</TableCell>
                              <TableCell>
                                {cust.priceTierId ? (
                                  <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50/80 border-none text-[11px]">
                                    {priceTiers.find(t => t.id === cust.priceTierId)?.name || 'Custom Tier'}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Default Retail</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                    onClick={() => setEditingCustomer(cust)}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete('customers', cust.id);
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="priceTiers" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-1 border-none shadow-sm bg-white/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="font-heading text-2xl">Add Price Tier</CardTitle>
                <CardDescription>Define special pricing for specific customers.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddPriceTier} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tier Name</Label>
                    <Input 
                      value={newPriceTier.name}
                      onChange={(e) => setNewPriceTier({ ...newPriceTier, name: e.target.value })}
                      placeholder="e.g. VIP, Wholesaler"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input 
                      value={newPriceTier.description}
                      onChange={(e) => setNewPriceTier({ ...newPriceTier, description: e.target.value })}
                      placeholder="e.g. 10% discount for bulk orders"
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Price Tier
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="md:col-span-2 border-none shadow-sm">
              <CardHeader>
                <CardTitle className="font-heading text-2xl">Price Tiers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto border border-border rounded-xl">
                  <Table>
                    <TableHeader className="bg-secondary/30">
                      <TableRow>
                        <TableHead className="font-heading">Tier Name</TableHead>
                        <TableHead className="font-heading">Description</TableHead>
                        <TableHead className="text-right font-heading w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {priceTiers.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                            No price tiers found
                          </TableCell>
                        </TableRow>
                      ) : (
                        priceTiers
                          .filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map((tier) => (
                            <TableRow key={tier.id} className="group hover:bg-secondary/20">
                              <TableCell className="font-semibold text-primary">{tier.name}</TableCell>
                              <TableCell className="text-muted-foreground">{tier.description || '-'}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                    onClick={() => setEditingPriceTier(tier)}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete('priceTiers', tier.id);
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialogs */}
      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateCategory} className="space-y-4">
            <div className="space-y-2">
              <Label>Category Name</Label>
              <Input 
                value={editingCategory?.name || ''} 
                onChange={(e) => setEditingCategory(prev => prev ? { ...prev, name: e.target.value } : null)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingCategory(null)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingBrand} onOpenChange={(open) => !open && setEditingBrand(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Brand</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateBrand} className="space-y-4">
            <div className="space-y-2">
              <Label>Brand Name</Label>
              <Input 
                value={editingBrand?.name || ''} 
                onChange={(e) => setEditingBrand(prev => prev ? { ...prev, name: e.target.value } : null)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingBrand(null)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingSupplier} onOpenChange={(open) => !open && setEditingSupplier(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateSupplier} className="space-y-4">
            <div className="space-y-2">
              <Label>Supplier Name</Label>
              <Input 
                value={editingSupplier?.name || ''} 
                onChange={(e) => setEditingSupplier(prev => prev ? { ...prev, name: e.target.value } : null)}
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Person</Label>
              <Input 
                value={editingSupplier?.contact || ''} 
                onChange={(e) => setEditingSupplier(prev => prev ? { ...prev, contact: e.target.value } : null)}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input 
                value={editingSupplier?.email || ''} 
                onChange={(e) => setEditingSupplier(prev => prev ? { ...prev, email: e.target.value } : null)}
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input 
                value={editingSupplier?.address || ''} 
                onChange={(e) => setEditingSupplier(prev => prev ? { ...prev, address: e.target.value } : null)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingSupplier(null)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingLocation} onOpenChange={(open) => !open && setEditingLocation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateLocation} className="space-y-4">
            <div className="space-y-2">
              <Label>Location Name</Label>
              <Input 
                value={editingLocation?.name || ''} 
                onChange={(e) => setEditingLocation(prev => prev ? { ...prev, name: e.target.value } : null)}
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input 
                value={editingLocation?.addressLine1 || ''} 
                onChange={(e) => setEditingLocation(prev => prev ? { ...prev, addressLine1: e.target.value } : null)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Municipality</Label>
                <Input 
                  value={editingLocation?.municipality || ''} 
                  onChange={(e) => setEditingLocation(prev => prev ? { ...prev, municipality: e.target.value } : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input 
                  value={editingLocation?.city || ''} 
                  onChange={(e) => setEditingLocation(prev => prev ? { ...prev, city: e.target.value } : null)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingLocation(null)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCustomer} onOpenChange={(open) => !open && setEditingCustomer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateCustomer} className="space-y-4">
            <div className="space-y-2">
              <Label>Customer Name</Label>
              <Input 
                value={editingCustomer?.name || ''} 
                onChange={(e) => setEditingCustomer(prev => prev ? { ...prev, name: e.target.value } : null)}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input 
                value={editingCustomer?.phone || ''} 
                onChange={(e) => setEditingCustomer(prev => prev ? { ...prev, phone: e.target.value } : null)}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input 
                value={editingCustomer?.email || ''} 
                onChange={(e) => setEditingCustomer(prev => prev ? { ...prev, email: e.target.value } : null)}
              />
            </div>
            <div className="space-y-2">
              <Label>Assigned Price Tier</Label>
              <Select 
                value={editingCustomer?.priceTierId || 'none'} 
                onValueChange={(v) => setEditingCustomer(prev => prev ? { ...prev, priceTierId: v === 'none' ? '' : v } : null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Tier">
                    {editingCustomer?.priceTierId ? (priceTiers.find(t => t.id === editingCustomer.priceTierId)?.name || 'Select Tier') : 'Default Retail Price'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Default Retail Price</SelectItem>
                  {priceTiers.map(tier => (
                    <SelectItem key={tier.id} value={tier.id}>{tier.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingCustomer(null)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingPriceTier} onOpenChange={(open) => !open && setEditingPriceTier(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Price Tier</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdatePriceTier} className="space-y-4">
            <div className="space-y-2">
              <Label>Tier Name</Label>
              <Input 
                value={editingPriceTier?.name || ''} 
                onChange={(e) => setEditingPriceTier(prev => prev ? { ...prev, name: e.target.value } : null)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input 
                value={editingPriceTier?.description || ''} 
                onChange={(e) => setEditingPriceTier(prev => prev ? { ...prev, description: e.target.value } : null)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingPriceTier(null)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
