import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAl9Dn4Q_Aj7FULt2cGKeaOOH7oQ5AjI8w",
  authDomain: "crossfit-tracker-50a2b.firebaseapp.com",
  projectId: "crossfit-tracker-50a2b",
  storageBucket: "crossfit-tracker-50a2b.firebasestorage.app",
  messagingSenderId: "205881091407",
  appId: "1:205881091407:web:aa435b500395fa5709d13a",
  measurementId: "G-VC14WW2C82"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { app };
export default app;
