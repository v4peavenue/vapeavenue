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
  Waves,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Layers,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocations } from '../contexts/LocationContext';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import greenVaporWave from '@/assets/images/green_vapor_wave_1786985245951.jpg';

export const Home: React.FC = () => {
  const { profile, isAdmin, isManager } = useAuth();
  const { locations, selectedLocationId, setSelectedLocationId, selectedLocation } = useLocations();
  const navigate = useNavigate();

  const activeLocationName = selectedLocation ? selectedLocation.name : 'All Store Locations';
  const userName = profile?.name ? profile.name.split(' ')[0] : (profile?.email ? profile.email.split('@')[0] : 'Van');
  const userRole = (profile?.role || 'admin').toUpperCase();

  const modules = [
    {
      title: 'POS Register',
      fullName: 'POS Register',
      icon: ShoppingCart,
      path: '/pos',
      bg: 'bg-[#10B981]',
      badge: true,
      roles: ['admin', 'manager', 'staff']
    },
    {
      title: 'Inventory Cat...',
      fullName: 'Inventory Catalog',
      icon: Package,
      path: '/inventory',
      bg: 'bg-[#1E293B]',
      roles: ['admin', 'manager', 'staff']
    },
    {
      title: 'Directory & L...',
      fullName: 'Directory & Loyalty',
      icon: BookOpen,
      path: '/directory',
      bg: 'bg-[#9333EA]',
      roles: ['admin', 'manager', 'staff']
    },
    {
      title: 'Sales History',
      fullName: 'Sales History',
      icon: History,
      path: '/sales',
      bg: 'bg-[#F59E0B]',
      roles: ['admin', 'manager', 'staff']
    },
    {
      title: 'Financial Led...',
      fullName: 'Financial Ledger',
      icon: Wallet,
      path: '/finance',
      bg: 'bg-[#2563EB]',
      roles: ['admin', 'manager', 'staff']
    },
    {
      title: 'Timeclock & ...',
      fullName: 'Timeclock & Schedule',
      icon: Clock,
      path: '/attendance',
      bg: 'bg-[#0D9488]',
      roles: ['admin', 'manager', 'staff']
    },
    {
      title: 'Executive Da...',
      fullName: 'Executive Dashboard',
      icon: LayoutDashboard,
      path: '/dashboard',
      bg: 'bg-[#E11D48]',
      roles: ['admin']
    },
    {
      title: 'Reports & An...',
      fullName: 'Reports & Analytics',
      icon: TrendingUp,
      path: '/reports',
      bg: 'bg-[#EA580C]',
      roles: ['admin']
    },
    {
      title: 'System Setti...',
      fullName: 'System Settings',
      icon: Settings,
      path: '/settings',
      bg: 'bg-[#1E293B]',
      roles: ['admin', 'manager', 'staff']
    }
  ];

  const currentRole = (profile?.role || 'staff').toLowerCase();
  const availableModules = modules.filter(m => {
    return m.roles.includes(currentRole as any) || (isAdmin && m.roles.includes('admin')) || (isManager && m.roles.includes('manager'));
  });

  return (
    <div className="h-screen max-h-screen w-full flex flex-col justify-between bg-[#E6ECF5] p-3.5 sm:p-5 lg:p-6 overflow-hidden font-sans box-border text-slate-700 select-none relative">
      
      {/* Background Ambient Green Smoke Layer */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden select-none">
        <img 
          src={greenVaporWave} 
          alt="Vape Smoke Ambient" 
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-[0.14] mix-blend-multiply filter contrast-125 saturate-150 scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#E6ECF5]/80 via-transparent to-[#E6ECF5]/60" />
      </div>

      {/* Centered Main Stage Container */}
      <div className="w-full max-w-[1640px] mx-auto flex-1 min-h-0 flex flex-col justify-between gap-3.5 sm:gap-5 relative z-10">
        
        {/* Upper Floating Master Card */}
        <div className="flex-1 min-h-0 flex flex-col justify-between neu-flat-lg rounded-2xl p-5 sm:p-6 lg:p-8 relative overflow-hidden bg-[#E6ECF5]/95 backdrop-blur-sm border border-emerald-500/10">
          
          {/* Internal Subtle Smoke Accent In Top-Right Corner */}
          <div className="absolute -top-24 -right-24 w-96 h-96 pointer-events-none rounded-full overflow-hidden opacity-20 mix-blend-multiply blur-2xl">
            <img 
              src={greenVaporWave} 
              alt="Smoke Corner Glow" 
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Top Navbar */}
          <header className="relative z-10 flex items-center justify-between gap-4 pb-3 sm:pb-4 border-b border-[#D1D9E6]/70 shrink-0">
            
            {/* Left: Brand Identity with Waves Icon & Pill */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 neu-btn rounded-xl flex items-center justify-center cursor-pointer text-emerald-600">
                <Waves className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 font-heading">AGOS</span>
                <span className="text-[10px] sm:text-[11px] font-black text-emerald-700 px-2.5 py-0.5 neu-inset rounded-md tracking-wider uppercase">
                  RETAIL ERP
                </span>
              </div>
            </div>

            {/* Center: Navigation Links */}
            <nav className="hidden md:flex items-center gap-7 lg:gap-10">
              <button 
                onClick={() => navigate('/pos')}
                className="text-sm sm:text-base font-bold text-slate-600 hover:text-slate-950 transition-colors cursor-pointer"
              >
                POS Register
              </button>
              <button 
                onClick={() => navigate('/inventory')}
                className="text-sm sm:text-base font-bold text-slate-600 hover:text-slate-950 transition-colors cursor-pointer"
              >
                Inventory
              </button>
              <button 
                onClick={() => navigate('/sales')}
                className="text-sm sm:text-base font-bold text-slate-600 hover:text-slate-950 transition-colors cursor-pointer"
              >
                Sales History
              </button>
              <button 
                onClick={() => navigate('/directory')}
                className="text-sm sm:text-base font-bold text-slate-600 hover:text-slate-950 transition-colors cursor-pointer"
              >
                Directory
              </button>
            </nav>

            {/* Right: Location Pill & Launch POS Button */}
            <div className="flex items-center gap-3">
              {/* Location Selector Pill */}
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 px-3.5 sm:px-4 py-2 neu-btn rounded-lg text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-900 cursor-pointer outline-none">
                  <Building2 className="w-4 h-4 text-amber-500" />
                  <span>{activeLocationName}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-[#E6ECF5] text-slate-800 rounded-lg border-0 neu-flat-lg p-1.5">
                  {(isAdmin || isManager) && (
                    <DropdownMenuItem 
                      onClick={() => setSelectedLocationId('all')}
                      className={cn("text-xs sm:text-sm font-bold rounded-md cursor-pointer py-2 px-3", selectedLocationId === 'all' && "text-emerald-700 font-black")}
                    >
                      All Store Locations
                    </DropdownMenuItem>
                  )}
                  {locations.map((loc) => (
                    <DropdownMenuItem 
                      key={loc.id} 
                      onClick={() => setSelectedLocationId(loc.id)}
                      className={cn("text-xs sm:text-sm font-bold rounded-md cursor-pointer py-2 px-3", selectedLocationId === loc.id && "text-emerald-700 font-black")}
                    >
                      {loc.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Launch POS Button */}
              <button 
                onClick={() => navigate('/pos')}
                className="neu-btn rounded-lg px-4 sm:px-5 py-2 text-xs sm:text-sm font-black text-slate-800 hover:text-emerald-700 cursor-pointer transition-all active:scale-95 shadow-xs"
              >
                Launch POS
              </button>
            </div>
          </header>

          {/* Hero Main Content Split */}
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 xl:gap-12 items-center flex-1 min-h-0 my-auto py-3">
            
            {/* Left Column: Heading & Primary Triggers */}
            <div className="lg:col-span-7 space-y-4 sm:space-y-5">
              
              {/* Eyebrow Pill */}
              <div className="inline-flex items-center gap-2 px-3 py-1 neu-inset rounded-md text-emerald-700 text-xs sm:text-sm font-bold">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Store Operations Workstation</span>
              </div>

              {/* Giant Heading */}
              <h1 className="text-3xl sm:text-5xl lg:text-[48px] xl:text-[54px] font-black text-slate-900 leading-[1.12] font-heading tracking-tight">
                Smart Retail & <br />
                Inventory Manage<span className="text-emerald-700">ment</span>
              </h1>

              {/* Description Subtitle */}
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl font-medium">
                Welcome back, <strong className="text-slate-900 font-bold">{userName}</strong>. Process checkouts, manage product stock, track sales history, and oversee cash registers from your Agos portal.
              </p>

              {/* Primary Pill Action Buttons */}
              <div className="flex flex-wrap items-center gap-3.5 pt-1">
                {/* Start POS Checkout (Dark Forest Green Button) */}
                <button 
                  onClick={() => navigate('/pos')}
                  className="bg-[#0D2818] hover:bg-[#143D25] text-white px-5 sm:px-6 py-2.5 sm:py-3.5 rounded-xl text-sm sm:text-base font-bold flex items-center gap-2.5 shadow-lg shadow-emerald-950/20 cursor-pointer transition-all active:scale-95 border border-emerald-900/40"
                >
                  <ShoppingCart className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-emerald-400" />
                  <span>Start POS Checkout</span>
                </button>

                {/* Manage Stock (Light Neumorphic Button) */}
                <button 
                  onClick={() => navigate('/inventory')}
                  className="neu-btn px-5 sm:px-6 py-2.5 sm:py-3.5 rounded-xl text-sm sm:text-base font-bold text-slate-800 hover:text-emerald-700 flex items-center gap-2.5 cursor-pointer transition-all active:scale-95"
                >
                  <Package className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-slate-600" />
                  <span>Manage Stock</span>
                </button>
              </div>

              {/* Cloud Sync & Role Indicators */}
              <div className="pt-2 flex items-center gap-5 sm:gap-7 text-xs sm:text-sm font-semibold text-slate-600">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
                  <span>Real-time cloud sync</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4.5 h-4.5 text-emerald-600" />
                  <span>Role: <strong className="uppercase font-black text-slate-900">{userRole}</strong></span>
                </div>
              </div>
            </div>

            {/* Right Column: Console Hub Stage */}
            <div className="lg:col-span-5 flex items-center justify-center min-h-0">
              <div className="w-full max-w-[480px] neu-flat-lg rounded-2xl p-4 sm:p-5 lg:p-6 bg-[#E6ECF5] space-y-4">
                
                {/* Top Status Indicators */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 px-3 py-1.5 neu-inset rounded-lg text-xs sm:text-sm font-bold text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>POS Terminal Active</span>
                  </div>

                  <div className="bg-[#0F1E36] text-white px-3 py-1.5 rounded-md text-xs font-black tracking-wider flex items-center gap-1.5 shadow-xs">
                    <span className="text-cyan-400 text-sm">📶</span>
                    <span>AGOS LIVE</span>
                  </div>
                </div>

                {/* 3 Square-Icon Feature Pedestals */}
                <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
                  
                  {/* Checkout */}
                  <div 
                    onClick={() => navigate('/pos')}
                    className="neu-btn rounded-xl p-3 sm:p-3.5 flex flex-col items-center text-center space-y-1.5 cursor-pointer group hover:scale-[1.02] transition-transform"
                  >
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#10B981] rounded-xl flex items-center justify-center text-white shadow-sm shadow-emerald-500/25">
                      <ShoppingCart className="w-6 h-6 sm:w-7 sm:h-7" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-black text-slate-900">Checkout</p>
                      <p className="text-[10px] sm:text-xs text-slate-400 font-bold">Barcode POS</p>
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-black text-blue-600 px-2.5 py-0.5 neu-inset rounded-md">
                      Ready
                    </span>
                  </div>

                  {/* Stock Items */}
                  <div 
                    onClick={() => navigate('/inventory')}
                    className="neu-btn rounded-xl p-3 sm:p-3.5 flex flex-col items-center text-center space-y-1.5 cursor-pointer group hover:scale-[1.02] transition-transform"
                  >
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#1E293B] rounded-xl flex items-center justify-center text-amber-400 shadow-sm shadow-slate-900/25">
                      <Package className="w-6 h-6 sm:w-7 sm:h-7" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-black text-slate-900">Stock Items</p>
                      <p className="text-[10px] sm:text-xs text-slate-400 font-bold">Catalog Hub</p>
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-black text-blue-600 px-2.5 py-0.5 neu-inset rounded-md">
                      Tracked
                    </span>
                  </div>

                  {/* Ledger */}
                  <div 
                    onClick={() => navigate('/finance')}
                    className="neu-btn rounded-xl p-3 sm:p-3.5 flex flex-col items-center text-center space-y-1.5 cursor-pointer group hover:scale-[1.02] transition-transform"
                  >
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#F59E0B] rounded-xl flex items-center justify-center text-white shadow-sm shadow-amber-500/25">
                      <Wallet className="w-6 h-6 sm:w-7 sm:h-7" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-black text-slate-900">Ledger</p>
                      <p className="text-[10px] sm:text-xs text-slate-400 font-bold">Cash Register</p>
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-black text-amber-600 px-2.5 py-0.5 neu-inset rounded-md">
                      Audited
                    </span>
                  </div>

                </div>

                {/* Operations Hub Dark Capsule */}
                <div className="bg-[#0F1E36] rounded-xl px-4 py-2.5 sm:py-3 text-white flex items-center justify-between shadow-inner">
                  <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold text-white">
                    <Layers className="w-4.5 h-4.5 text-amber-400" />
                    <span>Operations Hub</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 tracking-wide">
                    Online & Synced
                  </span>
                </div>

              </div>
            </div>

          </div>

        </div>

        {/* Lower Section: Store Modules & Services Strip */}
        <div className="shrink-0 space-y-2">
          {/* Header */}
          <div className="px-1">
            <h2 className="text-sm sm:text-base font-black text-slate-900 font-heading tracking-tight">
              Store Modules & Services
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Authorized tools for <span className="font-black text-slate-800 uppercase">{userRole}</span> account
            </p>
          </div>

          {/* Neumorphic Inset Module Tray */}
          <div className="neu-inset p-3 sm:p-4 lg:p-4.5 rounded-2xl flex items-center justify-between gap-2 sm:gap-3.5 overflow-x-auto custom-scrollbar">
            {availableModules.map((mod) => {
              const Icon = mod.icon;
              return (
                <button
                  key={mod.path}
                  onClick={() => navigate(mod.path)}
                  title={`${mod.fullName}`}
                  className="group flex-1 min-w-[76px] sm:min-w-[90px] max-w-[155px] flex flex-col items-center gap-1.5 p-1 cursor-pointer focus:outline-none transition-all"
                >
                  <div className={cn(
                    "w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center text-white shadow-md shadow-black/10 group-hover:scale-105 transition-transform relative",
                    mod.bg
                  )}>
                    <Icon className="w-5.5 h-5.5 sm:w-6.5 sm:h-6.5" />
                    {mod.badge && (
                      <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white shadow-xs" />
                    )}
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-slate-700 group-hover:text-emerald-700 transition-colors w-full text-center truncate">
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
