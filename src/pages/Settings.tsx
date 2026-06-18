import React, { useEffect, useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Plus, 
  Trash2, 
  User, 
  Shield, 
  Database,
  Building2,
  Tags,
  Edit2,
  Users,
  Mail,
  Check,
  X,
  History,
  FileText,
  Package,
  Ticket,
  CreditCard,
  Wallet,
  Building,
  Banknote
} from 'lucide-react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, orderBy, limit, getDocs, writeBatch, Timestamp, setDoc, deleteField } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Category, Supplier, UserProfile, Location, Invite, AuditLog, Customer, Product, PromoCode, PaymentOption } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { OperationType, handleFirestoreError } from '@/lib/firestore-utils';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { MapPin, Coins } from 'lucide-react';
import { logAction } from '@/lib/audit';
import { motion } from 'motion/react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export const Settings: React.FC = () => {
  const { profile, isAdmin, isManager, updateProfile } = useAuth();
  const { settings, updateCurrency } = useSettings();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([]);
  
  const [newInvite, setNewInvite] = useState({ 
    email: '', 
    role: 'staff' as 'admin' | 'manager' | 'staff',
    locationId: ''
  });

  const [newPromo, setNewPromo] = useState({
    code: '',
    amount: 0,
    isPermanent: true,
    startDate: '',
    endDate: '',
    isActive: true
  });

  const [newPayment, setNewPayment] = useState({
    name: '',
    type: 'bank' as 'bank' | 'ewallet' | 'cash' | 'card',
    active: true,
    initialBalance: 0
  });

  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);
  const [editingPayment, setEditingPayment] = useState<PaymentOption | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(profile?.name || '');

  useEffect(() => {
    if (!profile) return;

    const unsubscribeLocs = onSnapshot(collection(db, 'locations'), (snapshot) => {
      setLocations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Location)));
    }, (error) => {
      console.warn("Settings: Error listening to locations:", error);
    });

    const unsubscribePromos = onSnapshot(collection(db, 'promos'), (snapshot) => {
      setPromos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PromoCode)));
    }, (error) => {
      console.warn("Settings: Error listening to promos:", error);
    });

    const unsubscribePayments = onSnapshot(collection(db, 'paymentOptions'), (snapshot) => {
      setPaymentOptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentOption)));
    }, (error) => {
      console.warn("Settings: Error listening to paymentOptions:", error);
    });

    let unsubscribeUsers: () => void = () => {};
    let unsubscribeInvites: () => void = () => {};
    let unsubscribeAudit: () => void = () => {};

    if (isAdmin) {
      unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile)));
      }, (error) => {
        console.warn("Settings: Error listening to users:", error);
      });
      unsubscribeInvites = onSnapshot(query(collection(db, 'invites'), orderBy('createdAt', 'desc')), (snapshot) => {
        setInvites(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invite)));
      }, (error) => {
        console.warn("Settings: Error listening to invites:", error);
      });
      unsubscribeAudit = onSnapshot(query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100)), (snapshot) => {
        setAuditLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
      }, (error) => {
        console.warn("Settings: Error listening to audit_logs:", error);
      });
    }

    return () => {
      unsubscribeLocs();
      unsubscribePromos();
      unsubscribePayments();
      unsubscribeUsers();
      unsubscribeInvites();
      unsubscribeAudit();
    };
  }, [profile, isAdmin]);

  useEffect(() => {
    if (profile) setProfileName(profile.name || '');
  }, [profile]);

  const handleSyncStock = async () => {
    if (!isAdmin) return;
    setIsSyncing(true);
    try {
      const snapshot = await getDocs(collection(db, 'products'));
      const batch = writeBatch(db);
      let count = 0;

      snapshot.docs.forEach((docSnap) => {
        const product = { id: docSnap.id, ...docSnap.data() } as Product;
        const actualTotal = Object.values(product.stocks || {}).reduce((sum, val) => (sum as number) + Number(val), 0) as number;
        
        if (product.stock !== actualTotal) {
          batch.update(docSnap.ref, { stock: actualTotal });
          count++;
        }
      });

      if (count > 0) {
        await batch.commit();
        await logAction(profile, 'SYNC_STOCK', `Synchronized stock levels for ${count} products`, 'system', 'system');
        toast.success(`Synchronized ${count} products`);
      } else {
        toast.info('All stock levels are already accurate');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'products');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const oldName = profile?.name;
      await updateProfile({ name: profileName });
      await logAction(profile, 'UPDATE_PROFILE', `Updated profile name from "${oldName}" to "${profileName}"`, profile?.id, 'user');
      setEditingProfile(false);
    } catch (error) {
      // Error handled in updateProfile
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvite.email.trim()) return;
    try {
      const docRef = await addDoc(collection(db, 'invites'), {
        ...newInvite,
        status: 'pending',
        invitedBy: profile?.id,
        createdAt: new Date()
      });
      await logAction(profile, 'SEND_INVITE', `Sent ${newInvite.role} invite to ${newInvite.email}`, docRef.id, 'invite');
      setNewInvite({ email: '', role: 'staff', locationId: '' });
      toast.success('Invite sent to ' + newInvite.email);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'invites');
    }
  };

  const handleAddPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromo.code.trim()) return;

    if (promos.some(p => p.code.toLowerCase() === newPromo.code.trim().toLowerCase())) {
      toast.error('Promo with this code already exists');
      return;
    }

    try {
      const data: any = {
        code: newPromo.code,
        amount: newPromo.amount,
        isPermanent: newPromo.isPermanent,
        isActive: newPromo.isActive,
        createdAt: Timestamp.now()
      };
      
      if (!newPromo.isPermanent) {
        if (newPromo.startDate) data.startDate = Timestamp.fromDate(new Date(newPromo.startDate));
        if (newPromo.endDate) data.endDate = Timestamp.fromDate(new Date(newPromo.endDate));
      }

      const docRef = await addDoc(collection(db, 'promos'), data);
      await logAction(profile, 'CREATE_PROMO', `Created promo: ${newPromo.code}`, docRef.id, 'promo');
      setNewPromo({ code: '', amount: 0, isPermanent: true, startDate: '', endDate: '', isActive: true });
      toast.success('Promo created');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'promos');
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPayment.name.trim()) return;

    if (paymentOptions.some(p => p.name.toLowerCase() === newPayment.name.trim().toLowerCase())) {
      toast.error('Payment option with this name already exists');
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'paymentOptions'), newPayment);
      // Automatically create a financial account for this payment method
      await setDoc(doc(db, 'accounts', docRef.id), {
        name: newPayment.name,
        type: newPayment.type,
        balance: newPayment.initialBalance,
        lastUpdated: Timestamp.now()
      });
      await logAction(profile, 'CREATE_PAYMENT', `Created payment option and sync'd financial account with initial balance of ${newPayment.initialBalance}: ${newPayment.name}`, docRef.id, 'paymentOption');
      setNewPayment({ name: '', type: 'bank', active: true, initialBalance: 0 });
      toast.success('Payment option and financial account added');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'paymentOptions');
    }
  };

  const handleUpdatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPromo) return;
    try {
      const { id, ...data } = editingPromo;
      await updateDoc(doc(db, 'promos', id), data);
      await logAction(profile, 'UPDATE_PROMO', `Updated promo: ${data.code}`, id, 'promo');
      setEditingPromo(null);
      toast.success('Promo updated');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'promos');
    }
  };

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;
    try {
      const { id, ...data } = editingPayment;
      await updateDoc(doc(db, 'paymentOptions', id), data);
      await logAction(profile, 'UPDATE_PAYMENT', `Updated payment: ${data.name}`, id, 'paymentOption');
      setEditingPayment(null);
      toast.success('Payment updated');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'paymentOptions');
    }
  };
  const handleUpdateUser = async (userId: string, data: Partial<UserProfile>) => {
    if (userId === profile?.id && data.role) {
      toast.error("You cannot change your own role");
      return;
    }
    try {
      const user = users.find(u => u.id === userId);
      await updateDoc(doc(db, 'users', userId), data);
      await logAction(profile, 'UPDATE_USER', `Updated settings for ${user?.email}`, userId, 'user');
      toast.success('User updated');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const handleDelete = async (collectionName: string, id: string) => {
    const isAuthorized = isAdmin || isManager;
    
    if (!isAuthorized) {
      toast.error('You do not have permission to delete this');
      return;
    }
    
    let details = `Deleted item from ${collectionName}`;
    if (collectionName === 'invites') {
      const item = invites.find(i => i.id === id);
      details = `Cancelled invite for: ${item?.email}`;
    } else if (collectionName === 'users') {
      const item = users.find(u => u.id === id);
      details = `Removed user: ${item?.email}`;
    } else if (collectionName === 'paymentOptions') {
      const item = paymentOptions.find(p => p.id === id);
      details = `Deleted payment option: ${item?.name}`;
    } else if (collectionName === 'promos') {
      const item = promos.find(p => p.id === id);
      details = `Deleted promo code: ${item?.code}`;
    }

    if (window.confirm('Are you sure you want to delete this?')) {
      try {
        // If deleting a payment option, also delete its account or warn the user
        // The user request implies they are connected, so we delete both
        if (collectionName === 'paymentOptions') {
          await deleteDoc(doc(db, 'accounts', id));
          await logAction(profile, `DELETE_ACCOUNT`, `Deleted financial account sync'd with payment option: ${id}`, id, 'account');
        }

        await deleteDoc(doc(db, collectionName, id));
        await logAction(profile, `DELETE_${collectionName.toUpperCase().replace(/S$/, '')}`, details, id, collectionName.slice(0, -1));
        toast.success('Deleted successfully');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, collectionName);
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      <div>
        <h1 className="text-4xl font-bold text-primary tracking-tight font-heading">System</h1>
        <p className="text-muted-foreground">Manage system configurations and user access.</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-secondary p-1 rounded-xl">
          <TabsTrigger value="profile" className="gap-2 rounded-lg px-6">
            <User className="w-4 h-4" />
            Profile
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="users" className="gap-2 rounded-lg px-6">
              <Users className="w-4 h-4" />
              Users
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="business" className="gap-2 rounded-lg px-6">
              <Coins className="w-4 h-4" />
              Store
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="system" className="gap-2 rounded-lg px-6">
              <Shield className="w-4 h-4" />
              Settings
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="audit" className="gap-2 rounded-lg px-6">
              <History className="w-4 h-4" />
              Audit
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile">
          <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="font-heading text-2xl">User Profile</CardTitle>
                <CardDescription>Your personal information and role.</CardDescription>
              </div>
              {!editingProfile ? (
                <Button variant="outline" size="sm" onClick={() => setEditingProfile(true)} className="gap-2">
                  <Edit2 className="w-4 h-4" />
                  Edit Profile
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditingProfile(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                  <Button variant="default" size="sm" onClick={handleUpdateProfile} className="gap-2">
                    <Check className="w-4 h-4" />
                    Save
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input 
                    value={editingProfile ? profileName : (profile?.name || '')} 
                    onChange={(e) => setProfileName(e.target.value)}
                    readOnly={!editingProfile} 
                    className={cn("bg-secondary/50 border-none", !editingProfile && "cursor-not-allowed")} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input value={profile?.email || ''} readOnly className="bg-secondary/50 border-none cursor-not-allowed" />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Input value={profile?.role || ''} readOnly className="bg-secondary/50 border-none cursor-not-allowed capitalize" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="font-heading text-2xl">Invite User</CardTitle>
                <CardDescription>Send an invitation to join the application.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSendInvite} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input 
                      type="email"
                      value={newInvite.email}
                      onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
                      placeholder="e.g. colleague@example.com"
                      required
                    />
                  </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select 
                        value={newInvite.role} 
                        onValueChange={(v: 'admin' | 'manager' | 'staff') => setNewInvite({ ...newInvite, role: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrator</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Assigned Location</Label>
                      <Select 
                        value={newInvite.locationId} 
                        onValueChange={(v) => setNewInvite({ ...newInvite, locationId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a location">
                            {newInvite.locationId === 'none' ? 'No specific location' : (locations.find(l => l.id === newInvite.locationId)?.name || 'Select a location')}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No specific location</SelectItem>
                          {locations.map(loc => (
                            <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  <Button type="submit" className="w-full gap-2">
                    <Mail className="w-4 h-4" />
                    Send Invitation
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="font-heading text-2xl">Active Users & Invites</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Users</h4>
                    <div className="space-y-2">
                      {users.map(u => (
                        <div key={u.id} className="flex items-center justify-between p-4 bg-secondary/50 rounded-xl border border-border">
                          <div>
                            <p className="font-bold text-primary">{u.name || 'Unnamed User'}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Select 
                              value={u.locationId || 'none'} 
                              onValueChange={(v: string) => handleUpdateUser(u.id, { locationId: v === 'none' ? deleteField() as any : v })}
                            >
                              <SelectTrigger className="w-[120px] h-8 text-[10px] bg-white">
                                <SelectValue placeholder="Location">
                                  {u.locationId ? (locations.find(l => l.id === u.locationId)?.name || 'Location') : 'No Location'}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No Location</SelectItem>
                                {locations.map(loc => (
                                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select 
                              value={u.role} 
                              onValueChange={(v: 'admin' | 'manager' | 'staff') => handleUpdateUser(u.id, { role: v })}
                              disabled={u.id === profile?.id}
                            >
                              <SelectTrigger className="w-[100px] h-8 text-[10px] bg-white">
                                <SelectValue>
                                  {u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : ''}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="manager">Manager</SelectItem>
                                <SelectItem value="staff">Staff</SelectItem>
                              </SelectContent>
                            </Select>
                            {u.id !== profile?.id && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete('users', u.id);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Pending Invites</h4>
                    <div className="space-y-2">
                      {invites.filter(i => i.status === 'pending').length === 0 && <p className="text-sm text-muted-foreground italic">No pending invites.</p>}
                      {invites.filter(i => i.status === 'pending').map(inv => (
                        <div key={inv.id} className="flex items-center justify-between p-4 bg-secondary/50 rounded-xl border border-dashed border-border">
                          <div>
                            <p className="font-bold text-primary">{inv.email}</p>
                            <p className="text-xs text-muted-foreground capitalize">{inv.role}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                              Pending
                            </Badge>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete('invites', inv.id);
                              }}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="business">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="font-heading text-2xl flex items-center gap-2">
                  <Ticket className="w-6 h-6 text-[#D4AF37]" />
                  Promo Codes
                </CardTitle>
                <CardDescription>Fixed amount (Peso) discounts for checkout.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handleAddPromo} className="space-y-4 p-4 bg-secondary/30 rounded-2xl">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Promo Code</Label>
                      <Input 
                        value={newPromo.code} 
                        onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })} 
                        placeholder="SUMMER50" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Discount ({settings.currency})</Label>
                      <Input 
                        type="number"
                        value={newPromo.amount} 
                        onChange={(e) => setNewPromo({ ...newPromo, amount: Number(e.target.value) })} 
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-slate-300"
                        checked={newPromo.isPermanent}
                        onChange={(e) => setNewPromo({ ...newPromo, isPermanent: e.target.checked })}
                      />
                      Permanent
                    </Label>
                  </div>
                  {!newPromo.isPermanent && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Date</Label>
                        <Input 
                          type="date"
                          value={newPromo.startDate}
                          onChange={(e) => setNewPromo({ ...newPromo, startDate: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>End Date</Label>
                        <Input 
                          type="date"
                          value={newPromo.endDate}
                          onChange={(e) => setNewPromo({ ...newPromo, endDate: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                  <Button type="submit" className="w-full bg-[#D4AF37] hover:bg-[#B89630]">Create Promo</Button>
                </form>

                <div className="space-y-2">
                  {promos.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-border shadow-sm">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-primary font-mono">{p.code}</span>
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-none">
                            -{settings.currency}{p.amount}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {p.isPermanent ? 'Permanent' : `Expires ${p.endDate?.toDate().toLocaleDateString()}`}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingPromo(p)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-rose-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete('promos', p.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="font-heading text-2xl flex items-center gap-2">
                  <CreditCard className="w-6 h-6 text-indigo-600" />
                  Payment Options
                </CardTitle>
                <CardDescription>Custom methods like GCash, Bank Transfer, etc.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handleAddPayment} className="space-y-4 p-4 bg-secondary/30 rounded-2xl">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Method Name</Label>
                      <Input 
                        value={newPayment.name} 
                        onChange={(e) => setNewPayment({ ...newPayment, name: e.target.value })} 
                        placeholder="e.g. GCash, BDO Transfer" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Initial Balance ({settings.currency})</Label>
                      <Input 
                        type="number"
                        value={newPayment.initialBalance} 
                        onChange={(e) => setNewPayment({ ...newPayment, initialBalance: Number(e.target.value) })} 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Method Type</Label>
                    <Select value={newPayment.type} onValueChange={(v: any) => setNewPayment({ ...newPayment, type: v })}>
                      <SelectTrigger>
                        <SelectValue>
                          {newPayment.type === 'bank' ? 'Bank Transfer' : 
                           newPayment.type === 'ewallet' ? 'E-Wallet' : 
                           newPayment.type ? newPayment.type.charAt(0).toUpperCase() + newPayment.type.slice(1) : ''}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank">Bank Transfer</SelectItem>
                        <SelectItem value="ewallet">E-Wallet</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700">Add Method</Button>
                </form>

                <div className="space-y-2">
                  {paymentOptions.map(opt => (
                    <div key={opt.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-border shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                          {opt.type === 'bank' && <Building className="w-4 h-4 text-indigo-600" />}
                          {opt.type === 'ewallet' && <Wallet className="w-4 h-4 text-indigo-600" />}
                          {opt.type === 'cash' && <Banknote className="w-4 h-4 text-indigo-600" />}
                          {opt.type === 'card' && <CreditCard className="w-4 h-4 text-indigo-600" />}
                        </div>
                        <div>
                          <p className="font-bold text-primary">{opt.name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{opt.type}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-rose-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete('paymentOptions', opt.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="system">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="font-heading text-2xl">System Information</CardTitle>
              <CardDescription>Advanced system details and maintenance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-5 bg-secondary/50 rounded-2xl border border-border">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Database className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-primary">Cloud Sync Status</p>
                    <p className="text-xs text-muted-foreground">All data is currently synchronized with the cloud.</p>
                  </div>
                </div>
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Online</Badge>
              </div>
              <div className="flex items-center justify-between p-5 bg-secondary/50 rounded-2xl border border-border">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-primary">Security Rules</p>
                    <p className="text-xs text-muted-foreground">Firestore security rules are active and protecting data.</p>
                  </div>
                </div>
                <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">Active</Badge>
              </div>
              <div className="flex items-center justify-between p-5 bg-secondary/50 rounded-2xl border border-border">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Coins className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-primary">System Currency</p>
                    <p className="text-xs text-muted-foreground">Select the currency symbol used across the system.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select 
                    value={settings.currency} 
                    onValueChange={(val) => {
                      updateCurrency(val);
                      toast.success(`Currency updated to ${val}`);
                    }}
                  >
                    <SelectTrigger className="w-[100px] bg-white">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="₱">₱ (PHP)</SelectItem>
                      <SelectItem value="$">$ (USD)</SelectItem>
                      <SelectItem value="€">€ (EUR)</SelectItem>
                      <SelectItem value="£">£ (GBP)</SelectItem>
                      <SelectItem value="¥">¥ (JPY)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between p-5 bg-secondary/50 rounded-2xl border border-border">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-primary">Inventory Synchronization</p>
                    <p className="text-xs text-muted-foreground">Recalculate total stock levels from location-specific data.</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSyncStock} 
                  disabled={isSyncing}
                  className="gap-2"
                >
                  {isSyncing ? 'Syncing...' : 'Sync Stock Now'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-heading text-2xl">
                <History className="w-6 h-6 text-primary" />
                Audit Trail
              </CardTitle>
              <CardDescription>Real-time log of all system movements and user actions.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="grid grid-cols-4 bg-secondary/50 p-4 border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  <div>User</div>
                  <div>Action</div>
                  <div>Details</div>
                  <div className="text-right">Time</div>
                </div>
                <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                  {auditLogs.length === 0 && (
                    <div className="p-12 text-center text-muted-foreground italic">No audit logs found.</div>
                  )}
                  {auditLogs.map((log) => (
                    <div key={log.id} className="grid grid-cols-4 p-4 text-sm items-center hover:bg-secondary/20 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-bold text-primary">{log.userName}</span>
                        <span className="text-xs text-muted-foreground">{log.userEmail}</span>
                      </div>
                      <div>
                        <Badge variant="outline" className="text-[10px] font-mono bg-white border-border">
                          {log.action}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground pr-4 truncate" title={log.details}>
                        {log.details}
                      </div>
                      <div className="text-right text-xs text-muted-foreground/60">
                        {log.timestamp?.toDate().toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Dialog open={!!editingPromo} onOpenChange={(open) => !open && setEditingPromo(null)}>
        <DialogContent className="sm:max-w-[400px] min-h-[400px] flex flex-col justify-center">
          <DialogHeader>
            <DialogTitle>Edit Promo Code</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdatePromo} className="space-y-4">
            <div className="space-y-2">
              <Label>Discount Amount ({settings.currency})</Label>
              <Input 
                type="number"
                value={editingPromo?.amount || 0}
                onChange={(e) => setEditingPromo(prev => prev ? { ...prev, amount: Number(e.target.value) } : null)}
              />
            </div>
            <div className="flex items-center gap-4">
              <Label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-slate-300"
                  checked={editingPromo?.isActive}
                  onChange={(e) => setEditingPromo(prev => prev ? { ...prev, isActive: e.target.checked } : null)}
                />
                Is Active
              </Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingPromo(null)}>Cancel</Button>
              <Button type="submit">Update Promo</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};
