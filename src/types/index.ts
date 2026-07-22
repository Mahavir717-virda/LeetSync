// ─── Submission & Solution Model ───────────────────────────────────────────────
export type {
  LeetCodeSubmission,
  SubmissionStatus,
  // New Solution model (schemaVersion=2)
  Solution,
  LanguageSolutionGroup,
  ProblemManifest,
  SyncQueueItem,
  RecentSync,
  ConflictAction,
  ConflictResolution,
  CollisionDetectedPayload,
  SolutionMutation,
  // Legacy shims (schemaVersion=1 read-only support)
  ManifestSubmission,
  LegacyProblemManifest,
} from './submission';

// ─── Settings ──────────────────────────────────────────────────────────────────
export type { LeetSyncSettings, SyncMode, StreakData } from './settings';
export { DEFAULT_SETTINGS } from './settings';

// ─── GitHub & Migration ────────────────────────────────────────────────────────
export * from './github';
export * from './migration';



