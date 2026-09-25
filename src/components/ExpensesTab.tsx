import React, { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useLocations } from '../contexts/LocationContext';
import { format, subDays, startOfMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DataTablePagination } from '@/components/DataTablePagination';
import { TrendingDown, Trash2, Database, RotateCcw } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, increment, Timestamp, deleteDoc, getCountFromServer, query, where } from 'firebase/firestore';
import { logAction } from '@/lib/audit';
import { toast } from 'sonner';
import { FinancialAccount, Transaction } from '@/types';
import { DateRangeQueryGuardrail } from '@/components/DateRangeQueryGuardrail';

interface ExpensesTabProps {
  accounts: FinancialAccount[];
  transactions: Transaction[];
  transLimit?: number;
  dateRange?: { startDate: string; endDate: string } | null;
  onApplyDateRange?: (startDate: string, endDate: string) => void;
  onResetDateRange?: () => void;
  onExpandLimit?: () => void;
  onResetLimit?: () => void;
}

export const ExpensesTab: React.FC<ExpensesTabProps> = ({ 
  accounts, 
  transactions,
  transLimit = 300,
  dateRange,
  onApplyDateRange,
  onResetDateRange,
  onExpandLimit,
  onResetLimit
}) => {
  const { settings } = useSettings();
  const { user, profile, isAdmin, isManager } = useAuth();
  const { selectedLocationId, setSelectedLocationId, locations } = useLocations();

  const effectiveLocationId = (!isAdmin && !isManager)
    ? (profile?.locationId || null)
    : (selectedLocationId !== 'all' ? selectedLocationId : null);

  const activeLocationName = effectiveLocationId
    ? (locations.find(l => l.id === effectiveLocationId)?.name || 'Current Location')
    : undefined;

  // Date Range Read Estimator state
  const [filterStartDate, setFilterStartDate] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [filterEndDate, setFilterEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const calculateExpenseDocs = async (startStr: string, endStr: string): Promise<number> => {
    try {
      const startTs = Timestamp.fromDate(new Date(`${startStr}T00:00:00`));
      const endTs = Timestamp.fromDate(new Date(`${endStr}T23:59:59`));

      if (effectiveLocationId) {
        try {
          const countQuery = query(
            collection(db, 'financialTransactions'),
            where('locationId', '==', effectiveLocationId),
            where('timestamp', '>=', startTs),
            where('timestamp', '<=', endTs)
          );
          const snapshot = await getCountFromServer(countQuery);
          return snapshot.data().count || 0;
        } catch (e: any) {
          console.warn("Composite count query failed (missing index), falling back to date range count:", e?.message);
        }
      }

      const fallbackQuery = query(
        collection(db, 'financialTransactions'),
        where('timestamp', '>=', startTs),
        where('timestamp', '<=', endTs)
      );
      const snapshot = await getCountFromServer(fallbackQuery);
      return snapshot.data().count || 0;
    } catch (err: any) {
      console.warn("calculateExpenseDocs failed, returning 0:", err?.message);
      return 0;
    }
  };

  const handleDeleteExpense = async (id: string, amount: number, accountId: string, description: string) => {
    if (!isAdmin) {
      toast.error('Only administrators are allowed to delete expenses');
      return;
    }

    const isConfirmed = window.confirm(`Are you sure you want to delete the expense: "${description}"? This will refund ${settings.currency}${amount} to the original account.`);
    if (!isConfirmed) return;

    try {
      // 1. Delete the transaction doc
      await deleteDoc(doc(db, 'financialTransactions', id));

      // 2. Refund original account balance
      await updateDoc(doc(db, 'accounts', accountId), {
        balance: increment(amount),
        lastUpdated: Timestamp.now()
      });

      // 3. Log action
      await logAction(
        profile, 
        'DELETE_TRANSACTION', 
        `Deleted expense: ${description} (${settings.currency}${amount}) and refunded to account.`, 
        id, 
        'transaction'
      );

      toast.success('Expense deleted and funds refunded successfully');
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast.error('Failed to delete expense');
    }
  };

  // Form states
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseAccountId, setExpenseAccountId] = useState<string>(accounts[0]?.id || '');
  const [expenseLocationId, setExpenseLocationId] = useState<string>('');
  const [expenseCategory, setExpenseCategory] = useState<string>('Supplies');
  const [expenseDescription, setExpenseDescription] = useState<string>('');
  const [expenseSearch, setExpenseSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  React.useEffect(() => {
    if (accounts.length > 0 && !expenseAccountId) {
      setExpenseAccountId(accounts[0].id);
    }
  }, [accounts, expenseAccountId]);

  React.useEffect(() => {
    if (!isAdmin && profile?.locationId) {
      setExpenseLocationId(profile.locationId);
    }
  }, [profile, isAdmin]);

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
    if (!locationIdResolved) {
      toast.error('Please select a branch/location for this expense');
      return;
    }

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
      setExpenseLocationId(!isAdmin && profile?.locationId ? profile.locationId : '');
    } catch (error) {
      toast.error('Failed to record expense');
      console.error(error);
    }
  };

  const expenseTransactions = transactions.filter(t => {
    if (t.type !== 'expense') return false;
    
    // Admins and Managers can view all store/location expenses
    if (isAdmin || isManager) {
      if (selectedLocationId !== 'all') {
        return !t.locationId || t.locationId === selectedLocationId;
      }
      return true;
    }

    // Staff view their own entries or location entries
    const isMyEntry = 
      (!!t.createdBy && (
        t.createdBy === profile?.id || 
        t.createdBy === user?.uid || 
        t.createdBy === profile?.email || 
        t.createdBy === user?.email
      )) ||
      (!!t.createdByName && (
        (!!profile?.name && t.createdByName.toLowerCase().trim() === profile.name.toLowerCase().trim()) ||
        (!!user?.displayName && t.createdByName.toLowerCase().trim() === user.displayName.toLowerCase().trim()) ||
        (!!user?.email && t.createdByName.toLowerCase().trim() === user.email.toLowerCase().trim()) ||
        (!!profile?.email && t.createdByName.toLowerCase().trim() === profile.email.toLowerCase().trim())
      ));

    if (profile?.locationId) {
      return !t.locationId || t.locationId === profile.locationId;
    }

    return isMyEntry;
  });
  const filteredExpenses = expenseTransactions.filter(t => {
    const searchLower = expenseSearch.toLowerCase();
    return (t.description || '').toLowerCase().includes(searchLower) ||
           (t.category || '').toLowerCase().includes(searchLower) ||
           (t.accountName || '').toLowerCase().includes(searchLower) ||
           (t.createdByName || '').toLowerCase().includes(searchLower);
  });

  return (
    <div className="space-y-6">
      {/* Date Range Query Guardrail & Estimator Card */}
      <DateRangeQueryGuardrail
        title="DATE RANGE QUERY GUARDRAIL"
        badgeLabel="Firestore Cost Protection"
        description="Filter expenses by date range. Before running the query, the system calculates exact matching document reads to prevent unexpected database charges."
        startDate={filterStartDate}
        endDate={filterEndDate}
        onStartDateChange={setFilterStartDate}
        onEndDateChange={setFilterEndDate}
        calculateDocCount={calculateExpenseDocs}
        targetEntityLabel="expense transactions"
        locationName={activeLocationName}
        isQueryApplied={!!dateRange}
        activeLoadedRange={dateRange ? { start: dateRange.startDate, end: dateRange.endDate } : null}
        onApplyQuery={(s, e) => {
          if (onApplyDateRange) {
            onApplyDateRange(s, e);
          }
        }}
        onReset={onResetDateRange}
        presets={[
          { label: 'Today', key: 'today' },
          { label: 'This Month', key: 'this_month' },
          { label: 'Last 30 Days', key: 'last_30_days' }
        ]}
      />

      {/* Main Containers: Form + History Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Record Expense Form */}
        <Card className="lg:col-span-4 border border-slate-200/80 shadow-xs bg-white rounded-xl overflow-hidden h-fit">
          <CardHeader className="bg-slate-50/60 pb-4 border-b border-slate-100 rounded-t-xl">
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
                    {accounts.filter(acc => acc.active !== false).map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name}{isAdmin ? ` (${settings.currency}${(acc.balance || 0).toLocaleString()})` : ''}
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
                      <SelectItem value="Delivery/Shipping Fee">Delivery/Shipping Fee</SelectItem>
                      <SelectItem value="General">General / Others</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expense-location" className="text-xs font-bold text-slate-700 uppercase tracking-wider">Branch / Location</Label>
                  <Select 
                    disabled={!isAdmin && !!profile?.locationId}
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
        <Card className="lg:col-span-8 border border-slate-200/80 shadow-xs bg-white rounded-xl overflow-hidden">
          <CardHeader className="bg-slate-50/60 pb-4 border-b border-slate-100 rounded-t-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold text-slate-800">Expense History Ledger</CardTitle>
              <CardDescription className="text-xs">
                {isAdmin ? "Verified logs of outgoing cash and expense entries across all staff." : "Verified logs of your submitted outgoing cash and expense entries."}
              </CardDescription>
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
                    {isAdmin && <TableHead className="text-[10px] uppercase font-black tracking-widest text-slate-400 text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 7 : 6} className="h-32 text-center text-slate-400">
                        No matching expense records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredExpenses
                      .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                      .map((exp) => (
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
                          {exp.timestamp ? format(typeof exp.timestamp?.toDate === 'function' ? exp.timestamp.toDate() : new Date(exp.timestamp as any), 'MMM dd, yyyy p') : '--'}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                              onClick={() => handleDeleteExpense(exp.id, exp.amount, exp.accountId, exp.description)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <DataTablePagination
                currentPage={currentPage}
                totalPages={Math.ceil(filteredExpenses.length / pageSize) || 1}
                pageSize={pageSize}
                totalItems={filteredExpenses.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={size => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Firestore Read Guardrail Notice & Status */}
      <div className="w-full p-4 rounded-xl border border-slate-200/80 bg-white shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${dateRange ? 'bg-indigo-100 text-indigo-800' : transLimit > 300 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
            <Database className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">
              {dateRange
                ? `Custom Date Range Active (${dateRange.startDate} to ${dateRange.endDate})`
                : transLimit > 300
                ? `Extended History Active (${transLimit.toLocaleString()} Records Loaded)`
                : 'Default Read Cap Active (300 Most Recent Records)'}
            </p>
            <p className="text-[11px] text-slate-500">
              {dateRange
                ? `Filtered query active. Loaded ${transactions.length} matching transactions from Firestore.`
                : transLimit > 300
                ? 'Showing deep historical expense records from Firestore.'
                : 'Queries default to 300 documents to optimize database read costs. Use the Date Range Estimator above to fetch specific historical periods with exact read cost verification.'}
            </p>
          </div>
        </div>

        {(dateRange || transLimit > 300) && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onResetDateRange}
            className="text-xs font-bold text-slate-600 hover:bg-slate-100 h-8 gap-1.5 shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            Reset to 300 Default
          </Button>
        )}
      </div>
    </div>
  );
};
