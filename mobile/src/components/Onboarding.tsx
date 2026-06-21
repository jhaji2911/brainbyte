import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../theme";

const TOPICS = [
  "Physics",
  "Biology",
  "Neuroscience",
  "History",
  "Psychology",
  "Philosophy",
  "Technology",
  "Mathematics",
  "Economics",
  "Astronomy",
  "Chemistry",
  "Art History",
  "Music Theory",
  "Political Science",
  "Cognitive Science",
  "Computer Science",
];

interface Props {
  step: "poison" | "goal" | "interrupt";
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
  const [name, setName] = React.useState("");
  const slideAnim = React.useRef(new Animated.Value(30)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    slideAnim.setValue(30);
    opacityAnim.setValue(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [step]);

  // Parse comma-separated interests
  const selectedInterests = selectedPoison
    ? selectedPoison
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const toggleInterest = (topic: string) => {
    const next = new Set(selectedInterests);
    if (next.has(topic)) next.delete(topic);
    else next.add(topic);
    // Encode name + interests: "name|||topic1, topic2"
    onSelectPoison(`${name}|||${[...next].join(", ")}`);
  };

  // V2 only has 2 steps: interest + goal. Interrupt step is repurposed as "ready"
  const isInterest = step === "poison";
  const isGoal = step === "goal";
  const isFinal = step === "interrupt";

  const steps = ["interest", "goal"] as const;
  const stepIndex = isInterest ? 0 : 1;

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: opacityAnim, transform: [{ translateX: slideAnim }] },
      ]}
    >
      {/* Step dots */}
      <View style={[styles.stepRow, { paddingTop: insets.top + 16 }]}>
        {steps.map((s, i) => (
          <View
            key={s}
            style={[
              styles.stepDot,
              i === stepIndex
                ? styles.stepDotActive
                : i < stepIndex
                  ? styles.stepDotDone
                  : styles.stepDotInactive,
            ]}
          />
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Step 1: Select interests */}
        {isInterest && (
          <>
            <View style={styles.header}>
              <Text style={styles.headlineSmall}>
                What <Text style={{ color: COLORS.primary }}>fascinates</Text>{" "}
                you?
              </Text>
              <Text style={styles.subtitle}>
                An AI agent will curate knowledge based on your interests.
              </Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>YOUR NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Ada"
                placeholderTextColor={COLORS.onSurfaceVariant}
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  onSelectPoison(`${t}|||${selectedInterests.join(", ")}`);
                }}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
            <Text style={[styles.label, { marginTop: 16, marginBottom: 8 }]}>
              YOUR INTERESTS ({selectedInterests.length})
            </Text>
            <View style={styles.chipGrid}>
              {TOPICS.map((topic) => {
                const active = selectedInterests.includes(topic);
                return (
                  <TouchableOpacity
                    key={topic}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      toggleInterest(topic);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {topic}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Step 2: Select daily goal */}
        {isGoal && (
          <>
            <View style={styles.header}>
              <Text style={styles.tagLabel}>Learning Style</Text>
              <Text style={styles.headline}>
                How much do you want to learn?
              </Text>
              <Text style={styles.subtitle}>
                The agent adapts its curation pace to your preference.
              </Text>
            </View>

            <View style={styles.goalList}>
              <GoalCard
                title="Casual (2-3 bytes)"
                description="Light curiosity. A few fascinating facts throughout your day."
                selected={selectedGoal === "Casual (2-3 bytes)"}
                onPress={() => onSelectGoal("Casual (2-3 bytes)")}
              />
              <GoalCard
                title="Growth (5-7 bytes)"
                description="The sweet spot. Regular learning without the burnout."
                selected={selectedGoal === "Growth (5-7 bytes)"}
                onPress={() => onSelectGoal("Growth (5-7 bytes)")}
              />
              <GoalCard
                title="Scholar (10+ bytes)"
                description="Deep dive. Your brain becomes a knowledge sponge."
                selected={selectedGoal === "Scholar (10+ bytes)"}
                onPress={() => onSelectGoal("Scholar (10+ bytes)")}
              />
            </View>
          </>
        )}

        {/* Step 3: Repurposed as ready confirmation */}
        {isFinal && (
          <View style={styles.readyContainer}>
            <View style={styles.readyIconBox}>
              <Feather name="zap" size={48} color={COLORS.primary} />
            </View>
            <Text style={styles.readyTitle}>
              Your agent is <Text style={{ color: COLORS.primary }}>ready</Text>
            </Text>
            <Text style={styles.readySubtitle}>
              Based on your interests in {selectedPoison || "learning"}, the
              agent will start curating knowledge just for you. Every save and
              skip teaches it what you love.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, 16) + 20 },
        ]}
      >
        {isFinal ? (
          <>
            <TouchableOpacity
              style={styles.nextButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onNext();
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.nextButtonText}>Start Learning</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.skipRow}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSkip?.();
              }}
            >
              <Text style={styles.skipText}>Skip for now</Text>
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
              {isSaving ? "Saving..." : "Next"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

// ── Goal Card ──

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
    style={[styles.goalCard, selected && styles.goalCardSelected]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <View style={styles.goalCardHeader}>
      <Text style={styles.goalTitle}>{title}</Text>
      <View style={[styles.goalRadio, selected && styles.goalRadioSelected]}>
        {selected && <Feather name="check" size={12} color={COLORS.black} />}
      </View>
    </View>
    <Text style={styles.goalDescription}>{description}</Text>
    {selected && <View style={styles.goalAccentLine} />}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.black },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 140,
  },
  stepRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 28,
    paddingBottom: 12,
  },
  stepDot: { flex: 1, height: 4, borderRadius: 2 },
  stepDotActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  stepDotDone: { backgroundColor: COLORS.primary + "88" },
  stepDotInactive: { backgroundColor: COLORS.outlineVariant },

  header: { marginBottom: 32 },
  tagLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  headline: {
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.onSurface,
    letterSpacing: -0.8,
    lineHeight: 35,
    marginBottom: 10,
  },
  headlineSmall: {
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.onSurface,
    letterSpacing: -0.8,
    lineHeight: 35,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.onSurfaceVariant,
    lineHeight: 22,
  },
  field: { gap: 8, marginBottom: 16 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: COLORS.onSurfaceVariant,
  },
  input: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.onSurface,
  },

  // Interest chips
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: COLORS.outlineVariant,
    backgroundColor: COLORS.surfaceContainerLow,
  },
  chipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + "14",
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.onSurfaceVariant,
  },
  chipTextActive: {
    color: COLORS.primary,
  },

  // Goal cards
  goalList: { gap: 14 },
  goalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  goalCardSelected: {
    backgroundColor: COLORS.surfaceContainerHigh,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  goalCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  goalTitle: { fontSize: 16, fontWeight: "800", color: COLORS.onSurface },
  goalRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
  },
  goalRadioSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  goalDescription: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: COLORS.onSurfaceVariant,
  },
  goalAccentLine: {
    position: "absolute",
    bottom: 0,
    left: 12,
    right: 12,
    height: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 1,
  },

  // Ready screen
  readyContainer: {
    alignItems: "center",
    paddingTop: 32,
  },
  readyIconBox: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.primary + "33",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  readyTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: COLORS.onSurface,
    textAlign: "center",
    marginBottom: 14,
  },
  readySubtitle: {
    fontSize: 14,
    color: COLORS.onSurfaceVariant,
    lineHeight: 21,
    textAlign: "center",
    paddingHorizontal: 20,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "column",
    paddingHorizontal: 28,
    paddingTop: 16,
    backgroundColor: COLORS.black,
    gap: 10,
  },
  skipRow: { alignItems: "center", paddingVertical: 6 },
  skipText: {
    color: COLORS.onSurfaceVariant,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingVertical: 6,
  },
  nextButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  nextButtonDisabled: { opacity: 0.5 },
  nextButtonText: {
    color: COLORS.black,
    fontWeight: "900",
    fontSize: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
