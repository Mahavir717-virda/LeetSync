import type { LeetCodeSubmission } from './submission';

/**
 * Import states for every submission.
 */
export enum ImportState {
  DISCOVERED = 'DISCOVERED',
  FETCHING = 'FETCHING',
  DOWNLOADED = 'DOWNLOADED',
  QUEUED = 'QUEUED',
  UPLOADING = 'UPLOADING',
  VERIFIED = 'VERIFIED',
  FAILED = 'FAILED',
}

/**
 * Strategy for handling existing duplicates on GitHub.
 */
export type DuplicateStrategy = 'skip' | 'replace' | 'rename' | 'keep_fastest';

/**
 * Discovered user profile metadata.
 */
export interface UserProfile {
  username: string;
  ranking: number;
  solvedTotal: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  languages: { name: string; count: number }[];
  contestRating?: number;
  isPremium: boolean;
}

/**
 * Lightweight submission summary fetched during discovery.
 */
export interface SubmissionSummary {
  submissionId: string;
  titleSlug: string;
  title: string;
  language: string;
  timestamp: number;
  status: string;
}

/**
 * Single item inside the import execution plan.
 */
export interface ImportActionItem {
  id: string;
  submissionId: string;
  titleSlug: string;
  title: string;
  language: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  action: 'CREATE' | 'UPDATE' | 'SKIP' | 'RENAME';
  targetPath: string;
  state: ImportState;
  error?: string;
  code?: string;
  runtime?: string;
  memory?: string;
  timestamp?: number;
}

/**
 * Persistent import session checkpoint.
 */
export interface ImportSession {
  id: string;
  startedAt: string;
  updatedAt: string;
  totalDiscovered: number;
  currentIndex: number;
  completed: number;
  failed: number;
  skipped: number;
  status: 'idle' | 'discovering' | 'downloading' | 'planning' | 'uploading' | 'paused' | 'completed' | 'failed';
  duplicateStrategy: DuplicateStrategy;
  actions: ImportActionItem[];
  currentProblemTitle?: string;
  speedFilesPerSec?: number;
  etaSeconds?: number;
  recentCodeLogs?: { timestamp: string; submissionId: string; title: string; language: string; bytes: number; codePreview: string; status: 'OK' | 'ERR'; error?: string }[];
}

/**
 * Final import execution report.
 */
export interface ImportReport {
  id: string;
  completedAt: string;
  durationSeconds: number;
  totalSubmissions: number;
  newFilesCreated: number;
  duplicatesResolved: number;
  skippedCount: number;
  failedCount: number;
  languages: { name: string; count: number }[];
  repository: string;
}
