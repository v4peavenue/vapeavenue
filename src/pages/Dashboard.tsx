import React, { useEffect, useState } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  Timestamp,
  getDocs
} from 'firebase/firestore';
import { OperationType, handleFirestoreError } from '@/lib/firestore-utils';
import { 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingBag,
  Plus,
  History,
  ArrowRight,
  BarChart3,
  CheckCircle2
} from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLocations } from '../contexts/LocationContext';
import { useSettings } from '../contexts/SettingsContext';
import { Product, Sale, AuditLog } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  Legend
} from 'recharts';

interface LowStockAlert {
  product: Product;
  locationId: string;
  locationName: string;
  stock: number;
  threshold: number;
}

import { 
  format, 
  startOfDay, 
  subDays, 
  isSameDay, 
  eachDayOfInterval, 
  eachMonthOfInterval, 
  eachYearOfInterval,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  isSameMonth,
  isSameYear,
  addDays,
  subMonths,
  subYears
} from 'date-fns';
import { motion } from 'motion/react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';

export const Dashboard: React.FC = () => {
  const { isAdmin } = useAuth();
  const { selectedLocationId, locations } = useLocations();
  const { settings } = useSettings();
  const [stats, setStats] = useState({
    totalSales: 0,
    totalOrders: 0,
    lowStockCount: 0,
    totalProducts: 0,
    salesTrend: 0,
  });
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<AuditLog[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [locationChartData, setLocationChartData] = useState<any[]>([]);
  const [paymentOptions, setPaymentOptions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New states for filters
  const [timeRange, setTimeRange] = useState<string>('7days');
  const [customStartDate, setCustomStartDate] = useState<string>(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [groupBy, setGroupBy] = useState<'day' | 'month' | 'year'>('day');

  useEffect(() => {
    if (!isAdmin) return;

    // Listen to products for low stock alerts and top products
    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      
      const filteredProducts = selectedLocationId === 'all' 
        ? allProducts 
        : allProducts.filter(p => 
            (p.locationIds && p.locationIds.includes(selectedLocationId)) ||
            (p.stocks && p.stocks[selectedLocationId] !== undefined && Number(p.stocks[selectedLocationId]) > 0)
          );

      let alerts: LowStockAlert[] = [];
      if (selectedLocationId === 'all') {
        allProducts.forEach(p => {
          // Only show alerts for locations that actually carry the product (linked or has stock)
          const productLocations = Array.from(new Set([
            ...(p.locationIds || []),
            ...Object.keys(p.stocks || {})
          ]));
          
          productLocations.forEach(locId => {
            const loc = locations.find(l => l.id === locId);
            if (!loc) return;

            const stock = Number(p.stocks?.[locId] || 0);
            const threshold = p.locationThresholds?.[locId] ?? p.lowStockThreshold;

            if (stock > 0 && stock <= threshold) {
              alerts.push({
                product: p,
                locationId: locId,
                locationName: loc.name,
                stock,
                threshold
              });
            }
          });
        });
      } else {
        const loc = locations.find(l => l.id === selectedLocationId);
        filteredProducts.forEach(p => {
          const stock = Number(p.stocks?.[selectedLocationId] || 0);
          const threshold = p.locationThresholds?.[selectedLocationId] ?? p.lowStockThreshold;

          if (stock > 0 && stock <= threshold) {
            alerts.push({
              product: p,
              locationId: selectedLocationId,
              locationName: loc?.name || 'Unknown',
              stock,
              threshold
            });
          }
        });
      }

      setLowStockAlerts(alerts);
      setStats(prev => ({ ...prev, lowStockCount: alerts.length, totalProducts: filteredProducts.length }));
    }, (error) => {
      console.warn("Dashboard: Error listening to products:", error);
    });

    // Listen to audit logs
    const auditQuery = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(5));
    const unsubscribeAudit = onSnapshot(auditQuery, (snapshot) => {
      setRecentActivity(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
    }, (error) => {
      console.warn("Dashboard: Error listening to audit_logs:", error);
    });

    // Calculate dates based on range
    const now = new Date();
    let startDate = subDays(now, 7);
    let endDate = now;

    if (timeRange === 'today') startDate = startOfDay(now);
    else if (timeRange === '30days') startDate = subDays(now, 30);
    else if (timeRange === 'month') {
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
    }
    else if (timeRange === 'lastMonth') {
      startDate = startOfMonth(subMonths(now, 1));
      endDate = endOfMonth(subMonths(now, 1));
    }
    else if (timeRange === 'year') {
      startDate = startOfYear(now);
      endDate = endOfYear(now);
    }
    else if (timeRange === 'lastYear') {
      startDate = startOfYear(subYears(now, 1));
      endDate = endOfYear(subYears(now, 1));
    }
    else if (timeRange === 'custom') {
      startDate = startOfDay(new Date(customStartDate));
      endDate = startOfDay(addDays(new Date(customEndDate), 1)); // inclusive end of day
    }

    const salesQuery = query(
      collection(db, 'sales'),
      where('timestamp', '>=', Timestamp.fromDate(startDate)),
      where('timestamp', '<=', Timestamp.fromDate(endDate)),
      orderBy('timestamp', 'desc')
    );

    const unsubscribeSales = onSnapshot(salesQuery, (snapshot) => {
      let sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
      sales = sales.filter(s => s.status !== 'voided');

      if (selectedLocationId !== 'all') {
        sales = sales.filter(s => s.locationId === selectedLocationId);
      }
      
      const totalSales = sales.reduce((sum, s) => {
        const returnedAmount = (s.items || []).reduce((subSum, item) => subSum + ((item.price ?? 0) * (item.returnedQuantity || 0)), 0);
        const netTotal = Math.max(0, (s.total ?? 0) - returnedAmount);
        return sum + netTotal;
      }, 0);
      setStats(prev => ({ ...prev, totalSales, totalOrders: sales.length }));
      setRecentSales(sales.slice(0, 5));

      // Top products
      const productSales: { [key: string]: { name: string, quantity: number, total: number } } = {};
      sales.forEach(sale => {
        sale.items.forEach(item => {
          if (!productSales[item.productId]) {
            productSales[item.productId] = { name: item.name, quantity: 0, total: 0 };
          }
          const netQty = Math.max(0, item.quantity - (item.returnedQuantity || 0));
          const netSubtotal = item.quantity > 0 ? (item.subtotal / item.quantity) * netQty : 0;
          productSales[item.productId].quantity += netQty;
          productSales[item.productId].total += netSubtotal;
        });
      });

      const top = Object.values(productSales).sort((a, b) => b.total - a.total).slice(0, 5);
      setTopProducts(top);

      // Prepare Chart Data
      let interval: Date[] = [];
      if (groupBy === 'day') {
        interval = eachDayOfInterval({ start: startDate, end: endDate });
      } else if (groupBy === 'month') {
        interval = eachMonthOfInterval({ start: startDate, end: endDate });
      } else {
        interval = eachYearOfInterval({ start: startDate, end: endDate });
      }

      const revenueData = interval.map(date => {
        let bucketSales = [];
        let label = '';
        let subLabel = '';

        if (groupBy === 'day') {
          bucketSales = sales.filter(s => isSameDay(s.timestamp.toDate(), date));
          label = format(date, 'dd');
          subLabel = format(date, 'MMM yy');
        } else if (groupBy === 'month') {
          bucketSales = sales.filter(s => isSameMonth(s.timestamp.toDate(), date));
          label = format(date, 'MMM');
          subLabel = format(date, 'yyyy');
        } else {
          bucketSales = sales.filter(s => isSameYear(s.timestamp.toDate(), date));
          label = format(date, 'yyyy');
        }

        return {
          name: label,
          subLabel,
          amount: bucketSales.reduce((sum, s) => {
            const returnedAmount = (s.items || []).reduce((subSum, item) => subSum + ((item.price ?? 0) * (item.returnedQuantity || 0)), 0);
            return sum + Math.max(0, (s.total ?? 0) - returnedAmount);
          }, 0),
          orders: bucketSales.length,
          fullDate: date
        };
      });
      setChartData(revenueData);

      // Revenue by Location Data
      const locationData = interval.map(date => {
        const item: any = {
          name: groupBy === 'day' ? format(date, 'dd') : (groupBy === 'month' ? format(date, 'MMM') : format(date, 'yyyy')),
          subLabel: groupBy === 'day' ? format(date, 'MMM yy') : (groupBy === 'month' ? format(date, 'yyyy' ) : ''),
          fullDate: date
        };

        locations.forEach(loc => {
          let locSales = sales.filter(s => s.locationId === loc.id);
          if (groupBy === 'day') {
            locSales = locSales.filter(s => isSameDay(s.timestamp.toDate(), date));
          } else if (groupBy === 'month') {
            locSales = locSales.filter(s => isSameMonth(s.timestamp.toDate(), date));
          } else {
            locSales = locSales.filter(s => isSameYear(s.timestamp.toDate(), date));
          }
          item[loc.name] = locSales.reduce((sum, s) => {
            const returnedAmount = (s.items || []).reduce((subSum, item) => subSum + ((item.price ?? 0) * (item.returnedQuantity || 0)), 0);
            return sum + Math.max(0, (s.total ?? 0) - returnedAmount);
          }, 0);
        });

        return item;
      });
      setLocationChartData(locationData);

      setLoading(false);
    }, (error) => {
      console.warn("Dashboard: Error listening to sales:", error);
      setLoading(false);
    });

    const unsubscribePayments = onSnapshot(collection(db, 'paymentOptions'), (snapshot) => {
      setPaymentOptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeAccounts = onSnapshot(collection(db, 'accounts'), (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeProducts();
      unsubscribeSales();
      unsubscribeAudit();
      unsubscribePayments();
      unsubscribeAccounts();
    };
  }, [isAdmin, selectedLocationId, timeRange, groupBy, locations, customStartDate, customEndDate]);

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

  const StatCard = ({ title, value, icon: Icon, description, trend, trendValue, className }: any) => {
    const isRevenue = title.toLowerCase().includes('revenue');
    const isOrders = title.toLowerCase().includes('orders');
    const isLowStock = title.toLowerCase().includes('low stock');

    if (isRevenue) {
      return (
        <Card className={cn("overflow-hidden bg-gradient-to-br from-[#1C2D4E] to-[#0D1627] text-white border-none shadow-md shadow-indigo-950/10 relative group hover:scale-[1.02] transition-all duration-300", className)}>
          <div className="absolute right-0 top-0 w-24 h-24 bg-white/5 rounded-full -mr-6 -mt-6 group-hover:scale-125 transition-transform duration-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3.5 px-3.5">
            <CardTitle className="text-[10px] font-bold text-white/70 uppercase tracking-widest">{title}</CardTitle>
            <div className="p-1.5 bg-white/10 rounded-lg relative z-10">
              <Icon className="h-3.5 w-3.5 text-[#D4AF37]" />
            </div>
          </CardHeader>
          <CardContent className="pb-3 px-3.5">
            <div className="text-xl font-black tracking-tight font-heading text-white">{value}</div>
            <p className="text-[10px] text-[#D4AF37] mt-0.5 flex items-center gap-1 font-semibold">
              {trend && (
                <span className="flex items-center text-emerald-400">
                  <ArrowUpRight className="w-3 h-3 stroke-[2.5px]" />
                  {trendValue}%
                </span>
              )}
              <span className="text-white/60 font-normal">{description}</span>
            </p>
          </CardContent>
        </Card>
      );
    }

    if (isOrders) {
      return (
        <Card className={cn("overflow-hidden bg-gradient-to-br from-[#A0522D] to-[#804224] text-white border-none shadow-md shadow-amber-950/10 relative group hover:scale-[1.02] transition-all duration-300", className)}>
          <div className="absolute right-0 top-0 w-24 h-24 bg-white/5 rounded-full -mr-6 -mt-6 group-hover:scale-125 transition-transform duration-500" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3.5 px-3.5">
            <CardTitle className="text-[10px] font-bold text-white/70 uppercase tracking-widest">{title}</CardTitle>
            <div className="p-1.5 bg-white/10 rounded-lg relative z-10">
              <Icon className="h-3.5 w-3.5 text-white" />
            </div>
          </CardHeader>
          <CardContent className="pb-3 px-3.5">
            <div className="text-xl font-black tracking-tight font-heading text-white">{value}</div>
            <p className="text-[10px] text-white/80 mt-0.5 flex items-center gap-1 font-semibold">
              {trend && (
                <span className="flex items-center text-amber-300">
                  <ArrowUpRight className="w-3 h-3 stroke-[2.5px]" />
                  {trendValue}%
                </span>
              )}
              <span className="text-white/50 font-normal">{description}</span>
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className={cn("overflow-hidden bg-white hover:bg-slate-50/50 border-slate-200/60 shadow-sm relative group hover:scale-[1.01] transition-all duration-300", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3.5 px-3.5">
          <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</CardTitle>
          <div className={cn("p-1.5 rounded-lg transition-colors", isLowStock && value > 0 ? "bg-rose-100" : "bg-slate-100")}>
            <Icon className={cn("h-3.5 w-3.5", isLowStock && value > 0 ? "text-rose-600" : "text-[#1A2B4B]")} />
          </div>
        </CardHeader>
        <CardContent className="pb-3 px-3.5">
          <div className={cn("text-xl font-black tracking-tight font-heading", isLowStock && value > 0 ? "text-rose-600 font-bold" : "text-[#1A2B4B]")}>{value}</div>
          <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
            {description}
          </p>
        </CardContent>
      </Card>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-5 pb-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1A2B4B] tracking-tight font-heading flex items-center gap-1.5">
            Dashboard
            <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Real-time overview of your inventory and sales performance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/pos">
            <Button className="bg-gradient-to-r from-[#1C2D4E] to-[#0D1627] hover:from-[#253D68] hover:to-[#14233F] text-white shadow-md shadow-[#1A2B4B]/10 border-none transition-all duration-300 gap-1.5 h-8 px-3 text-xs font-bold">
              <Plus className="w-3.5 h-3.5" />
              New Sale
            </Button>
          </Link>
          <Link to="/inventory">
            <Button variant="outline" className="gap-1.5 border-[#D4AF37]/25 hover:bg-[#D4AF37]/5 text-slate-700 h-8 px-3 text-xs font-semibold">
              <Package className="w-3.5 h-3.5" />
              Add Product
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Revenue" 
          value={`${settings.currency}${stats.totalSales.toLocaleString()}`} 
          icon={DollarSign}
          description={`Filtered period`}
          trend="up"
          trendValue="12.5"
        />
        <StatCard 
          title="Sales Orders" 
          value={stats.totalOrders} 
          icon={ShoppingBag}
          description={`Filtered period`}
          trend="up"
          trendValue="8.2"
        />
        <StatCard 
          title="Inventory Items" 
          value={stats.totalProducts} 
          icon={Package}
          description="Total products"
        />
        <StatCard 
          title="Low Stock Alerts" 
          value={stats.lowStockCount} 
          icon={AlertTriangle}
          description="Items needing restock"
          className={stats.lowStockCount > 0 ? "border-amber-200 bg-amber-50/50" : ""}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-white/75 backdrop-blur-sm p-3 rounded-xl border border-slate-200/50 shadow-sm">
        <div className="flex items-center gap-2">
          <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Range:</Label>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px] h-9 bg-white text-xs">
              <SelectValue>
                {timeRange === 'today' ? 'Today' : 
                 timeRange === '7days' ? 'Last 7 Days' : 
                 timeRange === '30days' ? 'Last 30 Days' : 
                 timeRange === 'month' ? 'This Month' : 
                 timeRange === 'lastMonth' ? 'Last Month' : 
                 timeRange === 'year' ? 'This Year' : 
                 timeRange === 'lastYear' ? 'Last Year' : 
                 timeRange === 'custom' ? 'Custom Range' : timeRange}
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
        </div>

        {timeRange === 'custom' && (
          <div className="flex items-center gap-2 border-l border-slate-200 pl-4 animate-in fade-in slide-in-from-left-2 duration-300">
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From:</Label>
            <Input 
              type="date" 
              value={customStartDate} 
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="h-9 text-xs w-[130px] bg-white border-slate-200 focus:ring-[#1A2B4B]"
            />
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">To:</Label>
            <Input 
              type="date" 
              value={customEndDate} 
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="h-9 text-xs w-[130px] bg-white border-slate-200 focus:ring-[#1A2B4B]"
            />
          </div>
        )}

        <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
          <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Group By:</Label>
          <div className="flex p-1 bg-slate-100 rounded-lg">
            {(['day', 'month', 'year'] as const).map(p => (
              <button
                key={p}
                onClick={() => setGroupBy(p)}
                className={cn(
                  "px-3 py-1 text-[10px] font-bold uppercase tracking-tight rounded-md transition-all",
                  groupBy === p ? "bg-white text-[#1A2B4B] shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-sm border-slate-200/60 bg-white/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-heading text-[#1A2B4B]">Revenue Overview</CardTitle>
              <CardDescription>Sales across the selected period grouped by {groupBy}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="h-[350px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1A2B4B" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#1A2B4B" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  dy={5}
                />
                <XAxis 
                  dataKey="subLabel"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 8, fill: '#94a3b8', fontWeight: 600 }}
                  interval={groupBy === 'day' ? (chartData.length > 15 ? 5 : 0) : 0}
                  xAxisId="sub"
                  dy={-5}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={(value) => `${settings.currency}${value.toLocaleString()}`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => [`${settings.currency}${value.toLocaleString()}`, 'Revenue']}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      const data = payload[0].payload;
                      return `${data.name} ${data.subLabel || ''}`;
                    }
                    return label;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#1A2B4B" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorAmount)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Selling Products - moved here */}
        <Card className="shadow-sm border-slate-200/60 bg-white/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-heading text-[#1A2B4B]">Top Selling Products</CardTitle>
            <CardDescription>By revenue generated this period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topProducts.length === 0 ? (
                <div className="text-center py-8 text-slate-400 italic">No sales data yet</div>
              ) : (
                topProducts.map((product, idx) => (
                  <div key={idx} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-300 w-4 group-hover:text-[#D4AF37] transition-colors">{idx + 1}</span>
                      <span className="text-sm font-medium text-slate-700">{product.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#1A2B4B]">{settings.currency}{(product.total ?? 0).toLocaleString()}</p>
                      <p className="text-[10px] text-slate-500">{product.quantity} units sold</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-sm border-slate-200/60 bg-white/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-heading text-[#1A2B4B]">Revenue by Location</CardTitle>
              <CardDescription>Distribution of revenue across different branches</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="h-[350px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={locationChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b' }}
                />
                <XAxis 
                  dataKey="subLabel"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 8, fill: '#94a3b8', fontWeight: 600 }}
                  interval={groupBy === 'day' ? (locationChartData.length > 15 ? 5 : 0) : 0}
                  xAxisId="sub"
                  dy={-10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={(value) => `${settings.currency}${value.toLocaleString()}`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => [`${settings.currency}${value.toLocaleString()}`, '']}
                  cursor={{ fill: '#f1f5f9' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                {locations.filter(l => selectedLocationId === 'all' || l.id === selectedLocationId).map((loc, index) => {
                  const colors = ['#1A2B4B', '#D4AF37', '#22c55e', '#ef4444', '#a855f7', '#3b82f6'];
                  return (
                    <Bar 
                      key={loc.id} 
                      dataKey={loc.name} 
                      fill={colors[index % colors.length]} 
                      radius={[4, 4, 0, 0]} 
                      stackId="location"
                      animationDuration={1500}
                    />
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Sales - existing card */}
        <Card className="shadow-sm border-slate-200/60 bg-white/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-heading text-[#1A2B4B]">Recent Sales</CardTitle>
              <CardDescription>Latest transactions</CardDescription>
            </div>
            <History className="w-5 h-5 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center gap-4 group cursor-pointer">
                  <div className="w-9 h-9 rounded-lg bg-[#1A2B4B]/5 flex items-center justify-center text-[#1A2B4B] font-bold group-hover:bg-[#1A2B4B] group-hover:text-white transition-all">
                    {(getPaymentMethodName(sale.paymentMethod)?.[0] || 'S').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#1A2B4B] truncate">
                      {sale.items.map(i => i.name).join(', ')}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {format(sale.timestamp.toDate(), 'HH:mm')} • {getPaymentMethodName(sale.paymentMethod)}
                    </p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-0.5">
                    <div className="text-xs font-bold text-[#1A2B4B]">
                      +{settings.currency}{(() => {
                        const returnedAmount = (sale.items || []).reduce((sum, item) => sum + ((item.price ?? 0) * (item.returnedQuantity || 0)), 0);
                        const netTotal = Math.max(0, (sale.total ?? 0) - returnedAmount);
                        return netTotal.toFixed(2);
                      })()}
                    </div>
                    {sale.status === 'returned' && (
                      <span className="text-[8px] px-1 py-0.5 rounded bg-blue-50 text-blue-600 font-bold leading-none">Returned</span>
                    )}
                    {sale.status === 'partially_returned' && (
                      <span className="text-[8px] px-1 py-0.5 rounded bg-indigo-50 text-indigo-600 font-bold leading-none">Partially Returned</span>
                    )}
                  </div>
                </div>
              ))}
              <Link to="/reports" className="block pt-2">
                <Button variant="ghost" className="w-full text-[10px] h-8 text-[#1A2B4B] uppercase tracking-wider font-bold gap-1">
                  Full Sales Report <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        {/* Low Stock Alerts - existing but updated */}
        <Card className="shadow-sm border-slate-200/60 bg-white/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-heading flex items-center gap-2 text-[#1A2B4B]">
              Low Stock Alerts
              {lowStockAlerts.length > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-[10px] bg-rose-500">
                  {lowStockAlerts.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Items needing replenishment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {lowStockAlerts.length === 0 ? (
                <div className="text-center py-8 text-emerald-500 font-medium flex flex-col items-center gap-2 col-span-2">
                  <CheckCircle2 className="w-8 h-8 opacity-20" />
                  All stock levels healthy
                </div>
              ) : (
                lowStockAlerts.slice(0, 10).map((alert, idx) => (
                  <div key={`${alert.product.id}-${alert.locationId}-${idx}`} className="flex items-center justify-between p-3 rounded-xl bg-rose-50/30 border border-rose-100">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#1A2B4B] truncate">{alert.product.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Badge variant="outline" className="text-[8px] h-3 px-1 py-0 border-indigo-100 bg-indigo-50 text-indigo-600 font-bold uppercase tracking-tighter">
                          {alert.locationName}
                        </Badge>
                        <span className="text-[9px] text-slate-400 font-mono">SKU: {alert.product.sku}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-rose-600">
                        {alert.stock}
                      </p>
                      <p className="text-[9px] text-slate-400">Target: {alert.threshold}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            {lowStockAlerts.length > 10 && (
              <p className="text-[10px] text-center text-slate-400 mt-4 italic">And {lowStockAlerts.length - 10} more alerts...</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity - existing but updated */}
        <Card className="shadow-sm border-slate-200/60 bg-white/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-heading text-[#1A2B4B]">Recent Activity</CardTitle>
            <CardDescription>Audit trails and system logs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((log) => (
                <div key={log.id} className="flex gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-[#D4AF37] mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#1A2B4B] leading-snug">
                      {log.details}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-4 h-4 rounded px-1 bg-slate-100 text-[8px] font-bold text-slate-500 flex items-center justify-center">
                        {log.userName[0]}
                      </div>
                      <p className="text-[9px] text-slate-400">
                        {format(log.timestamp.toDate(), 'HH:mm')} • {log.userName}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
};
