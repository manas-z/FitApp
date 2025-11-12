// app/(tabs)/settings.tsx
import { useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  REST_DURATION_STORAGE_KEY,
  DEFAULT_REST_DURATION_SECONDS,
} from '../../constants/settings';
import { palette, radii, spacing, typography } from '../../constants/theme';

const VOICES = ['Male Voice 1', 'Female Voice 1', 'Neutral Voice'];

export default function SettingsScreen() {
  const [restDuration, setRestDuration] = useState(
    DEFAULT_REST_DURATION_SECONDS,
  );
  const [countdownEnabled, setCountdownEnabled] = useState(true);
  const [voice, setVoice] = useState<string>(VOICES[0]);
  const [isVoiceMenuOpen, setIsVoiceMenuOpen] = useState(false);
  const [defaultSprints, setDefaultSprints] = useState(3);

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(REST_DURATION_STORAGE_KEY)
      .then((stored) => {
        if (!stored || !isMounted) return;
        const parsed = Number.parseInt(stored, 10);
        if (!Number.isNaN(parsed)) {
          setRestDuration(parsed);
        }
      })
      .catch((err) => {
        console.warn('Failed to load rest duration preference', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const persistRestDuration = useCallback(async (value: number) => {
    try {
      await AsyncStorage.setItem(
        REST_DURATION_STORAGE_KEY,
        value.toString(),
      );
    } catch (err) {
      console.warn('Failed to persist rest duration preference', err);
    }
  }, []);

  const toggleVoiceMenu = () => {
    setIsVoiceMenuOpen((prev) => !prev);
  };

  const handleSelectVoice = (selectedVoice: string) => {
    setVoice(selectedVoice);
    setIsVoiceMenuOpen(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        style={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>Settings</Text>
        <Text style={styles.subheading}>
          Customize your workout experience.
        </Text>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="play-circle" size={22} color={palette.primary} />
            <Text style={styles.cardTitle}>Workout Player</Text>
          </View>
          <Text style={styles.cardDescription}>
            Adjust settings for the in-workout experience.
          </Text>

          <View style={styles.settingGroup}>
            <Text style={styles.settingLabel}>Rest Duration Between Steps</Text>
            <View style={styles.sliderRow}>
              <Slider
                style={styles.slider}
                minimumValue={10}
                maximumValue={120}
                step={5}
                minimumTrackTintColor={palette.primary}
                maximumTrackTintColor={palette.primaryMuted}
                thumbTintColor={palette.primary}
                value={restDuration}
                onValueChange={(value) => setRestDuration(Math.round(value))}
                onSlidingComplete={(value) => {
                  const rounded = Math.round(value);
                  setRestDuration(rounded);
                  void persistRestDuration(rounded);
                }}
              />
              <Text style={styles.sliderValue}>{restDuration}s</Text>
            </View>
          </View>

          <View style={[styles.settingGroup, styles.toggleRow]}>
            <View style={styles.toggleTextWrapper}>
              <Text style={styles.settingLabel}>Enable Countdown Timer</Text>
              <Text style={styles.settingHint}>
                A 3-second countdown before each step.
              </Text>
            </View>
            <Switch
              accessibilityLabel="Toggle countdown timer"
              value={countdownEnabled}
              onValueChange={setCountdownEnabled}
              thumbColor={countdownEnabled ? palette.primary : palette.surface}
              trackColor={{
                false: palette.surfaceMuted,
                true: palette.primaryMuted,
              }}
            />
          </View>

          <View style={[styles.settingGroup, styles.lastSettingGroup]}>
            <Text style={styles.settingLabel}>Countdown Voice</Text>
            <Text style={styles.settingHint}>Choose the voice that cues each step.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Select countdown voice"
              style={({ pressed }) => [
                styles.dropdown,
                pressed && styles.dropdownPressed,
                isVoiceMenuOpen && styles.dropdownActive,
              ]}
              onPress={toggleVoiceMenu}
            >
              <Text style={styles.dropdownText}>{voice}</Text>
              <Ionicons
                name={isVoiceMenuOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={palette.textPrimary}
                style={styles.dropdownIcon}
              />
            </Pressable>
            {isVoiceMenuOpen ? (
              <View style={styles.dropdownMenu}>
                {VOICES.map((item) => {
                  const isSelected = item === voice;
                  return (
                    <Pressable
                      key={item}
                      accessibilityRole="button"
                      accessibilityLabel={`Use ${item}`}
                      style={({ pressed }) => [
                        styles.dropdownOption,
                        isSelected && styles.dropdownOptionSelected,
                        pressed && styles.dropdownOptionPressed,
                      ]}
                      onPress={() => handleSelectVoice(item)}
                    >
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          isSelected && styles.dropdownOptionTextSelected,
                        ]}
                      >
                        {item}
                      </Text>
                      {isSelected ? (
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color={palette.primary}
                          style={styles.dropdownIcon}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="options" size={20} color={palette.primary} />
            <Text style={styles.cardTitle}>Defaults</Text>
          </View>
          <Text style={styles.cardDescription}>
            Set default values for new schedules and workouts.
          </Text>

          <View style={[styles.settingGroup, styles.lastSettingGroup]}>
            <Text style={styles.settingLabel}>Default Sprints</Text>
            <View style={styles.sliderRow}>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={10}
                step={1}
                minimumTrackTintColor={palette.primary}
                maximumTrackTintColor={palette.primaryMuted}
                thumbTintColor={palette.primary}
                value={defaultSprints}
                onValueChange={(value) => setDefaultSprints(Math.round(value))}
              />
              <Text style={styles.sliderValue}>{defaultSprints}</Text>
            </View>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save settings"
          style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}
          onPress={() => {
            void persistRestDuration(restDuration);
            console.log('Settings saved');
          }}
        >
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  contentContainer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  heading: {
    fontSize: 32,
    fontWeight: typography.headingFontWeight,
    color: palette.textPrimary,
    marginBottom: spacing.xs,
    letterSpacing: 0.2,
  },
  subheading: {
    fontSize: 16,
    color: palette.textSecondary,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    shadowColor: palette.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: palette.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.textPrimary,
    marginLeft: spacing.sm,
  },
  cardDescription: {
    fontSize: 15,
    color: palette.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  settingGroup: {
    marginBottom: spacing.xl,
  },
  lastSettingGroup: {
    marginBottom: 0,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: typography.labelFontWeight,
    color: palette.textPrimary,
    marginBottom: spacing.xs,
  },
  settingHint: {
    fontSize: 14,
    color: palette.textMuted,
    lineHeight: 20,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  slider: {
    flex: 1,
  },
  sliderValue: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.primary,
    minWidth: 52,
    textAlign: 'right',
    marginLeft: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleTextWrapper: {
    flex: 1,
    marginRight: spacing.lg,
  },
  dropdown: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: palette.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownActive: {
    borderColor: palette.primary,
  },
  dropdownPressed: {
    backgroundColor: palette.surfaceElevated,
  },
  dropdownText: {
    fontSize: 15,
    color: palette.textPrimary,
    fontWeight: typography.labelFontWeight,
  },
  dropdownIcon: {
    marginLeft: spacing.md,
  },
  dropdownMenu: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: palette.surface,
    shadowColor: palette.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  dropdownOptionSelected: {
    backgroundColor: palette.primaryMuted,
  },
  dropdownOptionPressed: {
    backgroundColor: palette.surfaceMuted,
  },
  dropdownOptionText: {
    fontSize: 15,
    color: palette.textPrimary,
  },
  dropdownOptionTextSelected: {
    fontWeight: '700',
    color: palette.primary,
  },
  saveButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: palette.accent,
    paddingHorizontal: spacing.xl + spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    shadowColor: palette.shadow,
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 5,
  },
  saveButtonPressed: {
    backgroundColor: palette.accentMuted,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.surface,
    letterSpacing: 0.3,
  },
});
