import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomNav } from './BottomNav';
import { InitialsAvatar } from './InitialsAvatar';
import { Byte, Screen, UserProfile } from '../types';
import { COLORS } from '../theme';

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = 100;

interface Props {
  bytes: Byte[];
  user: UserProfile | null;
  onSelectByte: (id: string) => void;
  onNavigate: (screen: Screen) => void;
  onSaveByte: (id: string) => void;
}

export const DopamineFeed: React.FC<Props> = ({
  bytes,
  user,
  onSelectByte,
  onNavigate,
  onSaveByte,
}) => {
  const insets = useSafeAreaInsets();
  const [currentByteIndex, setCurrentByteIndex] = React.useState(0);
  const [showSaveToast, setShowSaveToast] = React.useState(false);
  const toastOpacity = React.useRef(new Animated.Value(0)).current;
  const toastY = React.useRef(new Animated.Value(60)).current;
  const cardX = React.useRef(new Animated.Value(0)).current;
  const cardOpacity = React.useRef(new Animated.Value(1)).current;

  const byte = bytes.length > 0 ? bytes[currentByteIndex % bytes.length] : null;

  // Refs so the PanResponder closure always sees the latest values
  const byteRef = React.useRef(byte);
  const onSaveByteRef = React.useRef(onSaveByte);
  const showToastRef = React.useRef<() => void>(null as unknown as () => void);
  const toastDismissTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => { byteRef.current = byte; }, [byte]);
  React.useEffect(() => { onSaveByteRef.current = onSaveByte; }, [onSaveByte]);

  const showToast = React.useCallback(() => {
    // Cancel any in-flight dismiss so rapid swipes don't stack
    if (toastDismissTimer.current) clearTimeout(toastDismissTimer.current);

    setShowSaveToast(true);
    toastOpacity.stopAnimation();
    toastY.stopAnimation();

    Animated.parallel([
      Animated.timing(toastOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(toastY, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();

    // Dismiss unconditionally after 1.5 s — no dependency on animation callback
    toastDismissTimer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(toastY, { toValue: 60, duration: 250, useNativeDriver: true }),
      ]).start(() => setShowSaveToast(false));
    }, 1500);
  }, [toastOpacity, toastY]);

  // Clean up timer on unmount
  React.useEffect(() => () => {
    if (toastDismissTimer.current) clearTimeout(toastDismissTimer.current);
  }, []);

  React.useEffect(() => { showToastRef.current = showToast; }, [showToast]);

  const dismissCard = (direction: 'left' | 'right') => {
    Animated.parallel([
      Animated.timing(cardX, {
        toValue: direction === 'left' ? -width : width,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      setCurrentByteIndex((prev) => prev + 1);
      cardX.setValue(0);
      cardOpacity.setValue(1);
    });
  };

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 10,
      onPanResponderMove: (_, gestureState) => {
        cardX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -SWIPE_THRESHOLD) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          dismissCard('left');
        } else if (gestureState.dx > SWIPE_THRESHOLD) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          const current = byteRef.current;
          if (current) onSaveByteRef.current(current.id);
          showToastRef.current?.();
          dismissCard('right');
        } else {
          Animated.spring(cardX, { toValue: 0, friction: 5, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const cardRotation = cardX.interpolate({
    inputRange: [-width / 2, 0, width / 2],
    outputRange: ['-8deg', '0deg', '8deg'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.profileRow}
          onPress={() => onNavigate('profile')}
          activeOpacity={0.7}
        >
          <View style={styles.avatar}>
            {user?.avatar && !user.avatar.includes('pravatar') ? (
              <Image source={{ uri: user.avatar }} style={styles.avatarImg} />
            ) : (
              <InitialsAvatar
                name={user?.name ?? 'BB'}
                size={36}
                borderWidth={0}
              />
            )}
          </View>
          <Text style={styles.appName}>BrainByte</Text>
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <TouchableOpacity onPress={() => onNavigate('focus')} activeOpacity={0.7}>
            <Text style={styles.statLabel}>Focus</Text>
            <Text style={styles.statValueBlue}>{user?.focusMinutes ?? 247}</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity onPress={() => onNavigate('library')} activeOpacity={0.7}>
            <Text style={styles.statLabel}>Learned</Text>
            <Text style={styles.statValuePurple}>{user?.learnedBytes ?? 12}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => onNavigate('leaderboard')} activeOpacity={0.7}>
          <Text style={styles.streakBadge}>🔥 {user?.streak ?? 12}</Text>
        </TouchableOpacity>
      </View>

      {/* Card */}
      <View style={styles.cardArea}>
        {byte ? (
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.card,
            {
              transform: [{ translateX: cardX }, { rotate: cardRotation }],
              opacity: cardOpacity,
            },
          ]}
        >
          {/* Swipe-right save hint */}
          <Animated.View
            style={[
              styles.swipeHint,
              styles.swipeHintRight,
              {
                opacity: cardX.interpolate({
                  inputRange: [20, 80],
                  outputRange: [0, 1],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          >
            <Feather name="bookmark" size={18} color={COLORS.primary} />
            <Text style={styles.swipeHintText}>SAVE</Text>
          </Animated.View>

          {/* Swipe-left dismiss hint */}
          <Animated.View
            style={[
              styles.swipeHint,
              styles.swipeHintLeft,
              {
                opacity: cardX.interpolate({
                  inputRange: [-80, -20],
                  outputRange: [1, 0],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          >
            <Feather name="x" size={18} color={COLORS.onSurfaceVariant} />
            <Text style={[styles.swipeHintText, { color: COLORS.onSurfaceVariant }]}>SKIP</Text>
          </Animated.View>

          {/* Gradient overlays */}
          <View style={styles.cardGradientTopRight} />
          <View style={styles.cardGradientBottomLeft} />

          <View style={styles.cardContent}>
            {/* Top row */}
            <View style={styles.cardTopRow}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{byte.category}</Text>
              </View>
              <TouchableOpacity>
                <Feather name="more-vertical" size={20} color={COLORS.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{byte.title}</Text>
              <Text style={styles.cardContent_}>{byte.content}</Text>
            </View>

            {/* Curator + Play */}
            <View style={styles.cardFooter}>
              {byte.curatedBy ? (
                <View style={styles.curatorRow}>
                  <Image
                    source={{ uri: byte.curatedBy.avatar }}
                    style={styles.curatorAvatar}
                  />
                  <View>
                    <Text style={styles.curatedByLabel}>Curated By</Text>
                    <Text style={styles.curatorName}>{byte.curatedBy.name}</Text>
                  </View>
                </View>
              ) : (
                <View style={{ flex: 1 }} />
              )}
              <TouchableOpacity
                style={styles.playButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onSelectByte(byte.id);
                }}
                activeOpacity={0.85}
              >
                <Feather name="play" size={22} color={COLORS.black} />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
        ) : (
          <View style={[styles.card, styles.emptyCard]}>
            <Text style={styles.cardTitle}>No bytes available</Text>
            <Text style={styles.cardContent_}>Start the API and reload the app.</Text>
          </View>
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        <InteractionButton
          icon="x"
          label="Dismiss"
          color={COLORS.onSurfaceVariant}
          size="normal"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            dismissCard('left');
          }}
        />
        <InteractionButton
          icon="zap"
          label="Learn More"
          color={COLORS.black}
          size="large"
          onPress={() => {
            if (!byte) return;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onSelectByte(byte.id);
          }}
        />
        <InteractionButton
          icon="bookmark"
          label="Save"
          color={COLORS.onSurfaceVariant}
          size="normal"
          onPress={() => {
            if (!byte) return;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onSaveByte(byte.id);
            showToast();
            dismissCard('right');
          }}
        />
      </View>

      {/* Toast */}
      {showSaveToast && (
        <Animated.View
          style={[
            styles.toast,
            { opacity: toastOpacity, transform: [{ translateY: toastY }] },
          ]}
        >
          <Text style={styles.toastText}>Byte saved to Library! 📚</Text>
        </Animated.View>
      )}

      <BottomNav active="feed" onNavigate={onNavigate} />
    </View>
  );
};

const InteractionButton = ({
  icon,
  label,
  color,
  size,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  color: string;
  size: 'normal' | 'large';
  onPress: () => void;
}) => (
  <View style={iBtnStyles.wrapper}>
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        iBtnStyles.btn,
        size === 'large' ? iBtnStyles.btnLarge : iBtnStyles.btnNormal,
      ]}
    >
      <Feather
        name={icon}
        size={size === 'large' ? 34 : 26}
        color={color}
      />
    </TouchableOpacity>
    <Text style={[iBtnStyles.label, { color }]}>{label}</Text>
  </View>
);

const iBtnStyles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: 10 },
  btn: {
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  btnNormal: {
    width: 64,
    height: 64,
    backgroundColor: 'transparent',
  },
  btnLarge: {
    width: 80,
    height: 80,
    backgroundColor: COLORS.primary,
    borderColor: 'transparent',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 12,
    backgroundColor: COLORS.surfaceContainerLow + 'cc',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceContainerHighest,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  appName: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: -1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 50,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: COLORS.onSurfaceVariant,
    marginBottom: 1,
  },
  statValueBlue: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.secondary,
  },
  statValuePurple: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.primary,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  streakBadge: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.primary,
  },
  cardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    paddingBottom: 140,
    paddingHorizontal: 16,
  },
  card: {
    width: width - 32,
    height: (width - 32) * 1.25,
    backgroundColor: COLORS.surfaceContainerHighest,
    borderRadius: 36,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 12,
  },
  swipeHint: {
    position: 'absolute',
    top: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 50,
    zIndex: 10,
  },
  swipeHintRight: {
    right: 20,
    backgroundColor: COLORS.primary + '22',
    borderWidth: 1,
    borderColor: COLORS.primary + '60',
  },
  swipeHintLeft: {
    left: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  swipeHintText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: COLORS.primary,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 320,
  },
  cardGradientTopRight: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: COLORS.primary,
    opacity: 0.18,
  },
  cardGradientBottomLeft: {
    position: 'absolute',
    bottom: -40,
    left: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: COLORS.secondary,
    opacity: 0.18,
  },
  cardContent: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    backgroundColor: COLORS.primary + '30',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 50,
  },
  categoryBadgeText: {
    color: COLORS.primary,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  cardBody: {
    gap: 12,
  },
  cardTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.onSurface,
    letterSpacing: -1.5,
    lineHeight: 38,
  },
  cardContent_: {
    fontSize: 16,
    color: COLORS.onSurfaceVariant,
    lineHeight: 24,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  curatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(10,10,10,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  curatorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  curatedByLabel: {
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: COLORS.onSurfaceVariant,
  },
  curatorName: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  actionsRow: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  toast: {
    position: 'absolute',
    bottom: 110,
    alignSelf: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 50,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 100,
  },
  toastText: {
    color: COLORS.black,
    fontWeight: '700',
    fontSize: 14,
  },
});
