// app/(auth)/login.tsx
import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useFirebase } from '../../src/firebase';
import { palette, radii, spacing, getReadableTextColor } from '../../constants/theme';

type FormValues = {
  email: string;
  password: string;
};

const PRIMARY_BUTTON_TEXT_COLOR = getReadableTextColor(palette.primary);

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
    <View style={styles.container}>
      <Text style={styles.title}>CycleFit</Text>

      <Controller
        control={control}
        name="email"
        rules={{ required: true }}
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor={palette.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={onChange}
            value={value}
          />

        )}
      />

      <Controller
        control={control}
        name="password"
        rules={{ required: true }}
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor={palette.textMuted}
            secureTextEntry
            onChangeText={onChange}
            value={value}
          />

        )}
      />

      <Pressable style={styles.button} onPress={handleSubmit(onSubmit)}>
        <Text style={styles.buttonText}>Log in</Text>
      </Pressable>

      <Pressable onPress={() => router.push('/(auth)/signup')}>
        <Text style={styles.link}>Create an account</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center',
    backgroundColor: palette.background,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: spacing.xl,
    color: palette.textPrimary,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: palette.surface,
    color: palette.textPrimary,
    fontSize: 16,
  },
  button: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    backgroundColor: palette.primary,
    shadowColor: palette.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  buttonText: {
    color: PRIMARY_BUTTON_TEXT_COLOR,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  link: {
    marginTop: spacing.lg,
    textAlign: 'center',
    color: palette.textSecondary,
    fontWeight: '600',
  },
});
