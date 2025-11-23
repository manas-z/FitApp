// src/firebase/index.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import * as firebaseAuth from 'firebase/auth';
import {
  Firestore,
  getFirestore,
  setLogLevel
} from 'firebase/firestore';
import { Platform } from 'react-native';

import { firebaseConfig } from './config';

// Singletons to survive hot reload
let authInstance: Auth | null = null;
let firestoreInstance: Firestore | null = null;

export function initializeFirebase() {
  // Enable verbose logging for Firestore to debug connection issues
  setLogLevel('debug');

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

  // ---------- Auth ----------
  if (!authInstance) {
    if (Platform.OS === 'web') {
      authInstance = firebaseAuth.getAuth(app);
    } else {
      const getReactNativePersistence = (firebaseAuth as any)
        .getReactNativePersistence;

      authInstance = (firebaseAuth as any).initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    }
  }

  // ---------- Firestore ----------
  if (!firestoreInstance) {
    firestoreInstance = getFirestore(app);
  }

  return {
    firebaseApp: app,
    auth: authInstance as Auth,
    firestore: firestoreInstance as Firestore,
  };
}

// Re-export hooks and provider
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './provider';

