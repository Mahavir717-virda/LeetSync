import { GITHUB_API_BASE } from '@/utils/constants';
import { utf8ToBase64, base64ToUtf8 } from '@/utils/filename';
import type {
  GitHubUser,
  GitHubRepo,
  GitHubFileContent,
  GitHubCreateFileResponse,
  GitHubRateLimit,
  GitHubTreeResponse,
  GitHubBlobResponse,
  GitHubRefResponse,
  GitHubCommitResponse,
} from '@/types';

class GitHubApi {
  private rateLimit: GitHubRateLimit | null = null;

  /**
   * Make an authenticated request to the GitHub API with retry and rate-limit handling.
   */
  private async request<T>(
    endpoint: string,
    token: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${GITHUB_API_BASE}${endpoint}`;

    // Auto-pause if rate limit is dangerously low (< 20 remaining)
    if (this.rateLimit && this.rateLimit.remaining <= 20) {
      const waitMs = Math.max(0, this.rateLimit.reset * 1000 - Date.now()) + 1000;
      console.warn(`[GitHub API] Rate limit low (${this.rateLimit.remaining} remaining). Pausing ${(waitMs / 1000).toFixed(0)}s until reset.`);
      if (waitMs > 0 && waitMs <= 3_600_000) {
        await new Promise((res) => setTimeout(res, waitMs));
      }
    }

    let attempt = 0;
    const maxAttempts = 3;
    let delay = 1000;

    while (attempt < maxAttempts) {
      attempt++;
      try {
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

        if (response.status === 429 || (response.status >= 500 && response.status <= 504)) {
          if (attempt < maxAttempts) {
            const retryAfter = response.headers.get('Retry-After');
            const jitter = Math.random() * 500;
            const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay + jitter;
            await new Promise((res) => setTimeout(res, waitTime));
            delay *= 2;
            continue;
          }
        }

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
      } catch (err: any) {
        if (attempt >= maxAttempts || (err.status && err.status < 500 && err.status !== 429 && err.status !== 409)) {
          throw err;
        }
        const jitter = Math.random() * 500;
        await new Promise((res) => setTimeout(res, delay + jitter));
        delay *= 2;
      }
    }

    throw new Error('GitHub API request failed after maximum retries');
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
      // Use UTF-8 safe Base64 — handles C++ headers, emoji, non-ASCII comments
      content: utf8ToBase64(content),
    };

    if (sha) {
      body.sha = sha;
    }

    return this.request<GitHubCreateFileResponse>(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`,
      token,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      }
    );
  }

  /**
   * Delete a file from a repo.
   * Note: sha and message parameter order matches GitHub API requirements.
   */
  async deleteFile(
    token: string,
    owner: string,
    repo: string,
    path: string,
    message: string,
    sha: string
  ): Promise<void> {
    await this.request(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`,
      token,
      {
        method: 'DELETE',
        body: JSON.stringify({ message, sha }),
      }
    );
  }

  /**
   * Get only the blob SHA for a file path (avoids fetching the full content).
   * Returns null if the file does not exist.
   */
  async getFileSha(
    token: string,
    owner: string,
    repo: string,
    path: string
  ): Promise<string | null> {
    const file = await this.getFileContent(token, owner, repo, path);
    return file?.sha ?? null;
  }

  /**
   * Fetch the raw decoded content of a file at a specific commit SHA.
   * Used by the version recovery system to restore previousCommitSha.
   * Returns null if the file or commit is not found.
   */
  async getFileContentAtCommit(
    token: string,
    owner: string,
    repo: string,
    path: string,
    commitSha: string
  ): Promise<string | null> {
    try {
      // Use the Git Data API: get the commit, then walk to the blob
      const commit = await this.getCommit(token, owner, repo, commitSha);
      const tree = await this.getTree(token, owner, repo, commit.tree.sha, true);

      // Normalize path for comparison (strip leading slash)
      const normalizedPath = path.replace(/^\//, '');
      const treeItem = tree.tree.find((item) => item.path === normalizedPath);

      if (!treeItem?.sha) return null;

      const blob = await this.getBlob(token, owner, repo, treeItem.sha);
      return base64ToUtf8(blob.content);
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  // ─── Git Data API (Low-Level Atomic Batch Operations) ─────────────────

  /**
   * Get reference (e.g. branch HEAD) SHA.
   */
  async getRef(token: string, owner: string, repo: string, ref: string): Promise<GitHubRefResponse> {
    const formattedRef = ref.startsWith('heads/') ? ref : `heads/${ref}`;
    return this.request<GitHubRefResponse>(`/repos/${owner}/${repo}/git/ref/${formattedRef}`, token);
  }

  /**
   * Get a commit object.
   */
  async getCommit(token: string, owner: string, repo: string, sha: string): Promise<GitHubCommitResponse> {
    return this.request<GitHubCommitResponse>(`/repos/${owner}/${repo}/git/commits/${sha}`, token);
  }

  /**
   * Get a tree object recursively or non-recursively.
   */
  async getTree(
    token: string,
    owner: string,
    repo: string,
    treeSha: string,
    recursive: boolean = true
  ): Promise<GitHubTreeResponse> {
    const url = `/repos/${owner}/${repo}/git/trees/${treeSha}${recursive ? '?recursive=1' : ''}`;
    return this.request<GitHubTreeResponse>(url, token);
  }

  /**
   * Get a blob object.
   */
  async getBlob(token: string, owner: string, repo: string, sha: string): Promise<GitHubBlobResponse> {
    return this.request<GitHubBlobResponse>(`/repos/${owner}/${repo}/git/blobs/${sha}`, token);
  }

  /**
   * Create a new tree with base tree and array of tree mutations.
   */
  async createTree(
    token: string,
    owner: string,
    repo: string,
    baseTreeSha: string,
    treeMutations: {
      path: string;
      mode: string;
      type: string;
      sha: string | null;
    }[]
  ): Promise<GitHubTreeResponse> {
    const tree = treeMutations.map((m) => {
      if (m.sha === null) {
        // Deletion in Git Data API: omit mode/type or supply sha: null depending on GitHub specs
        return {
          path: m.path,
          mode: m.mode,
          type: m.type,
          sha: null,
        };
      }
      return {
        path: m.path,
        mode: m.mode,
        type: m.type,
        sha: m.sha,
      };
    });

    return this.request<GitHubTreeResponse>(`/repos/${owner}/${repo}/git/trees`, token, {
      method: 'POST',
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree,
      }),
    });
  }

  /**
   * Create a commit.
   */
  async createCommit(
    token: string,
    owner: string,
    repo: string,
    message: string,
    treeSha: string,
    parents: string[]
  ): Promise<GitHubCommitResponse> {
    return this.request<GitHubCommitResponse>(`/repos/${owner}/${repo}/git/commits`, token, {
      method: 'POST',
      body: JSON.stringify({
        message,
        tree: treeSha,
        parents,
      }),
    });
  }

  /**
   * Update a reference (e.g., move branch pointer to new commit).
   */
  async updateRef(
    token: string,
    owner: string,
    repo: string,
    ref: string,
    sha: string,
    force: boolean = false
  ): Promise<GitHubRefResponse> {
    const formattedRef = ref.startsWith('heads/') ? ref : `heads/${ref}`;
    return this.request<GitHubRefResponse>(`/repos/${owner}/${repo}/git/refs/${formattedRef}`, token, {
      method: 'PATCH',
      body: JSON.stringify({
        sha,
        force,
      }),
    });
  }

  // ─── Utility ─────────────────────────────────────────────────

  /**
   * Decode base64 file content from GitHub's API response.
   * Uses the UTF-8 safe decoder to handle non-ASCII characters correctly.
   */
  decodeFileContent(content: string): string {
    return base64ToUtf8(content);
  }
}

/** Singleton instance */
export const githubApi = new GitHubApi();

