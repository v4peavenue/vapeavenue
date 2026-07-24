import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile } from '../types';
import { toast } from 'sonner';
import { OperationType, handleFirestoreError } from '@/lib/firestore-utils';

interface AuthContextType {
  user: any;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  loginOffline: (email: string, name: string, role: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isManager: false,
  updateProfile: async () => {},
  loginOffline: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loginOffline = async (email: string, name: string, role: string) => {
    setLoading(true);
    try {
      const { signInAnonymously } = await import('firebase/auth');
      const cred = await signInAnonymously(auth);
      const uid = cred.user.uid;

      const offlineUser = {
        uid: uid,
        email: email,
        displayName: name,
        emailVerified: true,
        isAnonymous: true,
        providerData: []
      };

      const offlineProfile = {
        id: uid,
        name: name,
        email: email,
        role: role,
        createdAt: new Date().toISOString()
      };

      // Register the offline user session on the Firestore backend so security rules will approve writes/edits
      const userDocRef = doc(db, 'users', uid);
      await setDoc(userDocRef, {
        email: email,
        role: role,
        name: name,
        createdAt: new Date().toISOString()
      });

      localStorage.setItem('agos_offline_session', JSON.stringify({
        user: offlineUser,
        profile: offlineProfile
      }));

      setUser(offlineUser);
      setProfile(offlineProfile);
    } catch (err) {
      console.warn("Firebase anonymous authentication failed or offline. Fallback to purely local state:", err);
      
      const fallbackUid = 'offline-admin-uid';
      const offlineUser = {
        uid: fallbackUid,
        email: email,
        displayName: name,
        emailVerified: true,
        isAnonymous: false,
        providerData: []
      };

      const offlineProfile = {
        id: fallbackUid,
        name: name,
        email: email,
        role: role,
        createdAt: new Date().toISOString()
      };

      localStorage.setItem('agos_offline_session', JSON.stringify({
        user: offlineUser,
        profile: offlineProfile
      }));

      setUser(offlineUser);
      setProfile(offlineProfile);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    
    // Check if offline user
    if (user.uid === 'offline-admin-uid') {
      const updatedProfile = { ...profile, ...data } as UserProfile;
      setProfile(updatedProfile);
      localStorage.setItem('agos_offline_session', JSON.stringify({
        user,
        profile: updatedProfile
      }));
      toast.success('Offline profile updated locally');
      return;
    }

    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, { ...data, updatedAt: new Date() }, { merge: true });
      toast.success('Profile updated');
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error('Failed to update profile');
      throw error;
    }
  };

  useEffect(() => {
    // Check if there is an offline session
    const offlineSessionStr = localStorage.getItem('agos_offline_session');
    if (offlineSessionStr) {
      try {
        const session = JSON.parse(offlineSessionStr);
        setUser(session.user);
        setProfile(session.profile);
        setLoading(false);
        return;
      } catch (e) {
        console.error("Error loading offline session:", e);
      }
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Listen to user profile changes
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile({ id: docSnap.id, ...docSnap.data() } as UserProfile);
          } else {
            // If profile doesn't exist, maybe it's the first login
            // We'll handle profile creation in the login page or a setup hook
            setProfile(null);
          }
          setLoading(false);
        }, (error) => {
          console.warn("AuthContext: Error fetching profile snapshot:", error);
          setLoading(false);
        });

        return () => unsubscribeProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const isAdmin = profile?.role === 'admin' || user?.email?.toLowerCase() === 'vanhuxley24@gmail.com' || user?.email?.toLowerCase() === 'v4peavenue@gmail.com';
  const isManager = profile?.role === 'admin' || profile?.role === 'manager' || user?.email?.toLowerCase() === 'vanhuxley24@gmail.com' || user?.email?.toLowerCase() === 'v4peavenue@gmail.com';

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isManager, updateProfile, loginOffline }}>
      {children}
    </AuthContext.Provider>
  );
};
