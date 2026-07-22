/**
 * Types for Repository Migration System
 */

// ─── Layout Detection ──────────────────────────────────────

export type RepoLayout =
  | 'legacy-flat-folder'    // problems/0001-two-sum/
  | 'legacy-flat-root'      // 0001-two-sum/ at repo root (LeetHub v2)
  | 'topic-difficulty'      // Array/Easy/0001-two-sum/
  | 'unknown'
  | 'empty';

export type MigrationChoice = 'keep-legacy' | 'migrate-now' | 'new-only';

// ─── Migration State ───────────────────────────────────────

export type MigrationStatus =
  | 'idle'
  | 'validating'
  | 'scanning'
  | 'fetching-metadata'
  | 'planning'
  | 'previewing'
  | 'executing'
  | 'paused'
  | 'rolling-back'
  | 'completed'
  | 'failed';

export type MoveStatus =
  | 'pending'
  | 'staged'          // included in current batch tree
  | 'completed'
  | 'skipped'
  | 'failed';

export type ConflictResolution = 'skip' | 'overwrite' | 'rename';

// ─── Scanned Data ──────────────────────────────────────────

export interface ScannedProblem {
  originalPath: string;
  questionNumber: number;
  slug: string;
  files: ScannedFile[];
  parseable: boolean;
}

export interface ScannedFile {
  path: string;
  sha: string;           // original blob SHA — used for content + verification
  name: string;
  size: number;
}

// ─── Metadata ──────────────────────────────────────────────

export interface ProblemMetadata {
  slug: string;
  title: string;
  questionNumber: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  topicTags: string[];
  fetched: boolean;
  source: 'cache' | 'leetcode' | 'repository' | 'unknown';
  error?: string;
  cachedAt?: string;
}

// ─── Migration Move ───────────────────────────────────────

export interface MigrationMove {
  id: string;
  problem: ScannedProblem;
  metadata: ProblemMetadata | null;
  sourcePath: string;
  targetPath: string;
  files: MoveFile[];
  status: MoveStatus;
  conflict: boolean;
  conflictResolution?: ConflictResolution;
  duplicate: boolean;
  error?: string;
  batchIndex?: number;        // which commit batch this move belongs to
}

export interface MoveFile {
  sourcePath: string;
  targetPath: string;
  sourceSha: string;          // blob SHA from tree scan
  expectedSha?: string;       // computed SHA for verification
  verified: boolean;          // true after SHA verification passes
}

// ─── Batch Commit ─────────────────────────────────────────

export interface CommitBatch {
  index: number;
  moveIds: string[];           // moves included in this batch
  treeEntries: TreeMutation[];
  status: 'pending' | 'committed' | 'failed';
  commitSha?: string;
  error?: string;
}

export interface TreeMutation {
  path: string;
  mode: '100644';              // regular file
  type: 'blob';
  sha: string | null;          // blob SHA for add/move, null for delete
}

// ─── Dry-Run Estimate ─────────────────────────────────────

export interface MigrationEstimate {
  totalProblems: number;
  totalFiles: number;
  foldersToCreate: number;
  foldersToDelete: number;
  commitBatches: number;       // number of batch commits needed
  githubApiCalls: number;      // much lower with Git Data API
  estimatedTimeSeconds: number;
  rateLimitRemaining: number;
  rateLimitResetsAt: string;
  enoughBudget: boolean;
}

// ─── Migration Plan ───────────────────────────────────────

export interface MigrationPlan {
  version: number;
  status: MigrationStatus;
  detectedLayout: RepoLayout;
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  totalProblems: number;
  completedCount: number;
  failedCount: number;
  skippedCount: number;
  moves: MigrationMove[];
  batches: CommitBatch[];      // grouped commit batches
  manualReview: ScannedProblem[];
  estimate: MigrationEstimate | null;
  startedAt: string | null;
  lastUpdatedAt: string | null;
  currentBatchIndex: number;   // for resume
  aborted: boolean;
}

// ─── Rollback ─────────────────────────────────────────────

export interface RollbackPlan {
  available: boolean;
  moves: RollbackMove[];
  executedAt: string | null;
}

export interface RollbackMove {
  moveId: string;
  files: {
    currentPath: string;
    originalPath: string;
    currentSha: string;
  }[];
  rolledBack: boolean;
}

// ─── Telemetry ────────────────────────────────────────────

export interface MigrationLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  phase: string;
  message: string;
  data?: Record<string, unknown>;
}

// ─── Migration Lock ───────────────────────────────────────

export interface MigrationLock {
  active: boolean;
  lockedAt: string;
  lockedBy: string;        // random session UUID
  expiresAt: string;       // auto-expire after 30 min inactivity
}

// ─── Pre-flight Checks ────────────────────────────────────

export interface PreflightCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

export interface PreflightResult {
  passed: boolean;
  checks: PreflightCheck[];
  estimate?: MigrationEstimate;
}

// ─── leetsync.json (stored in repo root) ──────────────────

export interface LeetSyncConfig {
  layoutVersion: number;
  features: {
    topicLayout: boolean;
    migration: boolean;
  };
  migratedAt?: string;
  migratedFrom?: string;
  problemCount?: number;
}

// ─── Protected Files ──────────────────────────────────────

export const PROTECTED_ROOT_FILES = [
  'README.md',
  'readme.md',
  'stats.json',
  'LICENSE',
  'LICENSE.md',
  '.gitignore',
  '.gitattributes',
  'leetsync.json',
  'CONTRIBUTING.md',
];
