import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { UsageStatsModule: _NativeUsageStats } = NativeModules;
const isAvailable = Platform.OS === 'android' && !!_NativeUsageStats;

export const POISON_APP_PACKAGES = [
  'com.instagram.android',
  'com.zhiliaoapp.musically',       // TikTok
  'com.ss.android.ugc.trill',        // TikTok (some regions)
  'com.reddit.frontpage',
  'com.twitter.android',
  'com.snapchat.android',
  'com.facebook.katana',
  'com.google.android.youtube',
];

/** ms between interrupts per daily-goal selection */
export function goalToCooldownMs(dailyGoal: string): number {
  if (dailyGoal.includes('Casual')) return 25 * 60 * 1000;
  if (dailyGoal.includes('Scholar')) return 10 * 60 * 1000;
  return 15 * 60 * 1000; // Growth default
}

export const appMonitor = {
  /** Whether the UsageStats native module is present (Android only). */
  isAvailable,

  /** Resolves true if the user has granted PACKAGE_USAGE_STATS access. */
  hasUsagePermission(): Promise<boolean> {
    if (!isAvailable) return Promise.resolve(false);
    return _NativeUsageStats.hasUsageStatsPermission();
  },

  /** Opens the system "Usage Access" settings screen. */
  requestUsagePermission(): void {
    if (!isAvailable) return;
    _NativeUsageStats.requestUsageStatsPermission();
  },

  /** Resolves true if the user has granted SYSTEM_ALERT_WINDOW (draw over apps). */
  hasOverlayPermission(): Promise<boolean> {
    if (!isAvailable) return Promise.resolve(false);
    return _NativeUsageStats.hasOverlayPermission();
  },

  /** Opens "Display over other apps" settings for BrainByte. */
  requestOverlayPermission(): void {
    if (!isAvailable) return;
    _NativeUsageStats.requestOverlayPermission();
  },

  /**
   * Starts the background foreground-service that polls UsageStats.
   * @param intervalMs  How often to check the foreground app (e.g. 15 000).
   * @param cooldownMs  Minimum gap between two interrupt triggers.
   * @param poisonApps  Package names to watch for.
   */
  startMonitoring(intervalMs: number, cooldownMs: number, poisonApps: string[]): void {
    if (!isAvailable) return;
    _NativeUsageStats.startMonitoring(intervalMs, cooldownMs, poisonApps);
  },

  /** Stops the foreground service. */
  stopMonitoring(): void {
    if (!isAvailable) return;
    _NativeUsageStats.stopMonitoring();
  },

  /**
   * Immediately triggers the full-screen overlay for testing purposes.
   * Only works on Android with overlay permission granted.
   */
  triggerTestOverlay(): void {
    if (!isAvailable) return;
    _NativeUsageStats.triggerTestOverlay();
  },

  /**
   * Subscribe to distraction-detected events.
   * Returns an unsubscribe function.
   */
  onDistractionDetected(cb: (packageName: string) => void): () => void {
    if (!isAvailable) return () => {};
    const emitter = new NativeEventEmitter(_NativeUsageStats);
    const sub = emitter.addListener('onDistractionDetected', (event: { packageName: string }) => {
      cb(event.packageName);
    });
    return () => sub.remove();
  },
};
