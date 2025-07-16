
// Plik: api/data/[resource].ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin, keysToSnake } from '../_lib/supabaseAdmin';

const ALLOWED_RESOURCES = ['clients', 'projects', 'tasks', 'time_logs', 'invoices', 'deals', 'workspaces', 'workspace_members', 'project_members', 'profiles', 'task_dependencies', 'comments', 'notifications', 'attachments', 'custom_field_definitions', 'custom_field_values', 'automations', 'project_templates', 'wiki_history', 'channels', 'chat_messages', 'objectives', 'key_results', 'time_off_requests', 'calendar_events', 'expenses', 'workspace_join_requests', 'dashboard_widgets', 'invoice_line_items', 'task_assignees', 'tags', 'task_tags', 'deal_notes', 'integrations', 'client_contacts'];

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
             // Handle composite key deletion for join tables
            if (resource === 'task_assignees' || resource === 'task_tags') {
                const { taskId, userId, tagId } = body;
                let query = (supabase.from(resource) as any).delete().eq('task_id', taskId);
                if (userId) query = query.eq('user_id', userId);
                if (tagId) query = query.eq('tag_id', tagId);
                
                const { error } = await query;
                if (error) throw error;
                return res.status(204).send(undefined);
            }

            // Original logic for single ID deletion
            const { id } = body;
            if (!id) return res.status(400).json({ error: 'ID is required for delete' });
            
            const query = (supabase.from(resource) as any).delete().eq('id', id);

            // Add an ownership check for dashboard widgets for extra security
            if (resource === 'dashboard_widgets') {
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
