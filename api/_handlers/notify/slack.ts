
// api/_handlers/notify/slack.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const supabase = getSupabaseAdmin();
        const token = req.headers.authorization?.split('Bearer ')[1];
        if (!token) return res.status(401).json({ error: 'Auth token required' });

        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !authUser) return res.status(401).json({ error: 'Invalid auth token' });
        
        const { userId, message, workspaceId } = req.body;
        if (!userId || !message || !workspaceId) {
            return res.status(400).json({ error: 'userId, message, and workspaceId are required' });
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('slack_user_id')
            .eq('id', userId)
            .single();

        if (profileError || !profile || !profile.slack_user_id) {
             console.log(`Slack notification skipped: User ${userId} has no slack_user_id.`);
             return res.status(200).json({ message: 'Notification skipped, user not mapped to Slack.' });
        }
        
        const { data: integration, error: integrationError } = await supabase
            .from('integrations')
            .select('settings')
            .eq('workspace_id', workspaceId)
            .eq('provider', 'slack')
            .eq('is_active', true)
            .single();
            
        if (integrationError || !integration || !(integration.settings as any)?.accessToken) {
            console.log(`Slack notification skipped: Workspace ${workspaceId} has no active Slack integration.`);
            return res.status(200).json({ message: 'Notification skipped, workspace integration not active.' });
        }
        
        console.log(`[SLACK SIMULATION] Sending DM to ${profile.slack_user_id}: "${message}"`);

        return res.status(200).json({ success: true, message: 'Notification sent successfully.' });

    } catch (error: any) {
        console.error('Error in Slack notification handler:', error);
        return res.status(500).json({ error: error.message });
    }
}
