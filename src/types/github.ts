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
