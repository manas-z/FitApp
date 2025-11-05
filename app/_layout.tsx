// app/_layout.tsx
import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Slot, Redirect, useSegments } from 'expo-router';
import { initializeFirebase } from '../src/firebase';
import { FirebaseProvider, useUser } from '../src/firebase';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const segments = useSegments();
  const inAuthGroup = segments[0] === '(auth)';

  if (isUserLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  // Not logged in and not already in (auth) routes → send to login
  if (!user && !inAuthGroup) {
    return <Redirect href="/(auth)/login" />;
  }

  // Logged in but currently inside (auth) → send to tabs
  if (user && inAuthGroup) {
    return <Redirect href="/(tabs)" />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const { firebaseApp, auth, firestore } = initializeFirebase();

  return (
    <FirebaseProvider firebaseApp={firebaseApp} auth={auth} firestore={firestore}>
      <AuthGate>
        <Slot />
      </AuthGate>
    </FirebaseProvider>
  );
}
