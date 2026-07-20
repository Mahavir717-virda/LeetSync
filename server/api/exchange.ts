/**
 * GitHub OAuth Token Exchange — Serverless Function
 *
 * Deploy to Vercel (or Cloudflare Workers / Netlify Functions).
 *
 * This function receives the authorization code from the Chrome extension
 * and exchanges it for an access token using the client_secret (which is
 * stored as an environment variable on the server, never shipped in the extension).
 *
 * Environment variables required:
 *   GITHUB_CLIENT_ID     — Your GitHub OAuth App's client ID
 *   GITHUB_CLIENT_SECRET — Your GitHub OAuth App's client secret
 *
 * Endpoint: POST /api/exchange
 * Body: { "code": "...", "state": "..." }
 * Returns: { "access_token": "..." }
 */

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET env vars');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const data = await response.json();

    if (data.error) {
      return res.status(400).json({
        error: data.error,
        error_description: data.error_description,
      });
    }

    return res.status(200).json({
      access_token: data.access_token,
      token_type: data.token_type,
      scope: data.scope,
    });
  } catch (err: any) {
    console.error('Token exchange error:', err);
    return res.status(500).json({ error: 'Token exchange failed' });
  }
}
