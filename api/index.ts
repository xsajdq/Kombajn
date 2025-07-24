// api/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";

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
                const ALLOWED_RESOURCES = ['clients', 'projects', 'tasks', 'project_sections', 'task_views', 'time_logs', 'invoices', 'deals', 'workspaces', 'workspace_members', 'project_members', 'profiles', 'task_dependencies', 'comments', 'notifications', 'attachments', 'custom_field_definitions', 'custom_field_values', 'automations', 'project_templates', 'wiki_history', 'channels', 'chat_messages', 'objectives', 'key_results', 'time_off_requests', 'calendar_events', 'expenses', 'workspace_join_requests', 'dashboard_widgets', 'invoice_line_items', 'task_assignees', 'tags', 'task_tags', 'deal_notes', 'integrations', 'client_contacts', 'filter_views', 'reviews'];
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
                        const { data, error } = await (supabase.from(resource) as any).insert(bodyInSnakeCase).select();
                        if (error) throw error;
                        return res.status(201).json(keysToCamel(data));
                    }
                    case 'PUT': {
                        const recordToUpdate = { ...bodyInSnakeCase };
                        const id = recordToUpdate.id;
                        if (id) delete recordToUpdate.id;
                        if (!id) return res.status(400).json({ error: 'ID is required for update' });
                    
                        let queryBuilder = (supabase.from(resource) as any).update(recordToUpdate).eq('id', id);
                    
                        if (resource === 'dashboard_widgets') {
                            queryBuilder = queryBuilder.eq('user_id', user.id);
                        }
                    
                        // Chaining .select() is a workaround for a PostgREST schema cache issue.
                        // It forces the schema to be re-read before the update, fixing "column not found" errors.
                        const { data, error } = await queryBuilder.select();
                        
                        if (error) {
                            console.error(`Supabase PUT error for resource '${resource}':`, error.message);
                            throw error;
                        }
                        
                        return res.status(200).json(keysToCamel(data));
                    }
                    case 'DELETE': {
                        if (!req.body) return res.status(400).json({ error: 'Request body is required for DELETE operation.' });
                        if (resource === 'task_assignees') {
                            const { taskId, userId } = req.body;
                            const { error } = await supabase.from('task_assignees').delete().match({ task_id: taskId, user_id: userId });
                            if (error) throw error;
                        } else if (resource === 'task_tags') {
                            const { taskId, tagId } = req.body;
                            const { error } = await supabase.from('task_tags').delete().match({ task_id: taskId, tag_id: tagId });
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
            
                const { workspaceId } = req.query;
                if (!workspaceId || typeof workspaceId !== 'string') return res.status(400).json({ error: 'workspaceId is required.' });
            
                const { data: membership, error: memberError } = await supabase.from('workspace_members').select('user_id').eq('workspace_id', workspaceId).eq('user_id', user.id).single();
                if (memberError || !membership) return res.status(403).json({ error: 'User is not a member of this workspace.' });
            
                const [
                    dashboardWidgetsRes, projectsRes, tasksRes, clientsRes, invoicesRes, timeLogsRes, commentsRes,
                    taskAssigneesRes, projectSectionsRes, taskViewsRes, timeOffRequestsRes, reviewsRes
                ] = await Promise.all([
                    supabase.from('dashboard_widgets').select('*').eq('user_id', user.id).eq('workspace_id', workspaceId),
                    supabase.from('projects').select('*').eq('workspace_id', workspaceId),
                    supabase.from('tasks').select('*').eq('workspace_id', workspaceId),
                    supabase.from('clients').select('*, client_contacts(*)').eq('workspace_id', workspaceId),
                    supabase.from('invoices').select('*').eq('workspace_id', workspaceId),
                    supabase.from('time_logs').select('*').eq('workspace_id', workspaceId),
                    supabase.from('comments').select('*').eq('workspace_id', workspaceId),
                    supabase.from('task_assignees').select('*').eq('workspace_id', workspaceId),
                    supabase.from('project_sections').select('*').eq('workspace_id', workspaceId),
                    supabase.from('task_views').select('*').eq('workspace_id', workspaceId),
                    supabase.from('time_off_requests').select('*').eq('workspace_id', workspaceId),
                    supabase.from('reviews').select('*').eq('workspace_id', workspaceId),
                ]);
            
                const allResults = [
                    dashboardWidgetsRes, projectsRes, tasksRes, clientsRes, invoicesRes, timeLogsRes, commentsRes,
                    taskAssigneesRes, projectSectionsRes, taskViewsRes, timeOffRequestsRes, reviewsRes
                ];
                for (const r of allResults) {
                    if (r.error) throw new Error(`Dashboard data fetch failed: ${r.error.message}`);
                }
            
                // Fetch and attach invoice line items
                const invoices = invoicesRes.data || [];
                if (invoices.length > 0) {
                    const invoiceIds = invoices.map(i => i.id);
                    const { data: lineItems, error: lineItemsError } = await supabase.from('invoice_line_items').select('*').in('invoice_id', invoiceIds);
                    if (lineItemsError) throw lineItemsError;
                    
                    const lineItemsByInvoiceId = new Map();
                    for (const item of lineItems) {
                        if (!lineItemsByInvoiceId.has(item.invoice_id)) {
                            lineItemsByInvoiceId.set(item.invoice_id, []);
                        }
                        lineItemsByInvoiceId.get(item.invoice_id)!.push(item);
                    }
            
                    for (const invoice of invoices) {
                        (invoice as any).items = lineItemsByInvoiceId.get(invoice.id) || [];
                    }
                }
            
                return res.status(200).json(keysToCamel({
                    dashboardWidgets: dashboardWidgetsRes.data,
                    projects: projectsRes.data,
                    tasks: tasksRes.data,
                    clients: clientsRes.data,
                    invoices: invoices,
                    timeLogs: timeLogsRes.data,
                    comments: commentsRes.data,
                    taskAssignees: taskAssigneesRes.data,
                    projectSections: projectSectionsRes.data,
                    taskViews: taskViewsRes.data,
                    timeOffRequests: timeOffRequestsRes.data,
                    reviews: reviewsRes.data,
                }));
            }
            case 'clients-page-data':
            case 'get-clients-page-data': {
                 if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
                const supabase = getSupabaseAdmin();
                const token = req.headers.authorization?.split('Bearer ')[1];
                if (!token) return res.status(401).json({ error: 'Authentication token required.' });
                const { data: { user }, error: authError } = await supabase.auth.getUser(token);
                if (authError || !user) return res.status(401).json({ error: 'Invalid or expired token.' });
                
                const { workspaceId } = req.query;
                if (!workspaceId || typeof workspaceId !== 'string') return res.status(400).json({ error: 'workspaceId is required.' });

                const { data: membership, error: memberError } = await supabase.from('workspace_members').select('user_id').eq('workspace_id', workspaceId).eq('user_id', user.id).single();
                if (memberError || !membership) return res.status(403).json({ error: 'User is not a member of this workspace.' });

                const [clientsRes, projectsRes, invoicesRes] = await Promise.all([
                    supabase.from('clients').select('*, client_contacts(*)').eq('workspace_id', workspaceId),
                    supabase.from('projects').select('*').eq('workspace_id', workspaceId),
                    supabase.from('invoices').select('*, invoice_line_items(*)').eq('workspace_id', workspaceId)
                ]);

                for (const r of [clientsRes, projectsRes, invoicesRes]) if (r.error) throw new Error(`Clients/Invoices data fetch failed: ${r.error.message}`);
                
                 // FIX: Process invoices to rename 'invoice_line_items' to 'items'
                const processedInvoices = (invoicesRes.data || []).map(invoice => {
                    const newInvoice = { ...invoice, items: invoice.invoice_line_items || [] };
                    delete (newInvoice as any).invoice_line_items;
                    return newInvoice;
                });

                return res.status(200).json(keysToCamel({
                    clients: clientsRes.data || [], projects: projectsRes.data || [], invoices: processedInvoices,
                }));
            }
            case 'projects-page-data': {
                if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
                const supabase = getSupabaseAdmin();
                const token = req.headers.authorization?.split('Bearer ')[1];
                if (!token) return res.status(401).json({ error: 'Authentication token required.' });
                const { data: { user }, error: authError } = await supabase.auth.getUser(token);
                if (authError || !user) return res.status(401).json({ error: 'Invalid or expired token.' });
            
                const { workspaceId } = req.query;
                if (!workspaceId || typeof workspaceId !== 'string') return res.status(400).json({ error: 'workspaceId is required.' });
            
                const { data: membership, error: memberError } = await supabase.from('workspace_members').select('user_id').eq('workspace_id', workspaceId).eq('user_id', user.id).single();
                if (memberError || !membership) return res.status(403).json({ error: 'User is not a member of this workspace.' });
            
                const { data: projectsData, error: projectsError } = await supabase
                    .from('projects')
                    .select('*')
                    .eq('workspace_id', workspaceId);
            
                if (projectsError) throw new Error(`Projects page data fetch failed: ${projectsError.message}`);
            
                const projectIds = projectsData ? projectsData.map(p => p.id) : [];
            
                const [clientsRes, tasksRes, projectMembersRes] = await Promise.all([
                    supabase.from('clients').select('*').eq('workspace_id', workspaceId),
                    supabase.from('tasks').select('*').eq('workspace_id', workspaceId),
                    projectIds.length > 0
                        ? supabase.from('project_members').select('*').in('project_id', projectIds)
                        : Promise.resolve({ data: [], error: null })
                ]);
            
                for (const r of [clientsRes, tasksRes, projectMembersRes]) {
                    if (r.error) throw new Error(`Projects page data fetch failed: ${r.error.message}`);
                }
            
                return res.status(200).json(keysToCamel({
                    projects: projectsData || [],
                    clients: clientsRes.data || [],
                    tasks: tasksRes.data || [],
                    projectMembers: projectMembersRes.data || [],
                }));
            }
            case 'tasks-page-data': {
                if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
                const supabase = getSupabaseAdmin();
                const token = req.headers.authorization?.split('Bearer ')[1];
                if (!token) return res.status(401).json({ error: 'Authentication token required.' });
                const { data: { user }, error: authError } = await supabase.auth.getUser(token);
                if (authError || !user) return res.status(401).json({ error: 'Invalid or expired token.' });
                
                const { workspaceId } = req.query;
                if (!workspaceId || typeof workspaceId !== 'string') return res.status(400).json({ error: 'workspaceId is required.' });

                const { data: membership, error: memberError } = await supabase.from('workspace_members').select('user_id').eq('workspace_id', workspaceId).eq('user_id', user.id).single();
                if (memberError || !membership) return res.status(403).json({ error: 'User is not a member of this workspace.' });

                const { data: workspaceProjects, error: projectsError } = await supabase.from('projects').select('id').eq('workspace_id', workspaceId);
                if(projectsError) throw new Error(`Tasks page data fetch failed: ${projectsError.message}`);
                const projectIds = workspaceProjects ? workspaceProjects.map(p => p.id) : [];

                const [tasksRes, projectSectionsRes, projectsRes, taskAssigneesRes, tagsRes, taskTagsRes, dependenciesRes, projectMembersRes] = await Promise.all([
                    supabase.from('tasks').select('*').eq('workspace_id', workspaceId),
                    supabase.from('project_sections').select('*').eq('workspace_id', workspaceId),
                    supabase.from('projects').select('id, name').eq('workspace_id', workspaceId),
                    supabase.from('task_assignees').select('*').eq('workspace_id', workspaceId),
                    supabase.from('tags').select('*').eq('workspace_id', workspaceId),
                    supabase.from('task_tags').select('*').eq('workspace_id', workspaceId),
                    supabase.from('task_dependencies').select('*').eq('workspace_id', workspaceId),
                    projectIds.length > 0 ? supabase.from('project_members').select('*').in('project_id', projectIds) : Promise.resolve({ data: [], error: null })
                ]);

                for (const r of [tasksRes, projectSectionsRes, projectsRes, taskAssigneesRes, tagsRes, taskTagsRes, dependenciesRes, projectMembersRes]) if (r.error) throw new Error(`Tasks page data fetch failed: ${r.error.message}`);
                
                return res.status(200).json(keysToCamel({
                    tasks: tasksRes.data || [],
                    project_sections: projectSectionsRes.data || [],
                    projects: projectsRes.data || [],
                    taskAssignees: taskAssigneesRes.data || [],
                    tags: tagsRes.data || [],
                    taskTags: taskTagsRes.data || [],
                    dependencies: dependenciesRes.data || [],
                    projectMembers: projectMembersRes.data || []
                }));
            }
            case 'sales-data': {
                if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
                const supabase = getSupabaseAdmin();
                const token = req.headers.authorization?.split('Bearer ')[1];
                if (!token) return res.status(401).json({ error: 'Authentication token required.' });
                const { data: { user }, error: authError } = await supabase.auth.getUser(token);
                if (authError || !user) return res.status(401).json({ error: 'Invalid or expired token.' });
                
                const { workspaceId } = req.query;
                if (!workspaceId || typeof workspaceId !== 'string') return res.status(400).json({ error: 'workspaceId is required.' });

                const { data: membership, error: memberError } = await supabase.from('workspace_members').select('user_id').eq('workspace_id', workspaceId).eq('user_id', user.id).single();
                if (memberError || !membership) return res.status(403).json({ error: 'User is not a member of this workspace.' });

                const { data: deals, error: dealsError } = await supabase.from('deals').select('*').eq('workspace_id', workspaceId);
                if (dealsError) throw dealsError;

                if (!deals || deals.length === 0) return res.status(200).json(keysToCamel({ deals: [], clients: [], users: [] }));

                const clientIds = [...new Set(deals.map((d: { client_id: string }) => d.client_id))];
                const ownerIds = [...new Set(deals.map((d: { owner_id: string }) => d.owner_id))];

                const [clientsRes, usersRes] = await Promise.all([
                    supabase.from('clients').select('*, client_contacts(*)').in('id', clientIds),
                    supabase.from('profiles').select('id, name, initials, avatar_url').in('id', ownerIds)
                ]);
                
                if (clientsRes.error) throw clientsRes.error;
                if (usersRes.error) throw usersRes.error;

                return res.status(200).json(keysToCamel({
                    deals: deals, clients: clientsRes.data || [], users: usersRes.data || [],
                }));
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
            case 'auth-connect-google': {
                const { workspaceId } = req.query;
                if (!workspaceId) return res.status(400).json({ error: 'Workspace ID is required' });
                const clientId = process.env.GOOGLE_CLIENT_ID;
                if (!clientId) return res.status(500).json({ error: 'Google Client ID not configured on server.' });
                const redirectUri = `${process.env.BASE_URL}/api?action=auth-callback-google`;
                const scopes = ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/drive.file'];
                const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
                authUrl.searchParams.set('client_id', clientId);
                authUrl.searchParams.set('redirect_uri', redirectUri);
                authUrl.searchParams.set('response_type', 'code');
                authUrl.searchParams.set('scope', scopes.join(' '));
                authUrl.searchParams.set('state', workspaceId as string);
                authUrl.searchParams.set('access_type', 'offline');
                authUrl.searchParams.set('prompt', 'consent');
                return res.redirect(302, authUrl.toString());
            }
            case 'auth-callback-google': {
                const { code, state: workspaceId, error: authError } = req.query;
                if (authError) return res.status(200).send(renderClosingPage(false, authError as string, 'google_drive'));
                if (!code) return res.status(400).send(renderClosingPage(false, 'Authorization code is missing.', 'google_drive'));
                
                const supabase = getSupabaseAdmin();
                const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        code: code as string,
                        client_id: process.env.GOOGLE_CLIENT_ID!,
                        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                        redirect_uri: `${process.env.BASE_URL}/api?action=auth-callback-google`,
                        grant_type: 'authorization_code',
                    }),
                });
                const tokenData = await tokenResponse.json();
                if (!tokenResponse.ok) throw new Error(tokenData.error_description || 'Failed to fetch access token.');

                const { access_token, refresh_token, expires_in } = tokenData;
                const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { 'Authorization': `Bearer ${access_token}` } });
                const userData = await userResponse.json();

                const { error: dbError } = await supabase.from('integrations').upsert({
                    provider: 'google_drive', workspace_id: workspaceId, is_active: true,
                    settings: { accessToken: access_token, refreshToken: refresh_token, tokenExpiry: Math.floor(Date.now() / 1000) + expires_in, googleUserEmail: userData.email, },
                }, { onConflict: 'workspace_id, provider' });
                if (dbError) throw dbError;

                return res.status(200).send(renderClosingPage(true, undefined, 'google_drive'));
            }
             case 'auth-connect-slack': {
                const { workspaceId } = req.query;
                if (!workspaceId) return res.status(400).json({ error: 'Workspace ID is required' });
                const clientId = process.env.SLACK_CLIENT_ID;
                if (!clientId) return res.status(500).json({ error: 'Slack Client ID not configured on server.' });
                const redirectUri = `${process.env.BASE_URL}/api?action=auth-callback-slack`;
                const userScopes = ['chat:write', 'users:read', 'users:read.email'];
                const authUrl = new URL('https://slack.com/oauth/v2/authorize');
                authUrl.searchParams.set('client_id', clientId);
                authUrl.searchParams.set('redirect_uri', redirectUri);
                authUrl.searchParams.set('user_scope', userScopes.join(' '));
                authUrl.searchParams.set('state', workspaceId as string);
                return res.redirect(302, authUrl.toString());
            }
            case 'auth-callback-slack': {
                const { code, state: workspaceId, error: authError } = req.query;
                if (authError) return res.status(200).send(renderClosingPage(false, authError as string, 'slack'));
                if (!code) return res.status(400).send(renderClosingPage(false, 'Authorization code is missing.', 'slack'));
                
                const token = req.cookies['sb-access-token'];
                if (!token) return res.status(401).send(renderClosingPage(false, 'User session not found.', 'slack'));
                const supabaseUserClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } } });
                const { data: { user } } = await supabaseUserClient.auth.getUser();

                if (!user) return res.status(401).send(renderClosingPage(false, 'Invalid user session.', 'slack'));

                const supabaseAdmin = getSupabaseAdmin();
                const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ code: code as string, client_id: process.env.SLACK_CLIENT_ID!, client_secret: process.env.SLACK_CLIENT_SECRET! }),
                });
                const tokenData = await tokenResponse.json();
                if (!tokenData.ok) throw new Error(tokenData.error || 'Failed to fetch access token from Slack.');
                
                const { authed_user, team } = tokenData;
                await supabaseAdmin.from('profiles').update({ slack_user_id: authed_user.id }).eq('id', user.id);
                await supabaseAdmin.from('integrations').upsert({
                    provider: 'slack', workspace_id: workspaceId, is_active: true,
                    settings: { accessToken: authed_user.access_token, slackWorkspaceName: team.name, slackTeamId: team.id },
                }, { onConflict: 'workspace_id, provider' });

                return res.status(200).send(renderClosingPage(true, undefined, 'slack'));
            }

            // ============================================================================
            // AI & ACTION HANDLERS
            // ============================================================================
            case 'generate-tasks': {
                if (req.method !== 'POST') return res.status(405).json({ error: "Method Not Allowed" });
                const { promptText } = req.body;
                if (!promptText) return res.status(400).json({ error: "Prompt text is required." });
                if (!process.env.API_KEY) return res.status(500).json({ error: 'Server configuration error: Missing Google AI API key.' });

                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Generate a list of tasks for the following project: "${promptText}".`, config: { 
                    systemInstruction: `You are an expert project manager. Your task is to break down a user's high-level project idea into a list of specific, actionable tasks. Respond ONLY with a valid JSON array of objects. Do not include any other text, explanations, or markdown formatting around the JSON. The JSON schema for the response should be an array of objects, where each object has a "name" (a short, clear task title) and a "description" (a one-sentence explanation of what the task involves).`,
                    responseMimeType: "application/json" 
                }});
                let jsonStr = (response.text || '').trim().replace(/^```(\w*)?\s*\n?(.*?)\n?\s*```$/s, '$2');
                return res.status(200).json(JSON.parse(jsonStr));
            }
            case 'plan-project': {
                 if (req.method !== 'POST') return res.status(405).json({ error: "Method Not Allowed" });
                const { goal } = req.body;
                if (!goal) return res.status(400).json({ error: "Project goal is required." });
                if (!process.env.API_KEY) return res.status(500).json({ error: 'Server configuration error: Missing Google AI API key.' });
                
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Project Goal: "${goal}"`, config: {
                    systemInstruction: `You are a world-class project manager. A user will provide a project goal. Your job is to break it down into a list of actionable tasks. Return a JSON array of objects. Each object must have two properties: "name" (a short, imperative task title) and a "description" (a one-sentence explanation of the task). Do not add any commentary. Only return the JSON array.`,
                    responseMimeType: "application/json",
                    responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING } }, required: ["name", "description"] } },
                }});
                return res.status(200).json(JSON.parse((response.text || '').trim()));
            }
            case 'notify-slack': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
                const supabase = getSupabaseAdmin();
                const { userId, message, workspaceId } = req.body;
                
                const { data: user } = await supabase.from('profiles').select('slack_user_id').eq('id', userId).single();
                const { data: integration } = await supabase.from('integrations').select('settings').eq('workspace_id', workspaceId).eq('provider', 'slack').single();
                
                if (user?.slack_user_id && integration?.settings?.accessToken) {
                    await fetch('https://slack.com/api/chat.postMessage', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${integration.settings.accessToken}` },
                        body: JSON.stringify({ channel: user.slack_user_id, text: message }),
                    });
                }
                return res.status(200).json({ success: true });
            }
            case 'save-workspace-prefs': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
                const supabase = getSupabaseAdmin();
                const token = req.headers.authorization?.split('Bearer ')[1];
                if (!token) return res.status(401).json({ error: 'Authentication required.' });
                const { data: { user }, error: authError } = await supabase.auth.getUser(token);
                if (authError || !user) return res.status(401).json({ error: 'Invalid user session.' });

                const { workspaceId, workflow } = req.body;
                if (!workspaceId || !workflow || !['simple', 'advanced'].includes(workflow)) return res.status(400).json({ error: 'Invalid request body.' });

                const { data: member, error: memberError } = await supabase.from('workspace_members').select('role').eq('user_id', user.id).eq('workspace_id', workspaceId).single();
                if (memberError || !member || !['owner', 'admin'].includes(member.role)) return res.status(403).json({ error: 'Permission denied.' });
                
                const { data: existing } = await supabase.from('integrations').select('settings').eq('workspace_id', workspaceId).eq('provider', 'internal_settings').single();
                const newSettings = { ...(existing?.settings || {}), defaultKanbanWorkflow: workflow };

                const { data, error } = await supabase.from('integrations').upsert({ workspace_id: workspaceId, provider: 'internal_settings', is_active: false, settings: newSettings }, { onConflict: 'workspace_id, provider' }).select().single();
                if (error) throw error;
                
                return res.status(200).json({ success: true, data: keysToCamel(data) });
            }

            default:
                return res.status(404).json({ error: `Action '${action}' not found.` });
        }
    } catch (error: any) {
        console.error(`API Error for action '${action}':`, error);
        return res.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
}
