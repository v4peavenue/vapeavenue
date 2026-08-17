import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Button } from '@/components/ui/button';
import { LogIn, Sparkles, Waves, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { logAction } from '@/lib/audit';
import greenVaporWave from '@/assets/images/green_vapor_wave_1786985245951.jpg';
import greenSmokeBg from '@/assets/images/green_smoke_bg_1786985230027.jpg';

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
    <div className="relative min-h-screen flex items-center justify-center p-4 font-sans text-slate-800 overflow-hidden bg-[#03140C]">
      {/* Full-bleed Green Smoke / Vapor Backdrop */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img 
          src={greenVaporWave} 
          alt="Vape Avenue Green Smoke Background" 
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center filter brightness-95 contrast-125 scale-105 animate-pulse duration-[8000ms]"
        />
        {/* Deep atmospheric vignette and emerald radiance layers */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#021008] via-transparent to-[#021008]/80 mix-blend-multiply" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(2,16,8,0.75)_100%)]" />
      </div>

      {/* Floating Vape Avenue Signage Card (Matching the uploaded flyer aesthetic) */}
      <div className="max-w-md w-full rounded-3xl p-7 sm:p-9 bg-[#FDFEFE]/95 backdrop-blur-xl text-slate-800 space-y-6 relative z-10 shadow-2xl shadow-emerald-950/60 border border-emerald-500/20">
        
        {/* Top Emblem & Brand */}
        <div className="text-center space-y-3.5">
          <div className="flex items-center justify-center">
            {/* Circular Vape Avenue Emblem with Emerald Border */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-b from-[#10B981] to-[#047857] p-0.5 shadow-lg shadow-emerald-700/30 flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-[#064E3B] border border-emerald-400/40 flex flex-col items-center justify-center text-white">
                <span className="text-[8px] font-black tracking-widest text-emerald-300 uppercase">EST. 2022</span>
                <Waves className="w-6 h-6 text-white my-0.5" />
                <span className="text-[7px] font-black tracking-widest text-emerald-300 uppercase">DENWARD</span>
              </div>
            </div>
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100/80 rounded-full border border-emerald-300 text-emerald-800 text-[11px] font-black uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Vape Avenue Retail ERP</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 font-heading leading-tight">
              AGOS STORE PORTAL
            </h1>
            <p className="text-slate-500 mt-1 text-xs font-semibold">
              Point of Sale, Inventory Management & Financial Ledgers
            </p>
          </div>
        </div>

        {/* Action Panel */}
        <div className="space-y-4">
          <div className="bg-emerald-50/80 rounded-2xl p-4 text-center text-xs text-slate-600 font-semibold leading-relaxed border border-emerald-200/70">
            Sign in with your authorized Google account to access POS registers, barcode lookup, inventory and reports.
          </div>

          <Button 
            onClick={handleGoogleLogin} 
            disabled={loading}
            variant="outline"
            className="w-full h-12 gap-3 rounded-2xl font-black text-sm text-slate-900 bg-white hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-400 border-2 border-slate-200 shadow-md cursor-pointer transition-all active:scale-[0.98]"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4.5 h-4.5" />
            <span>{loading ? 'Authenticating...' : 'Continue with Google'}</span>
          </Button>
        </div>

        {/* Footer info */}
        <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500 font-bold px-1">
          <div className="flex items-center gap-1.5 text-emerald-700 font-extrabold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Encrypted Cloud Sync</span>
          </div>
          <span className="text-[11px] text-slate-400 font-semibold">v2.4 Live</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
