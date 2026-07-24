// ─── Submission & Solution Model ───────────────────────────────────────────────
export type {
  LeetCodeSubmission,
  SubmissionStatus,
  TopicTag,
  FolderTopic,
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
export type { LeetSyncSettings, SyncMode, FolderStructure, StreakData } from './settings';
export { DEFAULT_SETTINGS } from './settings';

// ─── Import Subsystem ──────────────────────────────────────────────────────────
export * from './import';

// ─── GitHub & Migration ────────────────────────────────────────────────────────
export * from './github';
export * from './migration';



