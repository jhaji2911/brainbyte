import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { BottomNav } from "./BottomNav";
import { Screen } from "../types";
import { COLORS } from "../theme";

const { width } = Dimensions.get("window");
const RING_SIZE = 280;
const RADIUS = RING_SIZE / 2 - 12;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface Props {
  onComplete: () => void;
  onNavigate: (screen: Screen) => void;
}

export const FocusSession: React.FC<Props> = ({ onComplete, onNavigate }) => {
  const [timeLeft, setTimeLeft] = React.useState(300);
  const [paused, setPaused] = React.useState(false);
  const strokeOffset = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const progress = timeLeft / 300;
    Animated.timing(strokeOffset, {
      toValue: CIRCUMFERENCE * (1 - progress),
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [timeLeft]);

  React.useEffect(() => {
    if (paused) return;
    if (timeLeft <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, paused]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const AnimatedCircle = Animated.createAnimatedComponent(Circle);

  return (
    <View style={styles.container}>
      {/* Ambient glow */}
      <View style={styles.ambientGlow} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.profileRow}
          onPress={() => onNavigate("feed")}
          activeOpacity={0.7}
        >
          <View style={styles.avatar}>
            <Image
              source={{ uri: "https://i.pravatar.cc/100?u=me" }}
              style={styles.avatarImg}
            />
          </View>
          <Text style={styles.appName}>BrainByte</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.streakBadge}
          onPress={() => onNavigate("leaderboard")}
          activeOpacity={0.7}
        >
          <View style={styles.streakRow}>
            <Feather name="activity" size={14} color={COLORS.primary} />
            <Text style={styles.streakText}>0</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Timer ring */}
        <View style={styles.ringWrapper}>
          <Svg
            width={RING_SIZE}
            height={RING_SIZE}
            style={{ transform: [{ rotate: "-90deg" }] }}
          >
            {/* Track */}
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              strokeWidth={10}
              stroke={COLORS.surfaceContainerHighest}
              fill="none"
            />
            {/* Progress */}
            <AnimatedCircle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              strokeWidth={10}
              stroke={COLORS.primary}
              fill="none"
              strokeDasharray={`${CIRCUMFERENCE}`}
              strokeDashoffset={strokeOffset as any}
              strokeLinecap="round"
            />
          </Svg>

          <View style={styles.ringCenter}>
            <Text style={styles.ringLabel}>Focus Remaining</Text>
            <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
          </View>
        </View>

        {/* Message */}
        <View style={styles.messageBlock}>
          <Text style={styles.messageTitle}>
            Breathe. You're building a better brain.
          </Text>
          <Text style={styles.messageSubtitle}>
            Neuroplasticity is most active during deep focus intervals.
          </Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.nextButton}
            onPress={() => {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              onComplete();
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.nextButtonText}>Next Byte</Text>
            <Feather name="chevron-right" size={20} color={COLORS.black} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onNavigate("feed");
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.skipText}>Finish Early</Text>
          </TouchableOpacity>
        </View>
      </View>

      <BottomNav active="feed" onNavigate={onNavigate} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  ambientGlow: {
    position: "absolute",
    top: "40%",
    left: "50%",
    marginLeft: -150,
    marginTop: -150,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: COLORS.primary,
    opacity: 0.04,
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
    borderWidth: 2,
    borderColor: COLORS.primary + "33",
  },
  avatarImg: { width: "100%", height: "100%" },
  appName: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.primary,
    letterSpacing: -1,
  },
  streakBadge: {
    backgroundColor: COLORS.surfaceContainerHighest,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 50,
  },
  streakRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  streakText: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.primary,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 100,
    paddingBottom: 120,
    gap: 40,
  },
  ringWrapper: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ringCenter: {
    position: "absolute",
    alignItems: "center",
  },
  ringLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2,
    color: COLORS.onSurfaceVariant,
    marginBottom: 6,
  },
  timerText: {
    fontSize: 64,
    fontWeight: "900",
    color: COLORS.white,
    letterSpacing: -3,
  },
  messageBlock: {
    alignItems: "center",
    gap: 10,
    maxWidth: 280,
  },
  messageTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: COLORS.white,
    textAlign: "center",
    letterSpacing: -0.8,
    lineHeight: 32,
  },
  messageSubtitle: {
    fontSize: 15,
    color: COLORS.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 22,
  },
  buttons: {
    width: "100%",
    gap: 12,
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 20,
    borderRadius: 50,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  nextButtonText: {
    color: COLORS.black,
    fontWeight: "900",
    fontSize: 15,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  skipButton: {
    paddingVertical: 16,
    alignItems: "center",
  },
  skipText: {
    color: COLORS.onSurfaceVariant,
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
});
