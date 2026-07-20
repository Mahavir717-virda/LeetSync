/**
 * Submission data extracted from LeetCode's internal API responses.
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
}

export type SubmissionStatus =
  | 'Accepted'
  | 'Wrong Answer'
  | 'Time Limit Exceeded'
  | 'Memory Limit Exceeded'
  | 'Runtime Error'
  | 'Compile Error'
  | 'Output Limit Exceeded';

/**
 * A single entry in a problem's manifest.json submissions array.
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
}

/**
 * The manifest.json file stored per-problem in the GitHub repo.
 */
export interface ProblemManifest {
  slug: string;
  title: string;
  number: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tags: string[];
  url: string;
  submissions: ManifestSubmission[];
}

/**
 * Internal submission record used by the sync engine and offline queue.
 */
export interface SyncQueueItem {
  id: string;
  submission: LeetCodeSubmission;
  status: 'pending' | 'in_progress' | 'failed' | 'dead_letter';
  retryCount: number;
  nextRetryAt: number;
  createdAt: number;
  lastError?: string;
}
