/**
 * GitHub REST API v3 Wrapper
 *
 * Thin wrapper around GitHub's API with:
 * - Automatic auth header injection
 * - Rate limit tracking
 * - Error handling with typed responses
 */

import { GITHUB_API_BASE } from '@/utils/constants';
import type {
  GitHubUser,
  GitHubRepo,
  GitHubFileContent,
  GitHubCreateFileResponse,
  GitHubRateLimit,
} from '@/types';

class GitHubApi {
  private rateLimit: GitHubRateLimit | null = null;

  /**
   * Make an authenticated request to the GitHub API.
   */
  private async request<T>(
    endpoint: string,
    token: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${GITHUB_API_BASE}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...options.headers,
      },
    });

    // Track rate limits from response headers
    this.rateLimit = {
      limit: parseInt(response.headers.get('X-RateLimit-Limit') ?? '5000', 10),
      remaining: parseInt(response.headers.get('X-RateLimit-Remaining') ?? '5000', 10),
      reset: parseInt(response.headers.get('X-RateLimit-Reset') ?? '0', 10),
      used: parseInt(response.headers.get('X-RateLimit-Used') ?? '0', 10),
    };

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: response.statusText }));
      const error = new Error(
        `GitHub API error (${response.status}): ${errorBody.message ?? response.statusText}`
      );
      (error as any).status = response.status;
      (error as any).response = errorBody;
      throw error;
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get the current rate limit info.
   */
  getRateLimit(): GitHubRateLimit | null {
    return this.rateLimit;
  }

  // ─── User ────────────────────────────────────────────────────

  /**
   * Get the authenticated user's profile.
   */
  async getUser(token: string): Promise<GitHubUser> {
    return this.request<GitHubUser>('/user', token);
  }

  // ─── Repositories ────────────────────────────────────────────

  /**
   * List repositories for the authenticated user.
   */
  async listRepos(
    token: string,
    options: { sort?: string; perPage?: number; page?: number } = {}
  ): Promise<GitHubRepo[]> {
    const params = new URLSearchParams({
      sort: options.sort ?? 'updated',
      per_page: String(options.perPage ?? 30),
      page: String(options.page ?? 1),
      affiliation: 'owner',
    });
    return this.request<GitHubRepo[]>(`/user/repos?${params}`, token);
  }

  /**
   * Create a new repository.
   */
  async createRepo(
    token: string,
    name: string,
    options: { description?: string; isPrivate?: boolean; autoInit?: boolean } = {}
  ): Promise<GitHubRepo> {
    return this.request<GitHubRepo>('/user/repos', token, {
      method: 'POST',
      body: JSON.stringify({
        name,
        description: options.description ?? '',
        private: options.isPrivate ?? false,
        auto_init: options.autoInit ?? true,
      }),
    });
  }

  /**
   * Get a specific repository.
   */
  async getRepo(token: string, owner: string, repo: string): Promise<GitHubRepo> {
    return this.request<GitHubRepo>(`/repos/${owner}/${repo}`, token);
  }

  // ─── File Operations ─────────────────────────────────────────

  /**
   * Get file content from a repo.
   * Returns null if the file doesn't exist (404).
   */
  async getFileContent(
    token: string,
    owner: string,
    repo: string,
    path: string
  ): Promise<GitHubFileContent | null> {
    try {
      return await this.request<GitHubFileContent>(
        `/repos/${owner}/${repo}/contents/${path}`,
        token
      );
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  /**
   * Create or update a file in a repo.
   *
   * @param sha - Required when updating an existing file (prevents conflicts)
   */
  async createOrUpdateFile(
    token: string,
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha?: string
  ): Promise<GitHubCreateFileResponse> {
    const body: Record<string, string> = {
      message,
      content: btoa(unescape(encodeURIComponent(content))), // UTF-8 safe base64
    };

    if (sha) {
      body.sha = sha;
    }

    return this.request<GitHubCreateFileResponse>(
      `/repos/${owner}/${repo}/contents/${path}`,
      token,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      }
    );
  }

  /**
   * Delete a file from a repo.
   */
  async deleteFile(
    token: string,
    owner: string,
    repo: string,
    path: string,
    sha: string,
    message: string
  ): Promise<void> {
    await this.request(
      `/repos/${owner}/${repo}/contents/${path}`,
      token,
      {
        method: 'DELETE',
        body: JSON.stringify({ message, sha }),
      }
    );
  }

  // ─── Utility ─────────────────────────────────────────────────

  /**
   * Decode base64 file content from GitHub's API response.
   */
  decodeFileContent(content: string): string {
    return decodeURIComponent(escape(atob(content.replace(/\n/g, ''))));
  }
}

/** Singleton instance */
export const githubApi = new GitHubApi();
