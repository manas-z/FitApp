// src/firebase/index.ts
import { initializeApp, getApp, getApps } from 'firebase/app';
import * as firebaseAuth from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import {
  initializeFirestore,
  Firestore,
} from 'firebase/firestore';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { firebaseConfig } from './config';

// Singletons to survive hot reload
let authInstance: Auth | null = null;
let firestoreInstance: Firestore | null = null;

export function initializeFirebase() {
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
    if (Platform.OS === 'web') {
      // Web: default transport
      firestoreInstance = initializeFirestore(app, {});
    } else {
      // React Native: force long polling; no useFetchStreams (not in this SDK)
      firestoreInstance = initializeFirestore(app, {
        experimentalForceLongPolling: true,
      });
    }
  }

  return {
    firebaseApp: app,
    auth: authInstance as Auth,
    firestore: firestoreInstance as Firestore,
  };
}

// Re-export hooks and provider
export * from './provider';
export * from './firestore/use-doc';
export * from './firestore/use-collection';
