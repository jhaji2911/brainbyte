import React from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomNav } from './BottomNav';
import { InitialsAvatar } from './InitialsAvatar';
import { Screen, UserProfile } from '../types';
import { COLORS } from '../theme';

interface Props {
  user: UserProfile | null;
  savedBytesCount: number;
  interruptsEnabled: boolean;
  onNavigate: (screen: Screen) => void;
  onToggleInterrupts: (enabled: boolean) => Promise<void>;
  onTestInterrupt: () => void;
  onUpdateAvatar?: (uri: string) => Promise<void>;
}

function getLevelInfo(xp: number) {
  const level = Math.floor(xp / 500) + 1;
  const xpInLevel = xp % 500;
  const xpForNext = 500;
  return { level, xpInLevel, xpForNext, progress: xpInLevel / xpForNext };
}

export const Profile: React.FC<Props> = ({
  user,
  savedBytesCount,
  interruptsEnabled,
  onNavigate,
  onToggleInterrupts,
  onTestInterrupt,
  onUpdateAvatar,
}) => {
  const insets = useSafeAreaInsets();
  const [toggling, setToggling] = React.useState(false);
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
  const barWidth = React.useRef(new Animated.Value(0)).current;
  const headerOpacity = React.useRef(new Animated.Value(0)).current;
  const headerSlide = React.useRef(new Animated.Value(24)).current;

  const xp = user?.xp ?? 0;
  const { level, xpInLevel, xpForNext, progress } = getLevelInfo(xp);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(headerSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
    Animated.timing(barWidth, {
      toValue: progress,
      duration: 900,
      delay: 400,
      useNativeDriver: false,
    }).start();
  }, []);

  const handlePickImage = async () => {
    if (!onUpdateAvatar) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingAvatar(true);
    try {
      await onUpdateAvatar(result.assets[0].uri);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleToggle = async (newValue: boolean) => {
    if (toggling) return;
    setToggling(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await onToggleInterrupts(newValue);
    } finally {
      setToggling(false);
    }
  };

  const xpBarInterpolated = barWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.scroll, { opacity: headerOpacity, transform: [{ translateY: headerSlide }] }]}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
        >
          {/* Top bar */}
          <View style={styles.topBar}>
            <Text style={styles.pageTitle}>Profile</Text>
          </View>

          {/* Avatar & identity */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatarWrapper}
              onPress={handlePickImage}
              activeOpacity={onUpdateAvatar ? 0.8 : 1}
              disabled={uploadingAvatar}
            >
              {user?.avatar && !user.avatar.includes('pravatar') ? (
                <Image source={{ uri: user.avatar }} style={styles.avatarImg} />
              ) : (
                <InitialsAvatar
                  name={user?.name ?? 'Guest'}
                  size={88}
                  borderColor={COLORS.primary}
                  borderWidth={2}
                />
              )}
              {onUpdateAvatar && (
                <View style={styles.avatarEditBadge}>
                  <Feather name={uploadingAvatar ? 'loader' : 'camera'} size={12} color={COLORS.black} />
                </View>
              )}
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeText}>{level}</Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.userName}>{user?.name ?? 'Guest Explorer'}</Text>
            {user ? (
              <View style={styles.rankRow}>
                <Feather name="award" size={12} color={COLORS.secondary} />
                <Text style={styles.rankText}>Rank #{user.rank}</Text>
              </View>
            ) : (
              <Text style={styles.guestHint}>Sign in to save your progress</Text>
            )}
          </View>

          {/* XP Progress */}
          <View style={styles.xpSection}>
            <View style={styles.xpLabelRow}>
              <Text style={styles.xpLabel}>
                Level {level} · {xpInLevel} / {xpForNext} XP
              </Text>
              <Text style={styles.xpNext}>Level {level + 1}</Text>
            </View>
            <View style={styles.xpTrack}>
              <Animated.View style={[styles.xpFill, { width: xpBarInterpolated }]} />
            </View>
          </View>

          {/* Stats grid */}
          <View style={styles.statsGrid}>
            <StatCard
              icon="zap"
              label="Streak"
              value={`${user?.streak ?? 0}d`}
              accent={COLORS.secondary}
            />
            <StatCard
              icon="clock"
              label="Focus Min"
              value={`${user?.focusMinutes ?? 0}`}
              accent={COLORS.primary}
            />
            <StatCard
              icon="bookmark"
              label="Saved"
              value={`${savedBytesCount}`}
              accent={COLORS.primary}
              onPress={() => onNavigate('library')}
            />
            <StatCard
              icon="layers"
              label="Learned"
              value={`${user?.learnedBytes ?? 0}`}
              accent={COLORS.secondary}
            />
          </View>

          {/* Interrupts section */}
          <Text style={styles.sectionLabel}>INTERRUPTS</Text>
          <View style={styles.interruptCard}>
            <View style={styles.interruptRow}>
              <View style={styles.interruptIconBox}>
                <Feather name="bell" size={18} color={COLORS.primary} />
              </View>
              <View style={styles.interruptTextBlock}>
                <Text style={styles.interruptTitle}>Instagram Interrupt</Text>
                <Text style={styles.interruptSubtitle}>
                  {interruptsEnabled
                    ? 'Active — breathe & micro-learn on doomscroll'
                    : 'Off — tap toggle to request overlay permission'}
                </Text>
              </View>
              <Switch
                value={interruptsEnabled}
                onValueChange={handleToggle}
                disabled={toggling}
                trackColor={{ false: COLORS.surfaceContainerHighest, true: COLORS.primaryDim }}
                thumbColor={interruptsEnabled ? COLORS.primary : COLORS.onSurfaceVariant}
              />
            </View>

            {interruptsEnabled && (
              <TouchableOpacity
                style={styles.testBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onTestInterrupt();
                }}
                activeOpacity={0.8}
              >
                <Feather name="play-circle" size={15} color={COLORS.black} />
                <Text style={styles.testBtnText}>Send Test Interrupt</Text>
              </TouchableOpacity>
            )}
          </View>

          {!user && (
            <TouchableOpacity
              style={styles.signInPrompt}
              onPress={() => onNavigate('register')}
              activeOpacity={0.85}
            >
              <Feather name="user-plus" size={16} color={COLORS.black} />
              <Text style={styles.signInPromptText}>Create Account to Sync Progress</Text>
            </TouchableOpacity>
          )}

          {/* DEV panel removed — test button above triggers native overlay */}
        </ScrollView>
      </Animated.View>

      <BottomNav active="profile" onNavigate={onNavigate} />
    </View>
  );
};

const StatCard = ({
  icon,
  label,
  value,
  accent,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  value: string;
  accent: string;
  onPress?: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={onPress ? 0.72 : 1}
    style={styles.statCard}
  >
    <Feather name={icon} size={18} color={accent} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: -1,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarImg: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  avatarEditBadge: {
    position: 'absolute',
    top: 0,
    right: -4,
    backgroundColor: COLORS.secondary,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: COLORS.primary,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.black,
  },
  userName: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: -0.5,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  rankText: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  guestHint: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    marginTop: 4,
  },
  xpSection: {
    marginBottom: 24,
  },
  xpLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  xpLabel: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    fontWeight: '600',
  },
  xpNext: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
  },
  xpTrack: {
    height: 6,
    backgroundColor: COLORS.surfaceContainerHighest,
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.white,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginBottom: 10,
  },
  interruptCard: {
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
  },
  interruptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  interruptIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  interruptTextBlock: {
    flex: 1,
  },
  interruptTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  interruptSubtitle: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    lineHeight: 16,
    marginTop: 2,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    justifyContent: 'center',
  },
  testBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.black,
  },
  signInPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 16,
    justifyContent: 'center',
    marginTop: 4,
  },
  signInPromptText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.black,
  },
  devPanel: {
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 16,
    padding: 16,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  devCountdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  devCountdownText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  devButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  devBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  devBtnNow: {
    backgroundColor: COLORS.primary,
    borderColor: 'transparent',
  },
  devBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
});
