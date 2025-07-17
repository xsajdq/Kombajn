
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin';

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
        
        // Fetch the current user's full profile separately
        const { data: currentUserProfile, error: currentUserProfileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        if (currentUserProfileError) throw new Error(`Could not fetch current user's profile: ${currentUserProfileError.message}`);


        // 1. Get user's workspace memberships to determine which workspaces to fetch data for.
        const { data: userWorkspaceMemberships, error: membersError } = await supabase
            .from('workspace_members')
            .select('workspace_id')
            .eq('user_id', user.id);
        
        if (membersError) throw membersError;
        
        const workspaceIds = userWorkspaceMemberships.map(m => m.workspace_id);
        if (workspaceIds.length === 0) {
            // If user has no workspaces, return minimal data to allow for setup page.
            return res.status(200).json({
                currentUser: currentUserProfile,
                profiles: currentUserProfile ? [currentUserProfile] : [],
                workspaces: [],
                workspaceMembers: [],
                projects: [],
                tasks: [],
                clients: [],
                deals: [],
                timeLogs: [],
                dependencies: [],
                workspaceJoinRequests: [],
                notifications: [],
                dashboardWidgets: [],
                comments: [],
                taskAssignees: [],
                tags: [],
                taskTags: [],
                objectives: [],
                keyResults: [],
                dealNotes: [],
                invoices: [],
                invoiceLineItems: [],
                integrations: [],
                clientContacts: [],
                expenses: [],
            });
        }
        
        // 2. Get all users associated with those workspaces.
        const { data: allMemberLinks, error: allMembersError } = await supabase
            .from('workspace_members')
            .select('user_id')
            .in('workspace_id', workspaceIds);

        if (allMembersError) throw allMembersError;
        const userIdsInWorkspaces = [...new Set(allMemberLinks.map(m => m.user_id))];

        // 3. Fetch essential data in parallel, scoped to the user's workspaces.
        const [
            profilesRes, projectsRes, clientsRes, tasksRes, timeLogsRes, workspacesRes, 
            workspaceMembersRes, notificationsRes, dashboardWidgetsRes, commentsRes, taskAssigneesRes
        ] = await Promise.all([
            supabase.from('profiles').select('*').in('id', userIdsInWorkspaces),
            supabase.from('projects').select('*').in('workspace_id', workspaceIds),
            supabase.from('clients').select('*').in('workspace_id', workspaceIds),
            supabase.from('tasks').select('*').in('workspace_id', workspaceIds),
            supabase.from('time_logs').select('*').in('workspace_id', workspaceIds),
            supabase.from('workspaces').select('*, "planHistory"').in('id', workspaceIds),
            supabase.from('workspace_members').select('*').in('workspace_id', workspaceIds),
            supabase.from('notifications').select('*').eq('user_id', user.id),
            supabase.from('dashboard_widgets').select('*').eq('user_id', user.id),
            supabase.from('comments').select('*').in('workspace_id', workspaceIds),
            supabase.from('task_assignees').select('*').in('workspace_id', workspaceIds),
        ]);

        // Throw first error found
        const results = [profilesRes, projectsRes, clientsRes, tasksRes, timeLogsRes, workspacesRes, workspaceMembersRes, notificationsRes, dashboardWidgetsRes, commentsRes, taskAssigneesRes];
        for (const r of results) {
            if (r.error) throw r.error;
        }
        
        // 5. Assemble the final payload, returning empty arrays for non-essential data to prevent timeouts.
        res.status(200).json({
            currentUser: currentUserProfile,
            profiles: profilesRes.data,
            projects: projectsRes.data,
            clients: clientsRes.data,
            tasks: tasksRes.data,
            timeLogs: timeLogsRes.data,
            workspaces: workspacesRes.data,
            workspaceMembers: workspaceMembersRes.data,
            notifications: notificationsRes.data,
            dashboardWidgets: dashboardWidgetsRes.data,
            comments: commentsRes.data,
            taskAssignees: taskAssigneesRes.data,

            // Non-essential data, returned as empty to be lazy-loaded later.
            deals: [],
            dependencies: [],
            workspaceJoinRequests: [],
            tags: [],
            taskTags: [],
            objectives: [],
            keyResults: [],
            dealNotes: [],
            invoices: [],
            invoiceLineItems: [],
            integrations: [],
            clientContacts: [],
            expenses: [],
        });

    } catch (error: any) {
        console.error('Bootstrap error:', error);
        return res.status(500).json({ error: `Bootstrap failed: ${error.message}` });
    }
}
