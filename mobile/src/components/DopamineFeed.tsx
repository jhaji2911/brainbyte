import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  PanResponder,
  Dimensions,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomNav } from "./BottomNav";
import { InitialsAvatar } from "./InitialsAvatar";
import { GameCard } from "./GameCard";
import { Byte, Screen, UserProfile } from "../types";
import { COLORS } from "../theme";

const { width, height } = Dimensions.get("window");
const SWIPE_THRESHOLD = 100;
const CARD_WIDTH = width - 32;
const CARD_HEIGHT = Math.min(CARD_WIDTH * 1.35, height * 0.65);

interface Props {
  bytes: Byte[];
  user: UserProfile | null;
  onSelectByte: (id: string) => void;
  onNavigate: (screen: Screen) => void;
  onSaveByte: (id: string) => void;
  onSkipByte?: (id: string, dwellTimeMs: number) => void;
  authToken?: string | null;
}

export const DopamineFeed: React.FC<Props> = ({
  bytes,
  user,
  onSelectByte,
  onNavigate,
  onSaveByte,
  onSkipByte,
}) => {
  const insets = useSafeAreaInsets();
  const [currentByteIndex, setCurrentByteIndex] = React.useState(0);
  const [showSaveToast, setShowSaveToast] = React.useState(false);
  const toastOpacity = React.useRef(new Animated.Value(0)).current;
  const toastY = React.useRef(new Animated.Value(60)).current;
  const cardX = React.useRef(new Animated.Value(0)).current;
  const cardOpacity = React.useRef(new Animated.Value(1)).current;

  const byte = bytes.length > 0 ? bytes[currentByteIndex % bytes.length] : null;

  // ── Dwell time tracking ──────────────────────────────────────────
  const byteStartTime = React.useRef(Date.now());
  React.useEffect(() => {
    byteStartTime.current = Date.now();
  }, [currentByteIndex]);

  const getDwellTimeMs = () => Date.now() - byteStartTime.current;

  const byteRef = React.useRef(byte);
  const onSaveByteRef = React.useRef(onSaveByte);
  const onSkipByteRef = React.useRef(onSkipByte);
  const showToastRef = React.useRef<() => void>(null as unknown as () => void);
  const toastDismissTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // ── Game overlay state ──
  const [gameVisible, setGameVisible] = React.useState(false);
  const [gameByte, setGameByte] = React.useState<Byte | null>(null);
  React.useEffect(() => {
    byteRef.current = byte;
  }, [byte]);
  React.useEffect(() => {
    onSaveByteRef.current = onSaveByte;
  }, [onSaveByte]);
  React.useEffect(() => {
    onSkipByteRef.current = onSkipByte;
  }, [onSkipByte]);

  const showToast = React.useCallback(() => {
    if (toastDismissTimer.current) clearTimeout(toastDismissTimer.current);
    setShowSaveToast(true);
    toastOpacity.stopAnimation();
    toastY.stopAnimation();
    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(toastY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    toastDismissTimer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(toastY, {
          toValue: 60,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => setShowSaveToast(false));
    }, 1600);
  }, [toastOpacity, toastY]);

  React.useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);
  React.useEffect(
    () => () => {
      if (toastDismissTimer.current) clearTimeout(toastDismissTimer.current);
    },
    [],
  );

  const dismissCard = (direction: "left" | "right") => {
    Animated.parallel([
      Animated.timing(cardX, {
        toValue: direction === "left" ? -width : width,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentByteIndex((prev) => prev + 1);
      cardX.setValue(0);
      cardOpacity.setValue(1);
    });
  };

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 10,
      onPanResponderMove: (_, gs) => {
        cardX.setValue(gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -SWIPE_THRESHOLD) {
          const current = byteRef.current;
          if (current) onSkipByteRef.current?.(current.id, getDwellTimeMs());
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          dismissCard("left");
        } else if (gs.dx > SWIPE_THRESHOLD) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          const current = byteRef.current;
          if (current) onSaveByteRef.current(current.id);
          showToastRef.current?.();
          dismissCard("right");
        } else {
          Animated.spring(cardX, {
            toValue: 0,
            friction: 5,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  const cardRotation = cardX.interpolate({
    inputRange: [-width / 2, 0, width / 2],
    outputRange: ["-6deg", "0deg", "6deg"],
    extrapolate: "clamp",
  });

  const isGame =
    byte?.format &&
    ["quiz", "word_scramble", "fill_blank"].includes(byte.format);
  const diffLabel =
    byte?.difficulty != null
      ? byte.difficulty <= 0.3
        ? "Beginner"
        : byte.difficulty <= 0.7
          ? "Intermediate"
          : "Advanced"
      : "";

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.profileRow}
          onPress={() => onNavigate("profile")}
          activeOpacity={0.7}
        >
          <View style={styles.avatar}>
            {user?.avatar && !user.avatar.includes("pravatar") ? (
              <Image source={{ uri: user.avatar }} style={styles.avatarImg} />
            ) : (
              <InitialsAvatar
                name={user?.name ?? "BB"}
                size={36}
                borderWidth={0}
              />
            )}
          </View>
          <Text style={styles.appName}>BrainByte</Text>
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <TouchableOpacity
            onPress={() => onNavigate("library")}
            activeOpacity={0.7}
            style={styles.statItem}
          >
            <Text style={styles.statLabel}>XP</Text>
            <Text style={styles.statValue}>{user?.xp ?? 0}</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity
            onPress={() => onNavigate("leaderboard")}
            activeOpacity={0.7}
            style={styles.statItem}
          >
            <View style={styles.streakRow}>
              <Text style={styles.statLabel}>Streak</Text>
            </View>
            <View style={styles.streakBadge}>
              <Feather name="activity" size={12} color={COLORS.secondary} />
              <Text style={styles.streakValue}>{user?.streak ?? 0}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Card Area ── */}
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
            {/* Swipe hints */}
            <Animated.View
              style={[
                styles.swipeHint,
                styles.swipeHintRight,
                {
                  opacity: cardX.interpolate({
                    inputRange: [20, 80],
                    outputRange: [0, 1],
                    extrapolate: "clamp",
                  }),
                },
              ]}
            >
              <Feather name="bookmark" size={16} color={COLORS.primary} />
              <Text style={styles.swipeHintText}>SAVE</Text>
            </Animated.View>
            <Animated.View
              style={[
                styles.swipeHint,
                styles.swipeHintLeft,
                {
                  opacity: cardX.interpolate({
                    inputRange: [-80, -20],
                    outputRange: [1, 0],
                    extrapolate: "clamp",
                  }),
                },
              ]}
            >
              <Feather name="x" size={16} color={COLORS.onSurfaceVariant} />
              <Text
                style={[
                  styles.swipeHintText,
                  { color: COLORS.onSurfaceVariant },
                ]}
              >
                SKIP
              </Text>
            </Animated.View>

            {/* Background gradients */}
            <View style={styles.cardGlow} />

            {/* Card Content */}
            <View style={styles.cardInner}>
              {/* Top: category + difficulty */}
              <View style={styles.cardTopRow}>
                <View style={styles.categoryBadge}>
                  <View style={styles.categoryDot} />
                  <Text style={styles.categoryText}>
                    {byte.category || "General"}
                  </Text>
                </View>
                {diffLabel ? (
                  <View style={styles.diffBadge}>
                    <Text style={styles.diffText}>{diffLabel}</Text>
                  </View>
                ) : null}
              </View>

              {/* Body */}
              {isGame ? (
                /* ── Game Preview Card ── */
                <View style={styles.gamePreview}>
                  <View style={styles.gameIconBox}>
                    <View style={styles.gameIcon}>
                      {byte.format === "quiz" ? (
                        <Feather
                          name="help-circle"
                          size={36}
                          color={COLORS.secondary}
                        />
                      ) : byte.format === "word_scramble" ? (
                        <Feather
                          name="type"
                          size={36}
                          color={COLORS.secondary}
                        />
                      ) : (
                        <Feather
                          name="edit-3"
                          size={36}
                          color={COLORS.secondary}
                        />
                      )}
                    </View>
                  </View>
                  <Text style={styles.gameLabel}>
                    {byte.format === "quiz"
                      ? "QUIZ"
                      : byte.format === "word_scramble"
                        ? "WORD SCRAMBLE"
                        : "FILL IN THE BLANK"}
                  </Text>
                  <Text style={styles.gameTitle} numberOfLines={2}>
                    {byte.title}
                  </Text>
                  <Text style={styles.gameHint}>
                    Tap the play button to start
                  </Text>
                  <TouchableOpacity
                    style={styles.gamePlayBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setGameByte(byte);
                      setGameVisible(true);
                    }}
                    activeOpacity={0.85}
                  >
                    <Feather name="play" size={20} color={COLORS.black} />
                    <Text style={styles.gamePlayText}>Play Game</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* ── Regular Content Card ── */
                <View style={styles.contentBody}>
                  <Text style={styles.cardTitle} numberOfLines={3}>
                    {byte.title}
                  </Text>
                  <Text style={styles.cardContent} numberOfLines={6}>
                    {byte.content}
                  </Text>
                </View>
              )}

              {/* Footer: agent row + play button */}
              <View style={styles.cardFooter}>
                {byte.source ? (
                  <View style={styles.agentRow}>
                    <Feather
                      name={
                        byte.source.includes("reuse") ? "refresh-cw" : "cpu"
                      }
                      size={11}
                      color={COLORS.primary}
                    />
                    <Text style={styles.agentText}>
                      {byte.source.includes("reuse")
                        ? "Reused byte"
                        : "Agent-curated"}
                    </Text>
                  </View>
                ) : (
                  <View style={{ flex: 1 }} />
                )}
                {!isGame ? (
                  <TouchableOpacity
                    style={styles.playBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      onSelectByte(byte.id);
                    }}
                    activeOpacity={0.85}
                  >
                    <Feather
                      name="arrow-right"
                      size={22}
                      color={COLORS.black}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </Animated.View>
        ) : (
          /* ── Empty / Loading State ── */
          <View style={[styles.card, styles.emptyCard]}>
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loaderTitle}>Curating bytes...</Text>
              <Text style={styles.loaderSub}>
                The agent is preparing knowledge just for you
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* ── Action Buttons ── */}
      <View style={[styles.actionsRow, { paddingBottom: insets.bottom + 110 }]}>
        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.7}
          onPress={() => {
            if (byte) onSkipByteRef.current?.(byte.id, getDwellTimeMs());
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            dismissCard("left");
          }}
        >
          <View style={[styles.actionCircle, styles.actionSkip]}>
            <Feather name="x" size={22} color={COLORS.onSurfaceVariant} />
          </View>
          <Text style={styles.actionLabel}>Skip</Text>
        </TouchableOpacity>

        {isGame ? (
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.85}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setGameByte(byte);
              setGameVisible(true);
            }}
          >
            <View style={styles.actionPlayBtn}>
              <Feather name="play" size={26} color={COLORS.black} />
            </View>
            <Text style={styles.actionLabel}>Play</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.85}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (byte) onSelectByte(byte.id);
            }}
          >
            <View style={styles.actionLearnBtn}>
              <Feather name="arrow-right" size={26} color={COLORS.black} />
            </View>
            <Text style={styles.actionLabel}>Learn</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.7}
          onPress={() => {
            if (!byte) return;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onSaveByte(byte.id);
            showToast();
            dismissCard("right");
          }}
        >
          <View style={[styles.actionCircle, styles.actionSave]}>
            <Feather name="bookmark" size={22} color={COLORS.primary} />
          </View>
          <Text style={styles.actionLabel}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* ── Game Overlay Modal ── */}
      <Modal
        visible={gameVisible}
        animationType="slide"
        transparent
        statusBarTranslucent
      >
        <View style={styles.gameOverlay}>
          <TouchableOpacity
            style={styles.gameBackdrop}
            onPress={() => setGameVisible(false)}
            activeOpacity={1}
          />
          <View style={styles.gameCardWrapper}>
            <View style={styles.gameHeader}>
              <TouchableOpacity
                onPress={() => setGameVisible(false)}
                style={styles.gameCloseBtn}
              >
                <Feather name="x" size={24} color={COLORS.onSurfaceVariant} />
              </TouchableOpacity>
              <Text style={styles.gameHeaderTitle}>
                {gameByte?.format === "quiz"
                  ? "Quiz"
                  : gameByte?.format === "word_scramble"
                    ? "Word Scramble"
                    : "Fill in the Blank"}
              </Text>
              <View style={{ width: 40 }} />
            </View>
            {gameByte?.game && (
              <GameCard
                gameType={gameByte.format || "quiz"}
                gameData={gameByte.game}
                onComplete={(correct) => {
                  setGameVisible(false);
                  if (correct && gameByte) {
                    onSaveByte(gameByte.id);
                    showToastRef.current?.();
                  } else if (gameByte)
                    onSkipByte?.(gameByte.id, getDwellTimeMs());
                  setTimeout(() => {
                    setCurrentByteIndex((prev) => prev + 1);
                    cardX.setValue(0);
                    cardOpacity.setValue(1);
                  }, 400);
                }}
                onSkip={() => {
                  setGameVisible(false);
                  if (gameByte) onSkipByte?.(gameByte.id, getDwellTimeMs());
                  setTimeout(() => {
                    setCurrentByteIndex((prev) => prev + 1);
                    cardX.setValue(0);
                    cardOpacity.setValue(1);
                  }, 400);
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ── Toast ── */}
      {showSaveToast && (
        <Animated.View
          style={[
            styles.toast,
            { opacity: toastOpacity, transform: [{ translateY: toastY }] },
          ]}
        >
          <Text style={styles.toastText}>Saved to Library ✦</Text>
        </Animated.View>
      )}

      <BottomNav active="feed" onNavigate={onNavigate} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#08080c" },
  // ── Header ──
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "transparent",
  },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#1a1a2e",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: COLORS.primary + "55",
  },
  avatarImg: { width: "100%", height: "100%" },
  appName: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.onSurface,
    letterSpacing: -1,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
    backgroundColor: "#14141f",
    borderRadius: 40,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#1e1e30",
  },
  statItem: { alignItems: "center", paddingHorizontal: 8 },
  statLabel: {
    fontSize: 8,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: COLORS.onSurfaceVariant,
    marginBottom: 2,
  },
  statValue: { fontSize: 16, fontWeight: "900", color: COLORS.primary },
  statDivider: { width: 1, height: 28, backgroundColor: "#1e1e30" },
  streakRow: { flexDirection: "row", alignItems: "center" },
  streakBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  streakValue: { fontSize: 16, fontWeight: "900", color: COLORS.secondary },

  // ── Card ──
  cardArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
    paddingBottom: 120,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: "#14141f",
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1e1e30",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 30,
    elevation: 16,
  },
  emptyCard: { alignItems: "center", justifyContent: "center" },
  cardGlow: {
    position: "absolute",
    top: -60,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: COLORS.primary,
    opacity: 0.08,
  },
  cardInner: { flex: 1, padding: 24, justifyContent: "space-between" },

  // ── Swipe hints ──
  swipeHint: {
    position: "absolute",
    top: 20,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 50,
  },
  swipeHintRight: {
    right: 20,
    backgroundColor: COLORS.primary + "18",
    borderWidth: 1,
    borderColor: COLORS.primary + "40",
  },
  swipeHintLeft: {
    left: 20,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  swipeHintText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: COLORS.primary,
  },

  // ── Card Top Row ──
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: COLORS.primary + "18",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 50,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: COLORS.primary,
  },
  diffBadge: {
    backgroundColor: "#ffffff10",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 30,
  },
  diffText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // ── Regular Content ──
  contentBody: { flex: 1, justifyContent: "center", paddingVertical: 8 },
  cardTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.onSurface,
    letterSpacing: -1,
    lineHeight: 32,
    marginBottom: 14,
  },
  cardContent: {
    fontSize: 15,
    color: "#b0b0c0",
    lineHeight: 23,
    fontWeight: "500",
  },

  // ── Game Preview ──
  gamePreview: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  gameIconBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: COLORS.secondary + "10",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: COLORS.secondary + "30",
    borderStyle: "dashed",
    marginBottom: 4,
  },
  gameIcon: { alignItems: "center", justifyContent: "center" },
  gameLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.secondary,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  gameTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.onSurface,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  gameHint: { fontSize: 12, color: COLORS.onSurfaceVariant, opacity: 0.5 },
  gamePlayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
    marginTop: 4,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  gamePlayText: {
    color: COLORS.black,
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 0.5,
  },

  // ── Card Footer ──
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  agentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#1e1e30",
  },
  agentText: { fontSize: 11, color: COLORS.primary, fontWeight: "600" },
  playBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },

  // ── Actions Row ──
  actionsRow: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: 28,
    paddingHorizontal: 20,
  },
  actionBtn: { alignItems: "center", gap: 6 },
  actionCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  actionSkip: { backgroundColor: "#14141f", borderColor: "#1e1e30" },
  actionSave: {
    backgroundColor: "#14141f",
    borderColor: COLORS.primary + "40",
  },
  actionPlayBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: COLORS.secondary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  actionLearnBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: COLORS.onSurfaceVariant,
  },

  // ── Empty/Loader ──
  loaderContainer: { alignItems: "center", gap: 12 },
  loaderTitle: { fontSize: 16, fontWeight: "800", color: COLORS.onSurface },
  loaderSub: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
    textAlign: "center",
  },

  // ── Toast ──
  toast: {
    position: "absolute",
    bottom: 200,
    alignSelf: "center",
    zIndex: 200,
    backgroundColor: COLORS.primary + "f0",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 50,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  toastText: {
    color: COLORS.black,
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 0.5,
  },

  // ── Game Overlay ──
  gameOverlay: { flex: 1, justifyContent: "flex-end" },
  gameBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  gameCardWrapper: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: 40,
    maxHeight: height * 0.85,
  },
  gameHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  gameCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1a1a2e",
    alignItems: "center",
    justifyContent: "center",
  },
  gameHeaderTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.onSurface,
    letterSpacing: -0.5,
  },
});
