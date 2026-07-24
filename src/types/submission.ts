/**
 * LeetSync Core Data Types
 *
 * The `Solution` model is the central data primitive. It replaces the old
 * flat `ManifestSubmission` type. Every feature — labels, rename, delete,
 * set-default, version recovery, analytics — is built on top of this model.
 */

// ─── Raw LeetCode Submission (captured from network) ──────────────────────────

/**
 * Submission data extracted from LeetCode's internal GraphQL API responses.
 * Captured via network interception in main-world.ts — no DOM scraping.
 */
export interface LeetCodeSubmission {
  /** LeetCode's internal submission ID */
  submissionId: string;
  /** Problem title slug (e.g., "two-sum") */
  titleSlug: string;
  /** Problem display title (e.g., "Two Sum") */
  title: string;
  /** Problem number (e.g., 1) */
  questionNumber: number;
  /** Difficulty level */
  difficulty: 'Easy' | 'Medium' | 'Hard';
  /** Problem tags/topics */
  tags: string[];
  /** LeetCode language slug (e.g., "python3", "java", "cpp") */
  language: string;
  /** The submitted source code */
  code: string;
  /** Submission result status */
  status: SubmissionStatus;
  /** Runtime string (e.g., "52 ms") */
  runtime: string;
  /** Runtime percentile (e.g., 88.2) */
  runtimePercentile: number;
  /** Memory usage string (e.g., "16.2 MB") */
  memory: string;
  /** Memory percentile (e.g., 45.1) */
  memoryPercentile: number;
  /** ISO 8601 timestamp of submission */
  timestamp: string;
  /** LeetCode problem URL */
  url: string;
  /** Optional contest title if submission originates from a contest (e.g. "Weekly Contest 463") */
  contestName?: string | null;
}

export type SubmissionStatus =
  | 'Accepted'
  | 'Wrong Answer'
  | 'Time Limit Exceeded'
  | 'Memory Limit Exceeded'
  | 'Runtime Error'
  | 'Compile Error'
  | 'Output Limit Exceeded';

// ─── Solution Model (Core Data Primitive) ─────────────────────────────────────

/**
 * A single named solution file stored in the GitHub repository.
 *
 * This is the fundamental unit of the multi-solution system. Each Solution
 * represents one named file (e.g., optimal.cpp) with full metadata for
 * display, management (rename/delete/set-default), and recovery.
 *
 * isDefault is scoped per-language — exactly one Solution per language
 * group has isDefault=true at all times.
 *
 * Rules:
 *  - First solution for a language → label="Default", isDefault=true automatically.
 *  - Replace action → updates commitSha, previousCommitSha, runtime, memory,
 *    updatedAt. Does NOT change isDefault or label.
 *  - Save As New → isDefault=false. User must call setDefaultSolution to promote.
 *  - Deleting the default → most recently created sibling is auto-promoted.
 */
export interface Solution {
  /**
   * Stable UUID (crypto.randomUUID) generated at creation time.
   * Used as the stable reference key for rename/delete/set-default operations.
   */
  id: string;

  /**
   * Human-readable label chosen by the user.
   * "Default" is reserved for the auto-saved first solution.
   * Examples: "Brute Force", "Optimal", "DP", "BFS", "Two Pointer"
   */
  label: string;

  /** LeetCode language slug (e.g., "cpp", "python3", "java") */
  language: string;

  /**
   * Full relative path inside the GitHub repo.
   * Example: "Array/Easy/0001-two-sum/cpp/optimal.cpp"
   * Example: "Array/Easy/0001-two-sum/python/solution.py"
   */
  filePath: string;

  /** ISO 8601 timestamp of when this solution was first committed. */
  createdAt: string;

  /**
   * ISO 8601 timestamp of the last update.
   * Updated whenever a Replace action overwrites this solution's content.
   */
  updatedAt: string;

  /**
   * Whether this is the primary/default solution for its language group.
   * Scoped per-language — not per-problem.
   * Exactly one Solution per language in a group has this set to true.
   */
  isDefault: boolean;

  /** Runtime string from LeetCode (e.g., "3 ms"). Optional — may be missing for non-Accepted. */
  runtime?: string;

  /** Runtime percentile beat (e.g., 94.2 means beats 94.2% of submissions). */
  runtimePercentile?: number;

  /** Memory usage string from LeetCode (e.g., "42.1 MB"). */
  memory?: string;

  /** Memory percentile. */
  memoryPercentile?: number;

  /**
   * GitHub commit SHA of when this solution was last created or replaced.
   * Used to link to the GitHub commit page from the popup.
   */
  commitSha: string;

  /**
   * The commit SHA of the version immediately before the last Replace action.
   * null when this solution has never been replaced (i.e., original save).
   * Enables one-click "Restore previous version" recovery in the popup.
   */
  previousCommitSha: string | null;

  /**
   * The LeetCode submission ID that produced this solution file.
   * Used for deduplication — prevents re-syncing the same submission.
   */
  submissionId: string;
}

// ─── Manifest Schema ───────────────────────────────────────────────────────────

/**
 * Groups all named solutions for a single programming language under one problem.
 * The default solution (isDefault=true) is always first in the solutions array.
 */
export interface LanguageSolutionGroup {
  /** LeetCode language slug (e.g., "cpp", "python3") */
  language: string;
  /**
   * Ordered list of solutions for this language.
   * The solution with isDefault=true is always at index 0.
   */
  solutions: Solution[];
}

/**
 * The manifest.json file stored per-problem in the GitHub repository.
 *
 * Stored at: {problemDir}/manifest.json
 * Example:   Array/Easy/0001-two-sum/manifest.json
 *
 * Solutions are organized into language groups so that files from different
 * languages never interfere with each other's default/label logic.
 *
 * schemaVersion allows future migrations of the manifest format without
 * breaking existing repos.
 */
export interface ProblemManifest {
  slug: string;
  title: string;
  number: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tags: string[];
  url: string;
  /** Solutions organized by language — one group per language used. */
  solutionGroups: LanguageSolutionGroup[];
  /**
   * Manifest format version.
   * 1 = legacy flat ManifestSubmission array (pre-Solution model).
   * 2 = current Solution model with solutionGroups.
   */
  schemaVersion: number;
}

// ─── Conflict Resolution (Background ↔ Popup messaging) ───────────────────────

export type ConflictAction = 'replace' | 'save_as_new';

/**
 * Resolution payload returned by the popup ConflictDialog to the background script.
 * Sent via chrome.runtime.sendMessage({ type: 'CONFLICT_RESOLVED', resolution }).
 */
export interface ConflictResolution {
  /** The LeetCode submission ID that triggered the conflict. */
  submissionId: string;
  /** Whether to overwrite the existing default or save alongside it. */
  action: ConflictAction;
  /**
   * Required when action === 'save_as_new'.
   * Will be validated against existing labels in the language group by label-resolver.ts.
   * If a duplicate is detected, label-resolver will auto-suffix (e.g., "Optimal v2").
   */
  label?: string;
}

/**
 * Message sent from background to popup when a collision is detected.
 * The popup renders the ConflictDialog and waits for user input.
 */
export interface CollisionDetectedPayload {
  /** The incoming submission that caused the collision. */
  submission: LeetCodeSubmission;
  /** The existing default solution being collided with. */
  existingSolution: Solution;
  /** All current solutions for this language (for duplicate label preview). */
  existingLabels: string[];
}

// ─── Solution Management Operations ───────────────────────────────────────────

/**
 * Mutation operations exposed from the popup to the background script
 * via chrome.runtime.sendMessage({ type: 'SOLUTION_MUTATION', mutation }).
 */
export interface SolutionMutation {
  type: 'rename' | 'delete' | 'set_default';
  /** Stable UUID of the Solution to mutate. */
  solutionId: string;
  /** Slug of the problem this solution belongs to (used to locate manifest). */
  problemSlug: string;
  /** Language of the solution (used to locate the correct LanguageSolutionGroup). */
  language: string;
  /** Required for 'rename' mutations — the new human-readable label. */
  newLabel?: string;
}

// ─── Sync Queue ────────────────────────────────────────────────────────────────

/**
 * Internal queue item used by the background sync engine and offline retry queue.
 * Persisted in chrome.storage.local so the MV3 service worker can resume
 * after being terminated by Chrome.
 */
export interface SyncQueueItem {
  id: string;
  submission: LeetCodeSubmission;
  status: 'pending' | 'in_progress' | 'failed' | 'dead_letter';
  retryCount: number;
  nextRetryAt: number;
  createdAt: number;
  /** Timestamp of when status last changed to in_progress — used by the watchdog
   *  to detect stuck items (service worker died mid-commit). */
  processingStartedAt?: number;
  lastError?: string;
}

// ─── Recent Sync (popup display) ──────────────────────────────────────────────

/**
 * Recent sync entry displayed in the popup's activity feed.
 * A lightweight summary stored in chrome.storage.local — not the full Solution.
 */
export interface RecentSync {
  problemTitle: string;
  problemSlug: string;
  language: string;
  label: string;
  action: ConflictAction | 'first_save';
  status: string;
  runtime: string;
  timestamp: string;
  success: boolean;
  commitSha?: string;
  error?: string;
}

// ─── Legacy compatibility shim ────────────────────────────────────────────────

/**
 * @deprecated Use Solution instead.
 * Kept only for reading schemaVersion=1 manifests during migration.
 * Will be removed after all user repos are migrated to schemaVersion=2.
 */
export interface ManifestSubmission {
  version: number;
  language: string;
  timestamp: string;
  status: SubmissionStatus;
  runtime: string;
  runtimePercentile: number;
  memory: string;
  memoryPercentile: number;
  commitSha: string;
  filePath: string;
  label?: string;
  isDefault?: boolean;
}

/** @deprecated Use ProblemManifest with solutionGroups instead. */
export interface LegacyProblemManifest {
  slug: string;
  title: string;
  number: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tags: string[];
  url: string;
  submissions: ManifestSubmission[];
}
