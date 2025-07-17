
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
        
        // --- Step 1: Fetch only the absolute essential data to render the app shell ---
        const { data: userWorkspaceMemberships, error: membersError } = await supabase
            .from('workspace_members')
            .select('workspace_id, user_id')
            .eq('user_id', user.id);
            
        if (membersError) throw new Error(`Could not fetch user memberships: ${membersError.message}`);
        
        const workspaceIds = userWorkspaceMemberships.map(m => m.workspace_id);

        // Handle case where user has no workspaces
        if (workspaceIds.length === 0) {
            const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (profileError) throw profileError;
            // The API must return `currentUser` for the app shell to render correctly before showing the setup page.
            return res.status(200).json({
                currentUser: profile, profiles: profile ? [profile] : [], workspaces: [],
                // Return empty for everything else
                workspaceMembers: [], projects: [], tasks: [], clients: [], deals: [], timeLogs: [], dependencies: [],
                workspaceJoinRequests: [], notifications: [], dashboardWidgets: [], comments: [], taskAssignees: [],
                tags: [], taskTags: [], objectives: [], keyResults: [], dealNotes: [], invoices: [],
                invoiceLineItems: [], integrations: [], clientContacts: [], expenses: [], projectMembers: []
            });
        }
        
        // --- Fetch essentials in parallel ---
        const [
            currentUserProfileRes,
            workspacesRes,
            workspaceMembersRes,
            profilesRes,
            notificationsRes
        ] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', user.id).single(),
            supabase.from('workspaces').select('*, "planHistory"').in('id', workspaceIds),
            supabase.from('workspace_members').select('*').in('workspace_id', workspaceIds),
            supabase.from('profiles').select('*').in('id', (await supabase.from('workspace_members').select('user_id').in('workspace_id', workspaceIds)).data!.map(m => m.user_id)),
            supabase.from('notifications').select('*').eq('user_id', user.id).in('workspace_id', workspaceIds)
        ]);

        const results = [currentUserProfileRes, workspacesRes, workspaceMembersRes, profilesRes, notificationsRes];
        for (const r of results) {
            if (r.error && r.error.code !== 'PGRST116') { // Ignore "The result contains 0 rows" for single()
                 throw new Error(`A database query failed: ${r.error.message}`);
            }
        }
        
        // --- Step 2: Assemble the payload with essentials + empty arrays for the rest ---
        // This ensures the app loads quickly without timing out. Data for pages will be loaded on demand later.
        res.status(200).json({
            // Essential data
            currentUser: currentUserProfileRes.data,
            workspaces: workspacesRes.data || [],
            workspaceMembers: workspaceMembersRes.data || [],
            profiles: profilesRes.data || [],
            notifications: notificationsRes.data || [],
            
            // Return empty arrays for all other data to prevent timeouts
            projects: [], tasks: [], clients: [], deals: [], timeLogs: [], dependencies: [],
            workspaceJoinRequests: [], dashboardWidgets: [], comments: [], taskAssignees: [],
            tags: [], taskTags: [], objectives: [], keyResults: [], dealNotes: [], invoices: [],
            invoiceLineItems: [], integrations: [], clientContacts: [], expenses: [], projectMembers: []
        });

    } catch (error: any) {
        console.error('Bootstrap error:', error);
        return res.status(500).json({ error: `Bootstrap failed: ${error.message}` });
    }
}
