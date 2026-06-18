import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './AuthContext';
import { OperationType, handleFirestoreError } from '@/lib/firestore-utils';

interface SystemSettings {
  currency: string;
}

interface SettingsContextType {
  settings: SystemSettings;
  updateCurrency: (currency: string) => Promise<void>;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin } = useAuth();
  const [settings, setSettings] = useState<SystemSettings>({ currency: '₱' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as SystemSettings);
      } else {
        // Initialize with default if it doesn't exist
        setSettings({ currency: '₱' });
      }
      setLoading(false);
    }, (error) => {
      // Avoid throwing error if it's just a permission issue while logging out
      if (error.code === 'permission-denied') {
        setLoading(false);
        return;
      }
      handleFirestoreError(error, OperationType.GET, 'settings/global');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const updateCurrency = async (currency: string) => {
    if (!isAdmin) return;
    await setDoc(doc(db, 'settings', 'global'), { 
      currency,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  };

  return (
    <SettingsContext.Provider value={{ settings, updateCurrency, loading }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
