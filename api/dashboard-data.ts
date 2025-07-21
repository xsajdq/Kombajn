// api/dashboard-data.ts
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

        // Check if user is member of this workspace for security
        const { data: membership, error: memberError } = await supabase
            .from('workspace_members')
            .select('user_id')
            .eq('workspace_id', workspaceId)
            .eq('user_id', user.id)
            .single();
            
        if (memberError || !membership) {
            return res.status(403).json({ error: 'User is not a member of this workspace.' });
        }

        const [
            projectsRes,
            tasksRes,
            taskAssigneesRes,
            timeLogsRes,
            commentsRes,
            clientsRes,
            invoicesRes,
            calendarEventsRes
        ] = await Promise.all([
            supabase.from('projects').select('*').eq('workspace_id', workspaceId),
            supabase.from('tasks').select('*').eq('workspace_id', workspaceId),
            supabase.from('task_assignees').select('*').eq('workspace_id', workspaceId),
            supabase.from('time_logs').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(20),
            supabase.from('comments').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(20),
            supabase.from('clients').select('id, name').eq('workspace_id', workspaceId),
            supabase.from('invoices').select('*, invoice_line_items(*)').eq('workspace_id', workspaceId),
            supabase.from('calendar_events').select('*').eq('workspace_id', workspaceId)
        ]);

        const allResults = [projectsRes, tasksRes, taskAssigneesRes, timeLogsRes, commentsRes, clientsRes, invoicesRes, calendarEventsRes];
        for (const r of allResults) {
            if (r.error) throw new Error(`Dashboard data fetch failed: ${r.error.message}`);
        }

        const responseData = {
            projects: projectsRes.data || [],
            tasks: tasksRes.data || [],
            taskAssignees: taskAssigneesRes.data || [],
            timeLogs: timeLogsRes.data || [],
            comments: commentsRes.data || [],
            clients: clientsRes.data || [],
            invoices: invoicesRes.data || [],
            calendarEvents: calendarEventsRes.data || [],
        };
        
        return res.status(200).json(keysToCamel(responseData));

    } catch (error: any) {
        console.error('Dashboard data error:', error);
        return res.status(500).json({ error: `Failed to fetch dashboard data: ${error.message}` });
    }
}