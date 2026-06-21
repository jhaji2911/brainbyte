import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
  ScrollView,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { BottomNav } from "./BottomNav";
import { Screen } from "../types";
import { COLORS } from "../theme";

const { width } = Dimensions.get("window");

const TARGET_WORD = "PULSE";
const MORSE_MAP: Record<string, string[]> = {
  P: [".", "-", "-", "."],
  U: [".", ".", "-"],
  L: [".", "-", ".", "."],
  S: [".", ".", "."],
  E: ["."],
};

interface Props {
  onComplete: () => void;
  onNavigate: (screen: Screen) => void;
}

export const InteractiveLesson: React.FC<Props> = ({
  onComplete,
  onNavigate,
}) => {
  const [currentLetterIndex, setCurrentLetterIndex] = React.useState(0);
  const [currentInput, setCurrentInput] = React.useState<string[]>([]);
  const [isHolding, setIsHolding] = React.useState(false);
  const holdStart = React.useRef<number>(0);
  const buttonScale = React.useRef(new Animated.Value(1)).current;
  const buttonGlow = React.useRef(new Animated.Value(0)).current;
  const progressAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: currentLetterIndex / TARGET_WORD.length,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [currentLetterIndex]);

  const handlePressIn = () => {
    setIsHolding(true);
    holdStart.current = Date.now();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.spring(buttonScale, {
        toValue: 0.92,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(buttonGlow, {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    setIsHolding(false);
    const duration = Date.now() - holdStart.current;
    const char = duration > 250 ? "-" : ".";

    Haptics.impactAsync(
      char === "-"
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light,
    );

    Animated.parallel([
      Animated.spring(buttonScale, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(buttonGlow, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();

    const targetCode = MORSE_MAP[TARGET_WORD[currentLetterIndex]];
    const nextInput = [...currentInput, char];

    const isCorrectSoFar = nextInput.every(
      (val, idx) => val === targetCode[idx],
    );

    if (isCorrectSoFar) {
      if (nextInput.length === targetCode.length) {
        if (currentLetterIndex === TARGET_WORD.length - 1) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setCurrentInput(nextInput);
          setTimeout(onComplete, 1000);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setCurrentInput([]);
          setCurrentLetterIndex((prev) => prev + 1);
        }
      } else {
        setCurrentInput(nextInput);
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setCurrentInput([]);
    }
  };

  const glowColor = buttonGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.primary + "20", COLORS.secondary + "33"],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Image
              source={{ uri: "https://i.pravatar.cc/100?u=me" }}
              style={styles.avatarImg}
            />
          </View>
          <Text style={styles.appName}>BrainByte</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.streakRow}>
            <Feather name="activity" size={14} color={COLORS.primary} />
            <Text style={styles.streakBadge}>0</Text>
          </View>
          <TouchableOpacity>
            <Feather
              name="settings"
              size={20}
              color={COLORS.onSurfaceVariant}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Tip card */}
        <View style={styles.tipCard}>
          <View style={styles.tipIconBox}>
            <Feather name="sun" size={22} color={COLORS.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tipTitle}>Morse Code Micro-bites</Text>
            <Text style={styles.tipSubtitle}>
              Tap short for dots (.), hold long for dashes (-). Master the
              rhythm to unlock the secret language of the wire.
            </Text>
          </View>
        </View>

        {/* Target word */}
        <View style={styles.targetSection}>
          <Text style={styles.targetLabel}>Target Word</Text>
          <View style={styles.targetWordRow}>
            {TARGET_WORD.split("").map((char, i) => (
              <Text
                key={i}
                style={[
                  styles.targetChar,
                  i < currentLetterIndex && { color: COLORS.primary },
                  i === currentLetterIndex && { color: COLORS.onSurface },
                  i > currentLetterIndex && {
                    color: COLORS.onSurfaceVariant,
                    opacity: 0.3,
                  },
                ]}
              >
                {char}
              </Text>
            ))}
            <MaterialCommunityIcons
              name="radio"
              size={28}
              color={COLORS.primary}
              style={{ opacity: 0.6, marginBottom: 4 }}
            />
          </View>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <Animated.View
              style={[styles.progressFill, { width: progressWidth }]}
            />
          </View>
          <Text style={styles.progressLabel}>
            {currentLetterIndex} / {TARGET_WORD.length} LETTERS COMPLETE
          </Text>
        </View>

        {/* Input display */}
        <View style={styles.inputDisplay}>
          <View style={styles.morseRow}>
            {currentInput.map((char, i) => (
              <View
                key={i}
                style={[styles.morseDot, char === "-" && styles.morseDash]}
              />
            ))}
          </View>
          <Text style={styles.morseText}>{currentInput.join(" ")}</Text>
        </View>

        {/* Big tap button */}
        <View style={styles.tapArea}>
          <Animated.View
            style={[styles.tapGlow, { backgroundColor: glowColor }]}
          />
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              activeOpacity={1}
              style={[styles.tapButton, isHolding && styles.tapButtonHolding]}
            >
              <MaterialCommunityIcons
                name="hand-pointing-up"
                size={48}
                color={COLORS.white}
              />
              <Text style={styles.tapLabel}>Tap / Hold</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          {TARGET_WORD.split("").map((char, i) => (
            <LegendChip
              key={char}
              char={char}
              code={MORSE_MAP[char].join(" ")}
              active={TARGET_WORD[currentLetterIndex] === char}
              done={i < currentLetterIndex}
            />
          ))}
        </View>
      </ScrollView>

      <BottomNav active="feed" onNavigate={onNavigate} />
    </View>
  );
};

const LegendChip = ({
  char,
  code,
  active,
  done,
}: {
  char: string;
  code: string;
  active: boolean;
  done: boolean;
}) => (
  <View
    style={[
      legendStyles.chip,
      active && legendStyles.chipActive,
      done && { opacity: 0.4 },
    ]}
  >
    <Text style={[legendStyles.char, active && { color: COLORS.primary }]}>
      {char}
    </Text>
    <Text style={[legendStyles.code, active && { color: COLORS.primary }]}>
      {code}
    </Text>
  </View>
);

const legendStyles = StyleSheet.create({
  chip: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerHigh,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  chipActive: {
    borderWidth: 1,
    borderColor: COLORS.primary + "50",
  },
  char: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.onSurface,
    marginBottom: 3,
  },
  code: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    letterSpacing: 2,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 52,
    paddingBottom: 16,
    backgroundColor: COLORS.surfaceContainerLow + "cc",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: COLORS.surfaceContainerHighest,
  },
  avatarImg: { width: "100%", height: "100%" },
  appName: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.primary,
    letterSpacing: -1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  streakRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  streakBadge: {
    fontSize: 15,
    fontWeight: "900",
    color: COLORS.primary,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: 100,
    paddingHorizontal: 24,
    paddingBottom: 120,
    gap: 24,
  },
  tipCard: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  tipIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.secondary + "20",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.onSurface,
    marginBottom: 6,
  },
  tipSubtitle: {
    fontSize: 13,
    color: COLORS.onSurfaceVariant,
    lineHeight: 20,
  },
  targetSection: {
    alignItems: "center",
    gap: 12,
  },
  targetLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2.5,
    color: COLORS.secondary,
  },
  targetWordRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  targetChar: {
    fontSize: 52,
    fontWeight: "900",
    letterSpacing: -2,
  },
  progressTrack: {
    width: "70%",
    height: 6,
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.secondary,
    borderRadius: 3,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: COLORS.onSurfaceVariant,
  },
  inputDisplay: {
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    minHeight: 120,
    justifyContent: "center",
    gap: 16,
  },
  morseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 20,
  },
  morseDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.onSurface,
  },
  morseDash: {
    width: 44,
    height: 16,
    borderRadius: 8,
  },
  morseText: {
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.primary,
    letterSpacing: 6,
    textTransform: "uppercase",
  },
  tapArea: {
    alignItems: "center",
    justifyContent: "center",
  },
  tapGlow: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  tapButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 8,
    borderColor: COLORS.surface,
    shadowColor: COLORS.primaryDim,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  tapButtonHolding: {
    backgroundColor: COLORS.secondary,
    shadowColor: COLORS.secondary,
  },
  tapLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "rgba(255,255,255,0.9)",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  legend: {
    flexDirection: "row",
    gap: 8,
  },
});
