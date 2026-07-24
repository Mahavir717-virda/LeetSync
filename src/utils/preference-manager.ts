import { getSettings, updateSettings } from './storage';
import { githubApi } from '@/background/github-api';

const PREFERENCES_FILE_PATH = '.leetsync/preferences.json';

export interface FolderPreferences {
  [questionNumber: string]: string;
}

export interface LeetSyncPreferencesFile {
  version: number;
  folderPreferences: FolderPreferences;
}

export async function getProblemPreference(questionNumber: number): Promise<string | null> {
  const settings = await getSettings();
  return settings.cachedPreferences?.[String(questionNumber)] ?? null;
}

export async function setProblemPreference(questionNumber: number, folder: string): Promise<void> {
  const settings = await getSettings();
  const updatedPrefs = { ...(settings.cachedPreferences || {}), [String(questionNumber)]: folder };
  await updateSettings({ cachedPreferences: updatedPrefs });

  // Sync to GitHub repository config in the background
  const token = settings.githubToken;
  const owner = settings.repoOwner;
  const repo = settings.repoName;
  if (token && owner && repo) {
    try {
      const existing = await githubApi.getFileContent(token, owner, repo, PREFERENCES_FILE_PATH);
      const content: LeetSyncPreferencesFile = {
        version: 1,
        folderPreferences: updatedPrefs,
      };
      await githubApi.createOrUpdateFile(
        token, owner, repo, PREFERENCES_FILE_PATH,
        JSON.stringify(content, null, 2),
        `Update folder preferences: problem #${questionNumber} -> ${folder}`,
        existing?.sha
      );
    } catch (err) {
      console.error('[Preference Manager] Failed to sync preferences.json to GitHub:', err);
    }
  }
}
