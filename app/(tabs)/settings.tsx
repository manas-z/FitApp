// app/(tabs)/settings.tsx
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Screen } from '@/components/Screen';
import { StyledText } from '@/components/StyledText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  DEFAULT_REST_DURATION_SECONDS,
  REST_DURATION_STORAGE_KEY,
} from '../../constants/settings';
import {
  palette,
  radii,
  spacing,
  typography,
  getReadableTextColor,
} from '../../constants/theme';

const SAVE_BUTTON_BACKGROUND = palette.accent;
const SAVE_BUTTON_TEXT_COLOR = getReadableTextColor(SAVE_BUTTON_BACKGROUND);

const VOICES = ['Male Voice 1', 'Female Voice 1', 'Neutral Voice'];

export default function SettingsScreen() {
  const [restDuration, setRestDuration] = useState(DEFAULT_REST_DURATION_SECONDS);
  const [countdownEnabled, setCountdownEnabled] = useState(true);
  const [voice, setVoice] = useState<string>(VOICES[0]);
  const [voiceMenuOpen, setVoiceMenuOpen] = useState(false);
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
      await AsyncStorage.setItem(REST_DURATION_STORAGE_KEY, value.toString());
    } catch (err) {
      console.warn('Failed to persist rest duration preference', err);
    }
  }, []);

  const toggleVoiceMenu = () => setVoiceMenuOpen((prev) => !prev);

  const handleSave = () => {
    void persistRestDuration(restDuration);
    console.log('Settings saved');
  };

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <StyledText variant="title" weight="bold">
          Settings
        </StyledText>
        <StyledText tone="muted">Customize your workout experience.</StyledText>
      </View>

      <Card elevated>
        <View style={styles.sectionHeading}>
          <View style={styles.iconBadge}>
            <Ionicons name="play" size={18} color={palette.primary} />
          </View>
          <View>
            <StyledText variant="subtitle" weight="semibold">
              Workout player
            </StyledText>
            <StyledText variant="caption" tone="muted">
              Playback preferences
            </StyledText>
          </View>
        </View>

        <View style={styles.settingBlock}>
          <View>
            <StyledText variant="label" weight="semibold">
              Rest duration
            </StyledText>
            <StyledText variant="caption" tone="muted">
              Time between each interval (seconds)
            </StyledText>
          </View>
          <StyledText variant="label" tone="primary">
            {restDuration}s
          </StyledText>
        </View>
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

        <View style={styles.settingRow}>
          <View style={styles.settingCopy}>
            <StyledText variant="label" weight="semibold">
              Countdown timer
            </StyledText>
            <StyledText variant="caption" tone="muted">
              Play a short cue before each effort.
            </StyledText>
          </View>
          <Switch
            accessibilityLabel="Toggle countdown timer"
            value={countdownEnabled}
            onValueChange={setCountdownEnabled}
            thumbColor={countdownEnabled ? palette.primary : palette.surface}
            trackColor={{
              true: palette.primaryMuted,
              false: palette.border,
            }}
          />
        </View>

        <View style={styles.settingBlock}>
          <View style={styles.settingCopy}>
            <StyledText variant="label" weight="semibold">
              Countdown voice
            </StyledText>
            <StyledText variant="caption" tone="muted">
              Choose the guidance tone you prefer.
            </StyledText>
          </View>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.voicePicker,
              pressed && styles.voicePickerPressed,
              voiceMenuOpen && styles.voicePickerActive,
            ]}
            onPress={toggleVoiceMenu}
          >
            <StyledText variant="label">{voice}</StyledText>
            <Ionicons
              name={voiceMenuOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={palette.textPrimary}
            />
          </Pressable>
        </View>

        {voiceMenuOpen ? (
          <View style={styles.voiceMenu}>
            {VOICES.map((item) => {
              const isSelected = item === voice;
              return (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.voiceOption,
                    isSelected && styles.voiceOptionSelected,
                    pressed && styles.voiceOptionPressed,
                  ]}
                  onPress={() => {
                    setVoice(item);
                    setVoiceMenuOpen(false);
                  }}
                >
                  <StyledText
                    variant="body"
                    weight="medium"
                    style={isSelected ? { color: palette.primary } : undefined}
                  >
                    {item}
                  </StyledText>
                  {isSelected ? (
                    <Ionicons name="checkmark" size={16} color={palette.primary} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </Card>

      <Card>
        <View style={styles.sectionHeading}>
          <View style={styles.iconBadge}>
            <Ionicons name="options" size={16} color={palette.primary} />
          </View>
          <View>
            <StyledText variant="subtitle" weight="semibold">
              Defaults
            </StyledText>
            <StyledText variant="caption" tone="muted">
              New workout templates
            </StyledText>
          </View>
        </View>

        <View style={styles.settingBlock}>
          <View>
            <StyledText variant="label" weight="semibold">
              Default sprints
            </StyledText>
            <StyledText variant="caption" tone="muted">
              Base number when creating a new plan.
            </StyledText>
          </View>
          <StyledText variant="label" tone="primary">
            {defaultSprints}
          </StyledText>
        </View>

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
      </Card>

      <Button title="Save changes" variant="secondary" onPress={handleSave} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: {
    gap: spacing.xs,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slider: {
    marginTop: spacing.sm,
  },
  settingBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  settingCopy: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  voicePicker: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: palette.surfaceMuted,
  },
  voicePickerActive: {
    borderColor: palette.primary,
  },
  voicePickerPressed: {
    backgroundColor: palette.surfaceElevated,
  },
  voiceMenu: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: spacing.md,
    overflow: 'hidden',
  },
  voiceOption: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.surface,
  },
  voiceOptionSelected: {
    backgroundColor: palette.primaryMuted,
  },
  voiceOptionPressed: {
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
    backgroundColor: SAVE_BUTTON_BACKGROUND,
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
    backgroundColor: palette.accentDark,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: SAVE_BUTTON_TEXT_COLOR,
    letterSpacing: 0.3,
  },
});
