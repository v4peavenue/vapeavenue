import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LocationProvider } from './contexts/LocationContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { TooltipProvider } from './components/ui/tooltip';
import ErrorBoundary from './components/ErrorBoundary';
import { Layout } from './components/Layout';

// Lazy load page components for bundle size & loading performance optimization
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Inventory = lazy(() => import('./pages/Inventory').then(m => ({ default: m.Inventory })));
const POS = lazy(() => import('./pages/POS').then(m => ({ default: m.POS })));
const SalesHistory = lazy(() => import('./pages/SalesHistory').then(m => ({ default: m.SalesHistory })));
const Reports = lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Purchasing = lazy(() => import('./pages/Purchasing').then(m => ({ default: m.Purchasing })));
const Directory = lazy(() => import('./pages/Directory').then(m => ({ default: m.Directory })));
const Finance = lazy(() => import('./pages/Finance').then(m => ({ default: m.Finance })));
const Attendance = lazy(() => import('./pages/Attendance').then(m => ({ default: m.Attendance })));

const PageLoader = (
  <div className="min-h-screen flex items-center justify-center bg-[#FDFCF8]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1A2B4B]"></div>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return PageLoader;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <Layout>{children}</Layout>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return PageLoader;
  }

  if (!user || !isAdmin) {
    return <Navigate to="/pos" />;
  }

  return <Layout>{children}</Layout>;
};

const ManagerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isManager, loading } = useAuth();

  if (loading) {
    return PageLoader;
  }

  if (!user || !isManager) {
    return <Navigate to="/pos" />;
  }

  return <Layout>{children}</Layout>;
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <LocationProvider>
          <SettingsProvider>
            <TooltipProvider>
              <Router>
                <Suspense fallback={PageLoader}>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/" element={<Navigate to="/pos" replace />} />
                    <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
                    <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
                    <Route path="/purchasing" element={<ManagerRoute><Purchasing /></ManagerRoute>} />
                    <Route path="/pos" element={<ProtectedRoute><POS /></ProtectedRoute>} />
                    <Route path="/sales" element={<ProtectedRoute><SalesHistory /></ProtectedRoute>} />
                    <Route path="/reports" element={<AdminRoute><Reports /></AdminRoute>} />
                    <Route path="/finance" element={<ProtectedRoute><Finance /></ProtectedRoute>} />
                    <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
                    <Route path="/directory" element={<ProtectedRoute><Directory /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  </Routes>
                </Suspense>
              </Router>
              <Toaster position="top-right" richColors />
            </TooltipProvider>
          </SettingsProvider>
        </LocationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
