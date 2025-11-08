// app/(tabs)/settings.tsx
import { useState } from 'react';
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

const VOICES = ['Male Voice 1', 'Female Voice 1', 'Neutral Voice'];

export default function SettingsScreen() {
  const [restDuration, setRestDuration] = useState(40);
  const [countdownEnabled, setCountdownEnabled] = useState(true);
  const [voice, setVoice] = useState<string>(VOICES[0]);
  const [isVoiceMenuOpen, setIsVoiceMenuOpen] = useState(false);
  const [defaultSprints, setDefaultSprints] = useState(3);

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
            <Ionicons name="play-circle" size={22} color="#2563eb" />
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
                minimumTrackTintColor="#2563eb"
                maximumTrackTintColor="#cbd5f5"
                thumbTintColor="#2563eb"
                value={restDuration}
                onValueChange={(value) => setRestDuration(Math.round(value))}
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
              thumbColor={countdownEnabled ? '#2563eb' : '#ffffff'}
              trackColor={{ false: '#dbeafe', true: '#bfdbfe' }}
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
                color="#1f2937"
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
                          color="#2563eb"
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
            <Ionicons name="options" size={20} color="#2563eb" />
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
                minimumTrackTintColor="#2563eb"
                maximumTrackTintColor="#cbd5f5"
                thumbTintColor="#2563eb"
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
    backgroundColor: '#d9f3ff',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingBottom: 40,
  },
  heading: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  subheading: {
    fontSize: 16,
    color: '#475569',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginLeft: 10,
  },
  cardDescription: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 16,
  },
  settingGroup: {
    marginBottom: 20,
  },
  lastSettingGroup: {
    marginBottom: 0,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  settingHint: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 18,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  slider: {
    flex: 1,
  },
  sliderValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1d4ed8',
    minWidth: 48,
    textAlign: 'right',
    marginLeft: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleTextWrapper: {
    flex: 1,
    marginRight: 16,
  },
  dropdown: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#f8fbff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownActive: {
    borderColor: '#93c5fd',
  },
  dropdownPressed: {
    backgroundColor: '#eef2ff',
  },
  dropdownText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },
  dropdownIcon: {
    marginLeft: 12,
  },
  dropdownMenu: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownOptionSelected: {
    backgroundColor: '#f0f7ff',
  },
  dropdownOptionPressed: {
    backgroundColor: '#e2e8f0',
  },
  dropdownOptionText: {
    fontSize: 15,
    color: '#111827',
  },
  dropdownOptionTextSelected: {
    fontWeight: '700',
    color: '#1d4ed8',
  },
  saveButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#fde047',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: '#facc15',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 16,
    elevation: 5,
  },
  saveButtonPressed: {
    backgroundColor: '#facc15',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
});
