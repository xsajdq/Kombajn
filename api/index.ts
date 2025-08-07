
// api/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";

declare var Buffer: any;

// ============================================================================
// LIB HELPERS (from _lib/supabaseAdmin.ts)
// ============================================================================
let supabaseAdmin: any;

function getSupabaseAdmin() {
    if (supabaseAdmin) {
        return supabaseAdmin;
    }
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
        console.error('Supabase credentials are not set in environment variables.');
        throw new Error('Server configuration error: Database credentials are missing.');
    }
    supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
    return supabaseAdmin;
}

function getBaseUrl(req: VercelRequest): string {
    // 1. Use the explicitly set BASE_URL if available. This is the most reliable method.
    if (process.env.BASE_URL) {
        // Ensure it doesn't have a trailing slash
        return process.env.BASE_URL.replace(/\/$/, '');
    }
    
    // 2. Fallback to Vercel's production URL variable.
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
        return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
    }
    
    // 3. Fallback to the current deployment's URL (less ideal for OAuth).
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }
    
    // 4. Last resort for local development or other environments.
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['host'];
    return host ? `${proto}://${host}` : 'http://localhost:3000';
}


const CAMEL_CASE_EXCEPTIONS = new Set([
  'planHistory',
  'contractInfoNotes',
  'employmentInfoNotes',
]);

function camelToSnake(str: string): string {
    if (CAMEL_CASE_EXCEPTIONS.has(str)) {
        return str;
    }
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function snakeToCamel(str: string): string {
    return str.replace(/_(\w)/g, (_, letter) => letter.toUpperCase());
}

function convertKeys(obj: any, converter: (key: string) => string): any {
    if (Array.isArray(obj)) {
        return obj.map(v => convertKeys(v, converter));
    } else if (obj !== null && typeof obj === 'object' && obj.constructor === Object) {
        return Object.keys(obj).reduce((acc, key) => {
            acc[converter(key)] = convertKeys(obj[key], converter);
            return acc;
        }, {} as any);
    }
    return obj;
}

const keysToSnake = (obj: any) => convertKeys(obj, camelToSnake);
const keysToCamel = (obj: any) => convertKeys(obj, snakeToCamel);

function renderClosingPage(success: boolean, error?: string, provider?: string) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Connecting...</title>
      <script>
        const data = ${JSON.stringify({ success, error, provider })};
        if (window.opener) {
          window.opener.postMessage(data, '*');
        }
        window.close();
      </script>
    </head>
    <body>
      <p>Please wait while we connect your account...</p>
    </body>
    </html>
    `;
}

// ============================================================================
// MAIN HANDLER & ROUTER
// ============================================================================
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { action } = req.query;

    try {
        switch (action) {
            // ============================================================================
            // BOOTSTRAP HANDLER
            // ============================================================================
            case 'bootstrap': {
                if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
                const supabase = getSupabaseAdmin();
                const token = req.headers.authorization?.split('Bearer ')[1];
                if (!token) return res.status(401).json({ error: 'Authentication token required.' });
                
                const { data: { user }, error: authError } = await supabase.auth.getUser(token);
                if (authError || !user) return res.status(401).json({ error: authError?.message || 'Invalid or expired token.' });

                const { data: userMemberships, error: memberError } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id);
                if (memberError) throw new Error(`DB error fetching memberships: ${memberError.message}`);

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
                        integrations: [],
                    }));
                }

                const userWorkspaceIds = userMemberships.map((m: { workspace_id: string }) => m.workspace_id);
                const { data: allMembersInUserWorkspaces, error: allMembersError } = await supabase.from('workspace_members').select('user_id, id, workspace_id, role').in('workspace_id', userWorkspaceIds);
                if (allMembersError) throw allMembersError;

                const allMemberUserIds = [...new Set(allMembersInUserWorkspaces.map((m: { user_id: string }) => m.user_id))];
                
                // --- Fetch only CORE data for bootstrap ---
                const [
                    allProfilesRes, allWorkspacesRes, notificationsRes,
                    joinRequestsRes, integrationsRes
                ] = await Promise.all([
                    supabase.from('profiles').select('*').in('id', allMemberUserIds),
                    supabase.from('workspaces').select('*, "planHistory"').in('id', userWorkspaceIds),
                    supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
                    supabase.from('workspace_join_requests').select('*').eq('user_id', user.id),
                    supabase.from('integrations').select('*').in('workspace_id', userWorkspaceIds),
                ]);

                const allResults = [
                    allProfilesRes, allWorkspacesRes, notificationsRes,
                    joinRequestsRes, integrationsRes
                ];
                for (const r of allResults) if (r.error) throw new Error(`A database query failed during bootstrap: ${r.error.message}`);
                
                const responseData = {
                    current_user: allProfilesRes.data?.find((p: any) => p.id === user.id) || null,
                    profiles: allProfilesRes.data || [],
                    workspaces: allWorkspacesRes.data || [],
                    workspace_members: allMembersInUserWorkspaces || [],
                    notifications: notificationsRes.data || [],
                    workspace_join_requests: joinRequestsRes.data || [],
                    integrations: integrationsRes.data || [],
                };

                return res.status(200).json(keysToCamel(responseData));
            }
            
            // ============================================================================
            // GENERIC DATA HANDLER
            // ============================================================================
            case 'data': {
                const ALLOWED_RESOURCES = ['clients', 'projects', 'tasks', 'project_sections', 'task_views', 'time_logs', 'invoices', 'deals', 'workspaces', 'workspace_members', 'project_members', 'profiles', 'task_dependencies', 'comments', 'notifications', 'attachments', 'custom_field_definitions', 'custom_field_values', 'automations', 'project_templates', 'wiki_history', 'channels', 'chat_messages', 'objectives', 'key_results', 'time_off_requests', 'calendar_events', 'expenses', 'workspace_join_requests', 'dashboard_widgets', 'invoice_line_items', 'task_assignees', 'tags', 'task_tags', 'project_tags', 'client_tags', 'deal_activities', 'integrations', 'client_contacts', 'filter_views', 'reviews', 'user_task_sort_orders', 'inventory_items', 'inventory_assignments', 'budgets', 'pipeline_stages', 'kanban_stages', 'checklist_templates'];
                const { resource } = req.query;
                if (typeof resource !== 'string' || !ALLOWED_RESOURCES.includes(resource)) return res.status(404).json({ error: `Resource '${resource}' not found or not allowed.` });
                
                const supabase = getSupabaseAdmin();
                const token = req.headers.authorization?.split('Bearer ')[1];
                if (!token) return res.status(401).json({ error: 'Authentication token required.' });
                const { data: { user }, error: authError } = await supabase.auth.getUser(token);
                if (authError || !user) return res.status(401).json({ error: authError?.message || 'Invalid or expired token.' });
                
                const bodyInSnakeCase = req.body ? keysToSnake(req.body) : req.body;

                switch (req.method) {
                    case 'GET': {
                        let query = (supabase.from(resource) as any).select('*');
                        
                        // Extended filtering based on query params
                        for (const key in req.query) {
                            if (key !== 'action' && key !== 'resource') {
                                const value = req.query[key] as string;
                                const snakeKey = camelToSnake(key);
                                
                                if (value.startsWith('in.(') && value.endsWith(')')) {
                                    const values = value.substring(4, value.length - 1).split(',');
                                    query = query.in(snakeKey, values);
                                } else {
                                    query = query.eq(snakeKey, value);
                                }
                            }
                        }
                    
                        const { data, error } = await query;
                        if (error) throw error;
                        return res.status(200).json(keysToCamel(data));
                    }
                    case 'POST': {
                        if (resource === 'user_task_sort_orders') {
                            const { data, error } = await (supabase.from(resource) as any)
                                .upsert(bodyInSnakeCase, { onConflict: 'user_id, task_id' })
                                .select();
                            if (error) throw error;
                            return res.status(200).json(keysToCamel(data));
                        }
                        if (resource === 'budgets') {
                            const { data, error } = await (supabase.from(resource) as any)
                                .upsert(bodyInSnakeCase, { onConflict: 'workspace_id, category, period' })
                                .select();
                            if (error) throw error;
                            return res.status(200).json(keysToCamel(data));
                        }
                        if (resource.endsWith('_tags')) {
                            const entityIdColumn = `${resource.split('_')[0]}_id`;
                            const { data, error } = await (supabase.from(resource) as any)
                                .upsert(bodyInSnakeCase, { onConflict: `${entityIdColumn}, tag_id`, ignoreDuplicates: true })
                                .select();
                            if (error) throw error;
                            return res.status(201).json(keysToCamel(data));
                        }
                        const { data, error } = await (supabase.from(resource) as any).insert(bodyInSnakeCase).select();
                        if (error) throw error;
                        return res.status(201).json(keysToCamel(data));
                    }
                    case 'PUT': {
                        const id = bodyInSnakeCase.id;
                        if (!id) {
                            return res.status(400).json({ error: 'ID is required for update' });
                        }
                    
                        const recordToUpdate = { ...bodyInSnakeCase };
                        delete recordToUpdate.id;
                    
                        const queryBuilder = supabase
                            .from(resource)
                            .update(recordToUpdate)
                            .match({ id });
                    
                        const { data, error } = await queryBuilder.select();
                    
                        if (error) {
                            console.error(`[API PUT FAILED] Resource: ${resource}, ID: ${id}, User: ${user.id}. Supabase error: ${error.message}`);
                            const clientError = error.message.includes("schema cache")
                                ? "Database schema cache error, please try again."
                                : error.message;
                            return res.status(500).json({ error: clientError });
                        }
                    
                        return res.status(200).json(keysToCamel(data));
                    }
                    case 'DELETE': {
                        if (!req.body) return res.status(400).json({ error: 'Request body is required for DELETE operation.' });
                        if (resource === 'task_assignees') {
                            const { taskId, userId } = req.body;
                            const { error } = await supabase.from('task_assignees').delete().match({ task_id: taskId, user_id: userId });
                            if (error) throw error;
                        } else if (resource === 'task_tags' || resource === 'project_tags' || resource === 'client_tags') {
                            const idKey = `${resource.split('_')[0]}_id`;
                            const tagIdKey = 'tag_id';
                            const matchObject = { [idKey]: req.body[camelToSnake(idKey)], [tagIdKey]: req.body.tagId };
                            const { error } = await supabase.from(resource).delete().match(matchObject);
                            if (error) throw error;
                        } else {
                            const { id } = req.body;
                            if (!id) return res.status(400).json({ error: 'An "id" is required.' });
                            const query = (supabase.from(resource) as any).delete().eq('id', id);
                            if (resource === 'dashboard_widgets' || resource === 'filter_views') query.eq('user_id', user.id);
                            const { error } = await query;
                            if (error) throw error;
                        }
                        return res.status(204).send(undefined);
                    }
                    default:
                        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
                        return res.status(405).end('Method Not Allowed');
                }
            }
            
            // ============================================================================
            // PAGE DATA HANDLERS
            // ============================================================================
            case 'dashboard-data': {
                if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
                const supabase = getSupabaseAdmin();
                const token = req.headers.authorization?.split('Bearer ')[1];
                if (!token) return res.status(401).json({ error: 'Authentication token required.' });
                const { data: { user }, error: authError } = await supabase.auth.getUser(token);
                if (authError || !user) return res.status(401).json({ error: 'Invalid or expired token.' });
            
                const { workspaceId, coreOnly, tasksOnly, clientsOnly, invoicesOnly, salesOnly, teamCalendarOnly, goalsOnly, budgetOnly, inventoryOnly, page, pageSize } = req.query;
                if (!workspaceId || typeof workspaceId !== 'string') return res.status(400).json({ error: 'workspaceId is required.' });
            
                const { data: membership, error: memberError } = await supabase.from('workspace_members').select('user_id').eq('workspace_id', workspaceId).eq('user_id', user.id).single();
                if (memberError || !membership) return res.status(403).json({ error: 'User is not a member of this workspace.' });
            
                let queries: { [key: string]: any } = {};

                if (inventoryOnly === 'true') {
                    queries['inventoryItems'] = supabase.from('inventory_items').select('*').eq('workspace_id', workspaceId);
                    queries['inventoryAssignments'] = supabase.from('inventory_assignments').select('*').eq('workspace_id', workspaceId);
                } else if (budgetOnly === 'true') {
                    queries['budgets'] = supabase.from('budgets').select('*').eq('workspace_id', workspaceId);
                    queries['expenses'] = supabase.from('expenses').select('*').eq('workspace_id', workspaceId);
                } else if (goalsOnly === 'true') {
                    queries['objectives'] = supabase.from('objectives').select('*').eq('workspace_id', workspaceId);
                    
                    const { data: objectivesData, error: oError } = await supabase.from('objectives').select('id').eq('workspace_id', workspaceId);
                    if (oError) throw oError;
                    const objectiveIds = objectivesData.map((o: any) => o.id);

                    queries['keyResults'] = objectiveIds.length > 0 
                        ? supabase.from('key_results').select('*').in('objective_id', objectiveIds) 
                        : Promise.resolve({ data: [], error: null });

                } else if (coreOnly === 'true') {
                    queries['dashboardWidgets'] = supabase.from('dashboard_widgets').select('*').eq('user_id', user.id).eq('workspace_id', workspaceId);
                    queries['projects'] = supabase.from('projects').select('*').eq('workspace_id', workspaceId);
                    queries['clients'] = supabase.from('clients').select('*, client_contacts(*)').eq('workspace_id', workspaceId);
                    const { data: projectsData, error: pError } = await supabase.from('projects').select('id').eq('workspace_id', workspaceId);
                    if (pError) throw pError;
                    const projectIds = projectsData.map(p => p.id);
                    queries['projectMembers'] = projectIds.length > 0 ? supabase.from('project_members').select('*').in('project_id', projectIds) : Promise.resolve({ data: [], error: null });
                    queries['tags'] = supabase.from('tags').select('*').eq('workspace_id', workspaceId);
                    queries['projectTags'] = supabase.from('project_tags').select('*').eq('workspace_id', workspaceId);
                    queries['clientTags'] = supabase.from('client_tags').select('*').eq('workspace_id', workspaceId);
                    queries['timeOffRequests'] = supabase.from('time_off_requests').select('*').eq('workspace_id', workspaceId);
                    queries['reviews'] = supabase.from('reviews').select('*').eq('workspace_id', workspaceId);
                } else if (tasksOnly === 'true') {
                    const pageNum = parseInt(page as string, 10) || 1;
                    const size = parseInt(pageSize as string, 10) || 50;
                    const from = (pageNum - 1) * size;
                    const to = from + size - 1;

                    const { data: tasksData, error: tasksError } = await supabase.from('tasks').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).range(from, to);
                    if (tasksError) throw tasksError;
                    queries['tasks'] = Promise.resolve({ data: tasksData, error: null });

                    const taskIds = (tasksData || []).map((t: any) => t.id);

                    if (taskIds.length > 0) {
                        queries['taskAssignees'] = supabase.from('task_assignees').select('*').in('task_id', taskIds);
                        queries['taskTags'] = supabase.from('task_tags').select('*').in('task_id', taskIds);
                        queries['comments'] = supabase.from('comments').select('*').in('task_id', taskIds);
                        
                        const { data: blockingDeps, error: blockingErr } = await supabase.from('task_dependencies').select('*').in('blocked_task_id', taskIds);
                        if (blockingErr) throw blockingErr;
                        const { data: blockedDeps, error: blockedErr } = await supabase.from('task_dependencies').select('*').in('blocking_task_id', taskIds);
                        if (blockedErr) throw blockedErr;
                        const allDeps = [...(blockingDeps || []), ...(blockedDeps || [])];
                        const uniqueDeps = [...new Map(allDeps.map(item => [item.id, item])).values()];
                        queries['dependencies'] = Promise.resolve({ data: uniqueDeps, error: null });
                        
                        queries['customFieldValues'] = supabase.from('custom_field_values').select('*').in('task_id', taskIds);
                        queries['userTaskSortOrders'] = supabase.from('user_task_sort_orders').select('*').eq('workspace_id', workspaceId).eq('user_id', user.id).in('task_id', taskIds);
                    } else {
                        ['taskAssignees', 'taskTags', 'comments', 'dependencies', 'customFieldValues', 'userTaskSortOrders'].forEach(key => {
                            queries[key] = Promise.resolve({ data: [], error: null });
                        });
                    }

                    if (pageNum === 1) {
                        queries['kanbanStages'] = supabase.from('kanban_stages').select('*').eq('workspace_id', workspaceId);
                        queries['projectSections'] = supabase.from('project_sections').select('*').eq('workspace_id', workspaceId);
                        queries['taskViews'] = supabase.from('task_views').select('*').eq('workspace_id', workspaceId);
                        queries['tags'] = supabase.from('tags').select('*').eq('workspace_id', workspaceId);
                        queries['customFieldDefinitions'] = supabase.from('custom_field_definitions').select('*').eq('workspace_id', workspaceId);
                        queries['checklistTemplates'] = supabase.from('checklist_templates').select('*').eq('workspace_id', workspaceId);
                    } else {
                        ['kanbanStages', 'projectSections', 'taskViews', 'tags', 'customFieldDefinitions', 'checklistTemplates'].forEach(key => {
                            queries[key] = Promise.resolve({ data: [], error: null });
                        });
                    }
                } else if (clientsOnly === 'true') {
                    queries['clients'] = supabase.from('clients').select('*, client_contacts(*)').eq('workspace_id', workspaceId);
                    queries['tags'] = supabase.from('tags').select('*').eq('workspace_id', workspaceId);
                    queries['clientTags'] = supabase.from('client_tags').select('*').eq('workspace_id', workspaceId);
                } else if (invoicesOnly === 'true') {
                    queries['invoices'] = supabase.from('invoices').select('*, invoice_line_items(*)').eq('workspace_id', workspaceId);
                } else if (salesOnly === 'true') {
                    queries['deals'] = supabase.from('deals').select('*').eq('workspace_id', workspaceId);
                    queries['dealActivities'] = supabase.from('deal_activities').select('*').eq('workspace_id', workspaceId);
                    queries['pipelineStages'] = supabase.from('pipeline_stages').select('*').eq('workspace_id', workspaceId);
                } else if (teamCalendarOnly === 'true') {
                    queries['tasks'] = supabase.from('tasks').select('*').eq('workspace_id', workspaceId);
                    queries['calendarEvents'] = supabase.from('calendar_events').select('*').eq('workspace_id', workspaceId);
                    queries['timeLogs'] = supabase.from('time_logs').select('*').eq('workspace_id', workspaceId);
                } else {
                    // Fallback to full data fetch if no specific flag is provided
                    const { data: projectsData, error: pError } = await supabase.from('projects').select('id').eq('workspace_id', workspaceId);
                    if (pError) throw pError;
                    const projectIds = projectsData.map(p => p.id);

                    const { data: objectivesData, error: oError } = await supabase.from('objectives').select('id').eq('workspace_id', workspaceId);
                    if (oError) throw oError;
                    const objectiveIds = objectivesData.map(o => o.id);
                    
                    queries = {
                        dashboardWidgets: supabase.from('dashboard_widgets').select('*').eq('user_id', user.id).eq('workspace_id', workspaceId),
                        projects: supabase.from('projects').select('*').eq('workspace_id', workspaceId),
                        tasks: supabase.from('tasks').select('*').eq('workspace_id', workspaceId),
                        clients: supabase.from('clients').select('*, client_contacts(*)').eq('workspace_id', workspaceId),
                        invoices: supabase.from('invoices').select('*, invoice_line_items(*)').eq('workspace_id', workspaceId),
                        timeLogs: supabase.from('time_logs').select('*').eq('workspace_id', workspaceId),
                        comments: supabase.from('comments').select('*').eq('workspace_id', workspaceId),
                        taskAssignees: supabase.from('task_assignees').select('*').eq('workspace_id', workspaceId),
                        projectSections: supabase.from('project_sections').select('*').eq('workspace_id', workspaceId),
                        taskViews: supabase.from('task_views').select('*').eq('workspace_id', workspaceId),
                        timeOffRequests: supabase.from('time_off_requests').select('*').eq('workspace_id', workspaceId),
                        userTaskSortOrders: supabase.from('user_task_sort_orders').select('*').eq('workspace_id', workspaceId).eq('user_id', user.id),
                        objectives: supabase.from('objectives').select('*').eq('workspace_id', workspaceId),
                        keyResults: objectiveIds.length > 0 ? supabase.from('key_results').select('*').in('objective_id', objectiveIds) : Promise.resolve({ data: [], error: null }),
                        inventoryItems: supabase.from('inventory_items').select('*').eq('workspace_id', workspaceId),
                        inventoryAssignments: supabase.from('inventory_assignments').select('*').eq('workspace_id', workspaceId),
                        deals: supabase.from('deals').select('*').eq('workspace_id', workspaceId),
                        dealActivities: supabase.from('deal_activities').select('*').eq('workspace_id', workspaceId),
                        automations: supabase.from('automations').select('*').eq('workspace_id', workspaceId),
                        tags: supabase.from('tags').select('*').eq('workspace_id', workspaceId),
                        taskTags: supabase.from('task_tags').select('*').eq('workspace_id', workspaceId),
                        projectTags: supabase.from('project_tags').select('*').eq('workspace_id', workspaceId),
                        clientTags: supabase.from('client_tags').select('*').eq('workspace_id', workspaceId),
                        customFieldDefinitions: supabase.from('custom_field_definitions').select('*').eq('workspace_id', workspaceId),
                        customFieldValues: supabase.from('custom_field_values').select('*').eq('workspace_id', workspaceId),
                        projectTemplates: supabase.from('project_templates').select('*').eq('workspace_id', workspaceId),
                        wikiHistory: supabase.from('wiki_history').select('*'), // This might need a workspace_id filter in the future
                        channels: supabase.from('channels').select('*').eq('workspace_id', workspaceId),
                        chatMessages: supabase.from('chat_messages').select('*'), // This should be filtered by channels
                        calendarEvents: supabase.from('calendar_events').select('*').eq('workspace_id', workspaceId),
                        expenses: supabase.from('expenses').select('*').eq('workspace_id', workspaceId),
                        budgets: supabase.from('budgets').select('*').eq('workspace_id', workspaceId),
                        reviews: supabase.from('reviews').select('*').eq('workspace_id', workspaceId),
                        pipelineStages: supabase.from('pipeline_stages').select('*').eq('workspace_id', workspaceId),
                        kanbanStages: supabase.from('kanban_stages').select('*').eq('workspace_id', workspaceId),
                        projectMembers: projectIds.length > 0 ? supabase.from('project_members').select('*').in('project_id', projectIds) : Promise.resolve({ data: [], error: null }),
                    };
                }

                const queryEntries = Object.entries(queries);
                const results = await Promise.all(queryEntries.map(([, query]) => query));

                const responseData: { [key: string]: any } = {};
                for (let i = 0; i < results.length; i++) {
                    const key = queryEntries[i][0];
                    const { data, error } = results[i];
                    if (error) {
                         if (key === 'checklistTemplates' && error.message.includes('relation "public.checklist_templates" does not exist')) {
                            console.warn('checklist_templates table not found, gracefully ignoring.');
                            responseData[key] = [];
                        } else {
                            console.error(`Error fetching ${key}:`, error);
                            throw new Error(`Failed to fetch data for ${key}: ${error.message}`);
                        }
                    } else {
                        responseData[key] = data;
                    }
                }

                if ((invoicesOnly === 'true' || !Object.keys(req.query).some(q => q.includes('Only'))) && responseData.invoices) {
                    responseData.invoices.forEach((inv: any) => {
                        inv.items = inv.invoice_line_items;
                        delete inv.invoice_line_items;
                    });
                }
            
                return res.status(200).json(keysToCamel(responseData));
            }
            
             // ============================================================================
            // CONFIG HANDLER
            // ============================================================================
            case 'app-config': {
                if (req.method !== 'GET') return res.status(405).json({ error: "Method Not Allowed" });
                
                const supabaseUrl = process.env.SUPABASE_URL;
                const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

                if (!supabaseUrl || !supabaseAnonKey) {
                    return res.status(500).json({ error: 'Server configuration error: Supabase credentials missing.' });
                }

                return res.status(200).json({ supabaseUrl, supabaseAnonKey });
            }
            case 'token': { // Integration token handler
                 if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
                const supabase = getSupabaseAdmin();
                const { provider, workspaceId } = req.query;
                if (!provider || !workspaceId) return res.status(400).json({ error: 'Provider and Workspace ID are required.' });
                
                const token = req.headers.authorization?.split('Bearer ')[1];
                if (!token) return res.status(401).json({ error: 'Authentication token required.' });
                const { data: { user }, error: authError } = await supabase.auth.getUser(token);
                if (authError || !user) return res.status(401).json({ error: 'Invalid user session.' });

                const { data: integration, error: dbError } = await supabase.from('integrations').select('*').eq('workspace_id', workspaceId).eq('provider', provider).single();
                if (dbError || !integration || !integration.is_active) return res.status(404).json({ error: 'Active integration not found.' });

                let accessToken = integration.settings.accessToken;
                const refreshToken = integration.settings.refreshToken;
                const tokenExpiry = integration.settings.tokenExpiry;
                const nowInSeconds = Math.floor(Date.now() / 1000);

                if (provider === 'google_drive' && tokenExpiry && refreshToken && nowInSeconds >= tokenExpiry - 60) {
                    const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({
                            client_id: process.env.GOOGLE_CLIENT_ID!,
                            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                            refresh_token: refreshToken,
                            grant_type: 'refresh_token',
                        }),
                    });
                    const refreshedTokenData = await refreshResponse.json();
                    if (!refreshResponse.ok) throw new Error('Failed to refresh Google token.');
                    accessToken = refreshedTokenData.access_token;
                    const newSettings = { ...integration.settings, accessToken, tokenExpiry: nowInSeconds + refreshedTokenData.expires_in };
                    await supabase.from('integrations').update({ settings: newSettings }).eq('id', integration.id);
                }
                
                return res.status(200).json({ token: accessToken, developerKey: process.env.GOOGLE_API_KEY, clientId: process.env.GOOGLE_CLIENT_ID });
            }
            // ============================================================================
            // GLOBAL SEARCH HANDLER
            // ============================================================================
            case 'global-search': {
                if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
                const supabase = getSupabaseAdmin();
                const token = req.headers.authorization?.split('Bearer ')[1];
                if (!token) return res.status(401).json({ error: 'Authentication token required.' });
                const { data: { user }, error: authError } = await supabase.auth.getUser(token);
                if (authError || !user) return res.status(401).json({ error: 'Invalid or expired token.' });

                const { workspaceId, query: searchTerm } = req.query;
                if (!workspaceId || !searchTerm || typeof workspaceId !== 'string' || typeof searchTerm !== 'string') {
                    return res.status(400).json({ error: 'workspaceId and query are required.' });
                }

                const { data, error } = await supabase.rpc('global_search', {
                    p_workspace_id: workspaceId,
                    p_search_term: searchTerm
                });

                if (error) {
                    console.error("Global search RPC error:", error);
                    throw error;
                }

                return res.status(200).json(keysToCamel(data));
            }
             // ============================================================================
            // JOB / CRON HANDLERS
            // ============================================================================
            case 'process-reminders': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
                // This endpoint should be protected, e.g., by a cron job secret.
                const CRON_SECRET = process.env.CRON_SECRET;
                const authHeader = req.headers.authorization;
                if (!CRON_SECRET || `Bearer ${CRON_SECRET}` !== authHeader) {
                    return res.status(401).json({ error: 'Unauthorized' });
                }

                const supabase = getSupabaseAdmin();
                const now = new Date().toISOString();

                // Find tasks with reminders that are due
                const { data: tasksToRemind, error: tasksError } = await supabase
                    .from('tasks')
                    .select('id, name, workspace_id, reminder_at')
                    .lte('reminder_at', now)
                    .not('reminder_at', 'is', null);

                if (tasksError) throw tasksError;
                if (!tasksToRemind || tasksToRemind.length === 0) {
                    return res.status(200).json({ message: 'No reminders to process.' });
                }

                const notificationsToCreate: any[] = [];
                const remindedTaskIds: string[] = [];

                for (const task of tasksToRemind) {
                    remindedTaskIds.push(task.id);
                    // Find all assignees for the task
                    const { data: assignees, error: assigneesError } = await supabase
                        .from('task_assignees')
                        .select('user_id')
                        .eq('task_id', task.id);
                    
                    if (assigneesError) {
                        console.error(`Could not fetch assignees for task ${task.id}:`, assigneesError);
                        continue; // Skip this task
                    }

                    for (const assignee of assignees) {
                        notificationsToCreate.push({
                            user_id: assignee.user_id,
                            workspace_id: task.workspace_id,
                            type: 'reminder',
                            text: `Reminder for task: "${task.name}"`,
                            is_read: false,
                            action: { type: 'viewTask', taskId: task.id },
                        });
                    }
                }

                if (notificationsToCreate.length > 0) {
                    const { error: notificationError } = await supabase
                        .from('notifications')
                        .insert(notificationsToCreate);

                    if (notificationError) throw notificationError;
                }

                // Clear the reminders from the tasks so they don't fire again
                const { error: updateError } = await supabase
                    .from('tasks')
                    .update({ reminder_at: null })
                    .in('id', remindedTaskIds);

                if (updateError) throw updateError;
                
                return res.status(200).json({ message: `Processed ${remindedTaskIds.length} reminders.` });
            }
            // ============================================================================
            // AUTH HANDLERS
            // ============================================================================
            case 'auth-update-password': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
                const supabase = getSupabaseAdmin();
                const token = req.headers.authorization?.split('Bearer ')[1];
                if (!token) return res.status(401).json({ error: 'Authentication token is required.' });

                const { data: { user }, error: getUserError } = await supabase.auth.getUser(token);
                if (getUserError || !user) return res.status(401).json({ error: getUserError?.message || 'Invalid session.' });
                
                const { newPassword } = req.body;
                if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters long.' });

                const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, { password: newPassword });
                if (updateError) throw updateError;
                
                return res.status(200).json({ message: 'Password updated successfully.' });
            }
            case 'auth-connect-google_drive': {
                const { workspaceId } = req.query;
                if (!workspaceId) return res.status(400).json({ error: 'Workspace ID is required' });
                const clientId = process.env.GOOGLE_CLIENT_ID;
                if (!clientId) return res.status(500).json({ error: 'Google Client ID not configured on server.' });
                const baseUrl = getBaseUrl(req);
                const redirectUri = `${baseUrl}/api?action=auth-callback-google_drive`;
                const scopes = ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/drive.file'];
                const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
                authUrl.searchParams.set('client_id', clientId);
                authUrl.searchParams.set('redirect_uri', redirectUri);
                authUrl.searchParams.set('response_type', 'code');
                authUrl.searchParams.set('scope', scopes.join(' '));
                authUrl.searchParams.set('state', workspaceId as string);
                authUrl.searchParams.set('access_type', 'offline');
                authUrl.searchParams.set('prompt', 'consent');
                authUrl.searchParams.set('include_granted_scopes', 'true');
                return res.redirect(302, authUrl.toString());
            }
            case 'auth-callback-google_drive': {
                const { code, state: workspaceId, error: authError } = req.query;
                if (authError) return res.status(200).send(renderClosingPage(false, authError as string, 'google_drive'));
                if (!code) return res.status(400).send(renderClosingPage(false, 'Authorization code is missing.', 'google_drive'));
                
                const supabase = getSupabaseAdmin();
                const baseUrl = getBaseUrl(req);
                const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        code: code as string,
                        client_id: process.env.GOOGLE_CLIENT_ID!,
                        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                        redirect_uri: `${baseUrl}/api?action=auth-callback-google_drive`,
                        grant_type: 'authorization_code',
                    }),
                });
                const tokenData = await tokenResponse.json();
                if (!tokenResponse.ok) throw new Error(tokenData.error_description || 'Failed to fetch access token.');

                const { access_token, refresh_token, expires_in } = tokenData;
                const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { 'Authorization': `Bearer ${access_token}` } });
                const userData = await userResponse.json();

                const integrationData = {
                    provider: 'google_drive',
                    workspace_id: workspaceId,
                    is_active: true,
                    settings: {
                        accessToken: access_token,
                        refreshToken: refresh_token,
                        tokenExpiry: Math.floor(Date.now() / 1000) + expires_in,
                        googleUserEmail: userData.email,
                    }
                };

                const { error: dbError } = await supabase.from('integrations').upsert(integrationData, {
                    onConflict: 'workspace_id, provider'
                }).select();
                
                if (dbError) {
                    console.error('Supabase error on integration upsert:', dbError);
                    return res.status(200).send(renderClosingPage(false, 'Failed to save integration details.', 'google_drive'));
                }

                return res.status(200).send(renderClosingPage(true, undefined, 'google_drive'));
            }
            case 'auth-connect-google_gmail': {
                const { workspaceId } = req.query;
                if (!workspaceId) return res.status(400).json({ error: 'Workspace ID is required' });
                const clientId = process.env.GOOGLE_CLIENT_ID;
                if (!clientId) return res.status(500).json({ error: 'Google Client ID not configured on server.' });
                const baseUrl = getBaseUrl(req);
                const redirectUri = `${baseUrl}/api?action=auth-callback-google_gmail`;
                const scopes = [
                    'https://www.googleapis.com/auth/userinfo.email',
                    'https://www.googleapis.com/auth/gmail.send',
                    'openid'
                ];
                const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
                authUrl.searchParams.set('client_id', clientId);
                authUrl.searchParams.set('redirect_uri', redirectUri);
                authUrl.searchParams.set('response_type', 'code');
                authUrl.searchParams.set('scope', scopes.join(' '));
                authUrl.searchParams.set('state', workspaceId as string);
                authUrl.searchParams.set('access_type', 'offline');
                authUrl.searchParams.set('prompt', 'consent');
                authUrl.searchParams.set('include_granted_scopes', 'true');
                return res.redirect(302, authUrl.toString());
            }
            case 'auth-callback-google_gmail': {
                const { code, state: workspaceId, error: authError } = req.query;
                if (authError) return res.status(200).send(renderClosingPage(false, authError as string, 'google_gmail'));
                if (!code) return res.status(400).send(renderClosingPage(false, 'Authorization code is missing.', 'google_gmail'));
                
                const supabase = getSupabaseAdmin();
                const baseUrl = getBaseUrl(req);
                const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        code: code as string,
                        client_id: process.env.GOOGLE_CLIENT_ID!,
                        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                        redirect_uri: `${baseUrl}/api?action=auth-callback-google_gmail`,
                        grant_type: 'authorization_code',
                    }),
                });
                const tokenData = await tokenResponse.json();
                if (!tokenResponse.ok) throw new Error(tokenData.error_description || 'Failed to fetch access token.');

                const { access_token, refresh_token, expires_in } = tokenData;
                const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { 'Authorization': `Bearer ${access_token}` } });
                const userData = await userResponse.json();

                const integrationData = {
                    provider: 'google_gmail',
                    workspace_id: workspaceId,
                    is_active: true,
                    settings: {
                        accessToken: access_token,
                        refreshToken: refresh_token,
                        tokenExpiry: Math.floor(Date.now() / 1000) + expires_in,
                        googleUserEmail: userData.email,
                    }
                };

                const { error: dbError } = await supabase.from('integrations').upsert(integrationData, {
                    onConflict: 'workspace_id, provider'
                }).select();
                
                if (dbError) {
                    console.error('Supabase error on gmail integration upsert:', dbError);
                    return res.status(200).send(renderClosingPage(false, 'Failed to save integration details.', 'google_gmail'));
                }

                return res.status(200).send(renderClosingPage(true, undefined, 'google_gmail'));
            }
            case 'send-invoice-gmail': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
                const supabase = getSupabaseAdmin();
                const token = req.headers.authorization?.split('Bearer ')[1];
                if (!token) return res.status(401).json({ error: 'Authentication token required.' });
                const { data: { user }, error: authError } = await supabase.auth.getUser(token);
                if (authError || !user) return res.status(401).json({ error: 'Invalid user session.' });

                const { workspaceId, invoiceId, to, subject, body, pdfBase64 } = req.body;

                const { data: integration, error: dbError } = await supabase.from('integrations').select('*').eq('workspace_id', workspaceId).eq('provider', 'google_gmail').single();
                if (dbError || !integration || !integration.is_active) return res.status(404).json({ error: 'Active Gmail integration not found.' });

                let accessToken = integration.settings.accessToken;
                const refreshToken = integration.settings.refreshToken;
                const tokenExpiry = integration.settings.tokenExpiry;
                const nowInSeconds = Math.floor(Date.now() / 1000);

                if (tokenExpiry && refreshToken && nowInSeconds >= tokenExpiry - 60) {
                     const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({
                            client_id: process.env.GOOGLE_CLIENT_ID!,
                            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                            refresh_token: refreshToken,
                            grant_type: 'refresh_token',
                        }),
                    });
                    const refreshedTokenData = await refreshResponse.json();
                    if (!refreshResponse.ok) throw new Error('Failed to refresh Google token.');
                    accessToken = refreshedTokenData.access_token;
                    const newSettings = { ...integration.settings, accessToken, tokenExpiry: nowInSeconds + refreshedTokenData.expires_in };
                    await supabase.from('integrations').update({ settings: newSettings }).eq('id', integration.id);
                }

                const boundary = "boundary_string_kombajn";
                const { data: invoiceData } = await supabase.from('invoices').select('invoice_number').eq('id', invoiceId).single();
                const fileName = `Invoice-${invoiceData?.invoice_number || 'invoice'}.pdf`;

                const mimeMessage = [
                    `To: ${to}`,
                    `Subject: ${subject}`,
                    'Content-Type: multipart/mixed; boundary="' + boundary + '"',
                    '',
                    '--' + boundary,
                    'Content-Type: text/plain; charset="UTF-8"',
                    '',
                    body,
                    '',
                    '--' + boundary,
                    'Content-Type: application/pdf',
                    'Content-Disposition: attachment; filename="' + fileName + '"',
                    'Content-Transfer-Encoding: base64',
                    '',
                    pdfBase64,
                    '',
                    '--' + boundary + '--'
                ].join('\n');

                const base64EncodedEmail = Buffer.from(mimeMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                
                const gmailResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/send`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        raw: base64EncodedEmail
                    })
                });

                const gmailResult = await gmailResponse.json();
                if (!gmailResponse.ok) {
                    console.error("Gmail API Error:", gmailResult);
                    throw new Error(gmailResult.error?.message || "Failed to send email via Gmail API.");
                }

                const { error: updateError } = await supabase.from('invoices').update({ email_status: 'sent', sent_at: new Date().toISOString() }).eq('id', invoiceId);
                if (updateError) {
                    console.error(`Failed to update invoice status after sending email for invoice ${invoiceId}:`, updateError);
                    throw new Error('Email was sent, but we failed to update the invoice status in the database.');
                }

                return res.status(200).json({ message: 'Email sent successfully.' });
            }
            case 'send-deal-email': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
                const supabase = getSupabaseAdmin();
                const token = req.headers.authorization?.split('Bearer ')[1];
                if (!token) return res.status(401).json({ error: 'Authentication token required.' });
                const { data: { user }, error: authError } = await supabase.auth.getUser(token);
                if (authError || !user) return res.status(401).json({ error: 'Invalid user session.' });

                const { workspaceId, to, subject, body } = req.body;

                const { data: integration, error: dbError } = await supabase.from('integrations').select('*').eq('workspace_id', workspaceId).eq('provider', 'google_gmail').single();
                if (dbError || !integration || !integration.is_active) return res.status(404).json({ error: 'Active Gmail integration not found.' });

                let accessToken = integration.settings.accessToken;
                const refreshToken = integration.settings.refreshToken;
                const tokenExpiry = integration.settings.tokenExpiry;
                const nowInSeconds = Math.floor(Date.now() / 1000);

                if (tokenExpiry && refreshToken && nowInSeconds >= tokenExpiry - 60) {
                     const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({
                            client_id: process.env.GOOGLE_CLIENT_ID!,
                            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                            refresh_token: refreshToken,
                            grant_type: 'refresh_token',
                        }),
                    });
                    const refreshedTokenData = await refreshResponse.json();
                    if (!refreshResponse.ok) throw new Error('Failed to refresh Google token.');
                    accessToken = refreshedTokenData.access_token;
                    const newSettings = { ...integration.settings, accessToken, tokenExpiry: nowInSeconds + refreshedTokenData.expires_in };
                    await supabase.from('integrations').update({ settings: newSettings }).eq('id', integration.id);
                }

                const mimeMessage = [
                    `To: ${to}`,
                    `Subject: ${subject}`,
                    'Content-Type: text/plain; charset="UTF-8"',
                    'Content-Transfer-Encoding: 8bit',
                    '',
                    body
                ].join('\n');

                const base64EncodedEmail = Buffer.from(mimeMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                
                const gmailResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/send`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        raw: base64EncodedEmail
                    })
                });

                const gmailResult = await gmailResponse.json();
                if (!gmailResponse.ok) {
                    console.error("Gmail API Error:", gmailResult);
                    throw new Error(gmailResult.error?.message || "Failed to send email via Gmail API.");
                }

                return res.status(200).json({ message: 'Email sent successfully.' });
            }


            default:
                return res.status(404).json({ error: `Action '${action}' not found.` });
        }
    } catch (error: any) {
        console.error(`[API Error] Action: ${action}`, error);
        return res.status(500).json({ error: error.message || 'An unexpected error occurred on the server.' });
    }
}
