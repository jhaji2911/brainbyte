import 'react-native-url-polyfill/auto';
import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SplashScreen } from './src/components/SplashScreen';
import { Onboarding } from './src/components/Onboarding';
import { DopamineFeed } from './src/components/DopamineFeed';
import { FactDetail } from './src/components/FactDetail';
import { FocusSession } from './src/components/FocusSession';
import { Library } from './src/components/Library';
import { Leaderboard } from './src/components/Leaderboard';
import { InteractiveLesson } from './src/components/InteractiveLesson';
import { Register } from './src/components/Register';
import { Profile } from './src/components/Profile';
import { InterruptOverlay } from './src/components/InterruptOverlay';
import { COLORS } from './src/theme';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './src/lib/queryClient';
import { AppStateProvider, useAppState } from './src/state/AppState';
import { useAppStore } from './src/store/useAppStore';

function AppShell() {
  const {
    currentScreen,
    user,
    bytes,
    savedBytes,
    selectedByte,
    leaderboard,
    season,
    onboarding,
    isBootstrapping,
    bootstrapProgress,
    bootstrapLabel,
    isSavingOnboarding,
    errorMessage,
    navigate,
    completeSplash,
    saveByte,
    removeByte,
    selectByte,
    completeInteractiveLesson,
    updateOnboardingPoison,
    updateOnboardingGoal,
    finishOnboardingStep,
    skipInterrupts,
    toggleInterrupts,
    showInterrupt,
    dismissInterrupt,
    triggerTestOverlay,
    register,
    login,
    updateAvatar,
  } = useAppState();

  const interruptOverlayVisible = useAppStore((s) => s.interruptOverlayVisible);
  const interruptByte = useAppStore((s) => s.interruptByte);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'splash':
        return (
          <SplashScreen
            isReady={!isBootstrapping}
            progress={bootstrapProgress}
            statusLabel={bootstrapLabel}
            onComplete={completeSplash}
          />
        );

      case 'onboarding-poison':
        return (
          <Onboarding
            step="poison"
            selectedPoison={onboarding.selectedPoison}
            selectedGoal={onboarding.dailyGoal}
            isSaving={isSavingOnboarding}
            onSelectPoison={updateOnboardingPoison}
            onSelectGoal={updateOnboardingGoal}
            onNext={finishOnboardingStep}
          />
        );

      case 'onboarding-goal':
        return (
          <Onboarding
            step="goal"
            selectedPoison={onboarding.selectedPoison}
            selectedGoal={onboarding.dailyGoal}
            isSaving={isSavingOnboarding}
            onSelectPoison={updateOnboardingPoison}
            onSelectGoal={updateOnboardingGoal}
            onNext={finishOnboardingStep}
          />
        );

      case 'onboarding-interrupt':
        return (
          <Onboarding
            step="interrupt"
            selectedPoison={onboarding.selectedPoison}
            selectedGoal={onboarding.dailyGoal}
            isSaving={isSavingOnboarding}
            onSelectPoison={updateOnboardingPoison}
            onSelectGoal={updateOnboardingGoal}
            onNext={finishOnboardingStep}
            onSkip={skipInterrupts}
          />
        );

      case 'feed':
        return (
          <DopamineFeed
            bytes={bytes}
            user={user}
            onNavigate={navigate}
            onSaveByte={saveByte}
            onSelectByte={selectByte}
          />
        );

      case 'interactive':
        return (
          <InteractiveLesson
            onComplete={completeInteractiveLesson}
            onNavigate={navigate}
          />
        );

      case 'focus':
        return <FocusSession onComplete={() => navigate('fact-detail')} onNavigate={navigate} />;

      case 'fact-detail':
        return (
          <FactDetail
            byte={selectedByte}
            user={user}
            isSaved={selectedByte ? savedBytes.includes(selectedByte.id) : false}
            onBack={() => navigate('feed')}
            onNavigate={navigate}
            onSaveByte={saveByte}
          />
        );

      case 'library':
        return (
          <Library
            bytes={bytes}
            user={user}
            onNavigate={navigate}
            savedIds={savedBytes}
            onRemoveByte={removeByte}
            onSelectByte={(id) => selectByte(id)}
          />
        );

      case 'leaderboard':
        return (
          <Leaderboard
            onNavigate={navigate}
            entries={leaderboard}
            season={season}
            user={user}
          />
        );

      case 'register':
        return (
          <Register
            isSaving={isSavingOnboarding}
            errorMessage={errorMessage}
            onRegister={register}
            onLogin={login}
            onSkip={() => navigate('feed')}
          />
        );

      case 'profile':
        return (
          <Profile
            user={user}
            savedBytesCount={savedBytes.length}
            interruptsEnabled={onboarding.interruptsEnabled}
            onNavigate={navigate}
            onToggleInterrupts={toggleInterrupts}
            onTestInterrupt={triggerTestOverlay}
            onUpdateAvatar={updateAvatar}
          />
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {renderScreen()}
      {errorMessage && currentScreen !== 'splash' ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}
      <InterruptOverlay
        visible={interruptOverlayVisible}
        byte={interruptByte}
        onDismiss={dismissInterrupt}
      />
    </View>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AppStateProvider>
          <AppShell />
        </AppStateProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  errorBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    backgroundColor: COLORS.surfaceContainerHighest,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.primary + '44',
  },
  errorText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
});
