import React, { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useLocations } from '../contexts/LocationContext';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TrendingDown } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, increment, Timestamp } from 'firebase/firestore';
import { logAction } from '@/lib/audit';
import { toast } from 'sonner';
import { FinancialAccount, Transaction } from '@/types';

interface ExpensesTabProps {
  accounts: FinancialAccount[];
  transactions: Transaction[];
}

export const ExpensesTab: React.FC<ExpensesTabProps> = ({ accounts, transactions }) => {
  const { settings } = useSettings();
  const { user, profile } = useAuth();
  const { locations } = useLocations();

  // Form states
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseAccountId, setExpenseAccountId] = useState<string>(accounts[0]?.id || '');
  const [expenseLocationId, setExpenseLocationId] = useState<string>('');
  const [expenseCategory, setExpenseCategory] = useState<string>('Supplies');
  const [expenseDescription, setExpenseDescription] = useState<string>('');
  const [expenseSearch, setExpenseSearch] = useState<string>('');

  React.useEffect(() => {
    if (accounts.length > 0 && !expenseAccountId) {
      setExpenseAccountId(accounts[0].id);
    }
  }, [accounts, expenseAccountId]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (expenseAmount <= 0 || !expenseAccountId) {
      toast.error('Please enter a valid amount and select an account');
      return;
    }

    const account = accounts.find(a => a.id === expenseAccountId);
    if (!account) {
      toast.error('Account not found');
      return;
    }

    // Check for insufficient funds
    if ((account.balance || 0) < expenseAmount) {
      toast.error(`Insufficient funds in ${account.name}. Available: ${settings.currency}${(account.balance || 0).toLocaleString()}`);
      return;
    }

    const locationIdResolved = expenseLocationId || profile?.locationId || null;
    const location = locations.find(l => l.id === locationIdResolved);
    const newBalance = (account.balance || 0) - expenseAmount;

    try {
      const transRef = await addDoc(collection(db, 'financialTransactions'), {
        amount: expenseAmount,
        type: 'expense',
        accountId: expenseAccountId,
        accountName: account.name,
        locationId: locationIdResolved,
        locationName: location?.name || 'Central',
        category: expenseCategory,
        description: expenseDescription,
        timestamp: Timestamp.now(),
        createdBy: profile?.id || 'anonymous',
        createdByName: profile?.name || user?.email || 'Staff',
        accountBalance: newBalance
      });

      await updateDoc(doc(db, 'accounts', expenseAccountId), {
        balance: increment(-expenseAmount),
        lastUpdated: Timestamp.now()
      });

      await logAction(
        profile, 
        'MANUAL_TRANSACTION', 
        `Expense: ${expenseDescription} (${settings.currency}${expenseAmount}) on ${account.name}`, 
        transRef.id, 
        'transaction'
      );

      toast.success('Expense recorded successfully!');
      
      // Reset expense form
      setExpenseAmount(0);
      setExpenseDescription('');
      setExpenseCategory('Supplies');
      setExpenseLocationId('');
    } catch (error) {
      toast.error('Failed to record expense');
      console.error(error);
    }
  };

  const expenseTransactions = transactions.filter(t => t.type === 'expense');
  const filteredExpenses = expenseTransactions.filter(t => {
    const searchLower = expenseSearch.toLowerCase();
    return (t.description || '').toLowerCase().includes(searchLower) ||
           (t.category || '').toLowerCase().includes(searchLower) ||
           (t.accountName || '').toLowerCase().includes(searchLower) ||
           (t.createdByName || '').toLowerCase().includes(searchLower);
  });

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Record Expense Form */}
      <Card className="lg:col-span-1 border-none shadow-md bg-white rounded-xl overflow-hidden">
        <CardHeader className="bg-slate-50/50 pb-4 border-b border-slate-100 rounded-t-xl">
          <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-rose-500" />
            Record New Expense
          </CardTitle>
          <CardDescription className="text-xs">
            Log purchases, utilities, or operating expenses directly.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          <form onSubmit={handleAddExpense} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="expense-amount" className="text-xs font-bold text-slate-700 uppercase tracking-wider">Amount ({settings.currency})</Label>
              <Input 
                id="expense-amount"
                type="number"
                step="0.01"
                min="0.01"
                className="h-10 text-lg font-black bg-slate-50 border-slate-200 text-[#1A2B4B]"
                placeholder="0.00"
                value={expenseAmount || ''}
                onChange={(e) => setExpenseAmount(Number(e.target.value))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense-account" className="text-xs font-bold text-slate-700 uppercase tracking-wider">Source of Funds (Paid From)</Label>
              <Select 
                required
                value={expenseAccountId} 
                onValueChange={setExpenseAccountId}
              >
                <SelectTrigger id="expense-account" className="h-10 bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Select account">
                    {accounts.find(a => a.id === expenseAccountId)?.name || 'Select account'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} ({settings.currency}{(acc.balance || 0).toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="expense-category" className="text-xs font-bold text-slate-700 uppercase tracking-wider">Category</Label>
                <Select 
                  required
                  value={expenseCategory} 
                  onValueChange={setExpenseCategory}
                >
                  <SelectTrigger id="expense-category" className="h-10 bg-slate-50 border-slate-200 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Supplies">Supplies</SelectItem>
                    <SelectItem value="Utilities">Utilities</SelectItem>
                    <SelectItem value="Rent">Rent</SelectItem>
                    <SelectItem value="Salary">Salary</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Taxes">Taxes</SelectItem>
                    <SelectItem value="General">General / Others</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense-location" className="text-xs font-bold text-slate-700 uppercase tracking-wider">Branch / Location</Label>
                <Select 
                  value={expenseLocationId || "central"} 
                  onValueChange={(v) => setExpenseLocationId(v === "central" ? "" : v)}
                >
                  <SelectTrigger id="expense-location" className="h-10 bg-slate-50 border-slate-200 text-xs">
                    <SelectValue placeholder="Select location">
                      {expenseLocationId 
                        ? (locations.find(l => l.id === expenseLocationId)?.name || 'Central') 
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
              <Label htmlFor="expense-description" className="text-xs font-bold text-slate-700 uppercase tracking-wider">Description / Purpose</Label>
              <Input 
                id="expense-description"
                className="h-10 bg-slate-50 border-slate-200"
                placeholder="Brief details about this expense"
                value={expenseDescription}
                onChange={(e) => setExpenseDescription(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full h-11 bg-[#1A2B4B] hover:bg-[#2C3E50] text-white font-bold rounded-xl shadow-lg shadow-[#1A2B4B]/10 transition-all mt-2">
              Record Expense
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Expense History Table */}
      <Card className="lg:col-span-2 border-none shadow-md bg-white rounded-xl overflow-hidden">
        <CardHeader className="bg-slate-50/50 pb-4 border-b border-slate-100 rounded-t-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-bold text-slate-800">Expense History Ledger</CardTitle>
            <CardDescription className="text-xs">Verified logs of outgoing cash and expense entries.</CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Input
              className="h-8 text-xs pl-3.5 bg-white border-slate-200 rounded-lg"
              placeholder="Search description, category..."
              value={expenseSearch}
              onChange={(e) => setExpenseSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-slate-100 bg-slate-50/30">
                  <TableHead className="text-[10px] uppercase font-black tracking-widest text-slate-400">Expense / Memo</TableHead>
                  <TableHead className="text-[10px] uppercase font-black tracking-widest text-slate-400">Category</TableHead>
                  <TableHead className="text-[10px] uppercase font-black tracking-widest text-slate-400">Paid From</TableHead>
                  <TableHead className="text-[10px] uppercase font-black tracking-widest text-slate-400">Amount</TableHead>
                  <TableHead className="text-[10px] uppercase font-black tracking-widest text-slate-400">Recorded By</TableHead>
                  <TableHead className="text-[10px] uppercase font-black tracking-widest text-slate-400">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-slate-400">
                      No matching expense records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredExpenses.map((exp) => (
                    <TableRow key={exp.id} className="hover:bg-slate-50/50 border-slate-50">
                      <TableCell className="font-bold text-slate-700 text-xs">
                        {exp.description}
                        {exp.locationName && (
                          <span className="block text-[10px] text-slate-400 font-normal">
                            • {exp.locationName}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px] font-black uppercase px-2 py-0.5 border-slate-200 text-slate-500 bg-slate-50">
                          {exp.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-slate-600">
                        {exp.accountName}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-black text-rose-600">
                        -{settings.currency}{(exp.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-500">
                        {exp.createdByName || 'System'}
                      </TableCell>
                      <TableCell className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
                        {exp.timestamp ? format(typeof exp.timestamp.toDate === 'function' ? exp.timestamp.toDate() : new Date(exp.timestamp), 'MMM dd, yyyy p') : '--'}
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
  );
};
