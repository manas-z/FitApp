// app/(auth)/signup.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';

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

export default function SignupScreen() {
  const router = useRouter();
  const { auth } = useFirebase();
  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: FormValues) => {
    await createUserWithEmailAndPassword(auth, values.email, values.password);
    // AuthGate will redirect to (tabs) automatically
  };

  return (
    <Screen scrollable contentStyle={styles.content}>
      <View style={styles.hero}>
        <StyledText variant="label" tone="muted">
          Get started
        </StyledText>
        <StyledText variant="display" weight="bold">
          Create account
        </StyledText>
        <StyledText tone="muted">
          Build flexible cycling routines in minutes.
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
          rules={{ required: true, minLength: 6 }}
          render={({ field: { onChange, value, onBlur } }) => (
            <TextField
              label="Password"
              placeholder="Minimum 6 characters"
              secureTextEntry
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
            />
          )}
        />

        <Button title="Sign up" onPress={handleSubmit(onSubmit)} />
        <Button
          title="Already have an account? Log in"
          variant="ghost"
          onPress={() => router.push('/(auth)/login')}
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
