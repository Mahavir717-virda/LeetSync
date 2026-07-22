/**
 * Phase 3 — Repository Layout Detector
 */

import { githubApi } from '../github-api';
import { PROBLEM_FOLDER_REGEX, KNOWN_TOPIC_FOLDERS } from '@/utils/constants';
import type { RepoLayout, GitHubTreeEntry } from '@/types';

export interface DetectionResult {
  layout: RepoLayout;
  tree: GitHubTreeEntry[];
  defaultBranch: string;
}

/**
 * Detect the layout structure of a LeetCode solutions repository.
 */
export async function detectRepoLayout(
  token: string,
  owner: string,
  repo: string
): Promise<DetectionResult> {
  const repoInfo = await githubApi.getRepo(token, owner, repo);
  const defaultBranch = repoInfo.default_branch || 'main';

  // Get full tree for default branch
  const ref = await githubApi.getRef(token, owner, repo, defaultBranch);
  const commit = await githubApi.getCommit(token, owner, repo, ref.object.sha);
  const treeResponse = await githubApi.getTree(token, owner, repo, commit.tree.sha, true);
  const tree = treeResponse.tree || [];

  if (tree.length === 0) {
    return { layout: 'empty', tree, defaultBranch };
  }

  // 1. Check for leetsync.json in root
  const leetSyncConfigEntry = tree.find((e: GitHubTreeEntry) => e.path === 'leetsync.json');
  if (leetSyncConfigEntry) {
    try {
      const blob = await githubApi.getBlob(token, owner, repo, leetSyncConfigEntry.sha);
      const content = githubApi.decodeFileContent(blob.content);
      const parsed = JSON.parse(content);
      if (parsed.layoutVersion >= 2) {
        return { layout: 'topic-difficulty', tree, defaultBranch };
      }
    } catch {
      // fallback to path analysis if file read fails
    }
  }

  // 2. Check for legacy-flat-folder (problems/0001-two-sum/...)
  const hasProblemsFolder = tree.some((e: GitHubTreeEntry) => e.path.startsWith('problems/') && e.path !== 'problems');
  if (hasProblemsFolder) {
    const problemFolderMatches = tree.some((e: GitHubTreeEntry) => {
      const parts = e.path.split('/');
      return parts.length >= 2 && parts[0] === 'problems' && PROBLEM_FOLDER_REGEX.test(parts[1]);
    });
    if (problemFolderMatches) {
      return { layout: 'legacy-flat-folder', tree, defaultBranch };
    }
  }

  // 3. Check for legacy-flat-root (0001-two-sum/ at repo root)
  const rootProblemFolders = new Set<string>();
  for (const entry of tree) {
    const parts = entry.path.split('/');
    if (parts.length >= 2 && PROBLEM_FOLDER_REGEX.test(parts[0])) {
      rootProblemFolders.add(parts[0]);
    }
  }
  if (rootProblemFolders.size >= 3) {
    return { layout: 'legacy-flat-root', tree, defaultBranch };
  }

  // 4. Check for topic-difficulty (Array/Easy/0001-two-sum/...)
  const hasTopicFolder = tree.some((entry: GitHubTreeEntry) => {
    const parts = entry.path.split('/');
    if (parts.length >= 3) {
      const [topic, diff] = parts;
      const isKnownTopic = KNOWN_TOPIC_FOLDERS.includes(topic);
      const isKnownDiff = ['Easy', 'Medium', 'Hard'].includes(diff);
      return isKnownTopic && isKnownDiff;
    }
    return false;
  });

  if (hasTopicFolder) {
    return { layout: 'topic-difficulty', tree, defaultBranch };
  }

  return { layout: 'unknown', tree, defaultBranch };
}

