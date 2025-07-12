// api/auth/connect/google.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
    const { workspaceId } = req.query;

    if (!workspaceId) {
        return res.status(400).json({ error: 'Workspace ID is required' });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
        return res.status(500).json({ error: 'Google Client ID not configured on server.' });
    }

    const redirectUri = `${process.env.BASE_URL}/api/auth/callback/google`;

    const scopes = [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/drive.file' // Scope required for Google Picker
    ];

    const state = `${workspaceId}`; // Simple state, can be enhanced with a JWT for more security

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('state', state as string);
    authUrl.searchParams.set('access_type', 'offline'); // To get a refresh token
    authUrl.searchParams.set('prompt', 'consent'); // Ensures refresh token is always sent

    res.redirect(302, authUrl.toString());
}
