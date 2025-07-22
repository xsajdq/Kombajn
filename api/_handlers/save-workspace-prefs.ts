
// api/_handlers/save-workspace-prefs.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin, keysToCamel } from '../_lib/supabaseAdmin';

const PROVIDER = 'internal_settings';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const supabase = getSupabaseAdmin();
        const token = req.headers.authorization?.split('Bearer ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Authentication required.' });
        }
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid user session.' });
        }

        const { workspaceId, workflow } = req.body;
        if (!workspaceId || !workflow) {
            return res.status(400).json({ error: 'workspaceId and workflow are required.' });
        }
        if (!['simple', 'advanced'].includes(workflow)) {
            return res.status(400).json({ error: 'Invalid workflow value.' });
        }

        // Security check: ensure user is an admin/owner of the workspace
        const { data: member, error: memberError } = await supabase
            .from('workspace_members')
            .select('role')
            .eq('user_id', user.id)
            .eq('workspace_id', workspaceId)
            .single();

        if (memberError || !member || !['owner', 'admin'].includes(member.role)) {
            return res.status(403).json({ error: 'You do not have permission to change these settings.' });
        }
        
        // Fetch existing settings to merge, not overwrite
        const { data: existingIntegration } = await supabase
            .from('integrations')
            .select('settings')
            .eq('workspace_id', workspaceId)
            .eq('provider', PROVIDER)
            .single();

        const newSettings = {
            ...(existingIntegration?.settings || {}),
            defaultKanbanWorkflow: workflow,
        };

        const { data, error } = await supabase
            .from('integrations')
            .upsert({
                workspace_id: workspaceId,
                provider: PROVIDER,
                is_active: false, // This is just for internal settings, doesn't need to be "active"
                settings: newSettings,
            }, {
                onConflict: 'workspace_id, provider',
            })
            .select()
            .single();
        
        if (error) throw error;
        
        return res.status(200).json({ success: true, data: keysToCamel(data) });

    } catch (error: any) {
        console.error('Error saving workspace preferences:', error);
        return res.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
}
