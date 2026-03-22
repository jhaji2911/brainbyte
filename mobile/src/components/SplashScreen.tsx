import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { COLORS } from '../theme';

interface Props {
  isReady: boolean;
  progress: number;
  statusLabel: string;
  onComplete: () => void;
}

export const SplashScreen: React.FC<Props> = ({ isReady, progress, statusLabel, onComplete }) => {
  const opacity = React.useRef(new Animated.Value(0)).current;
  const scale = React.useRef(new Animated.Value(0.8)).current;
  const progressWidth = React.useRef(new Animated.Value(0)).current;
  const shimmerX = React.useRef(new Animated.Value(-100)).current;
  const hasCompletedRef = React.useRef(false);
  const minDelayReachedRef = React.useRef(false);
  // Keeps a current reference to isReady so the timer closure is never stale
  const isReadyRef = React.useRef(isReady);
  isReadyRef.current = isReady;
  const onCompleteRef = React.useRef(onComplete);
  onCompleteRef.current = onComplete;

  React.useEffect(() => {
    // Haptic sequence: logo pop → shimmer tick → completion thud
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const t1 = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 350);
    const t2 = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 700);
    const t3 = setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 2300);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.timing(shimmerX, {
        toValue: 200,
        duration: 1500,
        useNativeDriver: true,
      })
    ).start();

    const timer = setTimeout(() => {
      minDelayReachedRef.current = true;
      if (isReadyRef.current && !hasCompletedRef.current) {
        hasCompletedRef.current = true;
        onCompleteRef.current();
      }
    }, 2500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(timer);
    };
  }, []);

  React.useEffect(() => {
    Animated.timing(progressWidth, {
      toValue: Math.max(0.12, Math.min(progress, 1)),
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress, progressWidth]);

  React.useEffect(() => {
    if (isReady && minDelayReachedRef.current && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      onCompleteRef.current();
    }
  }, [isReady]);

  const progressWidthInterpolated = progressWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      {/* Logo */}
      <Animated.View style={[styles.logoWrapper, { transform: [{ scale }] }]}>
        <View style={styles.glowRing} />
        <View style={styles.logoBox}>
          <Feather name="zap" size={60} color={COLORS.primary} />
          <Animated.View
            style={[
              styles.shimmer,
              { transform: [{ translateX: shimmerX }] },
            ]}
          />
        </View>
      </Animated.View>

      {/* Title */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>BrainByte</Text>
        <View style={styles.subtitleRow}>
          <View style={styles.divider} />
          <Text style={styles.subtitle}>NEURAL ACCELERATOR</Text>
          <View style={styles.divider} />
        </View>
      </View>

      {/* Version badge */}
      <View style={styles.versionBadge}>
        <Text style={styles.versionText}>v0.1.0-beta</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressLabelRow}>
          <Text style={styles.progressLabel}>{statusLabel}</Text>
          <Text style={styles.progressPercent}>{Math.round(progress * 100)}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[styles.progressFill, { width: progressWidthInterpolated }]}
          />
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.black,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 48,
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  glowRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: COLORS.primary,
    opacity: 0.08,
  },
  logoBox: {
    width: 96,
    height: 96,
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 20,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  titleContainer: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 48,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: -2,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  divider: {
    height: 1,
    width: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 3,
    opacity: 0.8,
  },
  versionBadge: {
    position: 'absolute',
    top: 56,
    left: 24,
  },
  versionText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.onSurfaceVariant,
    letterSpacing: 2,
    textTransform: 'uppercase',
    opacity: 0.4,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 48,
    left: 48,
    right: 48,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    fontWeight: '500',
  },
  progressPercent: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '700',
  },
  progressTrack: {
    height: 2,
    backgroundColor: COLORS.surfaceContainerHighest,
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 1,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
});
