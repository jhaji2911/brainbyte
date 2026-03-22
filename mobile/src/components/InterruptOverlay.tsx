import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Byte } from '../types';
import { COLORS } from '../theme';

const { width } = Dimensions.get('window');

interface Props {
  visible: boolean;
  byte: Byte | null;
  onDismiss: () => void;
}

type Phase = 'in' | 'hold' | 'out';

const PHASE_LABELS: Record<Phase, string> = {
  in: 'Breathe In...',
  hold: 'Hold.',
  out: 'Breathe Out...',
};

const PHASE_COLORS: Record<Phase, string> = {
  in: COLORS.secondary,
  hold: COLORS.primary,
  out: COLORS.primaryDim,
};

export const InterruptOverlay: React.FC<Props> = ({ visible, byte, onDismiss }) => {
  const breathScale = React.useRef(new Animated.Value(0.45)).current;
  const breathOpacity = React.useRef(new Animated.Value(0.25)).current;
  const ringScale = React.useRef(new Animated.Value(0.35)).current;
  const overlayOpacity = React.useRef(new Animated.Value(0)).current;
  const cardSlide = React.useRef(new Animated.Value(40)).current;

  const [phase, setPhase] = React.useState<Phase>('in');
  const isMounted = React.useRef(false);
  const animRef = React.useRef<Animated.CompositeAnimation | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(cardSlide, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]).start();

      breathScale.setValue(0.45);
      breathOpacity.setValue(0.25);
      ringScale.setValue(0.35);
      startCycle();
    } else {
      stopAll();
      overlayOpacity.setValue(0);
      cardSlide.setValue(40);
    }

    return stopAll;
  }, [visible]);

  const stopAll = () => {
    animRef.current?.stop();
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const runPhaseIn = () => {
    if (!isMounted.current) return;
    setPhase('in');

    animRef.current = Animated.parallel([
      Animated.timing(breathScale, { toValue: 1, duration: 4000, useNativeDriver: true }),
      Animated.timing(breathOpacity, { toValue: 0.75, duration: 4000, useNativeDriver: true }),
      Animated.timing(ringScale, { toValue: 1.15, duration: 4000, useNativeDriver: true }),
    ]);

    animRef.current.start(({ finished }) => {
      if (!finished || !isMounted.current) return;
      setPhase('hold');
      timerRef.current = setTimeout(runPhaseOut, 2000);
    });
  };

  const runPhaseOut = () => {
    if (!isMounted.current) return;
    setPhase('out');

    animRef.current = Animated.parallel([
      Animated.timing(breathScale, { toValue: 0.45, duration: 4000, useNativeDriver: true }),
      Animated.timing(breathOpacity, { toValue: 0.25, duration: 4000, useNativeDriver: true }),
      Animated.timing(ringScale, { toValue: 0.35, duration: 4000, useNativeDriver: true }),
    ]);

    animRef.current.start(({ finished }) => {
      if (!finished || !isMounted.current) return;
      timerRef.current = setTimeout(runPhaseIn, 500);
    });
  };

  const startCycle = () => {
    timerRef.current = setTimeout(runPhaseIn, 300);
  };

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss();
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        {/* Instagram badge */}
        <View style={styles.badge}>
          <Feather name="instagram" size={14} color={COLORS.onSurfaceVariant} />
          <Text style={styles.badgeText}>Instagram scroll detected</Text>
        </View>

        <Text style={styles.headline}>Step away.{'\n'}Breathe first.</Text>

        {/* Breathing visuals */}
        <View style={styles.breathWrap}>
          {/* Outer pulsing ring */}
          <Animated.View
            style={[
              styles.breathRing,
              { transform: [{ scale: ringScale }], borderColor: phase === 'in' ? COLORS.secondary : COLORS.primaryDim },
            ]}
          />
          {/* Main circle */}
          <Animated.View
            style={[
              styles.breathCircle,
              { transform: [{ scale: breathScale }], opacity: breathOpacity },
            ]}
          />
          {/* Center dot */}
          <View style={styles.centerDot} />
          {/* Phase label */}
          <Text style={[styles.phaseText, { color: PHASE_COLORS[phase] }]}>
            {PHASE_LABELS[phase]}
          </Text>
        </View>

        {/* Quick byte */}
        {byte && (
          <Animated.View
            style={[styles.byteCard, { transform: [{ translateY: cardSlide }] }]}
          >
            <View style={styles.byteCategoryRow}>
              <View style={styles.byteDot} />
              <Text style={styles.byteCategory}>{byte.category}</Text>
            </View>
            <Text style={styles.byteTitle}>{byte.title}</Text>
            <Text style={styles.byteContent} numberOfLines={3}>
              {byte.content}
            </Text>
          </Animated.View>
        )}

        <TouchableOpacity
          style={styles.dismissBtn}
          onPress={handleDismiss}
          activeOpacity={0.85}
        >
          <Text style={styles.dismissText}>Got it. Back to learning.</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.93)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceContainerHigh,
    borderRadius: 50,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 22,
  },
  badgeText: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    fontWeight: '600',
  },
  headline: {
    fontSize: 34,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: -1,
    textAlign: 'center',
    marginBottom: 36,
    lineHeight: 40,
  },
  breathWrap: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 44,
  },
  breathRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  breathCircle: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: COLORS.primary,
  },
  centerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.white,
    zIndex: 2,
  },
  phaseText: {
    position: 'absolute',
    bottom: -28,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  byteCard: {
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 20,
    padding: 18,
    width: width - 56,
    marginBottom: 92,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  byteCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  byteDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  byteCategory: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  byteTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.white,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  byteContent: {
    fontSize: 13,
    color: COLORS.onSurfaceVariant,
    lineHeight: 20,
  },
  dismissBtn: {
    position: 'absolute',
    bottom: 48,
    left: 28,
    right: 28,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.black,
  },
});
