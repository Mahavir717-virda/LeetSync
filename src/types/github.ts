/**
 * GitHub API response types.
 */

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  name: string | null;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  default_branch: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  permissions?: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
}

export interface GitHubFileContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
  content?: string;
  encoding?: string;
  html_url: string;
  download_url: string | null;
}

export interface GitHubCreateFileResponse {
  content: {
    name: string;
    path: string;
    sha: string;
    html_url: string;
  };
  commit: {
    sha: string;
    message: string;
    html_url: string;
  };
}

export interface GitHubApiError {
  message: string;
  documentation_url?: string;
  status?: number;
}

/**
 * Rate limit info from GitHub API response headers.
 */
export interface GitHubRateLimit {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
}

/**
 * Git Data API Response Types
 */
export interface GitHubTreeEntry {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
}

export interface GitHubTreeResponse {
  sha: string;
  tree: GitHubTreeEntry[];
  truncated: boolean;
}

export interface GitHubBlobResponse {
  sha: string;
  content: string;
  encoding: 'base64' | 'utf-8';
  size: number;
}

export interface GitHubRefResponse {
  ref: string;
  object: {
    sha: string;
    type: string;
  };
}

export interface GitHubCommitResponse {
  sha: string;
  tree: {
    sha: string;
  };
  message: string;
  parents: {
    sha: string;
  }[];
}

