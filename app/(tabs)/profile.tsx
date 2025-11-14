import { StyleSheet, View } from 'react-native';
import { signOut } from 'firebase/auth';

import { StyledText } from '@/components/StyledText';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ListItem } from '@/components/ui/ListItem';
import { palette, spacing } from '@/constants/theme';
import { useFirebase, useUser } from '@/src/firebase';

export default function ProfileScreen() {
  const { auth } = useFirebase();
  const { user } = useUser();

  const name =
    user?.displayName?.trim() ||
    user?.email?.split('@')[0] ||
    'Rider';
  const email = user?.email ?? 'No email provided';
  const initials = name
    .split(' ')
    .map((chunk) => chunk[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = () => {
    void signOut(auth);
  };

  return (
    <Screen scrollable={false} inset="all" contentStyle={styles.content}>
      <Card elevated style={styles.profileCard}>
        <View style={styles.avatar}>
          <StyledText variant="title" weight="bold" tone="inverse">
            {initials}
          </StyledText>
        </View>
        <StyledText variant="title" weight="bold">
          {name}
        </StyledText>
        <StyledText tone="muted">{email}</StyledText>
        <Button title="Sign out" variant="secondary" onPress={handleSignOut} />
      </Card>

      <View style={styles.section}>
        <StyledText variant="subtitle" weight="semibold">
          Personalization
        </StyledText>

        <ListItem
          title="Account"
          description="Manage your information and security"
          leading={<View style={styles.iconDot} />}
        />
        <ListItem
          title="Notifications"
          description="Turn workout reminders on or off"
          leading={<View style={styles.iconDot} />}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
  },
  profileCard: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  section: {
    gap: spacing.md,
  },
  iconDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.primary,
  },
});
