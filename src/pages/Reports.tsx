import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  Package,
  Calendar as CalendarIcon,
  Download,
  Search,
  ChevronDown,
  Filter,
  ArrowUpDown,
  FileText,
  PieChart as PieChartIcon,
  BarChart3
} from 'lucide-react';
import { collection, onSnapshot, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useLocations } from '@/contexts/LocationContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Sale, Product, StockAdjustment } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '@/lib/firestore-utils';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, subDays, subMonths, startOfYear, endOfYear, subYears, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { exportToCSV } from '@/lib/export';

type ReportType = 'sales' | 'inventory' | 'profit' | 'stock-adjustments';

export const Reports: React.FC = () => {
  const { profile, isAdmin, isManager } = useAuth();
  const { selectedLocationId, locations } = useLocations();
  const { settings } = useSettings();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [paymentOptions, setPaymentOptions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState<ReportType>('sales');
  const [dateRange, setDateRange] = useState<string>('month');
  const [customStartDate, setCustomStartDate] = useState<string>(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');

  const getPaymentMethodName = (methodId: string) => {
    if (!methodId) return 'N/A';
    if (methodId === 'split') return 'Split Payment';
    if (methodId === 'cash') return 'Cash';
    if (methodId === 'card') return 'Card';
    
    // Look in paymentOptions
    const opt = paymentOptions.find(o => o.id === methodId);
    if (opt) return opt.name;

    // Look in accounts
    const acc = accounts.find(a => a.id === methodId);
    if (acc) return acc.name;

    // Humanize the string if not found
    return methodId.charAt(0).toUpperCase() + methodId.slice(1);
  };

  useEffect(() => {
    if (!isAdmin) return;

    const now = new Date();
    let start = startOfDay(subDays(now, 7));
    let end = endOfDay(now);

    if (dateRange === 'today') {
      start = startOfDay(now);
      end = endOfDay(now);
    } else if (dateRange === '7days') {
      start = startOfDay(subDays(now, 7));
      end = endOfDay(now);
    } else if (dateRange === '30days') {
      start = startOfDay(subDays(now, 30));
      end = endOfDay(now);
    } else if (dateRange === 'month') {
      start = startOfMonth(now);
      end = endOfMonth(now);
    } else if (dateRange === 'lastMonth') {
      start = startOfMonth(subMonths(now, 1));
      end = endOfMonth(subMonths(now, 1));
    } else if (dateRange === 'year') {
      start = startOfYear(now);
      end = endOfYear(now);
    } else if (dateRange === 'lastYear') {
      start = startOfYear(subYears(now, 1));
      end = endOfYear(subYears(now, 1));
    } else if (dateRange === 'custom') {
      start = startOfDay(new Date(customStartDate));
      end = endOfDay(new Date(customEndDate));
    }
    
    const q = query(
      collection(db, 'sales'),
      where('timestamp', '>=', Timestamp.fromDate(start)),
      where('timestamp', '<=', Timestamp.fromDate(end)),
      orderBy('timestamp', 'desc')
    );

    const unsubscribeSales = onSnapshot(q, (snapshot) => {
      let salesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
      
      // Filter out voided sales
      salesList = salesList.filter(s => s.status !== 'voided');

      // Filter by global location
      if (selectedLocationId !== 'all') {
        salesList = salesList.filter(s => s.locationId === selectedLocationId);
      }
      
      setSales(salesList);
    });

    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    const adjQ = query(
      collection(db, 'stockAdjustments'),
      where('timestamp', '>=', Timestamp.fromDate(start)),
      where('timestamp', '<=', Timestamp.fromDate(end)),
      orderBy('timestamp', 'desc')
    );

    const unsubscribeAdjustments = onSnapshot(adjQ, (snapshot) => {
      let adjList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockAdjustment));
      if (selectedLocationId !== 'all') {
        adjList = adjList.filter(a => a.locationId === selectedLocationId);
      }
      setAdjustments(adjList);
    });

    const unsubscribePayments = onSnapshot(collection(db, 'paymentOptions'), (snapshot) => {
      setPaymentOptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeAccounts = onSnapshot(collection(db, 'accounts'), (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeSales();
      unsubscribeProducts();
      unsubscribeAdjustments();
      unsubscribePayments();
      unsubscribeAccounts();
    };
  }, [dateRange, customStartDate, customEndDate, selectedLocationId, profile, isAdmin]);

  const handleExportCSV = () => {
    let data: any[] = [];
    let name = 'Report';

    if (reportType === 'sales') {
      name = 'Sales_Report';
      data = filteredSales.map(s => {
        const returnedAmount = (s.items || []).reduce((sum, item) => sum + ((item.price ?? 0) * (item.returnedQuantity || 0)), 0);
        const netTotal = Math.max(0, (s.total ?? 0) - returnedAmount);
        return {
          ID: s.id,
          Date: format(s.timestamp.toDate(), 'yyyy-MM-dd HH:mm'),
          Location: locations.find(l => l.id === s.locationId)?.name || 'Unknown',
          Items: s.items.map(i => {
            const netQty = i.quantity - (i.returnedQuantity || 0);
            return `${i.name} x${netQty}${i.returnedQuantity ? ` (${i.returnedQuantity} returned)` : ''}`;
          }).join('; '),
          Total: netTotal.toFixed(2),
          Payment: getPaymentMethodName(s.paymentMethod)
        };
      });
    } else if (reportType === 'inventory') {
      name = 'Inventory_Report';
      data = products.map(p => ({
        Name: p.name,
        Category: p.category,
        Stock: selectedLocationId === 'all' ? p.stock : (p.stocks?.[selectedLocationId] || 0),
        Cost: (p.cost ?? 0).toFixed(2),
        Value: ((p.cost ?? 0) * (selectedLocationId === 'all' ? p.stock : (p.stocks?.[selectedLocationId] || 0))).toFixed(2)
      }));
    } else if (reportType === 'profit') {
      name = 'Profitability_Report';
      data = products.map(p => {
        const pSales = sales.reduce((acc, s) => {
          const item = s.items.find(i => i.productId === p.id);
          if (item) {
            const netQty = Math.max(0, item.quantity - (item.returnedQuantity || 0));
            const netSubtotal = item.quantity > 0 ? (item.subtotal / item.quantity) * netQty : 0;
            acc.quantity += netQty;
            acc.revenue += netSubtotal;
          }
          return acc;
        }, { quantity: 0, revenue: 0 });
        const cost = pSales.quantity * p.cost;
        return {
          Name: p.name,
          UnitsSold: pSales.quantity,
          Revenue: (pSales.revenue ?? 0).toFixed(2),
          Cost: (cost ?? 0).toFixed(2),
          Profit: ((pSales.revenue ?? 0) - cost).toFixed(2)
        };
      });
    } else if (reportType === 'stock-adjustments') {
      name = 'Adjustments_Report';
      data = adjustments.map(a => ({
        Date: format(a.timestamp.toDate(), 'yyyy-MM-dd HH:mm'),
        Product: a.productName,
        Location: a.locationName,
        Type: a.type,
        Quantity: a.adjustmentQuantity,
        Reason: a.reason,
        By: a.adjustedByName
      }));
    }

    if (data.length === 0) {
      toast.error('No data available to export for the selected filters.');
      return;
    }

    exportToCSV(data, name);
    toast.success(`${name.replace('_', ' ')} exported`);
  };

  const handleGeneratePDF = () => {
    window.print();
  };

  const totalRevenue = sales.reduce((sum, s) => {
    const returnedAmount = (s.items || []).reduce((subSum, item) => subSum + ((item.price ?? 0) * (item.returnedQuantity || 0)), 0);
    const netTotal = Math.max(0, (s.total ?? 0) - returnedAmount);
    return sum + netTotal;
  }, 0);

  const totalProfit = sales.reduce((sum, s) => {
    const saleProfit = (s.items || []).reduce((pSum, item) => {
      const product = products.find(p => p.id === item.productId);
      const cost = product?.cost || 0;
      const netQty = Math.max(0, (item.quantity ?? 0) - (item.returnedQuantity || 0));
      const itemSubtotal = item.quantity > 0 ? (item.subtotal / item.quantity) * netQty : 0;
      const itemCost = cost * netQty;
      return pSum + (itemSubtotal - itemCost);
    }, 0);
    return sum + saleProfit;
  }, 0);

  const filteredSales = sales.filter(s => 
    s.items.some(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    s.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const inventoryValue = products.reduce((sum, p) => {
    const stock = selectedLocationId === 'all' ? p.stock : (p.stocks?.[selectedLocationId] || 0);
    return sum + (p.cost * stock);
  }, 0);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight font-heading">Reports & Insights</h1>
          <p className="text-slate-500 mt-1">Detailed breakdown of your business performance and inventory.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2 border-slate-200 bg-white shadow-sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button 
            className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 gap-2"
            onClick={handleGeneratePDF}
          >
            <FileText className="w-4 h-4" />
            Generate PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm border-slate-200/60 overflow-hidden">
          <div className="h-1 bg-indigo-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Period Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{settings.currency}{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <p className="text-[10px] text-slate-400 mt-1">Total sales in selected range</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200/60 overflow-hidden">
          <div className="h-1 bg-emerald-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Gross Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{settings.currency}{totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <p className="text-[10px] text-slate-400 mt-1">Margin: {((totalProfit / (totalRevenue || 1)) * 100).toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200/60 overflow-hidden">
          <div className="h-1 bg-amber-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Orders Count</CardTitle>
            <ShoppingBag className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{sales.length}</div>
            <p className="text-[10px] text-slate-400 mt-1">Avg: {settings.currency}{(totalRevenue / (sales.length || 1)).toFixed(2)} / order</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200/60 overflow-hidden">
          <div className="h-1 bg-slate-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Inventory Value</CardTitle>
            <Package className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{settings.currency}{inventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <p className="text-[10px] text-slate-400 mt-1">{products.length} products in stock</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-slate-200/60">
        <CardHeader className="border-b border-slate-100 bg-slate-50/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1">
                <Button 
                  variant={reportType === 'sales' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className="text-xs h-8"
                  onClick={() => setReportType('sales')}
                >
                  Sales
                </Button>
                <Button 
                  variant={reportType === 'inventory' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className="text-xs h-8"
                  onClick={() => setReportType('inventory')}
                >
                  Inventory
                </Button>
                <Button 
                  variant={reportType === 'profit' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className="text-xs h-8"
                  onClick={() => setReportType('profit')}
                >
                  Profitability
                </Button>
                <Button 
                  variant={reportType === 'stock-adjustments' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className="text-xs h-8"
                  onClick={() => setReportType('stock-adjustments')}
                >
                  Adjustments
                </Button>
              </div>
              <div className="h-6 w-px bg-slate-200 hidden md:block" />
              <div className="flex items-center gap-2">
                <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
                  <SelectTrigger className="w-[140px] h-9 text-xs bg-white">
                    <SelectValue placeholder="Date Range">
                      {dateRange === 'today' ? 'Today' : 
                       dateRange === '7days' ? 'Last 7 Days' : 
                       dateRange === '30days' ? 'Last 30 Days' : 
                       dateRange === 'month' ? 'This Month' : 
                       dateRange === 'lastMonth' ? 'Last Month' :
                       dateRange === 'year' ? 'This Year' :
                       dateRange === 'lastYear' ? 'Last Year' :
                       dateRange === 'custom' ? 'Custom Range' : dateRange}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="7days">Last 7 Days</SelectItem>
                    <SelectItem value="30days">Last 30 Days</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="lastMonth">Last Month</SelectItem>
                    <SelectItem value="year">This Year</SelectItem>
                    <SelectItem value="lastYear">Last Year</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>

                {dateRange === 'custom' && (
                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                    <Input 
                      type="date" 
                      value={customStartDate} 
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="h-9 text-xs w-[130px] bg-white border-slate-200"
                    />
                    <span className="text-slate-400">to</span>
                    <Input 
                      type="date" 
                      value={customEndDate} 
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="h-9 text-xs w-[130px] bg-white border-slate-200"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                className="pl-9 h-9 text-xs bg-white" 
                placeholder="Search report data..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {reportType === 'sales' && (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="w-[100px]">Order ID</TableHead>
                  <TableHead>Date & Time</TableHead>
                  {selectedLocationId === 'all' && <TableHead>Location</TableHead>}
                  <TableHead>Items</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-slate-400 italic">
                      No sales records found for this period
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSales.map((sale) => (
                    <TableRow key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-mono text-[10px] text-slate-500">#{sale.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-xs font-medium">
                        {format(sale.timestamp.toDate(), 'MMM dd, yyyy HH:mm')}
                      </TableCell>
                      {selectedLocationId === 'all' && (
                        <TableCell className="text-xs">
                          {locations.find(l => l.id === sale.locationId)?.name || 'Unknown'}
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {sale.items.map((item, idx) => {
                            const netQty = item.quantity - (item.returnedQuantity || 0);
                            return (
                              <Badge key={idx} variant="outline" className="text-[10px] font-normal bg-white">
                                {item.name} x{netQty}
                                {item.returnedQuantity && item.returnedQuantity > 0 ? (
                                  <span className="text-rose-500 font-bold ml-1">({item.returnedQuantity} ret)</span>
                                ) : null}
                              </Badge>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] font-medium">
                          {getPaymentMethodName(sale.paymentMethod)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-900">
                        {settings.currency}{(() => {
                          const returnedAmount = (sale.items || []).reduce((sum, item) => sum + ((item.price ?? 0) * (item.returnedQuantity || 0)), 0);
                          const netTotal = Math.max(0, (sale.total ?? 0) - returnedAmount);
                          return netTotal.toFixed(2);
                        })()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {reportType === 'inventory' && (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Stock Level</TableHead>
                  <TableHead>Unit Cost</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{product.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${
                          (selectedLocationId === 'all' 
                            ? Object.values(product.stocks || {}).reduce((sum, val) => (sum as number) + Number(val), 0) as number
                            : Number(product.stocks?.[selectedLocationId] || 0)) <= product.lowStockThreshold 
                            ? 'text-rose-600' : 'text-slate-700'
                        }`}>
                          {selectedLocationId === 'all' 
                            ? Object.values(product.stocks || {}).reduce((sum, val) => (sum as number) + Number(val), 0) as number
                            : Number(product.stocks?.[selectedLocationId] || 0)}
                        </span>
                        {(selectedLocationId === 'all' 
                          ? Object.values(product.stocks || {}).reduce((sum, val) => (sum as number) + Number(val), 0) as number
                          : Number(product.stocks?.[selectedLocationId] || 0)) <= product.lowStockThreshold && (
                          <Badge variant="destructive" className="h-4 px-1 text-[8px]">LOW</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{settings.currency}{(product.cost ?? 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-bold text-slate-900">
                      {settings.currency}{((product.cost ?? 0) * (selectedLocationId === 'all' 
                        ? Object.values(product.stocks || {}).reduce((sum, val) => (sum as number) + Number(val), 0) as number
                        : Number(product.stocks?.[selectedLocationId] || 0))).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {reportType === 'profit' && (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Units Sold</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Cost of Goods</TableHead>
                  <TableHead className="text-right">Gross Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const productSales = sales.reduce((acc, sale) => {
                    const item = sale.items.find(i => i.productId === product.id);
                    if (item) {
                      const netQty = Math.max(0, item.quantity - (item.returnedQuantity || 0));
                      const netSubtotal = item.quantity > 0 ? (item.subtotal / item.quantity) * netQty : 0;
                      acc.quantity += netQty;
                      acc.revenue += netSubtotal;
                    }
                    return acc;
                  }, { quantity: 0, revenue: 0 });

                  const totalCost = productSales.quantity * product.cost;
                  const profit = productSales.revenue - totalCost;

                  return (
                    <TableRow key={product.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-xs">{productSales.quantity}</TableCell>
                      <TableCell className="text-xs text-slate-600">{settings.currency}{(productSales.revenue ?? 0).toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-slate-400">{settings.currency}{(totalCost ?? 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <span className={`font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {settings.currency}{(profit ?? 0).toFixed(2)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              {products.length > 0 && (
                <tfoot className="bg-slate-50 font-bold">
                  <TableRow>
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-xs">
                      {products.reduce((sum, p) => {
                        return sum + sales.reduce((acc, s) => {
                          const item = s.items.find(i => i.productId === p.id);
                          const netQty = item ? Math.max(0, item.quantity - (item.returnedQuantity || 0)) : 0;
                          return acc + netQty;
                        }, 0);
                      }, 0)}
                    </TableCell>
                    <TableCell className="text-xs text-indigo-600">
                      {settings.currency}{(totalRevenue ?? 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {settings.currency}{(totalRevenue - totalProfit).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-emerald-600">
                      {settings.currency}{(totalProfit ?? 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                </tfoot>
              )}
            </Table>
          )}

          {reportType === 'stock-adjustments' && (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Product</TableHead>
                  {selectedLocationId === 'all' && <TableHead>Location</TableHead>}
                  <TableHead>Type</TableHead>
                  <TableHead>Adjustment</TableHead>
                  <TableHead>New Stock</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Adjusted By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjustments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={selectedLocationId === 'all' ? 8 : 7} className="text-center py-12 text-slate-400 italic">
                      No stock adjustments found for this period
                    </TableCell>
                  </TableRow>
                ) : (
                  adjustments.map((adj) => (
                    <TableRow key={adj.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="text-xs">
                        {format(adj.timestamp.toDate(), 'MMM dd, yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="font-medium text-xs">{adj.productName}</TableCell>
                      {selectedLocationId === 'all' && (
                        <TableCell className="text-xs">{adj.locationName}</TableCell>
                      )}
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          "capitalize text-[10px]",
                          adj.type === 'add' ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
                          adj.type === 'subtract' ? "border-rose-200 bg-rose-50 text-rose-700" :
                          "border-indigo-200 bg-indigo-50 text-indigo-700"
                        )}>
                          {adj.type}
                        </Badge>
                      </TableCell>
                      <TableCell className={cn(
                        "text-xs font-bold",
                        adj.adjustmentQuantity > 0 ? "text-emerald-600" : 
                        adj.adjustmentQuantity < 0 ? "text-rose-600" : "text-slate-600"
                      )}>
                        {adj.adjustmentQuantity > 0 ? '+' : ''}{adj.adjustmentQuantity}
                      </TableCell>
                      <TableCell className="text-xs font-bold">{adj.newStock}</TableCell>
                      <TableCell className="text-xs text-slate-500 max-w-[200px] truncate" title={adj.reason}>
                        {adj.reason}
                      </TableCell>
                      <TableCell className="text-xs">{adj.adjustedByName}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
