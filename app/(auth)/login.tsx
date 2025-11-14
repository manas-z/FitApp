// app/(auth)/login.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';

import { StyledText } from '@/components/StyledText';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { palette, spacing } from '@/constants/theme';
import { useFirebase } from '@/src/firebase';

type FormValues = {
  email: string;
  password: string;
};

export default function LoginScreen() {
  const router = useRouter();
  const { auth } = useFirebase();
  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: FormValues) => {
    await signInWithEmailAndPassword(auth, values.email, values.password);
    // AuthGate will redirect to (tabs) automatically
  };

  return (
    <Screen scrollable contentStyle={styles.content}>
      <View style={styles.hero}>
        <StyledText variant="label" tone="muted">
          Welcome back
        </StyledText>
        <StyledText variant="display" weight="bold">
          CycleFit
        </StyledText>
        <StyledText tone="muted">
          Sign in to view and build your cycling intervals.
        </StyledText>
      </View>

      <View style={styles.form}>
        <Controller
          control={control}
          name="email"
          rules={{ required: true }}
          render={({ field: { onChange, value, onBlur } }) => (
            <TextField
              label="Email"
              placeholder="you@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          rules={{ required: true }}
          render={({ field: { onChange, value, onBlur } }) => (
            <TextField
              label="Password"
              placeholder="••••••••"
              secureTextEntry
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
            />
          )}
        />

        <Button title="Log in" onPress={handleSubmit(onSubmit)} />
        <Button
          title="Create an account"
          variant="ghost"
          onPress={() => router.push('/(auth)/signup')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
    gap: spacing.xxl,
  },
  hero: {
    gap: spacing.sm,
  },
  form: {
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: 28,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: palette.shadowStrong,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
  },
});
