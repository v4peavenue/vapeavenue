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
        const primaryAdminEmails = ['vanhuxley24@gmail.com', 'v4peavenue@gmail.com', 'dutchlordsilvertongue24@gmail.com'];
        const userEmailLower = user.email ? user.email.toLowerCase().trim() : '';
        const isPrimaryAdmin = userEmailLower ? primaryAdminEmails.includes(userEmailLower) : false;
        let role = isPrimaryAdmin ? 'admin' : null;
        let locationId: string | undefined = undefined;

        if (!isPrimaryAdmin) {
          // Check for pending or pre-approved invites (case-insensitive check)
          const invitesRef = collection(db, 'invites');
          const allInvitesSnap = await getDocs(invitesRef);
          const matchingInviteDoc = allInvitesSnap.docs.find(d => {
            const data = d.data();
            const inviteEmail = (data.email || '').toLowerCase().trim();
            return inviteEmail === userEmailLower && (data.status === 'pending' || data.status === 'accepted');
          });

          if (matchingInviteDoc) {
            const inviteData = matchingInviteDoc.data();
            role = inviteData.role || 'staff';
            locationId = inviteData.locationId;
            // Mark invite as accepted
            try {
              await updateDoc(doc(db, 'invites', matchingInviteDoc.id), { 
                status: 'accepted',
                acceptedAt: new Date().toISOString(),
                userId: user.uid
              });
            } catch (err) {
              console.warn("Login: Could not update invite status:", err);
            }
          }
        }

        // If not invited and not primary admin, check global access control setting
        if (!role) {
          let requireInvite = true;
          try {
            const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
            if (settingsDoc.exists()) {
              const sData = settingsDoc.data();
              if (sData.requireInviteToSignUp === false) {
                requireInvite = false;
              }
            }
          } catch (e) {
            console.warn("Login: Error checking access settings:", e);
          }

          if (!requireInvite) {
            // Open registration mode! Auto-create as staff
            role = 'staff';
            toast.success("Welcome to Vape Avenue! Your account has been registered with Staff access.");
          } else {
            // Record an Access Request so the Admin can approve them with 1-click in Settings!
            try {
              const invitesRef = collection(db, 'invites');
              const allInvitesSnap = await getDocs(invitesRef);
              const alreadyRequested = allInvitesSnap.docs.some(d => {
                const data = d.data();
                return (data.email || '').toLowerCase().trim() === userEmailLower;
              });

              if (!alreadyRequested) {
                await setDoc(doc(collection(db, 'invites')), {
                  email: user.email,
                  name: user.displayName || '',
                  role: 'staff',
                  status: 'requested',
                  requestedAt: new Date().toISOString(),
                  createdAt: new Date().toISOString()
                });
              }
            } catch (reqErr) {
              console.warn("Login: Could not record access request:", reqErr);
            }

            toast.error("Access Pending: You need to be approved by an administrator before logging in. Your access request has been sent to the store admin.");
            await auth.signOut();
            setLoading(false);
            return;
          }
        }

        // Create profile
        const profileData: any = {
          email: user.email,
          name: user.displayName || '',
          role: role,
          createdAt: new Date().toISOString()
        };
        if (locationId) {
          profileData.locationId = locationId;
        }
        await setDoc(userDocRef, profileData);
        
        await logAction(
          { id: user.uid, email: user.email!, name: user.displayName || '', role: role as any },
          'SIGN_UP',
          'User signed up and logged in'
        );
      } else {
        // Profile exists, but let's make sure any pending invites are marked as accepted
        const userEmailLower = user.email ? user.email.toLowerCase().trim() : '';
        const invitesRef = collection(db, 'invites');
        const inviteSnap = await getDocs(invitesRef);
        
        for (const inviteDoc of inviteSnap.docs) {
          const invData = inviteDoc.data();
          if ((invData.email || '').toLowerCase().trim() === userEmailLower && invData.status === 'pending') {
            try {
              await updateDoc(doc(db, 'invites', inviteDoc.id), { 
                status: 'accepted',
                acceptedAt: new Date().toISOString(),
                userId: user.uid
              });
            } catch (err) {
              console.warn("Login: Could not update invite status:", err);
            }
          }
        }

        const profileData = userDoc.data();
        
        const primaryAdminEmails = ['vanhuxley24@gmail.com', 'v4peavenue@gmail.com', 'dutchlordsilvertongue24@gmail.com'];
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
