import admin from "firebase-admin";

// Initialize Firebase Admin SDK for server-side operations
// In production, use service account credentials from environment variables

function getAdminApp(): admin.app.App {
  if (admin.apps.length === 0) {
    // For development, initialize with project ID only (uses default credentials)
    // In production, use service account from environment variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: "crossfit-tracker-50a2b",
      });
    } else {
      // Development mode - uses application default credentials
      admin.initializeApp({
        projectId: "crossfit-tracker-50a2b",
      });
    }
  }
  return admin.apps[0]!;
}

export function getAdminDb(): admin.firestore.Firestore {
  getAdminApp();
  return admin.firestore();
}

export { getAdminApp };
