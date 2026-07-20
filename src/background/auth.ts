/**
 * GitHub Authentication Module
 *
 * Supports two auth flows:
 * 1. OAuth via chrome.identity.launchWebAuthFlow + serverless proxy
 * 2. Manual PAT (Personal Access Token) entry
 */

import {
  GITHUB_CLIENT_ID,
  GITHUB_OAUTH_URL,
  GITHUB_TOKEN_EXCHANGE_URL,
  GITHUB_OAUTH_SCOPES,
} from '@/utils/constants';
import { updateSettings, getSettings } from '@/utils/storage';
import { githubApi } from './github-api';

/**
 * Initiate GitHub OAuth login flow.
 * Uses chrome.identity.launchWebAuthFlow to open the GitHub auth page,
 * then sends the code to our serverless proxy for token exchange.
 */
export async function loginWithOAuth(): Promise<{ success: boolean; error?: string }> {
  try {
    // Generate a random state parameter for CSRF protection
    const state = crypto.randomUUID();

    const redirectUri = chrome.identity.getRedirectURL();
    const authUrl = new URL(GITHUB_OAUTH_URL);
    authUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', GITHUB_OAUTH_SCOPES);
    authUrl.searchParams.set('state', state);

    console.log('[LeetSync Auth] Starting OAuth flow, redirect URI:', redirectUri);

    // Open the GitHub authorization page
    const responseUrl = await new Promise<string>((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl.toString(), interactive: true },
        (redirectUrl) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!redirectUrl) {
            reject(new Error('No redirect URL received'));
          } else {
            resolve(redirectUrl);
          }
        }
      );
    });

    // Extract the authorization code from the redirect URL
    const url = new URL(responseUrl);
    const code = url.searchParams.get('code');
    const returnedState = url.searchParams.get('state');

    if (!code) {
      return { success: false, error: 'No authorization code received from GitHub' };
    }

    // Verify state parameter to prevent CSRF
    if (returnedState !== state) {
      return { success: false, error: 'State mismatch — possible CSRF attack' };
    }

    // Exchange the code for an access token via serverless proxy
    const tokenResponse = await fetch(GITHUB_TOKEN_EXCHANGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      return { success: false, error: `Token exchange failed: ${errorData.message ?? tokenResponse.statusText}` };
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return { success: false, error: 'No access token received from token exchange' };
    }

    // Validate the token and get user info
    return await validateAndStoreToken(accessToken, 'oauth');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during OAuth';
    console.error('[LeetSync Auth] OAuth error:', err);
    return { success: false, error: message };
  }
}

/**
 * Login with a Personal Access Token.
 * Validates the token by calling the GitHub API, then stores it.
 */
export async function loginWithPAT(token: string): Promise<{ success: boolean; error?: string }> {
  if (!token || token.trim().length === 0) {
    return { success: false, error: 'Token cannot be empty' };
  }

  return await validateAndStoreToken(token.trim(), 'pat');
}

/**
 * Validate a GitHub token and store it along with user info.
 */
async function validateAndStoreToken(
  token: string,
  method: 'oauth' | 'pat'
): Promise<{ success: boolean; error?: string }> {
  try {
    // Test the token by fetching user info
    const user = await githubApi.getUser(token);

    if (!user || !user.login) {
      return { success: false, error: 'Invalid token — could not fetch user info' };
    }

    // Store the token and user info
    await updateSettings({
      githubToken: token,
      authMethod: method,
      githubUsername: user.login,
      githubAvatarUrl: user.avatar_url,
    });

    console.log(`[LeetSync Auth] Logged in as ${user.login} via ${method}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token validation failed';
    console.error('[LeetSync Auth] Token validation error:', err);

    if (message.includes('401') || message.includes('Unauthorized')) {
      return { success: false, error: 'Invalid or expired token' };
    }

    return { success: false, error: message };
  }
}

/**
 * Log out — clear token and user info.
 */
export async function logout(): Promise<void> {
  await updateSettings({
    githubToken: null,
    authMethod: null,
    githubUsername: null,
    githubAvatarUrl: null,
    repoOwner: null,
    repoName: null,
  });
  console.log('[LeetSync Auth] Logged out');
}

/**
 * Check if the stored token is still valid.
 * Call this on extension startup to detect expired/revoked tokens.
 */
export async function validateStoredToken(): Promise<boolean> {
  const settings = await getSettings();
  if (!settings.githubToken) return false;

  try {
    const user = await githubApi.getUser(settings.githubToken);
    return !!user?.login;
  } catch {
    console.warn('[LeetSync Auth] Stored token is invalid, clearing');
    await logout();
    return false;
  }
}
