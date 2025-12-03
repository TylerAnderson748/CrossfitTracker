import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

// Initialize Firebase Admin SDK for server-side operations
// In production, use service account credentials from environment variables

let adminApp: App;
let adminDb: Firestore;

function getAdminApp(): App {
  if (getApps().length === 0) {
    // For development, initialize with project ID only (uses default credentials)
    // In production, use service account from environment variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: "crossfit-tracker-50a2b",
      });
    } else {
      // Development mode - uses application default credentials
      adminApp = initializeApp({
        projectId: "crossfit-tracker-50a2b",
      });
    }
  } else {
    adminApp = getApps()[0];
  }
  return adminApp;
}

export function getAdminDb(): Firestore {
  if (!adminDb) {
    getAdminApp();
    adminDb = getFirestore();
  }
  return adminDb;
}

export { getAdminApp };
