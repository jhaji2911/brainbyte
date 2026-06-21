import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
  isSaving: boolean;
  errorMessage: string | null;
  onRegister: (name: string, email: string, password: string) => Promise<void>;
  onLogin: (email: string, password: string) => Promise<void>;
  onSkip: () => void;
}

export const Register: React.FC<Props> = ({
  isSaving,
  errorMessage,
  onRegister,
  onLogin,
  onSkip,
}) => {
  const [mode, setMode] = React.useState<"register" | "login">("register");
  const [name, setName] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [userId, setUserId] = React.useState("");
  const [localError, setLocalError] = React.useState<string | null>(null);

  const toggleChip = (topic: string) => {
    const next = new Set(selected);
    if (next.has(topic)) next.delete(topic);
    else next.add(topic);
    setSelected(next);
  };

  const switchMode = (next: "register" | "login") => {
    setLocalError(null);
    setMode(next);
  };

  const handleSubmit = async () => {
    setLocalError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (mode === "register") {
      const trimName = name.trim();
      if (!trimName) {
        setLocalError("Enter your name to continue.");
        return;
      }
      // v2: register with name + selected interests directly
      const interests = [...selected];
      // Pass interests via the password field as JSON so AppState can use them
      await onRegister(trimName, trimName, JSON.stringify(interests));
    } else {
      const trimId = userId.trim();
      if (!trimId) {
        setLocalError("Enter your user ID to sign in.");
        return;
      }
      // v2: user_id (passed as email for compat)
      await onLogin(trimId, "v2-no-password");
    }
  };

  const displayError = localError ?? errorMessage;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconBox}>
            <Feather
              name={mode === "login" ? "log-in" : "zap"}
              size={32}
              color={COLORS.primary}
            />
          </View>
          <Text style={styles.title}>
            {mode === "login" ? "Welcome Back" : "Your Learning Journey"}
          </Text>
          <Text style={styles.subtitle}>
            {mode === "login"
              ? "Enter your user ID to pick up where you left off."
              : "An AI agent curates knowledge based on what fascinates you."}
          </Text>
        </View>

        {/* Mode tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, mode === "register" && styles.tabActive]}
            onPress={() => switchMode("register")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabText,
                mode === "register" && styles.tabTextActive,
              ]}
            >
              New User
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === "login" && styles.tabActive]}
            onPress={() => switchMode("login")}
            activeOpacity={0.8}
          >
            <Text
              style={[styles.tabText, mode === "login" && styles.tabTextActive]}
            >
              Returning
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {mode === "register" ? (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Your Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Ada"
                  placeholderTextColor={COLORS.onSurfaceVariant}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  returnKeyType="next"
                  editable={!isSaving}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>
                  What fascinates you? ({selected.size} selected)
                </Text>
                <View style={styles.chipGrid}>
                  {TOPICS.map((t) => {
                    const active = selected.has(t);
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => toggleChip(t)}
                        activeOpacity={0.7}
                        disabled={isSaving}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            active && styles.chipTextActive,
                          ]}
                        >
                          {t}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <Text style={styles.hint}>
                The agent uses these to decide what to curate first. You can
                always explore new topics later.
              </Text>
            </>
          ) : (
            <View style={styles.field}>
              <Text style={styles.label}>Your User ID</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. user_a1b2c3d4"
                placeholderTextColor={COLORS.onSurfaceVariant}
                value={userId}
                onChangeText={setUserId}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                editable={!isSaving}
              />
              <Text style={styles.hint}>
                Your user ID was shown when you first registered. It looks like
                "user_xxxxxxxx".
              </Text>
            </View>
          )}

          {displayError ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={14} color={COLORS.error} />
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.submitButton,
              isSaving && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color={COLORS.black} />
            ) : (
              <Text style={styles.submitButtonText}>
                {mode === "login" ? "Sign In" : "Start Learning"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Skip */}
        <TouchableOpacity
          style={styles.skipRow}
          onPress={onSkip}
          activeOpacity={0.7}
          disabled={isSaving}
        >
          <Text style={styles.skipText}>Try without an account</Text>
          <Feather
            name="arrow-right"
            size={14}
            color={COLORS.onSurfaceVariant}
          />
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.surface },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 48,
    justifyContent: "center",
  },
  header: { alignItems: "center", marginBottom: 32 },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.primary + "33",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: COLORS.onSurface,
    letterSpacing: -0.6,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 20,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.onSurfaceVariant,
  },
  tabTextActive: { color: COLORS.black },
  form: { gap: 16 },
  field: { gap: 8 },
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
    fontSize: 15,
    color: COLORS.onSurface,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.outlineVariant,
    backgroundColor: COLORS.surfaceContainerLow,
  },
  chipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + "14",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.onSurfaceVariant,
  },
  chipTextActive: {
    color: COLORS.primary,
  },
  hint: {
    fontSize: 11,
    color: COLORS.onSurfaceVariant,
    opacity: 0.6,
    lineHeight: 16,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.error + "18",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: { fontSize: 13, color: COLORS.error, flex: 1 },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.black,
    letterSpacing: -0.3,
  },
  skipRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 28,
  },
  skipText: { fontSize: 13, color: COLORS.onSurfaceVariant },
});
