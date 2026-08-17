import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

console.log("Firebase: Initializing with config for project:", firebaseConfig.projectId);

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with persistent IndexedDB multi-tab offline cache
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
  experimentalAutoDetectLongPolling: true,
}, firebaseConfig.firestoreDatabaseId || '(default)');

// Initialize Auth
export const auth = getAuth(app);

export default app;
