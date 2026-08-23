import { useState, useEffect, useCallback, useRef } from 'react';

interface UseFormDraftOptions<T> {
  key: string;
  data: T;
  isOpen: boolean;
  onRestore: (savedData: T) => void;
  isEnabled?: boolean;
  debounceMs?: number;
  hasMeaningfulData?: (data: T) => boolean;
}

export function useFormDraft<T>({
  key,
  data,
  isOpen,
  onRestore,
  isEnabled = true,
  debounceMs = 500,
  hasMeaningfulData
}: UseFormDraftOptions<T>) {
  const [hasDraft, setHasDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isRestored, setIsRestored] = useState(false);
  const isInitialMount = useRef(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if draft exists on mount / when dialog opens
  useEffect(() => {
    if (!isOpen || !isEnabled) return;

    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.data) {
          setHasDraft(true);
          if (parsed.timestamp) {
            setLastSaved(new Date(parsed.timestamp));
          }
          // Automatically restore if not already restored in this session
          if (!isRestored) {
            onRestore(parsed.data);
            setIsRestored(true);
          }
        }
      } else {
        setHasDraft(false);
        setIsRestored(false);
      }
    } catch (e) {
      console.warn('Failed to parse draft from localStorage', e);
    }
    isInitialMount.current = false;
  }, [isOpen, key, isEnabled, isRestored, onRestore]);

  // Debounced auto-save
  useEffect(() => {
    if (!isOpen || !isEnabled || isInitialMount.current) return;

    // Check if there's meaningful data to save
    const shouldSave = hasMeaningfulData ? hasMeaningfulData(data) : true;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!shouldSave) {
      return;
    }

    timeoutRef.current = setTimeout(() => {
      try {
        const now = new Date();
        localStorage.setItem(key, JSON.stringify({
          data,
          timestamp: now.toISOString()
        }));
        setLastSaved(now);
        setHasDraft(true);
      } catch (e) {
        console.warn('Failed to save draft to localStorage', e);
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, isOpen, isEnabled, key, debounceMs, hasMeaningfulData]);

  // Clear draft
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setHasDraft(false);
      setLastSaved(null);
      setIsRestored(false);
    } catch (e) {
      console.warn('Failed to clear draft from localStorage', e);
    }
  }, [key]);

  // Force save immediately
  const saveNow = useCallback(() => {
    try {
      const now = new Date();
      localStorage.setItem(key, JSON.stringify({
        data,
        timestamp: now.toISOString()
      }));
      setLastSaved(now);
      setHasDraft(true);
    } catch (e) {
      console.warn('Failed to manually save draft to localStorage', e);
    }
  }, [data, key]);

  return {
    hasDraft,
    lastSaved,
    clearDraft,
    saveNow,
    isRestored
  };
}
