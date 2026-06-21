import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  ScrollView,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { BottomNav } from "./BottomNav";
import { Byte, Screen, UserProfile } from "../types";
import { COLORS } from "../theme";

const { width, height } = Dimensions.get("window");

interface Props {
  byte: Byte | null;
  user: UserProfile | null;
  isSaved: boolean;
  onBack: () => void;
  onNavigate: (screen: Screen) => void;
  onSaveByte: (id: string) => void;
}

export const FactDetail: React.FC<Props> = ({
  byte,
  user,
  isSaved,
  onBack,
  onNavigate,
  onSaveByte,
}) => {
  const [showToast, setShowToast] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState("");
  const toastOpacity = React.useRef(new Animated.Value(0)).current;
  const toastY = React.useRef(new Animated.Value(60)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const triggerToast = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(toastY, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(() => {
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
        ]).start(() => setShowToast(false));
      }, 1500);
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.profileRow}
          onPress={() => onNavigate("profile")}
          activeOpacity={0.7}
        >
          <View style={styles.avatar}>
            <Image
              source={{ uri: user?.avatar ?? "https://i.pravatar.cc/100?u=me" }}
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
            <Text style={styles.streakText}>{user?.streak ?? 0}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.contentArea}>
        <Animated.View
          style={[
            styles.card,
            { opacity: opacityAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Background image */}
          {byte?.image && (
            <Image
              source={{ uri: byte.image }}
              style={styles.bgImage}
              resizeMode="cover"
            />
          )}

          {/* Gradient overlays */}
          <View style={styles.gradientTop} />
          <View style={styles.gradientBottom} />

          {/* Card content */}
          <View style={styles.cardInner}>
            {/* Page indicator dots */}
            <View style={styles.pageDots}>
              <View style={styles.dotInactive} />
              <View style={styles.dotActive} />
              <View style={styles.dotInactive} />
            </View>

            <ScrollView
              style={styles.scrollArea}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Category */}
              <View style={styles.categoryRow}>
                <View style={styles.categoryDot} />
                <Text style={styles.categoryText}>
                  {byte?.category ?? "BrainByte"}
                </Text>
              </View>

              {/* Title */}
              <Text style={styles.title}>
                {byte?.title ?? "No fact selected"}
              </Text>

              {/* Body */}
              <Text style={styles.body}>
                {byte?.content ??
                  "Select a byte from the feed to view details."}
              </Text>

              {/* Source */}
              {byte?.source && (
                <TouchableOpacity style={styles.sourceRow}>
                  <Feather name="link" size={13} color={COLORS.primary} />
                  <Text style={styles.sourceText}>Source: {byte.source}</Text>
                </TouchableOpacity>
              )}

              {/* Action buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.saveButton}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (!byte) return;
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success,
                    );
                    onSaveByte(byte.id);
                    triggerToast(
                      isSaved
                        ? "Already saved in Library."
                        : "Byte saved to Library.",
                    );
                  }}
                >
                  <Feather name="bookmark" size={18} color={COLORS.black} />
                  <Text style={styles.saveButtonText}>
                    {isSaved ? "Saved" : "Save"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.shareButton}
                  activeOpacity={0.85}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    triggerToast("Link copied to clipboard");
                  }}
                >
                  <Feather name="share-2" size={18} color={COLORS.white} />
                  <Text style={styles.shareButtonText}>Share</Text>
                </TouchableOpacity>
              </View>

              {/* Interactive lesson CTA — only shown for lesson bytes */}
              {byte?.interactive && (
                <TouchableOpacity
                  style={styles.lessonButton}
                  activeOpacity={0.85}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    onNavigate("interactive");
                  }}
                >
                  <Feather name="play" size={16} color={COLORS.black} />
                  <Text style={styles.lessonButtonText}>
                    Start Interactive Lesson
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </Animated.View>
      </View>

      {/* Toast */}
      {showToast && (
        <Animated.View
          style={[
            styles.toast,
            { opacity: toastOpacity, transform: [{ translateY: toastY }] },
          ]}
        >
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}

      <BottomNav active="feed" onNavigate={onNavigate} />
    </View>
  );
};

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
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 12,
    backgroundColor: COLORS.surfaceContainerLow + "cc",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceContainerHighest,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  appName: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.primary,
    letterSpacing: -1,
  },
  streakBadge: {
    backgroundColor: COLORS.surfaceContainerHigh,
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
  contentArea: {
    flex: 1,
    paddingTop: 100,
    paddingBottom: 100,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: width - 32,
    height: height * 0.72,
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: COLORS.surfaceContainerHigh,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 20,
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  gradientTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "45%",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  gradientBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "70%",
    backgroundColor: "rgba(0,0,0,0.85)",
  },
  cardInner: {
    flex: 1,
    padding: 24,
    justifyContent: "flex-end",
  },
  pageDots: {
    position: "absolute",
    top: 24,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dotInactive: {
    width: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  dotActive: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  scrollArea: {
    flex: 1,
    marginTop: 8,
  },
  scrollContent: {
    paddingTop: 8,
    gap: 12,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  categoryDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.secondary,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: COLORS.secondary,
  },
  title: {
    fontSize: 40,
    fontWeight: "900",
    color: COLORS.white,
    letterSpacing: -1.5,
    lineHeight: 44,
    marginTop: 8,
  },
  titleGradient: {
    color: COLORS.primary,
  },
  body: {
    fontSize: 15,
    color: COLORS.onSurfaceVariant,
    lineHeight: 22,
    fontWeight: "500",
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    marginBottom: 8,
  },
  sourceText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  saveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 50,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  saveButtonText: {
    color: COLORS.black,
    fontWeight: "900",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  shareButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingVertical: 16,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  shareButtonText: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  lessonButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 15,
    marginTop: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  lessonButtonText: {
    color: COLORS.black,
    fontWeight: "900",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  toast: {
    position: "absolute",
    bottom: 110,
    alignSelf: "center",
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 50,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 100,
  },
  toastText: {
    color: COLORS.black,
    fontWeight: "700",
    fontSize: 14,
  },
});
