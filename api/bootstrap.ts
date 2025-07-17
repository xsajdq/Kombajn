
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin';
import type { User, WorkspaceMember } from '../../types';

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
        
        // --- Step 1: Fetch the user's workspace memberships to know which workspaces to query ---
        const { data: userWorkspaceMemberships, error: membersError } = await supabase
            .from('workspace_members')
            .select('workspace_id')
            .eq('user_id', user.id);
            
        if (membersError) throw new Error(`Could not fetch user memberships: ${membersError.message}`);
        
        const workspaceIds = userWorkspaceMemberships.map(m => m.workspace_id);

        // --- Handle case where user is new and has no workspaces ---
        if (workspaceIds.length === 0) {
            const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (profileError && profileError.code !== 'PGRST116') { // Ignore "0 rows" error for single()
                 throw profileError;
            }
            // The app needs `currentUser` to render the shell before showing the setup page.
            return res.status(200).json({
                currentUser: profile, profiles: profile ? [profile] : [], workspaces: [],
                workspaceJoinRequests: [], // Also fetch join requests for setup page
                // Return empty for all other non-essential data
                workspaceMembers: [], projects: [], tasks: [], clients: [], deals: [], timeLogs: [], dependencies: [],
                notifications: [], dashboardWidgets: [], comments: [], taskAssignees: [],
                tags: [], taskTags: [], objectives: [], keyResults: [], dealNotes: [], invoices: [],
                invoiceLineItems: [], integrations: [], clientContacts: [], expenses: [], projectMembers: []
            });
        }
        
        // --- Step 2: Fetch members and their profiles in a single, efficient joined query ---
        const { data: membersWithProfiles, error: membersWithProfilesError } = await supabase
            .from('workspace_members')
            .select(`
                *,
                profiles (
                    id,
                    name,
                    email,
                    initials,
                    avatar_url,
                    slack_user_id,
                    contract_info_notes,
                    employment_info_notes,
                    vacation_allowance_hours
                )
            `)
            .in('workspace_id', workspaceIds);

        if (membersWithProfilesError) throw membersWithProfilesError;

        // Process the joined data into separate arrays for the client
        const allWorkspaceMembers: WorkspaceMember[] = [];
        const profilesMap = new Map<string, User>();

        membersWithProfiles.forEach(member => {
            const profileData = member.profiles;
            if (profileData) {
                if (!profilesMap.has(profileData.id)) {
                    profilesMap.set(profileData.id, profileData);
                }
            }
            // Remove the nested object before adding to the members array
            delete (member as any).profiles;
            allWorkspaceMembers.push(member);
        });

        const allProfiles = Array.from(profilesMap.values());
        
        // --- Step 3: Fetch remaining essentials in parallel ---
        const [
            currentUserProfileRes,
            workspacesRes,
            notificationsRes,
            joinRequestsRes
        ] = await Promise.all([
            // current user profile is already in allProfiles, but this is a `single()` query which is fast
            supabase.from('profiles').select('*').eq('id', user.id).single(),
            supabase.from('workspaces').select('*, "planHistory"').in('id', workspaceIds),
            supabase.from('notifications').select('*').eq('user_id', user.id).in('workspace_id', workspaceIds),
            supabase.from('workspace_join_requests').select('*').eq('user_id', user.id)
        ]);

        const results = [currentUserProfileRes, workspacesRes, notificationsRes, joinRequestsRes];
        for (const r of results) {
            if (r.error && r.error.code !== 'PGRST116') { // Ignore "The result contains 0 rows" for single()
                 throw new Error(`A database query failed during bootstrap: ${r.error.message}`);
            }
        }
        
        // --- Step 4: Assemble the payload with essentials + empty arrays for the rest ---
        res.status(200).json({
            // Essential data for app shell and setup
            currentUser: currentUserProfileRes.data,
            workspaces: workspacesRes.data || [],
            workspaceMembers: allWorkspaceMembers || [],
            profiles: allProfiles || [],
            notifications: notificationsRes.data || [],
            workspaceJoinRequests: joinRequestsRes.data || [],
            
            // Return empty arrays for all other data to prevent timeouts and load them on demand later.
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
