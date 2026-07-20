/**
 * LeetSync constants — centralized configuration values.
 */

/** Extension metadata */
export const EXTENSION_NAME = 'LeetSync';
export const EXTENSION_VERSION = '1.0.0';

/** GitHub OAuth configuration */
export const GITHUB_CLIENT_ID = 'Ov23lizKSjgAL8yjQnfp'; // Replace with actual client ID
export const GITHUB_CLIENT_SECRET = '42f8c0da8a1c72ddbd60245bd678ef9a17332ba7'; // Replace with actual client ID

export const GITHUB_OAUTH_URL = 'https://github.com/login/oauth/authorize';
export const GITHUB_TOKEN_EXCHANGE_URL = 'https://leet-sync.vercel.app/api/exchange'; // Serverless proxy
export const GITHUB_API_BASE = 'https://api.github.com';
export const GITHUB_OAUTH_SCOPES = 'repo';

/** LeetCode URL patterns */
export const LEETCODE_BASE_URL = 'https://leetcode.com';
export const LEETCODE_PROBLEMS_URL = 'https://leetcode.com/problems/';
export const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';
export const LEETCODE_SUBMISSION_CHECK_PATTERN = /\/submissions\/detail\/(\d+)\/(?:v2\/)?check\//;
export const LEETCODE_GRAPHQL_SUBMISSION_PATTERN = /submissionDetails/;

/** GitHub repo structure */
export const REPO_PROBLEMS_DIR = 'problems';
export const REPO_MANIFEST_FILE = 'manifest.json';
export const REPO_README_FILE = 'README.md';
export const REPO_STATS_FILE = 'STATS.md';

/** Default repo name when creating a new one */
export const DEFAULT_REPO_NAME = 'leetcode-solutions';
export const DEFAULT_REPO_DESCRIPTION = '📝 My LeetCode solutions — synced with LeetSync (version history preserved)';

/** Sync settings */
export const MAX_RETRY_COUNT = 10;
export const RETRY_ALARM_NAME = 'leetsync-retry-queue';
export const RETRY_INTERVAL_MINUTES = 5;
export const RATE_LIMIT_THRESHOLD = 10; // Switch to batch mode below this

/** Language extension mapping: LeetCode language slug → file extension */
export const LANGUAGE_EXTENSIONS: Record<string, string> = {
  'python': '.py',
  'python3': '.py',
  'java': '.java',
  'cpp': '.cpp',
  'c': '.c',
  'csharp': '.cs',
  'javascript': '.js',
  'typescript': '.ts',
  'go': '.go',
  'ruby': '.rb',
  'swift': '.swift',
  'kotlin': '.kt',
  'rust': '.rs',
  'scala': '.scala',
  'php': '.php',
  'dart': '.dart',
  'racket': '.rkt',
  'erlang': '.erl',
  'elixir': '.ex',
  'mysql': '.sql',
  'mssql': '.sql',
  'oraclesql': '.sql',
  'bash': '.sh',
  'r': '.r',
};

/** Language display names */
export const LANGUAGE_NAMES: Record<string, string> = {
  'python': 'Python',
  'python3': 'Python',
  'java': 'Java',
  'cpp': 'C++',
  'c': 'C',
  'csharp': 'C#',
  'javascript': 'JavaScript',
  'typescript': 'TypeScript',
  'go': 'Go',
  'ruby': 'Ruby',
  'swift': 'Swift',
  'kotlin': 'Kotlin',
  'rust': 'Rust',
  'scala': 'Scala',
  'php': 'PHP',
  'dart': 'Dart',
  'racket': 'Racket',
  'erlang': 'Erlang',
  'elixir': 'Elixir',
  'mysql': 'MySQL',
  'mssql': 'MS SQL',
  'oraclesql': 'Oracle SQL',
  'bash': 'Bash',
  'r': 'R',
};

/** Message types for chrome.runtime messaging between content script ↔ background */
export enum MessageType {
  SUBMISSION_DETECTED = 'SUBMISSION_DETECTED',
  SYNC_STATUS = 'SYNC_STATUS',
  GET_SETTINGS = 'GET_SETTINGS',
  UPDATE_SETTINGS = 'UPDATE_SETTINGS',
  LOGIN_OAUTH = 'LOGIN_OAUTH',
  LOGIN_PAT = 'LOGIN_PAT',
  LOGOUT = 'LOGOUT',
  GET_AUTH_STATUS = 'GET_AUTH_STATUS',
  LIST_REPOS = 'LIST_REPOS',
  CREATE_REPO = 'CREATE_REPO',
  SELECT_REPO = 'SELECT_REPO',
  GET_RECENT_SYNCS = 'GET_RECENT_SYNCS',
  GET_QUEUE_STATUS = 'GET_QUEUE_STATUS',
  MANUAL_SYNC = 'MANUAL_SYNC',
}

/** Storage keys for chrome.storage.local */
export enum StorageKey {
  SETTINGS = 'leetsync_settings',
  RECENT_SYNCS = 'leetsync_recent_syncs',
  SUBMISSION_HASHES = 'leetsync_submission_hashes',
}
