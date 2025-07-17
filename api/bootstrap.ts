
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
            return res.status(401).json({ error: authError?.message || 'Invalid or expired token.' });
        }
        
        const { data: userMemberships, error: memberError } = await supabase
            .from('workspace_members')
            .select('workspace_id, role')
            .eq('user_id', user.id);

        if (memberError) {
            throw new Error(`DB error fetching memberships: ${memberError.message}`);
        }

        const { data: userProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

        if (!userMemberships || userMemberships.length === 0) {
            const { data: joinRequests } = await supabase.from('workspace_join_requests').select('*').eq('user_id', user.id);
            
            return res.status(200).json(keysToCamel({
                current_user: userProfile,
                profiles: userProfile ? [userProfile] : [],
                workspaces: [],
                workspace_members: [],
                notifications: [],
                workspace_join_requests: joinRequests || [],
                projects: [], tasks: [], clients: [], deals: [], time_logs: [], dependencies: [],
                dashboard_widgets: [], comments: [], task_assignees: [], tags: [], task_tags: [], 
                objectives: [], key_results: [], deal_notes: [], invoices: [], invoice_line_items: [], 
                integrations: [], client_contacts: [], expenses: [], project_members: []
            }));
        }

        const allUserWorkspaceIds = userMemberships.map((m: { workspace_id: string }) => m.workspace_id);
        
        const [
            allProfilesRes,
            allWorkspacesRes,
            allUserMembershipsRes,
            dashboardWidgetsRes,
            notificationsRes,
            joinRequestsRes
        ] = await Promise.all([
            supabase.from('profiles').select('*'),
            supabase.from('workspaces').select('*, "planHistory"').in('id', allUserWorkspaceIds),
            supabase.from('workspace_members').select('*').in('workspace_id', allUserWorkspaceIds),
            supabase.from('dashboard_widgets').select('*').eq('user_id', user.id),
            supabase.from('notifications').select('*').eq('user_id', user.id),
            supabase.from('workspace_join_requests').select('*').in('workspace_id', allUserWorkspaceIds).eq('status', 'pending'),
        ]);
        
        const allResults = [ allProfilesRes, allWorkspacesRes, allUserMembershipsRes, dashboardWidgetsRes, notificationsRes, joinRequestsRes ];
        
        for (const r of allResults) {
            if (r.error) {
                 throw new Error(`A database query failed during bootstrap: ${r.error.message}`);
            }
        }

        const responseData = {
            current_user: userProfile,
            profiles: allProfilesRes.data || [],
            workspaces: allWorkspacesRes.data || [],
            workspace_members: allUserMembershipsRes.data || [],
            dashboard_widgets: dashboardWidgetsRes.data || [],
            notifications: notificationsRes.data || [],
            workspace_join_requests: joinRequestsRes.data || [],
            projects: [], tasks: [], clients: [], deals: [], time_logs: [], comments: [], task_assignees: [], 
            tags: [], task_tags: [], objectives: [], key_results: [], deal_notes: [], invoices: [], 
            invoice_line_items: [], integrations: [], client_contacts: [], expenses: [], project_members: [], 
            dependencies: []
        };
        
        return res.status(200).json(keysToCamel(responseData));

    } catch (error: any) {
        console.error('Bootstrap error:', error);
        return res.status(500).json({ error: `Bootstrap failed: ${error.message}` });
    }
}
