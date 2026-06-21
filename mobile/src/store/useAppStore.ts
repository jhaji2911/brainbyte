import { create } from "zustand";
import {
  Byte,
  LeaderboardSeason,
  LeaderboardUser,
  OnboardingProfile,
  Screen,
  UserProfile,
} from "../types";
import { BYTES, LEADERBOARD } from "../constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

const INITIAL_ONBOARDING: OnboardingProfile = {
  selectedPoison: "",
  dailyGoal: "Growth (5-7 bytes)",
  interruptsEnabled: false,
  updatedAt: new Date().toISOString(),
};

export interface AppStore {
  // Navigation
  currentScreen: Screen;
  setScreen: (screen: Screen) => void;
  pendingScreen: Screen | null;
  setPendingScreen: (screen: Screen | null) => void;

  // Auth
  authToken: string | null;
  user: UserProfile | null;
  setAuth: (token: string, user: UserProfile) => void;
  setUser: (user: UserProfile) => void;
  clearAuth: () => void;

  // Bytes
  bytes: Byte[];
  setBytes: (bytes: Byte[]) => void;
  savedBytes: string[];
  setSavedBytes: (ids: string[]) => void;
  addSavedByte: (id: string) => void;
  removeSavedByte: (id: string) => void;
  selectedByteId: string | null;
  setSelectedByteId: (id: string | null) => void;

  // Leaderboard
  leaderboard: LeaderboardUser[];
  season: LeaderboardSeason | null;
  setLeaderboard: (
    entries: LeaderboardUser[],
    season: LeaderboardSeason,
  ) => void;

  // Onboarding
  onboarding: OnboardingProfile;
  hasCompletedOnboarding: boolean;
  setOnboarding: (profile: OnboardingProfile) => void;
  setHasCompletedOnboarding: (value: boolean) => void;
  updateOnboardingPoison: (value: string) => void;
  updateOnboardingGoal: (value: string) => void;
  updateOnboardingInterrupts: (value: boolean) => void;

  // Interrupt overlay
  interruptOverlayVisible: boolean;
  interruptByte: Byte | null;
  setInterruptOverlay: (visible: boolean, byte?: Byte | null) => void;

  // Bootstrap UI
  bootstrapProgress: number;
  bootstrapLabel: string;
  setBootstrapProgress: (v: number) => void;
  setBootstrapLabel: (v: string) => void;

  // Misc UI
  splashComplete: boolean;
  setSplashComplete: (value: boolean) => void;
  errorMessage: string | null;
  setErrorMessage: (msg: string | null) => void;
  isSavingOnboarding: boolean;
  setIsSavingOnboarding: (value: boolean) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  currentScreen: "splash",
  setScreen: (screen) => set({ currentScreen: screen }),

  pendingScreen: null,
  setPendingScreen: (screen) => set({ pendingScreen: screen }),

  authToken: null,
  user: null,
  setAuth: (token, user) => {
    AsyncStorage.setItem("auth_token", token).catch(() => {});
    AsyncStorage.setItem("auth_user", JSON.stringify(user)).catch(() => {});
    set({ authToken: token, user });
  },
  setUser: (user) => {
    AsyncStorage.setItem("auth_user", JSON.stringify(user)).catch(() => {});
    set({ user });
  },
  clearAuth: () => {
    AsyncStorage.multiRemove(["auth_token", "auth_user"]).catch(() => {});
    set({ authToken: null, user: null });
  },

  bytes: BYTES,
  setBytes: (incoming) => {
    // No hardcoded content injection — all content comes from the v2 backend
    set({ bytes: incoming });
  },
  savedBytes: [],
  setSavedBytes: (ids) => set({ savedBytes: ids }),
  addSavedByte: (id) =>
    set((s) => ({
      savedBytes: s.savedBytes.includes(id)
        ? s.savedBytes
        : [...s.savedBytes, id],
    })),
  removeSavedByte: (id) =>
    set((s) => ({ savedBytes: s.savedBytes.filter((b) => b !== id) })),
  selectedByteId: null,
  setSelectedByteId: (id) => set({ selectedByteId: id }),

  leaderboard: LEADERBOARD,
  season: null,
  setLeaderboard: (entries, season) => set({ leaderboard: entries, season }),

  onboarding: INITIAL_ONBOARDING,
  hasCompletedOnboarding: false,
  setOnboarding: (profile) =>
    set({ onboarding: profile, hasCompletedOnboarding: true }),
  setHasCompletedOnboarding: (value) => set({ hasCompletedOnboarding: value }),
  updateOnboardingPoison: (value) =>
    set((s) => ({ onboarding: { ...s.onboarding, selectedPoison: value } })),
  updateOnboardingGoal: (value) =>
    set((s) => ({ onboarding: { ...s.onboarding, dailyGoal: value } })),
  updateOnboardingInterrupts: (value) =>
    set((s) => ({ onboarding: { ...s.onboarding, interruptsEnabled: value } })),

  interruptOverlayVisible: false,
  interruptByte: null,
  setInterruptOverlay: (visible, byte = null) =>
    set({ interruptOverlayVisible: visible, interruptByte: byte ?? null }),

  bootstrapProgress: 0.18,
  bootstrapLabel: "System Initializing",
  setBootstrapProgress: (v) => set({ bootstrapProgress: v }),
  setBootstrapLabel: (v) => set({ bootstrapLabel: v }),

  splashComplete: false,
  setSplashComplete: (value) => set({ splashComplete: value }),
  errorMessage: null,
  setErrorMessage: (msg) => set({ errorMessage: msg }),
  isSavingOnboarding: false,
  setIsSavingOnboarding: (value) => set({ isSavingOnboarding: value }),
}));
