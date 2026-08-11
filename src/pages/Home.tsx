import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingCart, 
  Package, 
  LayoutDashboard, 
  BookOpen, 
  History, 
  TrendingUp, 
  Wallet, 
  Clock, 
  Settings, 
  ShieldCheck, 
  Building2, 
  ArrowRight,
  Zap,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocations } from '../contexts/LocationContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const Home: React.FC = () => {
  const { profile, user, isAdmin, isManager } = useAuth();
  const { locations, selectedLocation, selectedLocationId } = useLocations();
  const navigate = useNavigate();

  const activeLocationName = selectedLocation ? selectedLocation.name : 'All Store Locations';

  const modules = [
    {
      title: 'POS Register',
      description: 'Start a fast checkout session, process cash/e-wallet sales, and scan barcodes.',
      icon: ShoppingCart,
      path: '/pos',
      color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
      btnColor: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      badge: 'Fast Checkout',
      roles: ['admin', 'manager', 'staff']
    },
    {
      title: 'Inventory & Stock',
      description: 'Manage catalog, update stock quantities, price tiers, and low-stock alerts.',
      icon: Package,
      path: '/inventory',
      color: 'bg-blue-500/10 text-blue-600 border-blue-200',
      btnColor: 'bg-blue-600 hover:bg-blue-700 text-white',
      roles: ['admin', 'manager', 'staff']
    },
    {
      title: 'Directory & Loyalty',
      description: 'Customer directory, loyalty cards, staff rosters, and vendor directory.',
      icon: BookOpen,
      path: '/directory',
      color: 'bg-purple-500/10 text-purple-600 border-purple-200',
      btnColor: 'bg-purple-600 hover:bg-purple-700 text-white',
      roles: ['admin', 'manager', 'staff']
    },
    {
      title: 'Sales History',
      description: 'View sales ledger, issue refunds, approve discounts, and print receipts.',
      icon: History,
      path: '/sales',
      color: 'bg-amber-500/10 text-amber-600 border-amber-200',
      btnColor: 'bg-amber-600 hover:bg-amber-700 text-white',
      roles: ['admin', 'manager', 'staff']
    },
    {
      title: 'Financial Ledger',
      description: 'Store accounts, cash registers, expenses, and transaction logs.',
      icon: Wallet,
      path: '/finance',
      color: 'bg-indigo-500/10 text-indigo-600 border-indigo-200',
      btnColor: 'bg-indigo-600 hover:bg-indigo-700 text-white',
      roles: ['admin', 'manager', 'staff']
    },
    {
      title: 'Attendance & Schedule',
      description: 'Employee timeclock, shift schedules, and overtime requests.',
      icon: Clock,
      path: '/attendance',
      color: 'bg-teal-500/10 text-teal-600 border-teal-200',
      btnColor: 'bg-teal-600 hover:bg-teal-700 text-white',
      roles: ['admin', 'manager', 'staff']
    },
    {
      title: 'Executive Dashboard',
      description: 'Real-time sales velocity, KPI analytics, and store profitability charts.',
      icon: LayoutDashboard,
      path: '/dashboard',
      color: 'bg-rose-500/10 text-rose-600 border-rose-200',
      btnColor: 'bg-rose-600 hover:bg-rose-700 text-white',
      roles: ['admin']
    },
    {
      title: 'Analytics & Reports',
      description: 'Custom date reporting, inventory valuations, and audit logs.',
      icon: TrendingUp,
      path: '/reports',
      color: 'bg-orange-500/10 text-orange-600 border-orange-200',
      btnColor: 'bg-orange-600 hover:bg-orange-700 text-white',
      roles: ['admin']
    },
    {
      title: 'System Settings',
      description: 'Global configurations, user roles, database backup and reconciliation.',
      icon: Settings,
      path: '/settings',
      color: 'bg-slate-500/10 text-slate-700 border-slate-200',
      btnColor: 'bg-slate-800 hover:bg-slate-900 text-white',
      roles: ['admin', 'manager', 'staff']
    }
  ];

  const userRole = profile?.role || 'staff';
  const availableModules = modules.filter(m => m.roles.includes(userRole));

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 sm:p-6 lg:p-8">
      {/* Header Banner - 0 DB Reads */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 md:p-10 shadow-xl border border-slate-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 px-3 py-1 text-xs font-semibold">
                <Zap className="w-3.5 h-3.5 mr-1 text-emerald-400 fill-emerald-400" /> 0-Read Launchpad
              </Badge>
              <Badge className="bg-white/10 text-slate-200 border-white/20 px-3 py-1 text-xs font-medium">
                <Building2 className="w-3.5 h-3.5 mr-1" /> {activeLocationName}
              </Badge>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight font-heading">
              Welcome back, {profile?.name || user?.email?.split('@')[0] || 'User'}!
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Select a store operation module below to get started. Navigating through the home launchpad optimizes database read usage across your business.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 min-w-[220px]">
            <Button 
              onClick={() => navigate('/pos')}
              size="lg" 
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold shadow-lg shadow-emerald-500/20 text-base rounded-2xl h-12 gap-2"
            >
              <ShoppingCart className="w-5 h-5" /> Launch POS Register
            </Button>
          </div>
        </div>

        {/* Decorative ambient background accents */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -top-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Module Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 font-heading">
              Store Operations Portal
            </h2>
            <p className="text-xs text-slate-500">
              Access business modules authorized for your role: <span className="font-semibold capitalize text-indigo-600">{userRole}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {availableModules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Card 
                key={mod.path} 
                className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 border border-slate-200/80 bg-white rounded-2xl"
              >
                <CardHeader className="pb-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-2xl border ${mod.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    {mod.badge && (
                      <Badge variant="outline" className="text-xs border-emerald-200 bg-emerald-50 text-emerald-700">
                        {mod.badge}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {mod.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CardDescription className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {mod.description}
                  </CardDescription>
                  <Button 
                    onClick={() => navigate(mod.path)} 
                    className={`w-full rounded-xl font-semibold gap-2 ${mod.btnColor}`}
                  >
                    Open Module <ArrowRight className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Optimization Tips Footer */}
      <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-amber-900">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-xl text-amber-800 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-sm">Database Optimization Active</p>
            <p className="text-amber-800">
              The launchpad portal loads zero database records. Open POS or specific modules only when needed to conserve free tier quota.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
