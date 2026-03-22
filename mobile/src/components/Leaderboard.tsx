import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomNav } from './BottomNav';
import { InitialsAvatar } from './InitialsAvatar';
import { LeaderboardSeason, Screen, LeaderboardUser, UserProfile } from '../types';
import { COLORS } from '../theme';

interface Props {
  onNavigate: (screen: Screen) => void;
  entries: LeaderboardUser[];
  season: LeaderboardSeason | null;
  user: UserProfile | null;
}

export const Leaderboard: React.FC<Props> = ({ onNavigate, entries, season, user }) => {
  const insets = useSafeAreaInsets();
  const currentRank = entries.findIndex((entry) => entry.isMe) + 1;
  const nextUser = currentRank > 1 ? entries[currentRank - 2] : null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity
          style={styles.profileRow}
          onPress={() => onNavigate('profile')}
          activeOpacity={0.7}
        >
          <View style={styles.avatar}>
            {user?.avatar && !user.avatar.includes('pravatar') ? (
              <Image source={{ uri: user.avatar }} style={styles.avatarImg} />
            ) : (
              <InitialsAvatar
                name={user?.name ?? 'BB'}
                size={40}
                borderWidth={0}
              />
            )}
          </View>
          <Text style={styles.appName}>BrainByte</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.streakBadge}
          onPress={() => onNavigate('leaderboard')}
          activeOpacity={0.7}
        >
          <Text style={styles.streakText}>🔥 {user?.streak ?? 12}</Text>
        </TouchableOpacity>
      </View>

    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 84 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* League hero */}
      <View style={styles.leagueHero}>
        <View style={styles.awardGlow} />
        <View style={styles.awardBox}>
          <Feather name="award" size={56} color={COLORS.primary} />
        </View>
        <Text style={styles.leagueName}>{season?.leagueName ?? 'Obsidian League'}</Text>
        <Text style={styles.leagueSubtitle}>
          {(season?.division ?? 'Scholars Division')} • Round {season?.round ?? 4} of {season?.totalRounds ?? 12}
        </Text>
      </View>

      {/* Stats cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statCardLabel}>Time Left</Text>
          <Text style={[styles.statCardValue, { color: COLORS.secondary }]}>
            {season?.timeLeft ?? '2d 14h 05m'}
          </Text>
        </View>
        <View style={[styles.statCard, styles.statCardAccent]}>
          <Text style={styles.statCardLabel}>Current Rank</Text>
          <Text style={styles.statCardValue}>
            #{currentRank || user?.rank || 4}{' '}
            <Text style={styles.statCardDenom}>/ 50</Text>
          </Text>
        </View>
      </View>

      {/* List */}
      <View style={styles.list}>
        {entries.map((user, idx) => (
          <LeaderboardItem key={user.id} user={user} rank={idx + 1} />
        ))}

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>
            Top {season?.promotionCutoffRank ?? 10} Promoted to Emerald
          </Text>
          <View style={styles.dividerLine} />
        </View>
      </View>

      {/* CTA */}
      <View style={styles.ctaCard}>
        <Text style={styles.ctaTitle}>Almost there, {user?.name ?? 'Felix'}!</Text>
        <Text style={styles.ctaSubtitle}>
          {nextUser
            ? `Gain ${Math.max(nextUser.xp - (user?.xp ?? 0) + 1, 1)} more XP today to overtake ${nextUser.name}.`
            : 'You are already leading the board. Keep the streak alive.'}
        </Text>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => onNavigate('feed')}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaButtonText}>Earn Double XP Now</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>

      <BottomNav active="leaderboard" onNavigate={onNavigate} />
    </View>
  );
};

const LeaderboardItem = ({ user, rank }: { user: LeaderboardUser; rank: number }) => (
  <View style={[styles.listItem, user.isMe && styles.listItemMe]}>
    <View style={styles.rankBox}>
      <Text
        style={[
          styles.rankText,
          rank === 1 && { color: '#ffd700' },
          user.isMe && { color: COLORS.primary },
        ]}
      >
        {rank}
      </Text>
    </View>
    <View style={[styles.itemAvatar, user.isMe && styles.itemAvatarMe]}>
      <Image source={{ uri: user.avatar }} style={styles.itemAvatarImg} />
    </View>
    <View style={{ flex: 1 }}>
      <View style={styles.nameRow}>
        <Text style={styles.userName}>{user.name}</Text>
        {user.isMe && (
          <View style={styles.youBadge}>
            <Text style={styles.youBadgeText}>YOU</Text>
          </View>
        )}
      </View>
      <View style={styles.xpRow}>
        <Feather name="zap" size={13} color={user.isMe ? COLORS.primary : COLORS.onSurfaceVariant} />
        <Text style={styles.xpText}>{user.xp.toLocaleString()} XP</Text>
      </View>
    </View>
    <View style={[styles.streakPill, user.isMe && styles.streakPillMe]}>
      <Text style={{ fontSize: 12 }}>🔥</Text>
      <Text style={[styles.streakNum, user.isMe && { color: COLORS.black }]}>{user.streak}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 52,
    paddingBottom: 16,
    backgroundColor: COLORS.surfaceContainerLow + 'cc',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  avatarImg: { width: '100%', height: '100%' },
  appName: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: -1,
  },
  streakBadge: {
    backgroundColor: COLORS.surfaceContainerHighest,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 50,
  },
  streakText: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.primary,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: 104,
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  leagueHero: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 24,
  },
  awardGlow: {
    position: 'absolute',
    top: 16,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: COLORS.primary,
    opacity: 0.12,
  },
  awardBox: {
    width: 110,
    height: 110,
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary + '33',
    marginBottom: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  leagueName: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.onSurface,
    letterSpacing: -1,
    marginBottom: 6,
  },
  leagueSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 2.5,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 24,
    padding: 20,
  },
  statCardAccent: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  statCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: COLORS.onSurfaceVariant,
    marginBottom: 8,
  },
  statCardValue: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.onSurface,
    letterSpacing: -0.5,
  },
  statCardDenom: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.onSurfaceVariant,
  },
  list: { gap: 10, marginBottom: 16 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 24,
    padding: 16,
  },
  listItemMe: {
    backgroundColor: COLORS.primary + '18',
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  rankBox: { width: 28, alignItems: 'center' },
  rankText: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.onSurfaceVariant,
  },
  itemAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    overflow: 'hidden',
  },
  itemAvatarMe: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  itemAvatarImg: { width: '100%', height: '100%' },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.onSurface,
  },
  youBadge: {
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 50,
  },
  youBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  xpText: {
    fontSize: 12,
    color: COLORS.onSurfaceVariant,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceContainerLow,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 50,
  },
  streakPillMe: {
    backgroundColor: COLORS.primary,
  },
  streakNum: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.onSurfaceVariant,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.surfaceContainerHighest,
  },
  dividerText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: COLORS.onSurfaceVariant,
  },
  ctaCard: {
    backgroundColor: COLORS.surfaceContainerHighest,
    borderRadius: 28,
    padding: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.08)',
    borderStyle: 'dashed',
    alignItems: 'center',
    marginTop: 8,
  },
  ctaTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.onSurface,
    marginBottom: 8,
  },
  ctaSubtitle: {
    fontSize: 14,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  ctaButton: {
    width: '100%',
    backgroundColor: COLORS.primary,
    paddingVertical: 18,
    borderRadius: 50,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaButtonText: {
    color: COLORS.black,
    fontWeight: '900',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 2.5,
  },
});
