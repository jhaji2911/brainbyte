import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  query,
  orderBy,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { Byte, LeaderboardSeason, LeaderboardUser, OnboardingProfile, UserProfile } from './types';
import { BYTES, LEADERBOARD } from './constants';

const BOOTSTRAP_TIMEOUT_MS = 8000;

// ── Firestore document shapes ────────────────────────────────────────────────

interface FSFact {
  category: string;
  title: string;
  content: string;
  curatedBy?: { name: string; avatar: string } | null;
  image?: string | null;
  source?: string | null;
  interactive?: boolean | null;
  order?: number;
}

interface FSUser {
  name: string;
  avatar: string;
  xp: number;
  streak: number;
  focusMinutes: number;
  learnedBytes: number;
  rank: number;
  savedFactIds: string[];
  onboarding?: FSOnboarding | null;
}

interface FSOnboarding {
  selectedPoison: string;
  dailyGoal: string;
  interruptsEnabled: boolean;
  updatedAt: string;
}

interface FSLeaderboard {
  leagueName: string;
  division: string;
  round: number;
  totalRounds: number;
  promotionCutoffRank: number;
  timeLeft: string;
  entries: Array<{
    id: string;
    name: string;
    xp: number;
    streak: number;
    avatar: string;
    rank: number;
  }>;
}

// ── Mappers ──────────────────────────────────────────────────────────────────

function mapFact(id: string, data: FSFact): Byte {
  return {
    id,
    category: data.category,
    title: data.title,
    content: data.content,
    curatedBy: data.curatedBy ?? undefined,
    image: data.image ?? undefined,
    source: data.source ?? undefined,
    interactive: data.interactive ?? undefined,
  };
}

function mapUser(uid: string, data: FSUser): UserProfile {
  return {
    id: uid,
    name: data.name,
    avatar: data.avatar,
    xp: data.xp,
    streak: data.streak,
    focusMinutes: data.focusMinutes,
    learnedBytes: data.learnedBytes,
    rank: data.rank,
  };
}

function mapOnboarding(data: FSOnboarding): OnboardingProfile {
  return {
    selectedPoison: data.selectedPoison,
    dailyGoal: data.dailyGoal,
    interruptsEnabled: data.interruptsEnabled,
    updatedAt: data.updatedAt,
  };
}

function _fallbackSeason(): LeaderboardSeason {
  return {
    leagueName: 'Diamond',
    division: 'Alpha',
    round: 1,
    totalRounds: 5,
    promotionCutoffRank: 3,
    timeLeft: '7 days left',
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

export const api = {
  baseUrl: `https://firestore.googleapis.com/v1/projects/${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}`,

  async getFacts(_token?: string, savedOnly?: boolean): Promise<Byte[]> {
    try {
      const uid = auth.currentUser?.uid;
      const factsQuery = query(collection(db, 'facts'), orderBy('order', 'asc'));
      const snapshot = await getDocs(factsQuery);
      const facts = snapshot.docs.map((d) => mapFact(d.id, d.data() as FSFact));

      if (savedOnly && uid) {
        const userSnap = await getDoc(doc(db, 'users', uid));
        const savedIds: string[] = (userSnap.data() as FSUser)?.savedFactIds ?? [];
        return facts.filter((f) => savedIds.includes(f.id));
      }

      return facts;
    } catch {
      return BYTES;
    }
  },

  async getLeaderboard(_token?: string): Promise<{
    season: LeaderboardSeason;
    entries: LeaderboardUser[];
  }> {
    try {
      const uid = auth.currentUser?.uid;
      const snap = await getDoc(doc(db, 'leaderboard', 'current'));

      if (!snap.exists()) {
        return { season: _fallbackSeason(), entries: LEADERBOARD };
      }

      const data = snap.data() as FSLeaderboard;
      return {
        season: {
          leagueName: data.leagueName,
          division: data.division,
          round: data.round,
          totalRounds: data.totalRounds,
          promotionCutoffRank: data.promotionCutoffRank,
          timeLeft: data.timeLeft,
        },
        entries: data.entries.map((e) => ({
          id: e.id,
          name: e.name,
          xp: e.xp,
          streak: e.streak,
          avatar: e.avatar,
          rank: e.rank,
          isMe: uid ? e.id === uid : false,
        })),
      };
    } catch {
      return { season: _fallbackSeason(), entries: LEADERBOARD };
    }
  },

  async register(
    name: string,
    email: string,
    password: string,
  ): Promise<{ token: string; user: UserProfile }> {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const { uid } = credential.user;

    const newUser: FSUser = {
      name,
      avatar: `https://i.pravatar.cc/150?u=${uid}`,
      xp: 0,
      streak: 0,
      focusMinutes: 0,
      learnedBytes: 0,
      rank: 0,
      savedFactIds: [],
    };

    await setDoc(doc(db, 'users', uid), newUser);

    return { token: uid, user: mapUser(uid, newUser) };
  },

  async login(
    email: string,
    password: string,
  ): Promise<{ token: string; user: UserProfile }> {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const { uid } = credential.user;
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (!userSnap.exists()) throw new Error('User profile not found.');
    const data = userSnap.data() as FSUser;
    return { token: uid, user: mapUser(uid, data) };
  },

  async updateAvatar(_token: string, uri: string): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');
    await updateDoc(doc(db, 'users', uid), { avatar: uri });
  },

  /** No-op: Firebase Auth handles token persistence automatically. */
  async saveToken(_token: string): Promise<void> {},
  /** Signs the current user out of Firebase Auth. */
  async clearToken(): Promise<void> {
    await signOut(auth).catch(() => {});
  },

  async saveFact(_token: string, factId: string): Promise<{ fact_id: string; saved: boolean }> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');
    await updateDoc(doc(db, 'users', uid), { savedFactIds: arrayUnion(factId) });
    return { fact_id: factId, saved: true };
  },

  async unsaveFact(_token: string, factId: string): Promise<{ fact_id: string; saved: boolean }> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');
    await updateDoc(doc(db, 'users', uid), { savedFactIds: arrayRemove(factId) });
    return { fact_id: factId, saved: false };
  },

  async upsertOnboarding(
    _token: string,
    payload: Pick<OnboardingProfile, 'selectedPoison' | 'dailyGoal' | 'interruptsEnabled'>,
  ): Promise<OnboardingProfile> {
    const uid = auth.currentUser?.uid;
    const onboarding: FSOnboarding = {
      selectedPoison: payload.selectedPoison,
      dailyGoal: payload.dailyGoal,
      interruptsEnabled: payload.interruptsEnabled,
      updatedAt: new Date().toISOString(),
    };

    if (uid) {
      await setDoc(doc(db, 'users', uid), { onboarding }, { merge: true });
    }

    return mapOnboarding(onboarding);
  },

  async bootstrap(): Promise<{
    token: string | null;
    user: UserProfile | null;
    onboarding: OnboardingProfile | null;
    savedFactIds: string[];
    facts: Byte[];
    leaderboard: { season: LeaderboardSeason; entries: LeaderboardUser[] };
  }> {
    const run = async () => {
      // Wait for Firebase Auth to rehydrate the persisted session from AsyncStorage
      // before reading currentUser — otherwise it's null on every cold start.
      await auth.authStateReady();
      const firebaseUser = auth.currentUser;

      let session: {
        token: string;
        user: UserProfile;
        onboarding: OnboardingProfile | null;
        savedFactIds: string[];
      } | null = null;

      if (firebaseUser) {
        try {
          const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userSnap.exists()) {
            const data = userSnap.data() as FSUser;
            session = {
              token: firebaseUser.uid,
              user: mapUser(firebaseUser.uid, data),
              onboarding: data.onboarding ? mapOnboarding(data.onboarding) : null,
              savedFactIds: data.savedFactIds ?? [],
            };
          }
        } catch {
          // Firestore unavailable — continue as guest
        }
      }

      const [facts, leaderboard] = await Promise.all([
        api.getFacts(session?.token),
        api.getLeaderboard(session?.token),
      ]);

      return {
        token: session?.token ?? null,
        user: session?.user ?? null,
        onboarding: session?.onboarding ?? null,
        savedFactIds: session?.savedFactIds ?? [],
        facts,
        leaderboard,
      };
    };

    return Promise.race([
      run(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Bootstrap timed out')), BOOTSTRAP_TIMEOUT_MS),
      ),
    ]);
  },
};
