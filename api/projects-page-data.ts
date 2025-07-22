// api/projects-page-data.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin, keysToCamel } from './_lib/supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const supabase = getSupabaseAdmin();
        const token = req.headers.authorization?.split('Bearer ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Authentication token required.' });
        }
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid or expired token.' });
        }
        
        const { workspaceId } = req.query;
        if (!workspaceId || typeof workspaceId !== 'string') {
            return res.status(400).json({ error: 'workspaceId is required.' });
        }

        // Security Check: Verify user is a member of the workspace
        const { data: membership, error: memberError } = await supabase
            .from('workspace_members')
            .select('user_id')
            .eq('workspace_id', workspaceId)
            .eq('user_id', user.id)
            .single();
            
        if (memberError || !membership) {
            return res.status(403).json({ error: 'User is not a member of this workspace.' });
        }

        // Fetch all data needed for the Projects page
        const [
            projectsRes,
            clientsRes,
            tasksRes,
            projectMembersRes
        ] = await Promise.all([
            supabase.from('projects').select('*, "wikiContent"').eq('workspace_id', workspaceId),
            supabase.from('clients').select('*').eq('workspace_id', workspaceId),
            supabase.from('tasks').select('id, project_id, status, due_date').eq('workspace_id', workspaceId),
            supabase.from('project_members').select('*').eq('workspace_id', workspaceId)
        ]);

        const allResults = [projectsRes, clientsRes, tasksRes, projectMembersRes];
        for (const r of allResults) {
            if (r.error) {
                console.error(`Error fetching resource: ${r.error.message}`);
                throw new Error(`Projects page data fetch failed: ${r.error.message}`);
            }
        }

        const responseData = {
            projects: projectsRes.data || [],
            clients: clientsRes.data || [],
            tasks: tasksRes.data || [],
            projectMembers: projectMembersRes.data || [],
        };
        
        return res.status(200).json(keysToCamel(responseData));

    } catch (error: any) {
        console.error('Projects page data fetch error:', error);
        return res.status(500).json({ error: `Failed to fetch projects page data: ${error.message}` });
    }
}
