
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
        
        // 1. Get user's workspace IDs
        const { data: userMemberships, error: memberError } = await supabase
            .from('workspace_members')
            .select('workspace_id')
            .eq('user_id', user.id);

        if (memberError) {
            throw new Error(`DB error fetching memberships: ${memberError.message}`);
        }
        
        const { data: userProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

        // Handle case where user has no workspaces yet
        if (!userMemberships || userMemberships.length === 0) {
            const { data: joinRequests } = await supabase.from('workspace_join_requests').select('*').eq('user_id', user.id);
            return res.status(200).json(keysToCamel({
                current_user: userProfile,
                profiles: userProfile ? [userProfile] : [],
                workspaces: [],
                workspace_members: [],
                notifications: [],
                dashboard_widgets: [],
                workspace_join_requests: joinRequests || [],
                integrations: [],
                // Ensure other arrays are empty to prevent client-side errors
                projects: [], tasks: [], clients: [], deals: [], time_logs: [], dependencies: [],
                comments: [], task_assignees: [], tags: [], task_tags: [], 
                objectives: [], key_results: [], deal_notes: [], invoices: [], invoice_line_items: [], 
                client_contacts: [], expenses: [], project_members: []
            }));
        }

        const userWorkspaceIds = userMemberships.map((m: { workspace_id: string }) => m.workspace_id);

        // 2. Fetch all members of those workspaces to get all necessary user profiles
        const { data: allMembersInUserWorkspaces, error: allMembersError } = await supabase
            .from('workspace_members')
            .select('user_id, id, workspace_id, role')
            .in('workspace_id', userWorkspaceIds);

        if (allMembersError) throw allMembersError;

        const allMemberUserIds = [...new Set(allMembersInUserWorkspaces.map(m => m.user_id))];
        
        // 3. Fetch all other data in parallel, scoped to the user's workspaces/ID
        const [
            allProfilesRes,
            allWorkspacesRes,
            dashboardWidgetsRes,
            notificationsRes,
            joinRequestsRes,
            integrationsRes
        ] = await Promise.all([
            supabase.from('profiles').select('*').in('id', allMemberUserIds),
            supabase.from('workspaces').select('*, "planHistory"').in('id', userWorkspaceIds),
            supabase.from('dashboard_widgets').select('*').eq('user_id', user.id),
            supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
            supabase.from('workspace_join_requests').select('*').eq('user_id', user.id),
            supabase.from('integrations').select('*').in('workspace_id', userWorkspaceIds),
        ]);
        
        const allResults = [allProfilesRes, allWorkspacesRes, dashboardWidgetsRes, notificationsRes, joinRequestsRes, integrationsRes];
        
        for (const r of allResults) {
            if (r.error) {
                 throw new Error(`A database query failed during bootstrap: ${r.error.message}`);
            }
        }
        
        // 4. Construct the final response object
        const responseData = {
            current_user: allProfilesRes.data?.find(p => p.id === user.id) || null,
            profiles: allProfilesRes.data || [],
            workspaces: allWorkspacesRes.data || [],
            workspace_members: allMembersInUserWorkspaces || [],
            dashboard_widgets: dashboardWidgetsRes.data || [],
            notifications: notificationsRes.data || [],
            workspace_join_requests: joinRequestsRes.data || [],
            integrations: integrationsRes.data || [],
            // All other large tables are deferred and will be loaded by the client on-demand
            projects: [], tasks: [], clients: [], deals: [], time_logs: [], comments: [], task_assignees: [], 
            tags: [], task_tags: [], objectives: [], key_results: [], deal_notes: [], invoices: [], 
            invoice_line_items: [], client_contacts: [], expenses: [], project_members: [], 
            dependencies: []
        };
        
        return res.status(200).json(keysToCamel(responseData));

    } catch (error: any) {
        console.error('Bootstrap error:', error);
        return res.status(500).json({ error: `Bootstrap failed: ${error.message}` });
    }
}
