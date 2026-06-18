import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

console.log("Firebase: Initializing with config for project:", firebaseConfig.projectId);

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with settings
export const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId || '(default)');

// Enable Offline Persistence (Disabled in development/iframe mode to prevent IndexedDB lock assertion crashes)
/*
enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a a time.
        console.warn('Firestore persistence failed: Multiple tabs open');
    } else if (err.code == 'unimplemented') {
        // The current browser does not support all of the features required to enable persistence
        console.warn('Firestore persistence is not supported by this browser');
    }
});
*/

// Initialize Auth
export const auth = getAuth(app);

export default app;
