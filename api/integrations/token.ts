// api/integrations/token.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import type { Integration } from '../../types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const supabase = getSupabaseAdmin();
        const { provider, workspaceId } = req.query;

        if (!provider || !workspaceId) {
            return res.status(400).json({ error: 'Provider and Workspace ID are required.' });
        }
        
        // 1. Authenticate user from the request
        const token = req.headers.authorization?.split('Bearer ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Authentication token required.' });
        }
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid user session.' });
        }

        // 2. Fetch the integration details from the database
        const { data: integration, error: dbError } = await supabase
            .from('integrations')
            .select('*')
            .eq('workspace_id', workspaceId)
            .eq('provider', provider)
            .single();

        if (dbError || !integration || !integration.is_active) {
            return res.status(404).json({ error: 'Active integration not found for this workspace.' });
        }

        let accessToken = integration.settings.accessToken;
        const refreshToken = integration.settings.refreshToken;
        const tokenExpiry = integration.settings.tokenExpiry;
        const nowInSeconds = Math.floor(Date.now() / 1000);

        // 3. If token is expired, refresh it (Google Drive specific)
        if (provider === 'google_drive' && tokenExpiry && refreshToken && nowInSeconds >= tokenExpiry - 60) {
            console.log('Google token expired, refreshing...');
            const clientId = process.env.GOOGLE_CLIENT_ID;
            const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

            const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: clientId!,
                    client_secret: clientSecret!,
                    refresh_token: refreshToken,
                    grant_type: 'refresh_token',
                }),
            });

            const refreshedTokenData = await refreshResponse.json();
            if (!refreshResponse.ok) {
                throw new Error('Failed to refresh Google token.');
            }
            
            accessToken = refreshedTokenData.access_token;
            const newExpiry = nowInSeconds + refreshedTokenData.expires_in;

            // Update the database with the new token and expiry
            const newSettings = { ...integration.settings, accessToken, tokenExpiry: newExpiry };
            const { error: updateError } = await supabase
                .from('integrations')
                .update({ settings: newSettings })
                .eq('id', integration.id);

            if (updateError) {
                console.error('Failed to update refreshed token in DB:', updateError);
                // Continue with the new token anyway for this request
            }
        }
        
        // 4. Return the valid access token and necessary keys for the frontend
        return res.status(200).json({ 
            token: accessToken,
            developerKey: process.env.GOOGLE_API_KEY, // For Google Picker
            clientId: process.env.GOOGLE_CLIENT_ID, // For Google Picker
        });

    } catch (error: any) {
        console.error('Error in /api/integrations/token:', error);
        return res.status(500).json({ error: error.message });
    }
}
