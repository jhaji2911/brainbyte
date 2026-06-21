import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Dimensions,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomNav } from "./BottomNav";
import { InitialsAvatar } from "./InitialsAvatar";
import { Byte, Screen, UserProfile } from "../types";
import { COLORS } from "../theme";

const { width } = Dimensions.get("window");

interface Props {
  bytes: Byte[];
  user: UserProfile | null;
  onNavigate: (screen: Screen) => void;
  savedIds: string[];
  onRemoveByte: (id: string) => void;
  onSelectByte: (id: string) => void;
}

const CHIPS = [
  "All Bytes",
  "Psychology",
  "Neuroscience",
  "Vocab",
  "Productivity",
];

export const Library: React.FC<Props> = ({
  bytes,
  user,
  onNavigate,
  savedIds,
  onRemoveByte,
  onSelectByte,
}) => {
  const insets = useSafeAreaInsets();
  const [activeChip, setActiveChip] = React.useState("All Bytes");
  const savedBytes = bytes
    .filter((b) => savedIds.includes(b.id))
    .filter((b) => {
      if (activeChip === "All Bytes") return true;
      if (activeChip === "Vocab")
        return b.category.toLowerCase().includes("vocab");
      return b.category.toLowerCase().includes(activeChip.toLowerCase());
    });
  const recentBytes = savedBytes.slice(0, 2);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 68 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Page title */}
        <View style={styles.titleBlock}>
          <Text style={styles.pageTitle}>
            Saved <Text style={{ color: COLORS.primary }}>Bytes</Text>
          </Text>
          <Text style={styles.pageSubtitle}>
            Your personal archive of mental shifts and rapid insights.
          </Text>
        </View>

        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          style={{ marginBottom: 24 }}
        >
          {CHIPS.map((chip) => (
            <TouchableOpacity
              key={chip}
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveChip(chip);
              }}
              style={[styles.chip, activeChip === chip && styles.chipActive]}
            >
              {activeChip === chip && <View style={styles.chipDot} />}
              <Text
                style={[
                  styles.chipText,
                  activeChip === chip && styles.chipTextActive,
                ]}
              >
                {chip}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Saved bytes */}
        {savedBytes.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather
                name="bookmark"
                size={40}
                color={COLORS.onSurfaceVariant}
              />
            </View>
            <Text style={styles.emptyTitle}>No saved bytes yet</Text>
            <Text style={styles.emptySubtitle}>
              Start exploring the feed to build your personal library of
              knowledge.
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => onNavigate("feed")}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyButtonText}>Explore Feed</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.bytesList}>
            {savedBytes.map((byte) => (
              <TouchableOpacity
                key={byte.id}
                activeOpacity={0.8}
                style={styles.byteCard}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onSelectByte(byte.id);
                }}
              >
                <View style={styles.byteCardTop}>
                  <View style={styles.byteCategoryBadge}>
                    <Text style={styles.byteCategoryText}>{byte.category}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.notificationAsync(
                        Haptics.NotificationFeedbackType.Warning,
                      );
                      onRemoveByte(byte.id);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather
                      name="trash-2"
                      size={18}
                      color={COLORS.onSurfaceVariant}
                    />
                  </TouchableOpacity>
                </View>

                <Text style={styles.byteTitle}>{byte.title}</Text>
                <Text style={styles.byteContent} numberOfLines={3}>
                  {byte.content}
                </Text>

                <View style={styles.byteCardFooter}>
                  <Text style={styles.byteTime}>
                    {byte.savedAt || "Just now"}
                  </Text>
                  <TouchableOpacity
                    style={styles.reviewButton}
                    onPress={() => onNavigate("interactive")}
                  >
                    <Text style={styles.reviewText}>Review</Text>
                    <Feather
                      name="chevron-right"
                      size={14}
                      color={COLORS.secondary}
                    />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Recent Activity */}
        <View style={styles.recentSection}>
          <Text style={styles.recentTitle}>Recent Activity</Text>
          <View style={styles.recentList}>
            {recentBytes.length === 0 ? (
              <Text style={styles.recentEmpty}>
                Your saved bytes will show up here.
              </Text>
            ) : (
              recentBytes.map((byte, index) => (
                <RecentItem
                  key={byte.id}
                  icon={index === 0 ? "brain" : "zap"}
                  title={byte.title}
                  time={byte.savedAt || "Saved recently"}
                  borderColor={index === 0 ? COLORS.primary : COLORS.secondary}
                  onPress={() => onSelectByte(byte.id)}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>

      <BottomNav active="library" onNavigate={onNavigate} />
    </View>
  );
};

const RecentItem = ({
  icon,
  title,
  time,
  borderColor,
  onPress,
}: {
  icon: string;
  title: string;
  time: string;
  borderColor: string;
  onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.8}
    style={[styles.recentCard, { borderLeftColor: borderColor }]}
  >
    <View style={styles.recentIconBox}>
      {icon === "brain" ? (
        <MaterialCommunityIcons name="brain" size={22} color={COLORS.primary} />
      ) : (
        <Feather name="zap" size={22} color={COLORS.primary} />
      )}
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.recentTitle_}>{title}</Text>
      <Text style={styles.recentTime}>{time}</Text>
    </View>
    <Feather name="chevron-right" size={18} color={COLORS.onSurfaceVariant} />
  </TouchableOpacity>
);

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
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: 100,
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  titleBlock: { marginBottom: 24 },
  pageTitle: {
    fontSize: 44,
    fontWeight: "900",
    color: COLORS.onSurface,
    letterSpacing: -1.5,
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 15,
    color: COLORS.onSurfaceVariant,
    lineHeight: 22,
  },
  chipsRow: {
    gap: 10,
    paddingRight: 24,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 50,
    backgroundColor: COLORS.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: "transparent",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.black,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: COLORS.onSurfaceVariant,
  },
  chipTextActive: {
    color: COLORS.black,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    opacity: 0.4,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.onSurface,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: COLORS.onSurfaceVariant,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 22,
  },
  emptyButton: {
    marginTop: 32,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 50,
  },
  emptyButtonText: {
    color: COLORS.black,
    fontWeight: "700",
    fontSize: 14,
  },
  bytesList: { gap: 16, marginBottom: 40 },
  byteCard: {
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  byteCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  byteCategoryBadge: {
    backgroundColor: COLORS.primary + "1a",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: COLORS.primary + "33",
  },
  byteCategoryText: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: COLORS.primary,
  },
  byteTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.onSurface,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  byteContent: {
    fontSize: 13,
    color: COLORS.onSurfaceVariant,
    lineHeight: 20,
    marginBottom: 16,
  },
  byteCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    paddingTop: 12,
  },
  byteTime: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    color: COLORS.onSurfaceVariant,
    letterSpacing: 1,
  },
  reviewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reviewText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: COLORS.secondary,
  },
  recentSection: { marginTop: 8 },
  recentTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2.5,
    color: COLORS.onSurfaceVariant,
    opacity: 0.5,
    textAlign: "center",
    marginBottom: 16,
  },
  recentEmpty: {
    color: COLORS.onSurfaceVariant,
    fontSize: 14,
    textAlign: "center",
  },
  recentList: { gap: 12 },
  recentCard: {
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderLeftWidth: 4,
  },
  recentIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceContainerHighest,
    alignItems: "center",
    justifyContent: "center",
  },
  recentTitle_: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.onSurface,
    marginBottom: 2,
  },
  recentTime: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: COLORS.onSurfaceVariant,
  },
});
