import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
  Dimensions,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../theme';

const { width, height } = Dimensions.get('window');

interface Props {
  step: 'poison' | 'goal' | 'interrupt';
  selectedPoison: string;
  selectedGoal: string;
  isSaving?: boolean;
  onSelectPoison: (value: string) => void;
  onSelectGoal: (value: string) => void;
  onNext: () => void;
  onSkip?: () => void;
}

export const Onboarding: React.FC<Props> = ({
  step,
  selectedPoison,
  selectedGoal,
  isSaving = false,
  onSelectPoison,
  onSelectGoal,
  onNext,
  onSkip,
}) => {
  const insets = useSafeAreaInsets();
  const [requestingPermission, setRequestingPermission] = React.useState(false);
  const slideAnim = React.useRef(new Animated.Value(30)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    slideAnim.setValue(30);
    opacityAnim.setValue(0);
    // Light pop on every step transition
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [step]);

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: opacityAnim, transform: [{ translateX: slideAnim }] },
      ]}
    >
      {/* Step indicator */}
      <View style={[styles.stepRow, { paddingTop: insets.top + 16 }]}>
        {(['poison', 'goal', 'interrupt'] as const).map((s) => (
          <View
            key={s}
            style={[
              styles.stepDot,
              s === step
                ? styles.stepDotActive
                : step === 'goal' && s === 'poison'
                ? styles.stepDotDone
                : step === 'interrupt' && s !== 'interrupt'
                ? styles.stepDotDone
                : styles.stepDotInactive,
            ]}
          />
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {step === 'poison' && (
          <>
            <View style={styles.header}>
              <Text style={styles.headlinePoison}>
                Pick Your{' '}
                <Text style={{ color: COLORS.primary, fontStyle: 'italic' }}>Poison.</Text>
              </Text>
              <Text style={styles.subtitle}>
                Choose what you want to learn in under 5 minutes.
              </Text>
            </View>

            <View style={styles.poisonGrid}>
              <PoisonCard
                icon="zap"
                iconFamily="feather"
                category="Science"
                title="Quantum Quips"
                selected={selectedPoison === 'Science'}
                onPress={() => onSelectPoison('Science')}
              />
              <PoisonCard
                icon="clock"
                iconFamily="feather"
                category="History"
                title="Lost History"
                selected={selectedPoison === 'History'}
                onPress={() => onSelectPoison('History')}
              />
              <PoisonCard
                icon="book-open"
                iconFamily="feather"
                category="Words"
                title="Vocab Vibe"
                selected={selectedPoison === 'Words'}
                onPress={() => onSelectPoison('Words')}
              />
              <PoisonCard
                icon="gamepad-variant"
                iconFamily="mci"
                category="Micro-games"
                title="Survival Skills"
                selected={selectedPoison === 'Micro-games'}
                onPress={() => onSelectPoison('Micro-games')}
              />
            </View>
          </>
        )}

        {step === 'goal' && (
          <>
            <View style={styles.header}>
              <Text style={styles.tagLabel}>Personalization</Text>
              <Text style={styles.headline}>Set Your Goal.</Text>
              <Text style={styles.subtitle}>
                How many daily interruptions do you want? Choose your learning velocity.
              </Text>
            </View>

            <View style={styles.goalList}>
              <GoalCard
                title="Casual (2-3 bytes)"
                description="Mild curiosity. Won't break your focus, just fuels it."
                selected={selectedGoal === 'Casual (2-3 bytes)'}
                onPress={() => onSelectGoal('Casual (2-3 bytes)')}
              />
              <GoalCard
                title="Growth (5-7 bytes)"
                description="The sweet spot. High retention without the burnout."
                selected={selectedGoal === 'Growth (5-7 bytes)'}
                onPress={() => onSelectGoal('Growth (5-7 bytes)')}
              />
              <GoalCard
                title="Scholar (10+ bytes)"
                description="Total immersion. Your brain becomes a data sponge."
                selected={selectedGoal === 'Scholar (10+ bytes)'}
                onPress={() => onSelectGoal('Scholar (10+ bytes)')}
              />
            </View>
          </>
        )}

        {step === 'interrupt' && (
          <View style={styles.interruptContainer}>
            {/* Illustration */}
            <View style={styles.illustrationBox}>
              <View style={styles.outerRing}>
                <View style={styles.innerRing}>
                  <Feather name="zap" size={80} color={COLORS.primary} />
                </View>
              </View>
              <View style={[styles.floatBadge, { top: 32, right: 32 }]}>
                <Feather name="zap" size={20} color={COLORS.secondary} />
              </View>
              <View style={[styles.floatBadge, { bottom: 48, left: 24 }]}>
                <MaterialCommunityIcons name="brain" size={20} color={COLORS.primary} />
              </View>
            </View>

            <Text style={styles.interruptHeadline}>
              <Text style={{ color: COLORS.primary }}>Ready for the{'\n'}</Text>
              <Text style={{ color: COLORS.white }}>Interrupt?</Text>
            </Text>
            <Text style={styles.interruptSubtitle}>
              BrainByte will send a micro-dose of knowledge exactly when you need to stop the doomscroll.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom buttons */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 20 }]}>
        {step === 'interrupt' ? (
          <>
            <TouchableOpacity
              style={[styles.nextButton, (isSaving || requestingPermission) && styles.nextButtonDisabled]}
              disabled={isSaving || requestingPermission}
              onPress={async () => {
                setRequestingPermission(true);
                try {
                  if (Platform.OS === 'android') {
                    Alert.alert(
                      'Draw Over Other Apps',
                      'To interrupt doomscrolling, BrainByte needs "Display over other apps" permission.\n\nOpen Settings → Apps → Special App Access → Display over other apps and enable it for BrainByte.',
                      [
                        { text: 'Not Now', style: 'cancel', onPress: () => onSkip?.() },
                        { text: 'Open Settings', onPress: () => { Linking.openSettings(); onNext(); } },
                      ]
                    );
                  } else {
                    const { status } = await Notifications.requestPermissionsAsync();
                    if (status === 'granted') {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      onNext();
                    } else {
                      Alert.alert(
                        'Permission Required',
                        'Allow notifications for BrainByte in Settings to receive interrupts while doomscrolling.',
                        [
                          { text: 'Skip', style: 'cancel', onPress: () => onSkip?.() },
                          { text: 'Open Settings', onPress: () => Linking.openURL('app-settings:') },
                        ]
                      );
                    }
                  }
                } finally {
                  setRequestingPermission(false);
                }
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.nextButtonText}>
                {isSaving || requestingPermission ? 'Requesting...' : 'Enable Interrupts'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.skipRow}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSkip?.(); }}
            >
              <Text style={styles.skipText}>Skip — disable interrupts</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.nextButton, isSaving && styles.nextButtonDisabled]}
            disabled={isSaving}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onNext();
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.nextButtonText}>
              {isSaving ? 'Saving...' : 'Next'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const PoisonCard = ({
  icon,
  iconFamily,
  category,
  title,
  selected,
  onPress,
}: {
  icon: string;
  iconFamily: 'feather' | 'mci';
  category: string;
  title: string;
  selected: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }}
    activeOpacity={0.8}
    style={[styles.poisonCard, selected && styles.poisonCardSelected]}
  >
    <View style={[styles.poisonIconBox, selected && styles.poisonIconBoxSelected]}>
      {iconFamily === 'feather' ? (
        <Feather
          name={icon as React.ComponentProps<typeof Feather>['name']}
          size={24}
          color={selected ? COLORS.black : COLORS.onSurfaceVariant}
        />
      ) : (
        <MaterialCommunityIcons
          name={icon as any}
          size={24}
          color={selected ? COLORS.black : COLORS.onSurfaceVariant}
        />
      )}
    </View>
    <Text style={[styles.poisonCategory, selected && { color: COLORS.primary }]}>
      {category}
    </Text>
    <Text style={styles.poisonTitle}>{title}</Text>
  </TouchableOpacity>
);

const GoalCard = ({
  title,
  description,
  selected,
  onPress,
}: {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onPress();
    }}
    activeOpacity={0.8}
    style={[styles.goalCard, selected && styles.goalCardSelected]}
  >
    <View style={styles.goalCardHeader}>
      <Text style={[styles.goalTitle, selected && { color: COLORS.primary }]}>{title}</Text>
      <View style={[styles.goalRadio, selected && styles.goalRadioSelected]}>
        {selected && <Feather name="check" size={12} color={COLORS.black} />}
      </View>
    </View>
    <Text style={[styles.goalDescription, selected && { color: COLORS.primary + 'cc' }]}>
      {description}
    </Text>
    {selected && <View style={styles.goalAccentLine} />}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 120,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  stepDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  stepDotActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  stepDotDone: {
    backgroundColor: COLORS.primary + '80',
  },
  stepDotInactive: {
    backgroundColor: COLORS.surfaceContainerHighest,
  },
  header: {
    marginBottom: 32,
  },
  tagLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginBottom: 12,
  },
  headline: {
    fontSize: 42,
    fontWeight: '900',
    color: COLORS.onSurface,
    letterSpacing: -1.5,
    lineHeight: 46,
    marginBottom: 12,
  },
  headlinePoison: {
    fontSize: 42,
    fontWeight: '900',
    color: COLORS.onSurface,
    letterSpacing: -1.5,
    lineHeight: 46,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.onSurfaceVariant,
    lineHeight: 24,
  },
  poisonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  poisonCard: {
    width: (width - 60) / 2,
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 20,
    padding: 20,
  },
  poisonCardSelected: {
    backgroundColor: COLORS.primary + '18',
    borderWidth: 2,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  poisonIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  poisonIconBoxSelected: {
    backgroundColor: COLORS.primary,
  },
  poisonCategory: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: COLORS.onSurfaceVariant,
    marginBottom: 4,
  },
  poisonTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.onSurface,
    letterSpacing: -0.5,
  },
  goalList: {
    gap: 12,
  },
  goalCard: {
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  goalCardSelected: {
    backgroundColor: COLORS.surfaceContainerHighest,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  goalCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.onSurface,
  },
  goalRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalRadioSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  goalDescription: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: COLORS.onSurfaceVariant,
  },
  goalAccentLine: {
    position: 'absolute',
    bottom: -2,
    left: 20,
    right: 20,
    height: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 1,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  interruptContainer: {
    alignItems: 'center',
    paddingTop: 16,
  },
  illustrationBox: {
    width: width - 48,
    aspectRatio: 1,
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    overflow: 'hidden',
  },
  outerRing: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: COLORS.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: COLORS.primary + '30',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  floatBadge: {
    position: 'absolute',
    width: 44,
    height: 44,
    backgroundColor: COLORS.surfaceContainerHighest,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  interruptHeadline: {
    fontSize: 44,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: -1.5,
    lineHeight: 52,
    textAlign: 'center',
    marginBottom: 16,
  },
  interruptSubtitle: {
    fontSize: 16,
    color: COLORS.onSurfaceVariant,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 280,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'column',
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: COLORS.black,
    gap: 4,
  },
  skipRow: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  skipText: {
    color: COLORS.onSurfaceVariant,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 2,
    paddingVertical: 16,
  },
  nextButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    color: COLORS.black,
    fontWeight: '900',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 2.5,
  },
});
