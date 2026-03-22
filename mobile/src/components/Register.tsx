import React from 'react';
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
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../theme';

interface Props {
  isSaving: boolean;
  errorMessage: string | null;
  onRegister: (name: string, email: string, password: string) => Promise<void>;
  onLogin: (email: string, password: string) => Promise<void>;
  onSkip: () => void;
}

export const Register: React.FC<Props> = ({ isSaving, errorMessage, onRegister, onLogin, onSkip }) => {
  const [mode, setMode] = React.useState<'register' | 'login'>('register');
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [localError, setLocalError] = React.useState<string | null>(null);

  const switchMode = (next: 'register' | 'login') => {
    setLocalError(null);
    setMode(next);
  };

  const handleSubmit = async () => {
    setLocalError(null);
    const trimEmail = email.trim().toLowerCase();

    if (!trimEmail.includes('@')) { setLocalError('Enter a valid email address.'); return; }
    if (password.length < 8) { setLocalError('Password must be at least 8 characters.'); return; }

    if (mode === 'register') {
      const trimName = name.trim();
      if (!trimName) { setLocalError('Name is required.'); return; }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await onRegister(trimName, trimEmail, password);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await onLogin(trimEmail, password);
    }
  };

  const displayError = localError ?? errorMessage;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconBox}>
            <Feather name={mode === 'login' ? 'log-in' : 'user-plus'} size={32} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>{mode === 'login' ? 'Welcome Back' : 'Create Your Profile'}</Text>
          <Text style={styles.subtitle}>
            {mode === 'login'
              ? 'Sign in to sync your progress and compete on the leaderboard.'
              : 'Track your progress, save bytes, and compete on the leaderboard.'}
          </Text>
        </View>

        {/* Mode tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, mode === 'register' && styles.tabActive]}
            onPress={() => switchMode('register')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>Sign Up</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'login' && styles.tabActive]}
            onPress={() => switchMode('login')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>Sign In</Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {mode === 'register' && (
            <View style={styles.field}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={COLORS.onSurfaceVariant}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                returnKeyType="next"
                editable={!isSaving}
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.onSurfaceVariant}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              editable={!isSaving}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Min. 8 characters"
              placeholderTextColor={COLORS.onSurfaceVariant}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              editable={!isSaving}
            />
          </View>

          {displayError ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={14} color={COLORS.error} />
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.submitButton, isSaving && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color={COLORS.black} />
            ) : (
              <Text style={styles.submitButtonText}>
                {mode === 'login' ? 'Sign In' : 'Create Profile'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Skip */}
        <TouchableOpacity style={styles.skipRow} onPress={onSkip} activeOpacity={0.7} disabled={isSaving}>
          <Text style={styles.skipText}>Continue as guest</Text>
          <Feather name="arrow-right" size={14} color={COLORS.onSurfaceVariant} />
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.surface },
  container: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 80,
    paddingBottom: 48,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.onSurface,
    letterSpacing: -0.8,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurfaceVariant,
  },
  tabTextActive: {
    color: COLORS.black,
  },
  form: { gap: 16 },
  field: { gap: 6 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: COLORS.onSurfaceVariant,
  },
  input: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.onSurface,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.error + '18',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.error,
    flex: 1,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.black,
    letterSpacing: -0.3,
  },
  skipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 32,
  },
  skipText: {
    fontSize: 14,
    color: COLORS.onSurfaceVariant,
  },
});
