// api/auth/connect/slack.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
    const { workspaceId } = req.query;

    if (!workspaceId) {
        return res.status(400).json({ error: 'Workspace ID is required' });
    }

    const clientId = process.env.SLACK_CLIENT_ID;
    if (!clientId) {
        return res.status(500).json({ error: 'Slack Client ID not configured on server.' });
    }

    const redirectUri = `${process.env.BASE_URL}/api/auth/callback/slack`;

    const userScopes = [
        'chat:write', // To send DMs to the user
        'users:read', // To get user info
        'users:read.email', // To get user email
    ];
    
    const state = `${workspaceId}`;

    const authUrl = new URL('https://slack.com/oauth/v2/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('user_scope', userScopes.join(' '));
    authUrl.searchParams.set('state', state as string);
    
    res.redirect(302, authUrl.toString());
}
