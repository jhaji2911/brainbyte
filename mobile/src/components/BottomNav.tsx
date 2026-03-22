import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { Screen } from '../types';
import { COLORS } from '../theme';

interface BottomNavProps {
  active: Screen;
  onNavigate: (screen: Screen) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ active, onNavigate }) => (
  <View style={styles.wrapper}>
    <View style={styles.container}>
      <NavItem
        icon="zap"
        label="Dopamine"
        active={active === 'feed'}
        onPress={() => onNavigate('feed')}
      />
      <NavItem
        icon="compass"
        label="Library"
        active={active === 'library'}
        onPress={() => onNavigate('library')}
      />
      <NavItem
        icon="grid"
        label="Leaderboard"
        active={active === 'leaderboard'}
        onPress={() => onNavigate('leaderboard')}
      />
      <NavItem
        icon="user"
        label="Profile"
        active={active === 'profile'}
        onPress={() => onNavigate('profile')}
      />
    </View>
  </View>
);

const NavItem = ({
  icon,
  label,
  active,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  active: boolean;
  onPress: () => void;
}) => {
  const pillAnim = React.useRef(new Animated.Value(active ? 1 : 0)).current;
  const iconScale = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.spring(pillAnim, {
      toValue: active ? 1 : 0,
      friction: 7,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [active]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(iconScale, { toValue: 0.75, duration: 70, useNativeDriver: true }),
      Animated.spring(iconScale, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const pillScale = pillAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.9} style={styles.navItemHitbox}>
      <Animated.View
        style={[
          styles.navItemPill,
          { opacity: pillAnim, transform: [{ scale: pillScale }] },
        ]}
      />
      <Animated.View style={[styles.navItemContent, { transform: [{ scale: iconScale }] }]}>
        <Feather
          name={icon}
          size={20}
          color={active ? COLORS.black : COLORS.onSurfaceVariant}
        />
        <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  container: {
    backgroundColor: 'rgba(42,42,42,0.8)',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 50,
    width: '96%',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  navItemHitbox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  navItemPill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.primary,
    borderRadius: 50,
  },
  navItemContent: {
    alignItems: 'center',
  },
  navLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
    color: COLORS.onSurfaceVariant,
  },
  navLabelActive: {
    color: COLORS.black,
  },
});
