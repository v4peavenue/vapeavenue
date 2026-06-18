import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile } from '@/types';

export const logAction = async (
  user: UserProfile | null,
  action: string,
  details: string,
  entityId?: string,
  entityType?: string
) => {
  if (!user) return;

  try {
    await addDoc(collection(db, 'audit_logs'), {
      userId: user.id,
      userName: user.name || 'Unknown',
      userEmail: user.email,
      action,
      details,
      entityId: entityId || null,
      entityType: entityType || null,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('Failed to log action:', error);
  }
};
