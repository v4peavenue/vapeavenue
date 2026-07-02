import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  History, 
  Settings, 
  LogOut, 
  Menu,
  X,
  User as UserIcon,
  TrendingUp,
  Users,
  BookOpen,
  Waves,
  Wallet,
  Clock,
  Wifi,
  WifiOff,
  Database
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocations } from '../contexts/LocationContext';
import { auth } from '../lib/firebase';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { name: 'POS', path: '/pos', icon: ShoppingCart, roles: ['admin', 'manager', 'staff'] },
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['admin'] },
  { name: 'Inventory', path: '/inventory', icon: Package, roles: ['admin', 'manager', 'staff'] },
  { name: 'Purchasing', path: '/purchasing', icon: ShoppingCart, roles: ['admin', 'manager'] },
  { name: 'Directory', path: '/directory', icon: BookOpen, roles: ['admin', 'manager'] },
  { name: 'Sales History', path: '/sales', icon: History, roles: ['admin', 'manager', 'staff'] },
  { name: 'Reports', path: '/reports', icon: TrendingUp, roles: ['admin'] },
  { name: 'Finance', path: '/finance', icon: Wallet, roles: ['admin', 'manager'] },
  { name: 'Attendance', path: '/attendance', icon: Clock, roles: ['admin', 'manager', 'staff'] },
  { name: 'System', path: '/settings', icon: Settings, roles: ['admin'] },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, user, isAdmin, isManager } = useAuth();
  const { locations, selectedLocationId, setSelectedLocationId } = useLocations();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogout = async () => {
    localStorage.removeItem('agos_offline_session');
    try {
      await auth.signOut();
    } catch (e) {
      console.warn("Auth signout skipped or failed during offline logout:", e);
    }
    window.location.href = '/login';
  };

  const NavContent = () => (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#1C2D4E] via-[#15233D] to-[#0A1221] text-[#FDFCF8] border-r border-white/5">
      <div className="p-5 flex items-center gap-2.5">
        <div className="w-9 h-9 bg-gradient-to-br from-[#e5c05c] to-[#D4AF37] rounded-xl flex items-center justify-center shadow-md shadow-amber-500/10">
          <Waves className="w-5 h-5 text-primary" />
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-bold tracking-tight font-heading leading-none text-white">Agos</span>
          <span className="text-[9px] text-[#D4AF37] font-black tracking-widest uppercase mt-0.5 opacity-90">Local-First ERP</span>
        </div>
      </div>

      <div className="px-4 mb-3 space-y-2">
        <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-1.5 px-0.5">
            <MapPin className="w-3 h-3 text-[#D4AF37]" />
            <span className="text-[9px] font-black text-white/50 uppercase tracking-wider">Active Location</span>
          </div>
          <Select 
            value={selectedLocationId} 
            onValueChange={setSelectedLocationId}
            disabled={!isAdmin && !!profile?.locationId}
          >
            <SelectTrigger className="w-full bg-white/10 border-white/10 h-8 text-xs font-semibold text-white hover:bg-white/20 transition-colors">
              <SelectValue>
                {selectedLocationId === 'all' ? 'All Locations' : (locations.find(l => l.id === selectedLocationId)?.name || 'Select Location')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-primary text-white border-white/10">
              {(isAdmin || !profile?.locationId) && <SelectItem value="all">All Locations</SelectItem>}
              {locations.map(loc => (
                <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <div className="flex items-center gap-1.5">
              <Database className="w-3 h-3 text-emerald-400" />
              <span className="text-[9px] font-bold text-white/70 uppercase tracking-wider">Local Repository</span>
            </div>
            {isOnline ? (
              <Badge variant="outline" className="h-4 bg-emerald-500/25 text-emerald-400 border-emerald-500/20 text-[8px] font-black px-1.5 rounded-full flex items-center gap-1">
                <Wifi className="w-2 h-2" />
                SYNCED
              </Badge>
            ) : (
              <Badge variant="outline" className="h-4 bg-amber-500/25 text-amber-400 border-amber-500/20 text-[8px] font-black px-1.5 rounded-full flex items-center gap-1">
                <WifiOff className="w-2 h-2" />
                OFFLINE
              </Badge>
            )}
          </div>
        </div>
      </div>
      
      <nav className="flex-1 px-3 space-y-0.5 mt-1 overflow-y-auto custom-scrollbar">
        {navItems
          .filter(item => {
            const currentRole = isAdmin ? 'admin' : (profile?.role || 'staff');
            return item.roles.includes(currentRole as any) || 
                   (isManager && item.roles.includes('manager')) ||
                   (isAdmin && item.roles.includes('admin'));
          })
          .map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-300 group relative overflow-hidden",
                  isActive 
                    ? "bg-gradient-to-r from-[#e5c05c] to-[#D4AF37] text-primary shadow-md shadow-amber-500/10 font-bold" 
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon className={cn("w-4 h-4 transition-transform duration-300 group-hover:scale-110", isActive ? "text-primary stroke-[2.5px]" : "text-white/40 group-hover:text-white")} />
                <span className="font-semibold text-xs">{item.name}</span>
                {isActive && (
                  <motion.div 
                    layoutId="activeNav"
                    className="ml-auto w-1 h-1 rounded-full bg-primary" 
                  />
                )}
              </Link>
            );
          })}
      </nav>

      <div className="p-4 mt-auto">
        <div className="bg-white/5 rounded-xl p-3 mb-2 border border-white/10">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center shadow-sm border border-white/10">
              <UserIcon className="w-4 h-4 text-white/70" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate leading-none mb-0.5">{profile?.name || user?.email?.split('@')[0]}</p>
              <p className="text-[9px] text-[#D4AF37] font-bold uppercase tracking-wider">{isAdmin ? 'Admin' : (profile?.role || 'Staff')}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-2.5 text-white/55 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg h-8 transition-colors px-2 text-xs"
            onClick={handleLogout}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="text-[11px] font-bold">Logout</span>
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col fixed inset-y-0 z-20">
        <NavContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
        {/* Mobile Header */}
        <header className="md:hidden h-16 bg-primary border-b border-white/10 flex items-center justify-between px-4 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <Waves className="w-6 h-6 text-sidebar-primary" />
            <span className="font-bold text-white font-heading text-xl">Agos</span>
          </div>
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger render={<Button variant="ghost" className="text-white h-11 w-11 hover:bg-white/10 flex items-center justify-center p-0" />}>
              <Menu className="w-6 h-6" />
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 border-none">
              <NavContent />
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 relative overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="p-3 md:p-5 lg:p-6"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};
