import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, LogIn, AlertCircle, Database } from 'lucide-react';
import { toast } from 'sonner';
import { logAction } from '@/lib/audit';
import { useAuth } from '../contexts/AuthContext';

export const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { loginOffline } = useAuth();

  const [offlineEmail, setOfflineEmail] = useState('');
  const [offlineName, setOfflineName] = useState('');
  const [offlineRole, setOfflineRole] = useState('admin');
  const [showOffline, setShowOffline] = useState(false);

  const handleOfflineLogin = async () => {
    if (!offlineEmail.trim() || !offlineName.trim()) {
      toast.error("Please enter both email and name");
      return;
    }
    
    setLoading(true);
    try {
      await loginOffline(offlineEmail.trim(), offlineName.trim(), offlineRole);
      toast.success(`Logged in as ${offlineName} (${offlineRole.toUpperCase()})`);
      
      // Refresh page redirect or navigate
      window.location.href = '/pos';
    } catch (err: any) {
      toast.error(`Offline login failed: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    console.log("Login: Starting Google Login process...");
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      console.log("Login: Calling signInWithPopup...");
      const result = await signInWithPopup(auth, provider);
      console.log("Login: signInWithPopup successful, user:", result.user.email);
      const user = result.user;

      // Check if user profile exists
      console.log("Login: Checking user profile in Firestore...");
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      console.log("Login: User profile exists:", userDoc.exists());

      if (!userDoc.exists()) {
        // Check if user is the primary admin
        const isPrimaryAdmin = user.email === 'vanhuxley24@gmail.com' || user.email === 'v4peavenue@gmail.com';
        let role = isPrimaryAdmin ? 'admin' : null;

        if (!isPrimaryAdmin) {
          // Check for pending invites
          const invitesRef = collection(db, 'invites');
          const q = query(invitesRef, where('email', '==', user.email), where('status', '==', 'pending'));
          const inviteSnap = await getDocs(q);

          if (!inviteSnap.empty) {
            const inviteDoc = inviteSnap.docs[0];
            const inviteData = inviteDoc.data();
            role = inviteData.role;
            // Mark invite as accepted
            await updateDoc(doc(db, 'invites', inviteDoc.id), { status: 'accepted' });
          }
        }

        if (!role) {
          toast.error("Access Denied: You haven't been invited to this system.");
          await auth.signOut();
          setLoading(false);
          return;
        }

        // Create profile
        const profileData = {
          email: user.email,
          name: user.displayName,
          role: role,
          createdAt: new Date().toISOString()
        };
        await setDoc(userDocRef, profileData);
        
        await logAction(
          { id: user.uid, email: user.email!, name: user.displayName || '', role: role as any },
          'SIGN_UP',
          'User signed up and logged in'
        );
      } else {
        // Profile exists, but let's make sure any pending invites are marked as accepted
        const invitesRef = collection(db, 'invites');
        const q = query(invitesRef, where('email', '==', user.email), where('status', '==', 'pending'));
        const inviteSnap = await getDocs(q);
        
        for (const inviteDoc of inviteSnap.docs) {
          await updateDoc(doc(db, 'invites', inviteDoc.id), { status: 'accepted' });
        }

        const profileData = userDoc.data();
        
        // Force update primary admin role if it's not set correctly
        if ((user.email === 'vanhuxley24@gmail.com' || user.email === 'v4peavenue@gmail.com') && profileData.role !== 'admin') {
          await updateDoc(userDocRef, { role: 'admin' });
          profileData.role = 'admin';
        }

        await logAction(
          { id: user.uid, email: user.email!, name: user.displayName || '', role: profileData.role },
          'LOGIN',
          'User logged in'
        );
      }

      navigate('/');
    } catch (error: any) {
      console.error("Login failed:", error);
      toast.error(`Login failed: ${error.message || 'Unknown error'}`);
      if (error.code === 'auth/network-request-failed' || error.message?.includes('network') || error.message?.includes('auth/')) {
        toast.info("Network error caught. You can easily bypass this by logging in using Offline Mode below.");
        setShowOffline(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-md w-full shadow-xl border-slate-200">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <TrendingUp className="w-10 h-10 text-white" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold tracking-tight text-slate-900">Agos Local ERP</CardTitle>
            <CardDescription className="text-slate-500 mt-2">
              Professional Inventory & Sales Management
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <div className="text-center text-sm text-slate-600">
            Sign in to access your business dashboard, manage inventory, and process sales.
          </div>

          <div className="bg-[#F5F2ED]/80 border border-[#E5E1DA] rounded-xl p-3 text-xs text-[#1A2B4B] flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-[11px] uppercase tracking-wider text-[#A0522D]">Sandbox Environment Note</p>
              <p className="leading-relaxed">
                If Firebase is not yet fully configured with your live custom credentials, click the <strong className="underline cursor-pointer" onClick={() => setShowOffline(true)}>Offline Local Mode</strong> link below to launch a secure local database session.
              </p>
            </div>
          </div>

          <Button 
            onClick={handleGoogleLogin} 
            disabled={loading}
            className="w-full h-12 gap-3 bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm animate-pulse"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            <span className="font-semibold">Continue with Google</span>
          </Button>

          {!showOffline ? (
            <div className="text-center">
              <button 
                type="button"
                onClick={() => setShowOffline(true)}
                className="text-xs text-indigo-600 hover:text-indigo-800 underline font-medium"
              >
                Or sign in using Offline Local Mode
              </button>
            </div>
          ) : (
            <div className="space-y-4 border border-indigo-100 bg-indigo-50/30 p-4 rounded-xl mt-4 text-left">
              <div className="flex items-center gap-2 text-indigo-950 font-bold text-sm">
                <Database className="w-4 h-4 text-indigo-600" />
                <span>Local-First Offline Session</span>
              </div>
              <p className="text-xs text-slate-500 leading-normal">
                No internet or Firebase connection is required. Data is stored locally on this computer.
              </p>
              
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input 
                    type="email" 
                    value={offlineEmail}
                    onChange={(e) => setOfflineEmail(e.target.value)}
                    className="w-full text-sm px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Display Name
                  </label>
                  <input 
                    type="text" 
                    value={offlineName}
                    onChange={(e) => setOfflineName(e.target.value)}
                    className="w-full text-sm px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                    placeholder="e.g. Administrator"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Access Role
                  </label>
                  <select 
                    value={offlineRole}
                    onChange={(e) => setOfflineRole(e.target.value)}
                    className="w-full text-sm px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  >
                    <option value="admin">Administrator (Full Access)</option>
                    <option value="manager">Manager (Intermediate Access)</option>
                    <option value="staff">Staff (POS / Attendance Access)</option>
                  </select>
                </div>

                <Button 
                  onClick={handleOfflineLogin}
                  className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors mt-2"
                >
                  Launch Offline ERP
                </Button>
                
                <div className="text-center pt-1">
                  <button 
                    type="button"
                    onClick={() => setShowOffline(false)}
                    className="text-[10px] text-slate-400 hover:text-slate-600 underline"
                  >
                    Back to Google Sign-in
                  </button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-4 border-t bg-slate-50/50 rounded-b-xl pt-6">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <LogIn className="w-3 h-3" />
            <span>Secure Enterprise Authentication</span>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};
