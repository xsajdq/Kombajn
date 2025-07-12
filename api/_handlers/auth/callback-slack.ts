
// api/_handlers/auth/callback-slack.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin';

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
        return res.status(200).send(renderClosingPage(false, authError as string, 'slack'));
    }

    if (!code) {
        return res.status(400).send(renderClosingPage(false, 'Authorization code is missing.', 'slack'));
    }

    const workspaceId = state as string;

    // Use cookie to find user ID. The connect endpoint runs under the same domain, so cookies are sent.
    const supabaseForUser = getSupabaseAdmin();
    const token = req.cookies['sb-access-token']; // Default Supabase cookie name pattern
    if (!token) {
        return res.status(401).send(renderClosingPage(false, 'User session not found.', 'slack'));
    }

    const { data: { user } } = await supabaseForUser.auth.getUser(token);
    if (!user) {
        return res.status(401).send(renderClosingPage(false, 'Invalid user session.', 'slack'));
    }

    try {
        const supabaseAdmin = getSupabaseAdmin();
        const clientId = process.env.SLACK_CLIENT_ID;
        const clientSecret = process.env.SLACK_CLIENT_SECRET;

        const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code: code as string,
                client_id: clientId!,
                client_secret: clientSecret!,
            }),
        });

        const tokenData = await tokenResponse.json();

        if (!tokenData.ok) {
            throw new Error(tokenData.error || 'Failed to fetch access token from Slack.');
        }

        const { authed_user, team } = tokenData;

        const integrationData = {
            provider: 'slack',
            workspace_id: workspaceId,
            is_active: true,
            settings: {
                accessToken: authed_user.access_token,
                slackWorkspaceName: team.name,
                slackTeamId: team.id,
            },
        };

        // Update the user's profile with their Slack ID
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({ slack_user_id: authed_user.id })
            .eq('id', user.id);
        
        if (profileError) throw profileError;

        const { error: dbError } = await supabaseAdmin
            .from('integrations')
            .upsert(integrationData, { onConflict: 'workspace_id, provider' });
            
        if (dbError) throw dbError;

        return res.status(200).send(renderClosingPage(true, undefined, 'slack'));

    } catch (error: any) {
        console.error('Slack callback error:', error);
        return res.status(500).send(renderClosingPage(false, error.message, 'slack'));
    }
}
