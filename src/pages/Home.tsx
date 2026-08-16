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
  Building2, 
  ArrowRight,
  Waves,
  Zap,
  CheckCircle2,
  Sparkles,
  BarChart3,
  Layers,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocations } from '../contexts/LocationContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

export const Home: React.FC = () => {
  const { profile, user } = useAuth();
  const { selectedLocation } = useLocations();
  const navigate = useNavigate();

  const activeLocationName = selectedLocation ? selectedLocation.name : 'All Store Locations';

  const modules = [
    {
      title: 'POS Register',
      description: 'Fast barcode scanning, multi-payment checkout, and instant print receipt processing.',
      icon: ShoppingCart,
      path: '/pos',
      accentColor: 'from-emerald-500 to-teal-600',
      badge: 'Active Workstation',
      roles: ['admin', 'manager', 'staff']
    },
    {
      title: 'Inventory Catalog',
      description: 'Stock management, low stock warnings, barcode assignment, and pricing tiers.',
      icon: Package,
      path: '/inventory',
      accentColor: 'from-[#1C2D4E] to-[#2B4570]',
      roles: ['admin', 'manager', 'staff']
    },
    {
      title: 'Directory & Loyalty',
      description: 'Customer profiles, VIP loyalty cards, supplier index, and staff roster.',
      icon: BookOpen,
      path: '/directory',
      accentColor: 'from-purple-600 to-indigo-700',
      roles: ['admin', 'manager', 'staff']
    },
    {
      title: 'Sales History',
      description: 'Daily transaction records, refund manager, discounts log, and receipt reprints.',
      icon: History,
      path: '/sales',
      accentColor: 'from-amber-500 to-amber-700',
      roles: ['admin', 'manager', 'staff']
    },
    {
      title: 'Financial Ledger',
      description: 'Cash registers, store accounts, daily expense entries, and cash flow audit.',
      icon: Wallet,
      path: '/finance',
      accentColor: 'from-blue-600 to-cyan-700',
      roles: ['admin', 'manager', 'staff']
    },
    {
      title: 'Timeclock & Schedule',
      description: 'Staff shift schedules, daily timekeeping, and attendance reports.',
      icon: Clock,
      path: '/attendance',
      accentColor: 'from-teal-600 to-emerald-700',
      roles: ['admin', 'manager', 'staff']
    },
    {
      title: 'Executive Dashboard',
      description: 'Store analytics, hourly revenue velocity, top sellers, and margin tracking.',
      icon: LayoutDashboard,
      path: '/dashboard',
      accentColor: 'from-rose-600 to-pink-700',
      roles: ['admin']
    },
    {
      title: 'Reports & Analytics',
      description: 'Custom financial audits, stock valuations, and historical export tools.',
      icon: TrendingUp,
      path: '/reports',
      accentColor: 'from-orange-500 to-amber-600',
      roles: ['admin']
    },
    {
      title: 'System Settings',
      description: 'Store locations, security roles, printer setup, and system configuration.',
      icon: Settings,
      path: '/settings',
      accentColor: 'from-slate-700 to-slate-900',
      roles: ['admin', 'manager', 'staff']
    }
  ];

  const userRole = profile?.role || 'staff';
  const availableModules = modules.filter(m => m.roles.includes(userRole));

  return (
    <div className="relative min-h-screen w-full flex-1 flex flex-col justify-between bg-slate-100/80 p-3 sm:p-5 lg:p-6 overflow-x-hidden font-sans">
      {/* Background Stylized Agos Shapes */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#1C2D4E] rounded-full mix-blend-multiply opacity-25 filter blur-2xl pointer-events-none" />
      <div className="absolute top-1/3 -right-20 w-80 h-80 bg-[#D4AF37] rounded-full mix-blend-multiply opacity-20 filter blur-3xl pointer-events-none" />
      <div className="absolute -bottom-28 left-1/4 w-[500px] h-[500px] bg-indigo-900/20 rounded-full filter blur-3xl pointer-events-none" />

      {/* Elevated 100% Maximized Container */}
      <div className="relative z-10 w-full max-w-[1720px] mx-auto flex-1 flex flex-col justify-between gap-3 sm:gap-4 lg:gap-5">
        
        {/* Main Floating Landing Panel */}
        <div className="flex-1 flex flex-col justify-between bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 shadow-xl border border-slate-200/90 relative overflow-hidden">
          
          {/* Top Embedded Navbar inside Hero Card */}
          <header className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-4 mb-3 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-[#1C2D4E] to-[#15233D] rounded-xl flex items-center justify-center shadow-md shadow-[#1C2D4E]/20">
                <Waves className="w-4 h-4 text-[#D4AF37]" />
              </div>
              <div>
                <span className="text-lg font-extrabold tracking-tight text-[#1C2D4E] font-heading">AGOS</span>
                <span className="text-[10px] text-[#D4AF37] font-black tracking-widest uppercase ml-2 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200">
                  Retail ERP
                </span>
              </div>
            </div>

            {/* Quick Links inside Card Header */}
            <nav className="hidden md:flex items-center gap-5 text-xs font-semibold text-slate-600">
              <button onClick={() => navigate('/pos')} className="hover:text-[#1C2D4E] transition-colors cursor-pointer">POS Register</button>
              <button onClick={() => navigate('/inventory')} className="hover:text-[#1C2D4E] transition-colors cursor-pointer">Inventory</button>
              <button onClick={() => navigate('/sales')} className="hover:text-[#1C2D4E] transition-colors cursor-pointer">Sales History</button>
              <button onClick={() => navigate('/directory')} className="hover:text-[#1C2D4E] transition-colors cursor-pointer">Directory</button>
            </nav>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <Badge variant="outline" className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-700 border-slate-200 text-xs font-medium">
                <Building2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                {activeLocationName}
              </Badge>
              <Button 
                onClick={() => navigate('/pos')}
                className="bg-[#1C2D4E] hover:bg-[#15233D] text-[#D4AF37] font-bold rounded-full px-5 h-8 sm:h-9 shadow-md shadow-[#1C2D4E]/20 text-xs tracking-wide"
              >
                Launch POS
              </Button>
            </div>
          </header>

          {/* Hero Main Content Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center flex-1 my-auto py-2">
            
            {/* Left Column: Heading & Copy */}
            <div className="lg:col-span-6 space-y-4 sm:space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                Store Operations Workstation
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black text-slate-900 tracking-tight leading-[1.15] font-heading">
                Smart Retail & <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1C2D4E] via-indigo-900 to-[#D4AF37]">
                  Inventory Management
                </span>
              </h1>

              <p className="text-slate-600 text-xs sm:text-sm lg:text-base leading-relaxed max-w-xl">
                Welcome back, <span className="font-bold text-slate-900">{profile?.name || user?.email?.split('@')[0]}</span>. Process checkouts, manage product stock, track sales history, and oversee cash registers from your Agos portal.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button 
                  onClick={() => navigate('/pos')}
                  size="lg"
                  className="bg-gradient-to-r from-[#1C2D4E] to-[#2B4570] text-white hover:opacity-95 font-bold rounded-xl sm:rounded-2xl px-6 h-11 sm:h-12 shadow-lg shadow-[#1C2D4E]/20 text-xs sm:text-sm gap-2"
                >
                  <ShoppingCart className="w-4 h-4 text-[#D4AF37]" /> Start POS Checkout
                </Button>
                <Button 
                  onClick={() => navigate('/inventory')}
                  variant="outline"
                  size="lg"
                  className="rounded-xl sm:rounded-2xl px-5 h-11 sm:h-12 border-slate-200 text-slate-700 font-semibold text-xs sm:text-sm hover:bg-slate-50"
                >
                  <Package className="w-4 h-4 mr-2 text-slate-500" /> Manage Stock
                </Button>
              </div>

              {/* Quick Status Tags */}
              <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Local-first store sync
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-500" /> Role: <span className="capitalize font-bold text-slate-800">{userRole}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Agos Isometric Store Operations Illustration Stage */}
            <div className="lg:col-span-6 relative">
              <div className="relative w-full aspect-[4/3] max-h-[320px] sm:max-h-[360px] rounded-2xl sm:rounded-3xl bg-gradient-to-tr from-slate-50 via-indigo-50/50 to-amber-50/30 p-4 sm:p-5 border border-slate-100 flex items-center justify-center overflow-hidden shadow-inner">
                
                {/* Decorative Glowing Rings on Graphic Stage */}
                <div className="absolute w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-[#D4AF37]/15 rounded-full blur-2xl pointer-events-none" />

                {/* Isometric Product/POS Pedestals */}
                <div className="relative z-10 w-full h-full flex flex-col justify-between p-1">
                  
                  {/* Top Floating Badge */}
                  <div className="flex justify-between items-center">
                    <motion.div 
                      initial={{ y: -10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-xs border border-slate-200/80 flex items-center gap-2 text-xs font-bold text-slate-800"
                    >
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>POS Terminal Active</span>
                    </motion.div>

                    <div className="bg-[#1C2D4E] text-[#D4AF37] px-2.5 py-1 rounded-lg shadow text-[10px] font-black tracking-wider uppercase flex items-center gap-1.5">
                      <BarChart3 className="w-3 h-3" /> AGOS LIVE
                    </div>
                  </div>

                  {/* Isometric Graphic Cards Grid */}
                  <div className="grid grid-cols-3 gap-2.5 my-auto pt-1">
                    
                    {/* Pedestal 1: POS Checkout */}
                    <motion.div 
                      whileHover={{ y: -3 }}
                      onClick={() => navigate('/pos')}
                      className="cursor-pointer bg-gradient-to-b from-white to-emerald-50/60 p-3 rounded-xl sm:rounded-2xl shadow-md border border-emerald-100 flex flex-col items-center text-center space-y-1.5 group transition-all"
                    >
                      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/30 group-hover:scale-110 transition-transform">
                        <ShoppingCart className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-extrabold text-slate-900">Checkout</p>
                        <p className="text-[10px] text-slate-500 font-medium">Barcode POS</p>
                      </div>
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        Ready
                      </span>
                    </motion.div>

                    {/* Pedestal 2: Stock Inventory */}
                    <motion.div 
                      whileHover={{ y: -3 }}
                      onClick={() => navigate('/inventory')}
                      className="cursor-pointer bg-gradient-to-b from-white to-indigo-50/60 p-3 rounded-xl sm:rounded-2xl shadow-md border border-indigo-100 flex flex-col items-center text-center space-y-1.5 group transition-all"
                    >
                      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-[#1C2D4E] text-[#D4AF37] flex items-center justify-center shadow-md shadow-[#1C2D4E]/30 group-hover:scale-110 transition-transform">
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-extrabold text-slate-900">Stock Items</p>
                        <p className="text-[10px] text-slate-500 font-medium">Catalog Hub</p>
                      </div>
                      <span className="text-[9px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                        Tracked
                      </span>
                    </motion.div>

                    {/* Pedestal 3: Financial Accounts */}
                    <motion.div 
                      whileHover={{ y: -3 }}
                      onClick={() => navigate('/finance')}
                      className="cursor-pointer bg-gradient-to-b from-white to-amber-50/60 p-3 rounded-xl sm:rounded-2xl shadow-md border border-amber-100 flex flex-col items-center text-center space-y-1.5 group transition-all"
                    >
                      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/30 group-hover:scale-110 transition-transform">
                        <Wallet className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-extrabold text-slate-900">Ledger</p>
                        <p className="text-[10px] text-slate-500 font-medium">Cash Register</p>
                      </div>
                      <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                        Audited
                      </span>
                    </motion.div>

                  </div>

                  {/* Bottom Floating Stats Strip */}
                  <div className="bg-slate-900/90 text-white p-2.5 rounded-xl sm:rounded-2xl backdrop-blur-md flex items-center justify-between text-xs border border-slate-800">
                    <div className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span className="font-medium text-slate-300 text-xs">Operations Hub</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                      <span>Online & Synced</span>
                    </div>
                  </div>

                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Operational Modules Horizontal Grid / Strip */}
        <div className="shrink-0 space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 font-heading tracking-tight">
              Store Modules & Services
            </h2>
            <span className="text-[11px] text-slate-500">
              Authorized for <span className="font-bold text-[#1C2D4E] uppercase">{userRole}</span>
            </span>
          </div>

          <div className="bg-white/95 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-2 sm:gap-4 overflow-x-auto custom-scrollbar">
            {availableModules.map((mod) => {
              const Icon = mod.icon;
              return (
                <button
                  key={mod.path}
                  onClick={() => navigate(mod.path)}
                  title={`${mod.title} - ${mod.description}`}
                  className="group flex-1 min-w-[72px] sm:min-w-[84px] max-w-[140px] flex flex-col items-center gap-1.5 p-1.5 sm:p-2 rounded-xl hover:bg-slate-100/80 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1C2D4E]/20"
                >
                  <div className={cn(
                    "w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br",
                    mod.accentColor,
                    "text-white flex items-center justify-center shadow-md shadow-slate-200 group-hover:scale-110 group-hover:shadow-lg transition-all duration-200 relative"
                  )}>
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                    {mod.badge && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" title={mod.badge} />
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#1C2D4E] transition-colors w-full text-center truncate">
                    {mod.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Home;
