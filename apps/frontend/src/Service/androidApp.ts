/**
 * The Android app opens this same site in a WebView: it appends "GameTrackerVaultApp" to the
 * user agent and exposes window.GameTrackerApp (change server, version and, since
 * 1.1.0, check for updates). The newer functions are optional: an older app
 * doesn't have them.
 */
interface AndroidBridge {
  changeServer(): void;
  version(): string;
  versionCode?: () => number;
  checkUpdate?: () => void;
  // Since 1.2.0: price alerts as phone notifications. The app keeps a read-only token
  // and asks the server for new notifications in the background.
  enableAlerts?: (apiUrl: string, token: string, tokenId: string, afterId: number) => void;
  disableAlerts?: () => void;
  // JSON of AndroidAlertsStatus
  alertsStatus?: () => string;
  // Opens the phone's notification settings for the app
  openNotificationSettings?: () => void;
}

export interface AndroidAlertsStatus {
  enabled: boolean;
  tokenId: string | null;
  // Whether Android lets the app show notifications (Android 13+ asks the user)
  allowed: boolean;
}

declare global {
  interface Window {
    GameTrackerApp?: AndroidBridge;
    // Called by the app when alerts were turned on or off (after the permission prompt)
    onAlertsChanged?: (status: string) => void;
  }
}

export const isAndroidApp = (): boolean => /GameTrackerVaultApp/.test(navigator.userAgent);

export const androidBridge = (): AndroidBridge | null => (isAndroidApp() ? window.GameTrackerApp ?? null : null);

/** The APK published with the site (public/downloads) and its metadata. */
export const ANDROID_APK_URL = '/downloads/gametracker-vault.apk';
export const ANDROID_INFO_URL = '/downloads/android.json';
// The same APK in the repository (a different address: inside the app it opens in the browser)
export const ANDROID_APK_REPO_URL =
  'https://github.com/TTiagoSousa/GamesTracker-Vault/raw/main/apps/frontend/public/downloads/gametracker-vault.apk';

export interface AndroidApkInfo {
  version: string;
  versionCode: number;
  size: number;
  sha256: string;
  builtAt: string;
}
