
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
        
        // Step 1: Get all workspaces the user is a member of.
        const { data: userMemberships, error: memberError } = await supabase
            .from('workspace_members')
            .select('workspace_id, role')
            .eq('user_id', user.id);

        if (memberError) {
            throw new Error(`DB error fetching memberships: ${memberError.message}`);
        }

        const { data: userProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

        // Step 2: Handle new user with no workspaces (shows setup page on client)
        if (!userMemberships || userMemberships.length === 0) {
            const { data: joinRequests } = await supabase.from('workspace_join_requests').select('*').eq('user_id', user.id);
            
            return res.status(200).json(keysToCamel({
                current_user: userProfile,
                profiles: userProfile ? [userProfile] : [],
                workspaces: [],
                workspace_members: [],
                notifications: [],
                workspace_join_requests: joinRequests || [],
                // Return empty arrays for all other non-essential data
                projects: [], tasks: [], clients: [], deals: [], time_logs: [], dependencies: [],
                dashboard_widgets: [], comments: [], task_assignees: [], tags: [], task_tags: [], 
                objectives: [], key_results: [], deal_notes: [], invoices: [], invoice_line_items: [], 
                integrations: [], client_contacts: [], expenses: [], project_members: []
            }));
        }

        const allUserWorkspaceIds = userMemberships.map(m => m.workspace_id);
        
        // For now, we load data for the first workspace the user is part of.
        // A future improvement would be to use the last active workspace ID from localStorage.
        const activeWorkspaceId = allUserWorkspaceIds[0];

        // Step 3: Fetch all members of the active workspace to get their profiles
        const { data: activeWorkspaceMembers, error: awmError } = await supabase
            .from('workspace_members')
            .select('user_id')
            .eq('workspace_id', activeWorkspaceId);
        
        if (awmError) throw awmError;
        
        const userIdsInActiveWorkspace = [...new Set(activeWorkspaceMembers.map(m => m.user_id))];

        // Step 4: Fetch only the ESSENTIAL data for the dashboard view to prevent timeouts.
        // All other data (deals, invoices, etc.) should be loaded on-demand by their respective pages.
        const [
            allProfilesRes,
            allWorkspacesRes,
            allUserMembershipsRes,
            projectsRes,
            tasksRes,
            clientsRes,
            taskAssigneesRes,
            dashboardWidgetsRes,
            notificationsRes,
        ] = await Promise.all([
            // User & Workspace context
            supabase.from('profiles').select('*').in('id', userIdsInActiveWorkspace),
            supabase.from('workspaces').select('*, "planHistory"').in('id', allUserWorkspaceIds),
            supabase.from('workspace_members').select('*').in('workspace_id', allUserWorkspaceIds),
            
            // Core data for dashboard
            supabase.from('projects').select('*').eq('workspace_id', activeWorkspaceId),
            supabase.from('tasks').select('*').eq('workspace_id', activeWorkspaceId),
            supabase.from('clients').select('*').eq('workspace_id', activeWorkspaceId),
            supabase.from('task_assignees').select('*').eq('workspace_id', activeWorkspaceId),
            supabase.from('dashboard_widgets').select('*').eq('user_id', user.id).eq('workspace_id', activeWorkspaceId),
            supabase.from('notifications').select('*').eq('user_id', user.id),
        ]);
        
        const allResults = [
            allProfilesRes, allWorkspacesRes, allUserMembershipsRes, projectsRes,
            tasksRes, clientsRes, taskAssigneesRes, dashboardWidgetsRes, notificationsRes
        ];
        
        for (const r of allResults) {
            if (r.error) {
                 throw new Error(`A database query failed during bootstrap: ${r.error.message}`);
            }
        }

        // Step 5: Assemble final payload with empty arrays for non-essential data
        const responseData = {
            current_user: userProfile,
            profiles: allProfilesRes.data || [],
            workspaces: allWorkspacesRes.data || [],
            workspace_members: allUserMembershipsRes.data || [],
            projects: projectsRes.data || [],
            tasks: tasksRes.data || [],
            clients: clientsRes.data || [],
            task_assignees: taskAssigneesRes.data || [],
            dashboard_widgets: dashboardWidgetsRes.data || [],
            notifications: notificationsRes.data || [],
            // All other data is deferred to be loaded on-demand by their respective pages
            deals: [], time_logs: [], comments: [], tags: [], task_tags: [], objectives: [], 
            key_results: [], deal_notes: [], invoices: [], invoice_line_items: [], 
            integrations: [], client_contacts: [], expenses: [], project_members: [], 
            dependencies: [], workspace_join_requests: []
        };
        
        return res.status(200).json(keysToCamel(responseData));

    } catch (error: any) {
        console.error('Bootstrap error:', error);
        return res.status(500).json({ error: `Bootstrap failed: ${error.message}` });
    }
}
