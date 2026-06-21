export type Screen =
  | "splash"
  | "onboarding-poison"
  | "onboarding-goal"
  | "onboarding-interrupt"
  | "feed"
  | "fact-detail"
  | "focus"
  | "library"
  | "leaderboard"
  | "interactive"
  | "register"
  | "profile";

export interface Byte {
  id: string;
  category: string;
  title: string;
  content: string;
  curatedBy?: {
    name: string;
    avatar: string;
  };
  image?: string;
  source?: string;
  progress?: number;
  savedAt?: string;
  interactive?: boolean;
  format?: string;
  game?: any;
}

export interface UserProfile {
  id: string;
  name: string;
  avatar: string;
  xp: number;
  streak: number;
  focusMinutes: number;
  learnedBytes: number;
  rank: number;
}

export interface UserStats {
  focusMinutes: number;
  learnedBytes: number;
  streak: number;
  level: number;
  xp: number;
  rank: number;
}

export interface LeaderboardUser {
  id: string;
  name: string;
  xp: number;
  streak: number;
  avatar: string;
  isMe?: boolean;
}

export interface OnboardingProfile {
  selectedPoison: string;
  dailyGoal: string;
  interruptsEnabled: boolean;
  updatedAt: string;
}

export interface LeaderboardSeason {
  leagueName: string;
  division: string;
  round: number;
  totalRounds: number;
  promotionCutoffRank: number;
  timeLeft: string;
}
