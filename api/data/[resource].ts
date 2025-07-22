// Plik: api/data/[resource].ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin, keysToSnake } from '../_lib/supabaseAdmin';

const ALLOWED_RESOURCES = ['clients', 'projects', 'tasks', 'time_logs', 'invoices', 'deals', 'workspaces', 'workspace_members', 'project_members', 'profiles', 'task_dependencies', 'comments', 'notifications', 'attachments', 'custom_field_definitions', 'custom_field_values', 'automations', 'project_templates', 'wiki_history', 'channels', 'chat_messages', 'objectives', 'key_results', 'time_off_requests', 'calendar_events', 'expenses', 'workspace_join_requests', 'dashboard_widgets', 'invoice_line_items', 'task_assignees', 'tags', 'task_tags', 'deal_notes', 'integrations', 'client_contacts', 'filter_views'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const resource = req.query.resource as string;

  try {
    const supabase = getSupabaseAdmin();
    
    // 1. Authenticate FIRST for all requests.
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Authentication token required.' });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
        return res.status(401).json({ error: authError?.message || 'Invalid or expired token.' });
    }
    
    // 2. Validate resource
    if (typeof resource !== 'string' || !ALLOWED_RESOURCES.includes(resource)) {
        return res.status(404).json({ error: `Resource '${resource}' not found or not allowed.` });
    }
    
    const bodyInSnakeCase = req.body ? keysToSnake(req.body) : req.body;

    switch (req.method) {
        case 'GET': {
            const { data, error } = await (supabase.from(resource) as any).select('*');
            if (error) throw error;
            return res.status(200).json(data);
        }
        case 'POST': {
            const { data, error } = await (supabase.from(resource) as any).insert(bodyInSnakeCase).select();
            if (error) throw error;
            return res.status(201).json(data);
        }
        case 'PUT': {
            const recordToUpdate = { ...bodyInSnakeCase };
            const id = recordToUpdate.id; 
            if (id) delete recordToUpdate.id;
            const updateData = recordToUpdate;

            if (!id) return res.status(400).json({ error: 'ID is required for update' });
            
            const query = (supabase.from(resource) as any).update(updateData).eq('id', id);

            // Add an ownership check for dashboard widgets for extra security
            if (resource === 'dashboard_widgets') {
                query.eq('user_id', user.id);
            }

            const { data, error } = await query.select();
            if (error) throw error;
            return res.status(200).json(data);
        }
        case 'DELETE': {
            const body = req.body;
            if (!body) {
                return res.status(400).json({ error: 'Request body is required for DELETE operation.' });
            }

            // Handle composite key deletion for task_assignees
            if (resource === 'task_assignees') {
                const { taskId, userId } = body;
                if (!taskId || !userId) {
                    return res.status(400).json({ error: 'For task_assignees, taskId and userId are required.' });
                }
                const { error } = await supabase.from('task_assignees').delete().match({ task_id: taskId, user_id: userId });
                if (error) throw error;
                return res.status(204).send(undefined);
            }

            // Handle composite key deletion for task_tags
            if (resource === 'task_tags') {
                const { taskId, tagId } = body;
                if (!taskId || !tagId) {
                    return res.status(400).json({ error: 'For task_tags, taskId and tagId are required.' });
                }
                const { error } = await supabase.from('task_tags').delete().match({ task_id: taskId, tag_id: tagId });
                if (error) throw error;
                return res.status(204).send(undefined);
            }

            // Default deletion logic for tables with a single 'id' primary key
            const { id } = body;
            if (!id) {
                return res.status(400).json({ error: 'An "id" is required for this delete operation.' });
            }
            
            const query = (supabase.from(resource) as any).delete().eq('id', id);

            // Add an ownership check for dashboard widgets for extra security
            if (resource === 'dashboard_widgets' || resource === 'filter_views') {
                query.eq('user_id', user.id);
            }

            const { error } = await query;
            if (error) throw error;
            
            return res.status(204).send(undefined);
        }
        default:
            res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
            return res.status(405).end('Method Not Allowed');
    }
  } catch(error: any) {
     console.error(`Error with resource ${resource}:`, error);
     const errorMessage = error.message || 'An internal server error occurred.';
     return res.status(500).json({ error: errorMessage });
  }
}