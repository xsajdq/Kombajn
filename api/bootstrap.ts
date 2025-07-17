

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin, keysToCamel } from './_lib/supabaseAdmin';
import type { User, Workspace, WorkspaceMember, Notification, WorkspaceJoinRequest } from '../../types';

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
        
        // Step 1: Fetch all essential data scoped to the current user in parallel
        const [
            profileRes,
            workspaceMembersRes,
            notificationsRes,
            joinRequestsRes
        ] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', user.id).single(),
            supabase.from('workspace_members').select('*').eq('user_id', user.id),
            supabase.from('notifications').select('*').eq('user_id', user.id),
            supabase.from('workspace_join_requests').select('*').eq('user_id', user.id),
        ]);

        // Check for critical errors
        const results = [profileRes, workspaceMembersRes, notificationsRes, joinRequestsRes];
        for (const r of results) {
            // Ignore "0 rows" error for single() as it's not a real error in this context
            if (r.error && r.error.code !== 'PGRST116') { 
                 throw new Error(`A database query failed during bootstrap: ${r.error.message}`);
            }
        }
        
        const userProfile: User | null = keysToCamel(profileRes.data);
        const userMemberships: WorkspaceMember[] = keysToCamel(workspaceMembersRes.data) || [];
        const userNotifications: Notification[] = keysToCamel(notificationsRes.data) || [];
        const userJoinRequests: WorkspaceJoinRequest[] = keysToCamel(joinRequestsRes.data) || [];

        // Step 2: If the user has memberships, fetch the corresponding workspace data.
        let userWorkspaces: Workspace[] = [];
        if (userMemberships.length > 0) {
            const workspaceIds = userMemberships.map(m => m.workspaceId);
            const { data: workspacesData, error: workspacesError } = await supabase.from('workspaces').select('*, "planHistory"').in('id', workspaceIds);
            if (workspacesError) throw workspacesError;
            userWorkspaces = keysToCamel(workspacesData) || [];
        }

        // --- Handle case where user is new and has no workspaces ---
        if (userMemberships.length === 0) {
             return res.status(200).json({
                currentUser: userProfile,
                profiles: userProfile ? [userProfile] : [],
                workspaces: [],
                workspaceMembers: [],
                notifications: [],
                workspaceJoinRequests: userJoinRequests,
                // Return empty for all other non-essential data
                projects: [], tasks: [], clients: [], deals: [], timeLogs: [], dependencies: [],
                dashboardWidgets: [], comments: [], taskAssignees: [], tags: [], taskTags: [], 
                objectives: [], keyResults: [], dealNotes: [], invoices: [], invoiceLineItems: [], 
                integrations: [], clientContacts: [], expenses: [], projectMembers: []
            });
        }
        
        // --- Step 3: Assemble the payload. Note: profiles and workspaceMembers are now minimal.
        // The app will need to be adapted to fetch other users' data on demand.
        res.status(200).json({
            // Essential data for app shell and setup
            currentUser: userProfile,
            profiles: userProfile ? [userProfile] : [], // CRITICAL: Only send the current user's profile
            workspaces: userWorkspaces,
            workspaceMembers: userMemberships, // CRITICAL: Only send the current user's memberships
            notifications: userNotifications,
            workspaceJoinRequests: userJoinRequests,
            
            // Return empty arrays for all other data. This is the key to preventing timeouts.
            projects: [], tasks: [], clients: [], deals: [], timeLogs: [], dependencies: [],
            dashboardWidgets: [], comments: [], taskAssignees: [], tags: [], taskTags: [], 
            objectives: [], keyResults: [], dealNotes: [], invoices: [], invoiceLineItems: [], 
            integrations: [], clientContacts: [], expenses: [], projectMembers: []
        });

    } catch (error: any) {
        console.error('Bootstrap error:', error);
        return res.status(500).json({ error: `Bootstrap failed: ${error.message}` });
    }
}
