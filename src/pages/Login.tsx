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
    <div className="relative min-h-screen flex items-center justify-center bg-slate-100/90 p-4 overflow-hidden font-sans">
      {/* Background Stylized Agos Shapes */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#1C2D4E] rounded-full mix-blend-multiply opacity-25 filter blur-2xl pointer-events-none" />
      <div className="absolute top-1/3 -right-20 w-80 h-80 bg-[#D4AF37] rounded-full mix-blend-multiply opacity-20 filter blur-3xl pointer-events-none" />
      <div className="absolute -bottom-28 left-1/4 w-[500px] h-[500px] bg-indigo-900/20 rounded-full filter blur-3xl pointer-events-none" />

      <Card className="max-w-md w-full shadow-2xl border-slate-200/90 bg-white/95 backdrop-blur-md rounded-[28px] relative z-10">
        <CardHeader className="text-center space-y-4 pt-8">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-[#1C2D4E] to-[#15233D] rounded-2xl flex items-center justify-center shadow-lg shadow-[#1C2D4E]/20 border border-[#D4AF37]/30">
            <Waves className="w-9 h-9 text-[#D4AF37]" />
          </div>
          <div>
            <CardTitle className="text-3xl font-extrabold tracking-tight text-[#1C2D4E] font-heading">AGOS ERP</CardTitle>
            <CardDescription className="text-slate-500 mt-1 font-medium">
              Smart Store & Inventory Portal
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-2">
          <div className="text-center text-xs text-slate-600 font-medium leading-relaxed">
            Sign in with your authorized Google account to access store operations, barcodes, cash registers, and multi-location management.
          </div>

          <Button 
            onClick={handleGoogleLogin} 
            disabled={loading}
            className="w-full h-12 gap-3 bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm rounded-xl font-bold text-sm"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            <span>Continue with Google</span>
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 border-t border-slate-100 bg-slate-50/50 rounded-b-[28px] pt-4 pb-6">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <LogIn className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Secure Enterprise Authentication</span>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;
