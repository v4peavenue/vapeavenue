import React, { useEffect, useState } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  Timestamp,
  doc,
  updateDoc,
  increment,
  addDoc,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FinancialAccount, AuditLog, Transaction } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Wallet, 
  Building2, 
  CreditCard, 
  Banknote,
  ArrowUpRight,
  ArrowDownLeft,
  History,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  Trash2,
  Edit,
  AlertCircle
} from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLocations } from '@/contexts/LocationContext';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription,
  DialogTrigger
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { logAction } from '@/lib/audit';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const Finance: React.FC = () => {
  const { settings } = useSettings();
  const { user, profile, isAdmin, isManager } = useAuth();
  const { locations, selectedLocationId } = useLocations();
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  const [newAccount, setNewAccount] = useState({
    name: '',
    type: 'bank' as 'bank' | 'ewallet' | 'cash' | 'card',
    initialBalance: 0
  });

  const [newTransaction, setNewTransaction] = useState({
    amount: 0,
    type: 'expense' as 'income' | 'expense',
    accountId: '',
    locationId: '',
    category: 'General',
    description: ''
  });

  useEffect(() => {
    if (selectedLocationId && selectedLocationId !== 'all') {
      setNewTransaction(prev => ({ ...prev, locationId: selectedLocationId }));
    }
  }, [selectedLocationId]);

  useEffect(() => {
    if (!profile) return;

    const isStaffUser = ['admin', 'manager', 'staff'].includes(profile.role) || 
                        user?.email?.toLowerCase() === 'vanhuxley24@gmail.com' || 
                        user?.email?.toLowerCase() === 'v4peavenue@gmail.com';
                        
    const isManagerUser = ['admin', 'manager'].includes(profile.role) || 
                          user?.email?.toLowerCase() === 'vanhuxley24@gmail.com' || 
                          user?.email?.toLowerCase() === 'v4peavenue@gmail.com' ||
                          isAdmin || isManager;

    let unsubAccounts = () => {};
    let unsubTrans = () => {};
    let unsubLogs = () => {};

    if (isStaffUser) {
      unsubAccounts = onSnapshot(collection(db, 'accounts'), (snapshot) => {
        const accountsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinancialAccount));
        setAccounts(accountsList);
        if (accountsList.length > 0 && !newTransaction.accountId) {
          setNewTransaction(prev => ({ ...prev, accountId: accountsList[0].id }));
        }
      }, (error) => {
        console.warn("Finance: Error listening to accounts:", error);
      });
    }

    if (isManagerUser) {
      const qTrans = query(
        collection(db, 'financialTransactions'),
        orderBy('timestamp', 'desc')
      );
      unsubTrans = onSnapshot(qTrans, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)).slice(0, 50));
      }, (error) => {
        console.warn("Finance: Error listening to financialTransactions:", error);
      });

      const qLogs = query(
        collection(db, 'audit_logs'), 
        orderBy('timestamp', 'desc')
      );
      unsubLogs = onSnapshot(qLogs, (snapshot) => {
        const financeLogs = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as AuditLog))
          .filter(log => 
            log.action.includes('CREATE_SALE') || 
            log.action.includes('RECEIVE_STOCK') || 
            log.action.includes('ITEM_RETURN') ||
            log.action.includes('UPDATE_ACCOUNT') ||
            log.action.includes('CREATE_PAYMENT')
          )
          .slice(0, 50);
        setLogs(financeLogs);
        setLoading(false);
      }, (error) => {
        console.warn("Finance: Error listening to audit_logs:", error);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }

    return () => {
      unsubAccounts();
      unsubTrans();
      unsubLogs();
    };
  }, [profile, user, isAdmin, isManager]);

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'bank': return <Building2 className="w-5 h-5 text-blue-500" />;
      case 'ewallet': return <Wallet className="w-5 h-5 text-purple-500" />;
      case 'cash': return <Banknote className="w-5 h-5 text-emerald-500" />;
      case 'card': return <CreditCard className="w-5 h-5 text-orange-500" />;
      default: return <Wallet className="w-5 h-5 text-slate-500" />;
    }
  };

  const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance ?? 0), 0);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.name.trim()) return;

    if (accounts.some(a => a.name.toLowerCase() === newAccount.name.trim().toLowerCase())) {
      toast.error('Account with this name already exists');
      return;
    }

    try {
      const paymentRef = await addDoc(collection(db, 'paymentOptions'), {
        name: newAccount.name,
        type: newAccount.type,
        active: true
      });

      await setDoc(doc(db, 'accounts', paymentRef.id), {
        name: newAccount.name,
        type: newAccount.type,
        balance: Number(newAccount.initialBalance),
        lastUpdated: Timestamp.now()
      });

      await logAction(profile, 'CREATE_ACCOUNT', `Added financial account: ${newAccount.name} with initial balance ${newAccount.initialBalance}`, paymentRef.id, 'account');
      
      toast.success('Account added successfully');
      setIsAddAccountOpen(false);
      setNewAccount({ name: '', type: 'bank', initialBalance: 0 });
    } catch (error) {
      toast.error('Failed to add account');
      console.error(error);
    }
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;

    try {
      await updateDoc(doc(db, 'paymentOptions', editingAccount.id), {
        name: editingAccount.name,
        type: editingAccount.type
      });

      await updateDoc(doc(db, 'accounts', editingAccount.id), {
        name: editingAccount.name,
        type: editingAccount.type,
        balance: Number(editingAccount.balance),
        lastUpdated: Timestamp.now()
      });

      await logAction(profile, 'UPDATE_ACCOUNT', `Updated financial account: ${editingAccount.name}`, editingAccount.id, 'account');
      
      toast.success('Account updated successfully');
      setEditingAccount(null);
    } catch (error) {
      toast.error('Failed to update account');
      console.error(error);
    }
  };

  const handleDeleteAccount = async (id: string, name: string) => {
    if (!isAdmin && !isManager) {
      toast.error('You do not have permission to delete this');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${name}? This will also remove it as a payment method.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'accounts', id));
      await deleteDoc(doc(db, 'paymentOptions', id));
      await logAction(profile, 'DELETE_ACCOUNT', `Deleted financial account and payment option: ${name}`, id, 'account');
      toast.success('Account deleted successfully');
    } catch (error) {
      toast.error('Failed to delete account');
      console.error(error);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTransaction.amount <= 0 || !newTransaction.accountId) {
      toast.error('Please enter a valid amount and account');
      return;
    }

    const account = accounts.find(a => a.id === newTransaction.accountId);
    if (!account) return;

    const location = locations.find(l => l.id === newTransaction.locationId);

    const balanceAdjustment = newTransaction.type === 'income' ? Number(newTransaction.amount) : -Number(newTransaction.amount);
    
    // Check for insufficient funds if it's an expense
    if (newTransaction.type === 'expense' && (account.balance || 0) < Number(newTransaction.amount)) {
      toast.error(`Insufficient funds in ${account.name}. Available: ${settings.currency}${(account.balance || 0).toLocaleString()}`);
      return;
    }

    const newBalance = (account.balance || 0) + balanceAdjustment;

    try {
      const transRef = await addDoc(collection(db, 'financialTransactions'), {
        amount: Number(newTransaction.amount),
        type: newTransaction.type,
        accountId: newTransaction.accountId,
        accountName: account.name,
        locationId: newTransaction.locationId || null,
        locationName: location?.name || null,
        category: newTransaction.category,
        description: newTransaction.description,
        timestamp: Timestamp.now(),
        createdBy: profile?.id || 'anonymous',
        createdByName: profile?.name || 'Staff',
        accountBalance: newBalance
      });

      await updateDoc(doc(db, 'accounts', newTransaction.accountId), {
        balance: increment(balanceAdjustment),
        lastUpdated: Timestamp.now()
      });

      await logAction(
        profile, 
        'MANUAL_TRANSACTION', 
        `${newTransaction.type === 'income' ? 'Income' : 'Expense'}: ${newTransaction.description} (${settings.currency}${newTransaction.amount}) on ${account.name}`, 
        transRef.id, 
        'transaction'
      );

      toast.success('Transaction recorded successfully');
      setIsAddTransactionOpen(false);
      setNewTransaction({
        amount: 0,
        type: 'expense',
        accountId: accounts[0]?.id || '',
        locationId: selectedLocationId !== 'all' ? selectedLocationId : '',
        category: 'General',
        description: ''
      });
    } catch (error) {
      toast.error('Failed to record transaction');
      console.error(error);
    }
  };

  return (
    <div className="space-y-5 p-1">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1A2B4B] tracking-tight font-heading flex items-center gap-1.5">
            Financial Overview
            <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Track your banks, e-wallets, and cash on hand balances.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={isAddTransactionOpen} onOpenChange={setIsAddTransactionOpen}>
            <DialogTrigger 
              render={
                <Button className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white gap-1.5 h-8 px-3 rounded-lg shadow-sm text-xs font-bold transition-all">
                  <Plus className="w-3.5 h-3.5" />
                  New Transaction
                </Button>
              } 
            />
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>New Manual Transaction</DialogTitle>
                <DialogDescription>
                  Record expenses or income not tracked automatically.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddTransaction} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Transaction Type</Label>
                    <Select 
                      value={newTransaction.type} 
                      onValueChange={(v: any) => setNewTransaction({ ...newTransaction, type: v })}
                    >
                      <SelectTrigger className="bg-slate-50">
                        <SelectValue>
                          {newTransaction.type === 'income' ? 'Income / Deposit' : 'Expense / Withdrawal'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Income / Deposit</SelectItem>
                        <SelectItem value="expense">Expense / Withdrawal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Amount ({settings.currency})</Label>
                    <Input 
                      type="number"
                      step="0.01"
                      value={newTransaction.amount || ''}
                      onChange={(e) => setNewTransaction({ ...newTransaction, amount: Number(e.target.value) })}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="trans-acc">Source/Destination Account</Label>
                    <Select 
                      required
                      value={newTransaction.accountId} 
                      onValueChange={(v: any) => setNewTransaction({ ...newTransaction, accountId: v })}
                    >
                      <SelectTrigger id="trans-acc" className="bg-slate-50">
                        <SelectValue placeholder="Select account">
                          {accounts.find(a => a.id === newTransaction.accountId)?.name || 'Select account'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.name} ({settings.currency}{acc.balance.toLocaleString()})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trans-loc">Location (Optional)</Label>
                    <Select 
                      value={newTransaction.locationId || "central"} 
                      onValueChange={(v: any) => setNewTransaction({ ...newTransaction, locationId: v === "central" ? "" : v })}
                    >
                      <SelectTrigger id="trans-loc" className="bg-slate-50">
                        <SelectValue placeholder="Select branch">
                          {newTransaction.locationId 
                            ? (locations.find(l => l.id === newTransaction.locationId)?.name || 'Select branch') 
                            : 'None / Central'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="central">None / Central</SelectItem>
                        {locations.map(loc => (
                          <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trans-cat">Category</Label>
                  <Select 
                    required
                    value={newTransaction.category} 
                    onValueChange={(v: any) => setNewTransaction({ ...newTransaction, category: v })}
                  >
                    <SelectTrigger id="trans-cat" className="bg-slate-50">
                      <SelectValue>
                        {newTransaction.category}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="General">General</SelectItem>
                      <SelectItem value="Rent">Rent</SelectItem>
                      <SelectItem value="Utilities">Utilities</SelectItem>
                      <SelectItem value="Salary">Salary</SelectItem>
                      <SelectItem value="Supplies">Supplies</SelectItem>
                      <SelectItem value="Maintenance">Maintenance</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                      <SelectItem value="Taxes">Taxes</SelectItem>
                      <SelectItem value="Personal">Personal / Drawings</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input 
                    value={newTransaction.description}
                    onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                    placeholder="Brief details about this transaction"
                    required
                  />
                </div>

                <DialogFooter className="pt-4 mt-auto border-t">
                  <Button type="button" variant="outline" onClick={() => setIsAddTransactionOpen(false)}>Cancel</Button>
                  <Button type="submit" className="bg-[#1A2B4B] hover:bg-[#2C3E50] text-white">Record Transaction</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
            <DialogTrigger 
              render={
                <Button variant="outline" className="gap-1.5 h-8 px-3 rounded-lg border-[#D4AF37]/25 hover:bg-[#D4AF37]/5 text-slate-700 text-xs font-semibold">
                  <Plus className="w-3.5 h-3.5" />
                  Add Account
                </Button>
              } 
            />
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add Financial Account</DialogTitle>
                <DialogDescription>
                  Add a new bank or e-wallet account to track your money.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddAccount} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="acc-name">Account Name</Label>
                  <Input 
                    id="acc-name" 
                    value={newAccount.name}
                    onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                    placeholder="e.g. BDO Savings, GCash Personal" 
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="acc-type">Type</Label>
                    <Select 
                      required
                      value={newAccount.type} 
                      onValueChange={(v: any) => setNewAccount({ ...newAccount, type: v })}
                    >
                      <SelectTrigger id="acc-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank">Bank</SelectItem>
                        <SelectItem value="ewallet">E-Wallet</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="acc-balance">Initial Balance ({settings.currency})</Label>
                    <Input 
                      id="acc-balance"
                      type="number"
                      value={newAccount.initialBalance}
                      onChange={(e) => setNewAccount({ ...newAccount, initialBalance: Number(e.target.value) })}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>
                <DialogFooter className="pt-4 mt-auto border-t">
                  <Button type="button" variant="outline" onClick={() => setIsAddAccountOpen(false)}>Cancel</Button>
                  <Button type="submit" className="bg-[#1A2B4B] hover:bg-[#2C3E50] text-white">Add Account</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-1 border-none shadow-md bg-gradient-to-br from-[#1C2D4E] to-[#0D1627] text-white overflow-hidden relative rounded-xl hover:scale-[1.01] transition-all duration-300">
          <div className="absolute top-0 right-0 p-3 opacity-5">
            <TrendingUp className="w-24 h-24" />
          </div>
          <CardHeader className="pb-1 pt-3.5 px-3.5">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37] opacity-90">Total Liquidity</CardTitle>
          </CardHeader>
          <CardContent className="pb-3.5 px-3.5">
            <p className="text-3xl font-black font-heading mb-1.5 text-white">
              {settings.currency}{totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <div className="flex items-center gap-1 text-[9px] font-bold bg-white/10 w-fit px-2 py-0.5 rounded-full border border-white/5 text-white/80">
              <History className="w-2.5 h-2.5" />
              Real-time synchronization active
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2 grid sm:grid-cols-2 gap-3">
          {accounts.map(acc => (
            <Card key={acc.id} className="bg-white border border-slate-200/50 hover:border-[#D4AF37]/50 shadow-sm hover:shadow-md transition-all duration-300 rounded-xl group relative overflow-hidden">
              <CardContent className="p-3.5">
                <div className="flex justify-between items-start mb-2.5">
                  <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-[#1A2B4B]/5 transition-colors">
                    {getAccountIcon(acc.type)}
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-slate-400 hover:text-[#1A2B4B] rounded-md"
                      onClick={() => setEditingAccount(acc)}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-slate-400 hover:text-rose-600 rounded-md"
                      onClick={() => handleDeleteAccount(acc.id, acc.name)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <Badge variant="outline" className="text-[8px] uppercase font-black tracking-tighter opacity-60 border-slate-200">
                    {acc.type}
                  </Badge>
                </div>
                <h3 className="font-bold text-xs text-[#1A2B4B] mb-0.5">{acc.name}</h3>
                <p className="text-xl font-black text-[#1A2B4B] font-heading">
                  {settings.currency}{(acc.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <div className="mt-2.5 pt-2.5 border-t border-slate-50 flex items-center justify-between">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Last Updated</span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    {acc.lastUpdated ? format(acc.lastUpdated.toDate(), 'MMM dd, HH:mm') : 'N/A'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
          {accounts.length === 0 && !loading && (
            <div className="col-span-2 p-12 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
              <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">No financial accounts found.</p>
              <p className="text-xs text-slate-400 mt-1">Add accounts to track your money.</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
            <div>
              <CardTitle className="text-xl font-black font-heading text-slate-900">Transaction History</CardTitle>
              <CardDescription>Recent financial records including manual entries and system logs.</CardDescription>
            </div>
            <History className="w-5 h-5 text-slate-400" />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-slate-100">
                  <TableHead className="text-[10px] uppercase font-black tracking-widest text-slate-400">Transaction</TableHead>
                  <TableHead className="text-[10px] uppercase font-black tracking-widest text-slate-400">Account / Type</TableHead>
                  <TableHead className="text-[10px] uppercase font-black tracking-widest text-slate-400">Amount</TableHead>
                  <TableHead className="text-[10px] uppercase font-black tracking-widest text-slate-400">Ending Balance</TableHead>
                  <TableHead className="text-[10px] uppercase font-black tracking-widest text-slate-400">Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ...transactions.map(t => ({ 
                    id: t.id, 
                    type: 'TRANSACTION', 
                    transType: t.type, 
                    details: t.description, 
                    category: t.category, 
                    accountName: t.accountName, 
                    locationName: t.locationName,
                    amount: t.amount, 
                    timestamp: t.timestamp,
                    accountBalance: t.accountBalance
                  })),
                  ...logs.map(l => ({ 
                    id: l.id, 
                    type: 'LOG', 
                    action: l.action, 
                    details: l.details, 
                    timestamp: l.timestamp,
                    amount: 0 // Logs might not have an intuitive singular amount
                  }))
                ]
                .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())
                .slice(0, 50)
                .map((item) => {
                  const isIncome = item.type === 'TRANSACTION' 
                    ? item.transType === 'income' 
                    : (item.action === 'CREATE_SALE' || item.action === 'ITEM_RETURN');
                  const isExpense = item.type === 'TRANSACTION' 
                    ? item.transType === 'expense' 
                    : (item.action === 'RECEIVE_STOCK');
                  
                  return (
                    <TableRow key={item.id} className="hover:bg-slate-50/50 border-slate-50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${isIncome ? 'bg-emerald-50 text-emerald-600' : isExpense ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-600'}`}>
                            {isIncome ? <TrendingUp className="w-4 h-4" /> : isExpense ? <TrendingDown className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-700">{item.details}</span>
                            {item.type === 'TRANSACTION' && <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">{item.category}</span>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-[#1A2B4B]">
                            {item.type === 'TRANSACTION' ? item.accountName : 'System Event'}
                            {item.type === 'TRANSACTION' && item.locationName && (
                              <span className="ml-1 text-slate-400 font-normal">
                                • {item.locationName}
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">
                            {item.type === 'TRANSACTION' ? item.transType : item.action?.replace('_', ' ')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.type === 'TRANSACTION' ? (
                          <span className={`font-mono text-sm font-bold ${isIncome ? 'text-emerald-600' : isExpense ? 'text-rose-600' : 'text-slate-600'}`}>
                            {isIncome ? '+' : '-'}{settings.currency}{(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Audit Log</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.type === 'TRANSACTION' && item.accountBalance !== undefined ? (
                          <span className="font-mono text-xs font-bold text-slate-500">
                            {settings.currency}{(item.accountBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-300">--</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 font-mono whitespace-nowrap">
                        {format(item.timestamp.toDate(), 'MMM dd, p')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm h-fit">
          <CardHeader>
            <CardTitle className="text-xl font-black font-heading text-slate-900">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                <span>By Type</span>
                <span>Balance</span>
              </div>
              {['bank', 'ewallet', 'cash', 'card'].map(type => {
                const balance = accounts.filter(a => a.type === type).reduce((s, a) => s + (a.balance ?? 0), 0);
                if (balance === 0 && !accounts.some(a => a.type === type)) return null;
                return (
                  <div key={type} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      {getAccountIcon(type)}
                      <span className="text-sm font-bold capitalize">{type}</span>
                    </div>
                    <span className="font-bold text-slate-900">{settings.currency}{balance.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-[#1A2B4B]/5 rounded-2xl border border-[#1A2B4B]/10">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-[#1A2B4B]" />
                <h4 className="text-sm font-black text-[#1A2B4B] uppercase tracking-tight">System Note</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Accounts are automatically managed based on your payment configuration. Visit System Settings to add or move accounts.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Account Dialog */}
      <Dialog open={!!editingAccount} onOpenChange={(open) => !open && setEditingAccount(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>Update account details or adjust balance.</DialogDescription>
          </DialogHeader>
          {editingAccount && (
            <form onSubmit={handleUpdateAccount} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Account Name</Label>
                <Input 
                  id="edit-name" 
                  value={editingAccount.name}
                  onChange={(e) => setEditingAccount({ ...editingAccount, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-type">Type</Label>
                  <Select 
                    value={editingAccount.type} 
                    onValueChange={(v: any) => setEditingAccount({ ...editingAccount, type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {editingAccount.type ? editingAccount.type.charAt(0).toUpperCase() + editingAccount.type.slice(1) : ''}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank">Bank</SelectItem>
                      <SelectItem value="ewallet">E-Wallet</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-balance">Balance ({settings.currency})</Label>
                  <Input 
                    id="edit-balance"
                    type="number"
                    step="0.01"
                    value={editingAccount.balance}
                    onChange={(e) => setEditingAccount({ ...editingAccount, balance: Number(e.target.value) })}
                  />
                </div>
              </div>
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setEditingAccount(null)}>Cancel</Button>
                <Button type="submit" className="bg-[#1A2B4B] hover:bg-[#2C3E50] text-white">Save Changes</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
