"use client";

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import { AppUser, StoredAccount } from "./types";

const STORED_ACCOUNTS_KEY = "crossfit_tracker_accounts";

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  user: AppUser | null;
  loading: boolean;
  switching: boolean; // True during account switch to prevent redirects
  signIn: (email: string, password: string, saveAccount?: boolean) => Promise<void>;
  signUp: (email: string, password: string, userData: Partial<AppUser>) => Promise<void>;
  signOut: () => Promise<void>;
  // Multi-account management
  storedAccounts: StoredAccount[];
  switchAccount: (accountId: string) => Promise<void>;
  addAccount: (email: string, password: string) => Promise<void>;
  removeAccount: (accountId: string) => void;
  isCurrentAccount: (accountId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper functions for localStorage
function getStoredAccountsFromStorage(): StoredAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORED_ACCOUNTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveStoredAccountsToStorage(accounts: StoredAccount[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORED_ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [storedAccounts, setStoredAccounts] = useState<StoredAccount[]>([]);

  // Ref to track switching synchronously (state updates are async)
  const switchingRef = useRef(false);

  // Load stored accounts from localStorage on mount
  useEffect(() => {
    setStoredAccounts(getStoredAccountsFromStorage());
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);

      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          setUser({ id: userDoc.id, ...userDoc.data() } as AppUser);
        }
      } else {
        // Only clear user if we're not in the middle of switching accounts
        if (!switchingRef.current) {
          setUser(null);
        }
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Update stored account display name when user data changes
  useEffect(() => {
    if (user) {
      const accounts = getStoredAccountsFromStorage();
      const accountIndex = accounts.findIndex((a) => a.id === user.id);
      if (accountIndex !== -1 && accounts[accountIndex].displayName !== user.displayName) {
        accounts[accountIndex].displayName = user.displayName;
        saveStoredAccountsToStorage(accounts);
        setStoredAccounts(accounts);
      }
    }
  }, [user]);

  const signIn = async (email: string, password: string, saveAccount: boolean = true) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    if (saveAccount) {
      // Get user display name from Firestore
      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
      const userData = userDoc.exists() ? userDoc.data() : null;

      const accounts = getStoredAccountsFromStorage();
      const existingIndex = accounts.findIndex((a) => a.email === email);

      const newAccount: StoredAccount = {
        id: userCredential.user.uid,
        email,
        displayName: userData?.displayName || userData?.firstName || email,
        password,
      };

      if (existingIndex !== -1) {
        accounts[existingIndex] = newAccount;
      } else {
        accounts.push(newAccount);
      }

      saveStoredAccountsToStorage(accounts);
      setStoredAccounts(accounts);
    }
  };

  const signUp = async (email: string, password: string, userData: Partial<AppUser>) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const { uid } = userCredential.user;

    await setDoc(doc(db, "users", uid), {
      ...userData,
      email,
      role: "athlete",
      hideFromLeaderboards: false,
      createdAt: Timestamp.now(),
    });

    // Save the new account
    const accounts = getStoredAccountsFromStorage();
    const newAccount: StoredAccount = {
      id: uid,
      email,
      displayName: userData.displayName || userData.firstName || email,
      password,
    };
    accounts.push(newAccount);
    saveStoredAccountsToStorage(accounts);
    setStoredAccounts(accounts);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
  };

  const switchAccount = async (accountId: string) => {
    const account = storedAccounts.find((a) => a.id === accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    // Set switching flag to prevent redirects during the switch
    // Use ref for synchronous check in auth listener, state for UI
    switchingRef.current = true;
    setSwitching(true);
    try {
      // Sign out current user and sign in with the new account
      await firebaseSignOut(auth);
      await signInWithEmailAndPassword(auth, account.email, account.password);
    } finally {
      switchingRef.current = false;
      setSwitching(false);
    }
  };

  const addAccount = async (email: string, password: string) => {
    // Sign in to validate credentials and get user info
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
    const userData = userDoc.exists() ? userDoc.data() : null;

    const accounts = getStoredAccountsFromStorage();
    const existingIndex = accounts.findIndex((a) => a.email === email);

    const newAccount: StoredAccount = {
      id: userCredential.user.uid,
      email,
      displayName: userData?.displayName || userData?.firstName || email,
      password,
    };

    if (existingIndex !== -1) {
      accounts[existingIndex] = newAccount;
    } else {
      accounts.push(newAccount);
    }

    saveStoredAccountsToStorage(accounts);
    setStoredAccounts(accounts);
  };

  const removeAccount = (accountId: string) => {
    const accounts = storedAccounts.filter((a) => a.id !== accountId);
    saveStoredAccountsToStorage(accounts);
    setStoredAccounts(accounts);
  };

  const isCurrentAccount = (accountId: string) => {
    return user?.id === accountId;
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        user,
        loading,
        switching,
        signIn,
        signUp,
        signOut,
        storedAccounts,
        switchAccount,
        addAccount,
        removeAccount,
        isCurrentAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
