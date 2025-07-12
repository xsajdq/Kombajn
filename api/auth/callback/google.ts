// api/auth/callback/google.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin';

// Helper to render the self-closing page
function renderClosingPage(success: boolean, error?: string, provider?: string) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Connecting...</title>
      <script>
        const data = ${JSON.stringify({ success, error, provider })};
        if (window.opener) {
          window.opener.postMessage(data, '*');
        }
        window.close();
      </script>
    </head>
    <body>
      <p>Please wait while we connect your account...</p>
    </body>
    </html>
    `;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { code, state, error: authError } = req.query;

    if (authError) {
        return res.status(200).send(renderClosingPage(false, authError as string, 'google_drive'));
    }

    if (!code) {
        return res.status(400).send(renderClosingPage(false, 'Authorization code is missing.', 'google_drive'));
    }

    const workspaceId = state as string;

    try {
        const supabase = getSupabaseAdmin();
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const redirectUri = `${process.env.BASE_URL}/api/auth/callback/google`;

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code: code as string,
                client_id: clientId!,
                client_secret: clientSecret!,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }),
        });
        
        const tokenData = await tokenResponse.json();
        
        if (!tokenResponse.ok) {
            throw new Error(tokenData.error_description || 'Failed to fetch access token.');
        }

        const { access_token, refresh_token, expires_in } = tokenData;
        const tokenExpiry = Math.floor(Date.now() / 1000) + expires_in;

        // Fetch user info with the new access token
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { 'Authorization': `Bearer ${access_token}` },
        });
        const userData = await userResponse.json();

        const integrationData = {
            provider: 'google_drive',
            workspace_id: workspaceId,
            is_active: true,
            settings: {
                accessToken: access_token,
                refreshToken: refresh_token,
                tokenExpiry: tokenExpiry,
                googleUserEmail: userData.email,
            },
        };

        const { error: dbError } = await supabase
            .from('integrations')
            .upsert(integrationData, { onConflict: 'workspace_id, provider' });
        
        if (dbError) throw dbError;

        return res.status(200).send(renderClosingPage(true, undefined, 'google_drive'));

    } catch (error: any) {
        console.error('Google callback error:', error);
        return res.status(500).send(renderClosingPage(false, error.message, 'google_drive'));
    }
}
