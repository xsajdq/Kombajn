
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

        // Step 2: Handle new user with no workspaces (shows setup page on client)
        if (!userMemberships || userMemberships.length === 0) {
            const { data: userProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            const { data: joinRequests } = await supabase.from('workspace_join_requests').select('*').eq('user_id', user.id);
            
            return res.status(200).json(keysToCamel({
                current_user: userProfile,
                profiles: userProfile ? [userProfile] : [],
                workspaces: [],
                workspace_members: [],
                notifications: [],
                workspace_join_requests: joinRequests || [],
                // Return empty arrays for all other data
                projects: [], tasks: [], clients: [], deals: [], time_logs: [], dependencies: [],
                dashboard_widgets: [], comments: [], task_assignees: [], tags: [], task_tags: [], 
                objectives: [], key_results: [], deal_notes: [], invoices: [], invoice_line_items: [], 
                integrations: [], client_contacts: [], expenses: [], project_members: []
            }));
        }

        const allUserWorkspaceIds = userMemberships.map(m => m.workspace_id);
        const activeWorkspaceId = allUserWorkspaceIds[0]; // Load data for the first workspace by default

        // Step 3: Fetch all members of the active workspace to get their profiles
        const { data: activeWorkspaceMembers, error: awmError } = await supabase
            .from('workspace_members')
            .select('*')
            .eq('workspace_id', activeWorkspaceId);
        
        if (awmError) throw awmError;
        
        const userIdsInActiveWorkspace = [...new Set(activeWorkspaceMembers.map(m => m.user_id))];

        // Step 4: Fetch all required data in parallel.
        const [
            currentUserProfileRes,
            allProfilesRes,
            allWorkspacesRes,
            allUserMembershipsRes,
            projectsRes,
            tasksRes,
            clientsRes,
            dealsRes,
            timeLogsRes,
            commentsRes,
            taskAssigneesRes,
            tagsRes,
            taskTagsRes,
            objectivesRes,
            dealNotesRes,
            invoicesRes,
            integrationsRes,
            clientContactsRes,
            expensesRes,
            projectMembersRes,
            dependenciesRes,
            workspaceJoinRequestsRes,
            dashboardWidgetsRes,
            notificationsRes,
        ] = await Promise.all([
            // User & Workspace context data
            supabase.from('profiles').select('*').eq('id', user.id).single(),
            supabase.from('profiles').select('*').in('id', userIdsInActiveWorkspace),
            supabase.from('workspaces').select('*, "planHistory"').in('id', allUserWorkspaceIds),
            supabase.from('workspace_members').select('*').in('workspace_id', allUserWorkspaceIds),
            
            // Data scoped to the active workspace
            supabase.from('projects').select('*').eq('workspace_id', activeWorkspaceId),
            supabase.from('tasks').select('*').eq('workspace_id', activeWorkspaceId),
            supabase.from('clients').select('*').eq('workspace_id', activeWorkspaceId),
            supabase.from('deals').select('*').eq('workspace_id', activeWorkspaceId),
            supabase.from('time_logs').select('*').eq('workspace_id', activeWorkspaceId),
            supabase.from('comments').select('*').eq('workspace_id', activeWorkspaceId),
            supabase.from('task_assignees').select('*').eq('workspace_id', activeWorkspaceId),
            supabase.from('tags').select('*').eq('workspace_id', activeWorkspaceId),
            supabase.from('task_tags').select('*').eq('workspace_id', activeWorkspaceId),
            supabase.from('objectives').select('*').eq('workspace_id', activeWorkspaceId),
            supabase.from('deal_notes').select('*').eq('workspace_id', activeWorkspaceId),
            supabase.from('invoices').select('*').eq('workspace_id', activeWorkspaceId),
            supabase.from('integrations').select('*').eq('workspace_id', activeWorkspaceId),
            supabase.from('client_contacts').select('*').eq('workspace_id', activeWorkspaceId),
            supabase.from('expenses').select('*').eq('workspace_id', activeWorkspaceId),
            supabase.from('project_members').select('*').eq('workspace_id', activeWorkspaceId),
            supabase.from('task_dependencies').select('*').eq('workspace_id', activeWorkspaceId),
            supabase.from('workspace_join_requests').select('*').in('workspace_id', allUserWorkspaceIds),
            supabase.from('dashboard_widgets').select('*').eq('user_id', user.id).eq('workspace_id', activeWorkspaceId),
            supabase.from('notifications').select('*').eq('user_id', user.id), // All notifications for user
        ]);
        
        // Check all results for errors
        const allResults = [
            currentUserProfileRes, allProfilesRes, allWorkspacesRes, allUserMembershipsRes, projectsRes,
            tasksRes, clientsRes, dealsRes, timeLogsRes, commentsRes, taskAssigneesRes, tagsRes, taskTagsRes,
            objectivesRes, dealNotesRes, invoicesRes, integrationsRes, clientContactsRes, expensesRes,
            projectMembersRes, dependenciesRes, workspaceJoinRequestsRes, dashboardWidgetsRes, notificationsRes
        ];
        
        for (const r of allResults) {
            if (r.error && r.error.code !== 'PGRST116') { // Ignore "0 rows" error for single()
                 throw new Error(`A database query failed during bootstrap: ${r.error.message}`);
            }
        }

        // Step 5: Fetch second-level dependencies (Key Results, Invoice Line Items)
        const objectiveIds = (objectivesRes.data || []).map(o => o.id);
        const invoiceIds = (invoicesRes.data || []).map(i => i.id);

        const [keyResultsRes, invoiceLineItemsRes] = await Promise.all([
            objectiveIds.length > 0 ? supabase.from('key_results').select('*').in('objective_id', objectiveIds) : Promise.resolve({ data: [], error: null }),
            invoiceIds.length > 0 ? supabase.from('invoice_line_items').select('*').in('invoice_id', invoiceIds) : Promise.resolve({ data: [], error: null }),
        ]);

        if (keyResultsRes.error) throw keyResultsRes.error;
        if (invoiceLineItemsRes.error) throw invoiceLineItemsRes.error;

        // Step 6: Assemble final payload
        const responseData = {
            current_user: currentUserProfileRes.data,
            profiles: allProfilesRes.data || [],
            workspaces: allWorkspacesRes.data || [],
            workspace_members: allUserMembershipsRes.data || [],
            projects: projectsRes.data || [],
            tasks: tasksRes.data || [],
            clients: clientsRes.data || [],
            deals: dealsRes.data || [],
            time_logs: timeLogsRes.data || [],
            comments: commentsRes.data || [],
            task_assignees: taskAssigneesRes.data || [],
            tags: tagsRes.data || [],
            task_tags: taskTagsRes.data || [],
            objectives: objectivesRes.data || [],
            key_results: keyResultsRes.data || [],
            deal_notes: dealNotesRes.data || [],
            invoices: invoicesRes.data || [],
            invoice_line_items: invoiceLineItemsRes.data || [],
            integrations: integrationsRes.data || [],
            client_contacts: clientContactsRes.data || [],
            expenses: expensesRes.data || [],
            project_members: projectMembersRes.data || [],
            dependencies: dependenciesRes.data || [],
            workspace_join_requests: workspaceJoinRequestsRes.data || [],
            dashboard_widgets: dashboardWidgetsRes.data || [],
            notifications: notificationsRes.data || [],
        };
        
        return res.status(200).json(keysToCamel(responseData));

    } catch (error: any) {
        console.error('Bootstrap error:', error);
        return res.status(500).json({ error: `Bootstrap failed: ${error.message}` });
    }
}
