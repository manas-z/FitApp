// src/firebase/provider.ts
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import type { FirebaseApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

type FirebaseContextValue = {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  user: User | null;
  isUserLoading: boolean;
};

const FirebaseContext = createContext<FirebaseContextValue | undefined>(
  undefined,
);

type FirebaseProviderProps = {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  children: ReactNode;
};

export function FirebaseProvider({
  firebaseApp,
  auth,
  firestore,
  children,
}: FirebaseProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsUserLoading(false);
    });
    return unsub;
  }, [auth]);

  const value: FirebaseContextValue = {
    app: firebaseApp,
    auth,
    firestore,
    user,
    isUserLoading,
  };

  // no JSX, to keep this as .ts
  return React.createElement(FirebaseContext.Provider, { value }, children);
}

export function useFirebase() {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used inside FirebaseProvider');
  }
  return ctx;
}

export function useUser() {
  const { user, isUserLoading } = useFirebase();
  return { user, isUserLoading };
}
