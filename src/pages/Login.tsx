import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, LogIn, AlertCircle, Database, Waves } from 'lucide-react';
import { toast } from 'sonner';
import { logAction } from '@/lib/audit';
import { useAuth } from '../contexts/AuthContext';
import { VapeAvenueLogo } from '@/components/VapeAvenueLogo';

export const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
        const primaryAdminEmails = ['vanhuxley24@gmail.com', 'v4peavenue@gmail.com'];
        const isPrimaryAdmin = user.email && primaryAdminEmails.includes(user.email.toLowerCase());
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
        
        const primaryAdminEmails = ['vanhuxley24@gmail.com', 'v4peavenue@gmail.com'];
        if (user.email && primaryAdminEmails.includes(user.email.toLowerCase()) && profileData.role !== 'admin') {
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
      const isPopupClosed = error.code === 'auth/popup-closed-by-user' || 
                            error.code === 'auth/cancelled-popup-request' || 
                            error.code === 'auth/user-cancelled' ||
                            error.message?.includes('popup-closed-by-user') ||
                            error.message?.includes('cancelled-popup-request');
      const isPopupBlocked = error.code === 'auth/popup-blocked' || 
                             error.message?.includes('popup-blocked');
      const isNetworkError = error.code === 'auth/network-request-failed' || 
                             error.message?.toLowerCase().includes('network');
      const isUnauthorizedDomain = error.code === 'auth/unauthorized-domain' ||
                                    error.message?.includes('unauthorized-domain');

      if (isPopupClosed) {
        console.log("Login: User dismissed or closed the sign-in popup.");
        toast.info("Sign-in cancelled. Click below to try again whenever you're ready.");
      } else if (isPopupBlocked) {
        console.warn("Login: Popup blocked by browser.", error);
        toast.warning("Sign-in popup was blocked by your browser. Please allow popups to continue.");
      } else if (isUnauthorizedDomain) {
        console.warn("Login: Unauthorized domain for OAuth.", error);
        toast.error("This domain is not authorized for Google Sign-In. Please check your Firebase authorized domains.");
      } else if (isNetworkError) {
        console.warn("Login: Network error during authentication.", error);
        toast.error("Network error connecting to authentication service. Please check your connection.");
      } else {
        console.error("Login failed:", error);
        toast.error(`Login failed: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#E6ECF5] p-4 font-sans text-slate-800">
      <div className="max-w-md w-full neu-flat-lg rounded-2xl p-6 sm:p-8 bg-[#E6ECF5] text-slate-800 space-y-6 relative z-10 border-0">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="w-14 h-14 neu-btn rounded-2xl flex items-center justify-center text-emerald-600 shadow-none">
              <Waves className="w-7 h-7" />
            </div>
            <div className="w-14 h-14 neu-flat rounded-full p-1 flex items-center justify-center shadow-xs">
              <VapeAvenueLogo className="w-full h-full rounded-full" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 font-heading">AGOS STORE PORTAL</h1>
            <p className="text-xs font-black text-emerald-700 uppercase tracking-widest mt-1">
              Vape Avenue • Denward
            </p>
            <p className="text-slate-500 mt-1 text-xs font-semibold">
              Multi-Store Retail POS & Inventory Operations
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="neu-inset rounded-xl p-3.5 text-center text-xs text-slate-600 font-semibold leading-relaxed">
            Sign in with your authorized Google account to access store operations, barcodes, cash registers, and multi-location management.
          </div>

          <Button 
            onClick={handleGoogleLogin} 
            disabled={loading}
            variant="outline"
            className="w-full h-12 gap-2.5 neu-btn rounded-xl font-black text-sm text-slate-800 hover:text-emerald-700 cursor-pointer"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4.5 h-4.5" />
            <span>Continue with Google</span>
          </Button>
        </div>

        <div className="pt-3 border-t border-[#D1D9E6]/60 flex items-center justify-center gap-2 text-xs text-slate-500 font-bold">
          <LogIn className="w-3.5 h-3.5 text-emerald-600" />
          <span>EST. 2022 • Cloud Sync Active</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
