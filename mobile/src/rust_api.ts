/**
 * BrainByte v2 API Client
 * =======================
 * Talks to the BrainByte v2 curation agent backend.
 * The agent decides what to curate, generates content via LLM,
 * and learns from user interactions.
 *
 * Backend: brainbyte-v2/server.py (port 8080)
 */

import {
  Byte,
  LeaderboardSeason,
  LeaderboardUser,
  OnboardingProfile,
  UserProfile,
} from "./types";
import { BYTES, LEADERBOARD } from "./constants";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080";

async function request<T>(
  method: string,
  path: string,
  token?: string | null,
  body?: unknown,
): Promise<T> {
  const url = `${API_BASE}/api${path}`;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const resp = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail ?? err.error ?? `HTTP ${resp.status}`);
  }

  return resp.json();
}

// ── v2 Response Shapes ──────────────────────────────────────────────────────

interface V2AuthResponse {
  token: string;
  user: { id: string; name: string; interests: string[] };
  preloaded?: V2CuratedByte[];
}
interface V2MeResponse {
  data: { user: any; onboarding: any; saved_fact_ids: string[] };
}
interface V2CuratedByte {
  id: string;
  title: string;
  content: string;
  category: string;
  difficulty: number;
  format: string;
  source: string;
  tags: string[];
  agent_reason: string;
}
interface V2BatchResponse {
  bytes: V2CuratedByte[];
}
interface V2LearnResponse {
  reward: number;
  episode_id: string;
  message: string;
}
interface V2LeaderboardResponse {
  data: { season: any; entries: any[] };
}

// ── Mappers ─────────────────────────────────────────────────────────────────

function mapV2User(v2: V2AuthResponse["user"]): UserProfile {
  return {
    id: v2.id,
    name: v2.name,
    avatar: "",
    xp: 0,
    streak: 0,
    focusMinutes: 0,
    learnedBytes: 0,
    rank: 1,
  };
}

function mapV2Byte(v2: V2CuratedByte): Byte {
  let game = (v2 as any).game;
  // If the byte has format_type but game data is embedded in content,
  // try to parse it from the content JSON
  if (
    !game &&
    v2.format &&
    ["quiz", "word_scramble", "fill_blank"].includes(v2.format)
  ) {
    try {
      game = JSON.parse(v2.content);
    } catch {}
  }
  return {
    id: v2.id,
    category: v2.category,
    title: v2.title,
    content: v2.content,
    source: v2.source,
    format: v2.format,
    game,
    curatedBy: undefined,
    image: undefined,
    progress: undefined,
    savedAt: undefined,
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

export const rustApi = {
  /** Register with name + interests (v2 simple auth). */
  async register(
    name: string,
    email: string,
    _password: string,
  ): Promise<{ token: string; user: UserProfile; preloaded?: Byte[] }> {
    const data = await request<V2AuthResponse>("POST", "/auth/register", null, {
      name: name || "Learner",
      interests: [],
    });
    return {
      token: data.token,
      user: mapV2User(data.user),
      preloaded: data.preloaded?.map(mapV2Byte),
    };
  },

  /** Login with user ID. */
  async login(
    email: string,
    _password: string,
  ): Promise<{ token: string; user: UserProfile }> {
    // v2 login uses user_id; treat email param as user_id
    const data = await request<V2AuthResponse>("POST", "/auth/login", null, {
      user_id: email,
    });
    return { token: data.token, user: mapV2User(data.user) };
  },

  /** Get current user profile. */
  async getProfile(token: string): Promise<{
    user: UserProfile;
    onboarding: OnboardingProfile | null;
    savedFactIds: string[];
  }> {
    const data = await request<V2MeResponse>("GET", "/auth/me", token);
    return {
      user: data.data.user as UserProfile,
      onboarding: data.data.onboarding as OnboardingProfile,
      savedFactIds: data.data.saved_fact_ids,
    };
  },

  /** Get agent-curated recommendations. */
  async getRecommendedFacts(
    token: string,
    nResults = 10,
  ): Promise<{
    facts: Byte[];
    cotTrace: unknown;
    timestamp: string;
  }> {
    const data = await request<V2BatchResponse>(
      "POST",
      `/feed/curate-batch?count=${nResults}`,
      token,
    );
    return {
      facts: data.bytes.map(mapV2Byte),
      cotTrace: null,
      timestamp: new Date().toISOString(),
    };
  },

  /** Send interaction signal to the learning agent. */
  async learnInteraction(
    token: string,
    contentId: string,
    action: string,
    dwellTime = 0,
    rating = 0,
  ): Promise<{
    reward: number;
    episodeId: string;
    message: string;
  }> {
    const data = await request<V2LearnResponse>(
      "POST",
      "/feed/interact",
      token,
      {
        content_id: contentId,
        action,
        dwell_time: dwellTime,
        rating,
      },
    );
    return {
      reward: data.reward,
      episodeId: data.episode_id,
      message: data.message,
    };
  },

  /** Save a fact (v2: saves are handled via learnInteraction with action="save"). */
  async saveFact(
    token: string,
    factId: string,
  ): Promise<{ fact_id: string; saved: boolean }> {
    // Already handled by learnInteraction in the saveByte flow
    return { fact_id: factId, saved: true };
  },

  /** Unsave a fact (v2: no native unsave — no-op for now). */
  async unsaveFact(
    _token: string,
    factId: string,
  ): Promise<{ fact_id: string; saved: boolean }> {
    return { fact_id: factId, saved: false };
  },

  /** Get leaderboard. */
  async getLeaderboard(
    token: string | null,
  ): Promise<{ season: LeaderboardSeason; entries: LeaderboardUser[] }> {
    try {
      const data = await request<V2LeaderboardResponse>(
        "GET",
        "/leaderboard",
        token,
      );
      return {
        season: {
          leagueName: data.data.season.league_name,
          division: data.data.season.division,
          round: data.data.season.round,
          totalRounds: data.data.season.total_rounds,
          promotionCutoffRank: data.data.season.promotion_cutoff_rank,
          timeLeft: data.data.season.time_left,
        },
        entries: data.data.entries.map((e: any) => ({
          id: e.id,
          name: e.name,
          xp: e.xp,
          streak: e.streak,
          avatar: e.avatar,
          rank: e.rank,
          isMe: e.is_me,
        })),
      };
    } catch {
      return {
        season: {
          leagueName: "Obsidian",
          division: "Alpha",
          round: 1,
          totalRounds: 12,
          promotionCutoffRank: 10,
          timeLeft: "7d",
        },
        entries: LEADERBOARD,
      };
    }
  },

  async getOnboarding(_token: string): Promise<OnboardingProfile> {
    return {
      selectedPoison: "General",
      dailyGoal: "Growth (5-7 bytes)",
      interruptsEnabled: false,
      updatedAt: new Date().toISOString(),
    };
  },

  async upsertOnboarding(
    _token: string,
    _payload: any,
  ): Promise<OnboardingProfile> {
    return {
      selectedPoison: _payload.selectedPoison,
      dailyGoal: _payload.dailyGoal,
      interruptsEnabled: _payload.interruptsEnabled,
      updatedAt: new Date().toISOString(),
    };
  },

  /** Bootstrap — fetch initial data. No leaderboard — loaded lazily. */
  async bootstrap(token?: string | null): Promise<{
    token: string | null;
    user: UserProfile | null;
    onboarding: OnboardingProfile | null;
    savedFactIds: string[];
    facts: Byte[];
    leaderboard: { season: LeaderboardSeason; entries: LeaderboardUser[] };
  }> {
    if (!token) {
      return {
        token: null,
        user: null,
        onboarding: null,
        savedFactIds: [],
        facts: BYTES,
        leaderboard: {
          season: {
            leagueName: "Obsidian",
            division: "Alpha",
            round: 1,
            totalRounds: 12,
            promotionCutoffRank: 10,
            timeLeft: "7d",
          },
          entries: LEADERBOARD,
        },
      };
    }

    const [profileData, recData] = await Promise.all([
      rustApi.getProfile(token).catch(() => null),
      rustApi.getRecommendedFacts(token, 12).catch(() => null),
    ]);

    return {
      token,
      user: profileData?.user ?? null,
      onboarding: profileData?.onboarding ?? null,
      savedFactIds: profileData?.savedFactIds ?? [],
      facts: recData?.facts ?? BYTES,
      leaderboard: {
        season: {
          leagueName: "Obsidian",
          division: "Alpha",
          round: 1,
          totalRounds: 12,
          promotionCutoffRank: 10,
          timeLeft: "7d",
        },
        entries: LEADERBOARD,
      },
    };
  },

  async saveToken(_token: string): Promise<void> {},
  async clearToken(): Promise<void> {},
};
