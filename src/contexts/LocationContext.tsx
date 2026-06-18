import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Location } from '../types';
import { useAuth } from './AuthContext';

interface LocationContextType {
  locations: Location[];
  selectedLocationId: string | 'all';
  selectedLocation: Location | null;
  setSelectedLocationId: (id: string | 'all') => void;
  loading: boolean;
}

const LocationContext = createContext<LocationContextType>({
  locations: [],
  selectedLocationId: 'all',
  selectedLocation: null,
  setSelectedLocationId: () => {},
  loading: true,
});

export const useLocations = () => useContext(LocationContext);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, isAdmin } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(collection(db, 'locations'), (snapshot) => {
      const locs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Location));
      setLocations(locs);
      setLoading(false);
    }, (error) => {
      if (error.code === 'permission-denied') {
        setLoading(false);
        return;
      }
      console.error("Error listening to locations:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Handle initial selection and restrictions
  useEffect(() => {
    if (!loading) {
      if (!isAdmin && profile?.locationId) {
        // Non-admins are locked to their assigned location
        setSelectedLocationId(profile.locationId);
      } else if (isAdmin) {
        // Admins can use stored preference or default to 'all'
        const stored = localStorage.getItem('selectedLocationId');
        if (stored && (stored === 'all' || locations.some(l => l.id === stored))) {
          setSelectedLocationId(stored);
        } else {
          setSelectedLocationId('all');
        }
      } else {
        // No restriction but no assignment, stay on 'all'
        setSelectedLocationId('all');
      }
    }
  }, [profile, isAdmin, loading, locations]);

  const handleSetSelectedLocationId = (id: string | 'all') => {
    if (!isAdmin && profile?.locationId && id !== profile.locationId) {
      // Prevent non-admins from changing to a location they don't belong to
      return;
    }
    setSelectedLocationId(id);
    if (isAdmin) {
      localStorage.setItem('selectedLocationId', id);
    }
  };

  const selectedLocation = locations.find(l => l.id === selectedLocationId) || null;

  return (
    <LocationContext.Provider 
      value={{ 
        locations, 
        selectedLocationId, 
        selectedLocation, 
        setSelectedLocationId: handleSetSelectedLocationId,
        loading 
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};
