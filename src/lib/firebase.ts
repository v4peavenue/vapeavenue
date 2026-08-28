import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore,
  memoryLocalCache,
  Firestore
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

console.log("Firebase: Initializing with config for project:", firebaseConfig.projectId);

// Attempt to clean up any corrupted IndexedDB databases if needed
if (typeof window !== 'undefined' && window.indexedDB) {
  window.addEventListener('error', (event) => {
    if (event?.message && event.message.includes('refusing to open IndexedDB database')) {
      console.warn('Firebase: Caught IndexedDB corruption error, resetting local storage cache.');
      try {
        if (window.indexedDB.databases) {
          window.indexedDB.databases().then((dbs) => {
            dbs.forEach((dbInfo) => {
              if (dbInfo.name && dbInfo.name.startsWith('firestore')) {
                window.indexedDB.deleteDatabase(dbInfo.name);
              }
            });
          }).catch(() => {});
        }
      } catch {
        // Ignore fallback errors
      }
    }
  });
}

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with memory cache to completely prevent IndexedDB corruption & multi-tab locking crashes
let firestoreDb: Firestore;
const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';

try {
  firestoreDb = initializeFirestore(app, {
    localCache: memoryLocalCache(),
    experimentalForceLongPolling: true,
  }, databaseId);
} catch {
  // If already initialized or fails, retrieve default instance
  firestoreDb = getFirestore(app, databaseId);
}

export const db = firestoreDb;

// Initialize Auth
export const auth = getAuth(app);

export default app;

