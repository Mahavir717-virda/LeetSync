/**
 * Extension settings stored in chrome.storage.local.
 */
export interface LeetSyncSettings {
  /** GitHub personal access token or OAuth token */
  githubToken: string | null;
  /** Authentication method used */
  authMethod: 'oauth' | 'pat' | null;
  /** GitHub username */
  githubUsername: string | null;
  /** GitHub avatar URL */
  githubAvatarUrl: string | null;
  /** Target repository owner */
  repoOwner: string | null;
  /** Target repository name */
  repoName: string | null;
  /** Whether to sync only accepted submissions or all */
  syncMode: SyncMode;
  /** Whether auto-sync is enabled */
  autoSync: boolean;
  /** Whether to show desktop notifications */
  notifications: boolean;
  /** Last successfully synced problem slug */
  lastSyncedProblem: string | null;
  /** Last sync timestamp */
  lastSyncTimestamp: string | null;
  /** Streak data */
  streak: StreakData;
}

export type SyncMode = 'accepted_only' | 'all_submissions';

export interface StreakData {
  current: number;
  longest: number;
  lastSyncDate: string | null;
}

/**
 * Default settings for a fresh installation.
 */
export const DEFAULT_SETTINGS: LeetSyncSettings = {
  githubToken: null,
  authMethod: null,
  githubUsername: null,
  githubAvatarUrl: null,
  repoOwner: null,
  repoName: null,
  syncMode: 'accepted_only',
  autoSync: true,
  notifications: true,
  lastSyncedProblem: null,
  lastSyncTimestamp: null,
  streak: {
    current: 0,
    longest: 0,
    lastSyncDate: null,
  },
};

/**
 * Recent sync entry displayed in the popup.
 */
export interface RecentSync {
  problemTitle: string;
  problemSlug: string;
  language: string;
  version: number;
  status: string;
  runtime: string;
  timestamp: string;
  success: boolean;
  error?: string;
}
