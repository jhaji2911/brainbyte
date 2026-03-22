import React from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { api } from '../api';
import { Screen } from '../types';
import { useAppStore } from '../store/useAppStore';
import { appMonitor, goalToCooldownMs, POISON_APP_PACKAGES } from '../lib/appMonitor';

// AppStateProvider is kept for structural compatibility but is now a no-op.
// All state lives in the Zustand store; queries are managed by React Query.
export function AppStateProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/**
 * Runs the bootstrap query once, hydrates the Zustand store with the result,
 * and animates the splash-screen progress labels while loading.
 * Returns true while the query is still pending.
 */
function useBootstrap(): boolean {
  const setAuth = useAppStore((s) => s.setAuth);
  const setSavedBytes = useAppStore((s) => s.setSavedBytes);
  const setOnboarding = useAppStore((s) => s.setOnboarding);
  const setBytes = useAppStore((s) => s.setBytes);
  const setLeaderboard = useAppStore((s) => s.setLeaderboard);
  const setErrorMessage = useAppStore((s) => s.setErrorMessage);
  const setBootstrapProgress = useAppStore((s) => s.setBootstrapProgress);
  const setBootstrapLabel = useAppStore((s) => s.setBootstrapLabel);
  const setSelectedByteId = useAppStore((s) => s.setSelectedByteId);

  const { data, status, error } = useQuery({
    queryKey: ['bootstrap'],
    queryFn: () => api.bootstrap(),
    retry: 0,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // Animate progress labels while the query is in-flight
  React.useEffect(() => {
    if (status !== 'pending') return;
    setBootstrapLabel('Initializing Session');
    setBootstrapProgress(0.3);
    const t1 = setTimeout(() => {
      setBootstrapLabel('Syncing Knowledge Feed');
      setBootstrapProgress(0.62);
    }, 1500);
    const t2 = setTimeout(() => setBootstrapProgress(0.85), 3500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [status, setBootstrapLabel, setBootstrapProgress]);

  // Hydrate store on success / fall back gracefully on error
  React.useEffect(() => {
    if (status === 'success' && data) {
      if (data.token && data.user) {
        setAuth(data.token, data.user);
        setSavedBytes(data.savedFactIds);
        if (data.onboarding) setOnboarding(data.onboarding);
      }
      setBytes(data.facts);
      setSelectedByteId(data.facts[1]?.id ?? data.facts[0]?.id ?? null);
      setLeaderboard(data.leaderboard.entries, data.leaderboard.season);
      setBootstrapLabel('Neural Accelerator Ready');
      setBootstrapProgress(1);
    } else if (status === 'error') {
      setBootstrapLabel('Offline Mode Ready');
      setBootstrapProgress(1);
      setErrorMessage(
        error instanceof Error
          ? `${error.message}. Using local mock data until the API is reachable.`
          : 'Could not reach the API. Using local mock data until the API is reachable.'
      );
    }
  }, [
    status,
    data,
    error,
    setAuth,
    setBytes,
    setBootstrapLabel,
    setBootstrapProgress,
    setErrorMessage,
    setLeaderboard,
    setOnboarding,
    setSavedBytes,
    setSelectedByteId,
  ]);

  return status === 'pending';
}

export function useAppState() {
  const isBootstrapping = useBootstrap();

  const currentScreen = useAppStore((s) => s.currentScreen);
  const authToken = useAppStore((s) => s.authToken);
  const user = useAppStore((s) => s.user);
  const bytes = useAppStore((s) => s.bytes);
  const savedBytes = useAppStore((s) => s.savedBytes);
  const selectedByteId = useAppStore((s) => s.selectedByteId);
  const leaderboard = useAppStore((s) => s.leaderboard);
  const season = useAppStore((s) => s.season);
  const onboarding = useAppStore((s) => s.onboarding);
  const hasCompletedOnboarding = useAppStore((s) => s.hasCompletedOnboarding);
  const splashComplete = useAppStore((s) => s.splashComplete);
  const isSavingOnboarding = useAppStore((s) => s.isSavingOnboarding);
  const errorMessage = useAppStore((s) => s.errorMessage);
  const bootstrapProgress = useAppStore((s) => s.bootstrapProgress);
  const bootstrapLabel = useAppStore((s) => s.bootstrapLabel);

  const setScreen = useAppStore((s) => s.setScreen);
  const setPendingScreen = useAppStore((s) => s.setPendingScreen);
  const setSplashComplete = useAppStore((s) => s.setSplashComplete);
  const addSavedByte = useAppStore((s) => s.addSavedByte);
  const removeSavedByte = useAppStore((s) => s.removeSavedByte);
  const setSelectedByteId = useAppStore((s) => s.setSelectedByteId);
  const setAuth = useAppStore((s) => s.setAuth);
  const setSavedBytes = useAppStore((s) => s.setSavedBytes);
  const setOnboarding = useAppStore((s) => s.setOnboarding);
  const setHasCompletedOnboarding = useAppStore((s) => s.setHasCompletedOnboarding);
  const setIsSavingOnboarding = useAppStore((s) => s.setIsSavingOnboarding);
  const setErrorMessage = useAppStore((s) => s.setErrorMessage);
  const updateOnboardingPoisonFn = useAppStore((s) => s.updateOnboardingPoison);
  const updateOnboardingGoalFn = useAppStore((s) => s.updateOnboardingGoal);
  const updateOnboardingInterruptsFn = useAppStore((s) => s.updateOnboardingInterrupts);
  const setInterruptOverlay = useAppStore((s) => s.setInterruptOverlay);
  const interruptOverlayVisible = useAppStore((s) => s.interruptOverlayVisible);

  // Screens where an interrupt would disrupt active learning — suppress here
  const LEARNING_SCREENS = ['fact-detail', 'interactive', 'focus',
    'onboarding-poison', 'onboarding-goal', 'onboarding-interrupt'] as const;

  // Stable ref so closures (timer, native event) always read the latest screen
  const currentScreenRef = React.useRef(currentScreen);
  const interruptVisibleRef = React.useRef(interruptOverlayVisible);
  React.useEffect(() => { currentScreenRef.current = currentScreen; }, [currentScreen]);
  React.useEffect(() => { interruptVisibleRef.current = interruptOverlayVisible; }, [interruptOverlayVisible]);

  const isBusyLearning = () =>
    (LEARNING_SCREENS as readonly string[]).includes(currentScreenRef.current) ||
    interruptVisibleRef.current;

  const navigate = React.useCallback((screen: Screen) => {
    if (!authToken && screen === 'leaderboard') {
      setPendingScreen('leaderboard');
      setScreen('register');
      return;
    }
    setScreen(screen);
  }, [authToken, setScreen, setPendingScreen]);

  React.useEffect(() => {
    if (!splashComplete || isBootstrapping) return;
    setScreen(hasCompletedOnboarding ? 'feed' : 'onboarding-poison');
  }, [splashComplete, isBootstrapping, hasCompletedOnboarding, setScreen]);

  const saveByte = React.useCallback(
    async (id: string) => {
      if (!authToken) {
        setPendingScreen('feed');
        setScreen('register');
        return;
      }
      addSavedByte(id);
      try {
        await api.saveFact(authToken, id);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Could not save this byte.');
      }
    },
    [authToken, addSavedByte, setErrorMessage, setPendingScreen, setScreen]
  );

  const removeByte = React.useCallback(
    async (id: string) => {
      removeSavedByte(id);
      if (!authToken) return;
      try {
        await api.unsaveFact(authToken, id);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Could not remove this byte.');
      }
    },
    [authToken, removeSavedByte, setErrorMessage]
  );

  // Always open fact-detail — the Morse Code byte shows a "Start Lesson" CTA inside FactDetail
  const selectByte = React.useCallback(
    (id: string) => {
      setSelectedByteId(id);
      setScreen('fact-detail');
    },
    [setSelectedByteId, setScreen]
  );

  const completeInteractiveLesson = React.useCallback(() => {
    setScreen('feed');
  }, [setScreen]);

  const _saveOnboardingAndNavigate = React.useCallback(
    async (overrideProfile?: Partial<typeof onboarding>) => {
      const finalProfile = overrideProfile ? { ...onboarding, ...overrideProfile } : onboarding;
      setIsSavingOnboarding(true);
      try {
        if (authToken) {
          const profile = await api.upsertOnboarding(authToken, finalProfile);
          setOnboarding(profile);
        } else {
          setHasCompletedOnboarding(true);
        }
        setScreen('feed');
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Could not save onboarding.');
      } finally {
        setIsSavingOnboarding(false);
      }
    },
    [authToken, onboarding, setScreen, setIsSavingOnboarding, setOnboarding, setHasCompletedOnboarding, setErrorMessage]
  );

  const finishOnboardingStep = React.useCallback(async () => {
    if (currentScreen === 'onboarding-poison') { setScreen('onboarding-goal'); return; }
    if (currentScreen === 'onboarding-goal') { setScreen('onboarding-interrupt'); return; }
    // Interrupt step — user clicked "Enable Interrupts" (permission already handled in UI)
    updateOnboardingInterruptsFn(true);
    await _saveOnboardingAndNavigate({ interruptsEnabled: true });
  }, [currentScreen, setScreen, updateOnboardingInterruptsFn, _saveOnboardingAndNavigate]);

  const skipInterrupts = React.useCallback(async () => {
    updateOnboardingInterruptsFn(false);
    await _saveOnboardingAndNavigate({ interruptsEnabled: false });
  }, [updateOnboardingInterruptsFn, _saveOnboardingAndNavigate]);

  const toggleInterrupts = React.useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        if (Platform.OS === 'android') {
          Alert.alert(
            'Draw Over Other Apps',
            'To interrupt your doomscrolling, BrainByte needs the "Display over other apps" permission.\n\nOpen Settings → Apps → Special App Access → Display over other apps.',
            [
              { text: 'Not Now', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
          // Proceed optimistically — user has been guided to grant it
        } else {
          const { status } = await Notifications.requestPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert(
              'Permission Needed',
              'Allow notifications for BrainByte in Settings to receive interrupts.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openURL('app-settings:') },
              ]
            );
            return;
          }
        }
      }
      updateOnboardingInterruptsFn(enabled);
      if (authToken) {
        try {
          await api.upsertOnboarding(authToken, { ...onboarding, interruptsEnabled: enabled });
        } catch (err) {
          setErrorMessage(err instanceof Error ? err.message : 'Could not update interrupt setting.');
        }
      }
    },
    [authToken, onboarding, updateOnboardingInterruptsFn, setErrorMessage]
  );

  const showInterrupt = React.useCallback(() => {
    // Never interrupt while the user is actively learning or overlay already up
    if (isBusyLearning()) return;
    const randomByte = bytes[Math.floor(Math.random() * bytes.length)] ?? null;
    setInterruptOverlay(true, randomByte);
  }, [bytes, setInterruptOverlay]);

  const dismissInterrupt = React.useCallback(() => {
    setInterruptOverlay(false);
  }, [setInterruptOverlay]);

  // Triggers the native full-screen overlay for testing.
  // Checks overlay permission at runtime: shows native overlay if granted,
  // falls back to the in-app modal otherwise (covers iOS and Android without permission).
  const triggerTestOverlay = React.useCallback(async () => {
    if (appMonitor.isAvailable) {
      const hasOverlay = await appMonitor.hasOverlayPermission();
      if (hasOverlay) {
        appMonitor.triggerTestOverlay();
        return;
      }
    }
    showInterrupt();
  }, [showInterrupt]);

  // ── Background usage-stats monitor ──────────────────────────────
  // The AppMonitorService handles everything on the native side:
  //  • draws a WindowManager banner OVER the distraction app
  //  • sends a notification
  // The JS onDistractionDetected event is intentionally NOT wired to
  // showInterrupt() — the in-app modal must never appear while the
  // user is inside another app.
  React.useEffect(() => {
    if (!appMonitor.isAvailable || !onboarding.interruptsEnabled) {
      appMonitor.stopMonitoring();
      return;
    }

    appMonitor.hasUsagePermission().then((hasPerms) => {
      if (!hasPerms) return;
      const cooldown = goalToCooldownMs(onboarding.dailyGoal);
      appMonitor.startMonitoring(15_000, cooldown, POISON_APP_PACKAGES);
    });

    // Subscribe just to keep RN event emitter happy; native handles the actual UI.
    const unsub = appMonitor.onDistractionDetected(() => {});

    return () => {
      unsub();
      appMonitor.stopMonitoring();
    };
  }, [onboarding.interruptsEnabled, onboarding.dailyGoal]);

  const selectedByte = bytes.find((b) => b.id === selectedByteId) ?? bytes[0] ?? null;

  const register = React.useCallback(
    async (name: string, email: string, password: string) => {
      setIsSavingOnboarding(true);
      try {
        const { token, user: newUser } = await api.register(name, email, password);
        setAuth(token, newUser);
        const profile = await api.upsertOnboarding(token, onboarding);
        setOnboarding(profile);
        const pendingScreen = useAppStore.getState().pendingScreen;
        setPendingScreen(null);
        setScreen(pendingScreen ?? 'feed');
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Could not create your profile.');
      } finally {
        setIsSavingOnboarding(false);
      }
    },
    [onboarding, setAuth, setOnboarding, setScreen, setPendingScreen, setIsSavingOnboarding, setErrorMessage]
  );

  const login = React.useCallback(
    async (email: string, password: string) => {
      setIsSavingOnboarding(true);
      try {
        const { token, user: loggedUser } = await api.login(email, password);
        setAuth(token, loggedUser);
        const pending = useAppStore.getState().pendingScreen;
        setPendingScreen(null);
        setScreen(pending ?? 'feed');
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Incorrect email or password.');
      } finally {
        setIsSavingOnboarding(false);
      }
    },
    [setAuth, setScreen, setPendingScreen, setIsSavingOnboarding, setErrorMessage]
  );

  const updateAvatar = React.useCallback(
    async (uri: string) => {
      if (!authToken || !user) return;
      const setUser = useAppStore.getState().setUser;
      setUser({ ...user, avatar: uri });
      try {
        await api.updateAvatar(authToken, uri);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Could not update avatar.');
      }
    },
    [authToken, user, setErrorMessage]
  );

  return {
    currentScreen,
    authToken,
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
    completeSplash: () => setSplashComplete(true),
    saveByte,
    removeByte,
    selectByte,
    completeInteractiveLesson,
    updateOnboardingPoison: updateOnboardingPoisonFn,
    updateOnboardingGoal: updateOnboardingGoalFn,
    finishOnboardingStep,
    skipInterrupts,
    toggleInterrupts,
    showInterrupt,
    dismissInterrupt,
    triggerTestOverlay,
    register,
    login,
    updateAvatar,
  };
}
