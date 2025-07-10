
// Plik: api/data/[resource].ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin, keysToSnake } from '../_lib/supabaseAdmin';

const ALLOWED_RESOURCES = ['clients', 'projects', 'tasks', 'time_logs', 'invoices', 'deals', 'workspaces', 'workspace_members', 'project_members', 'profiles', 'task_dependencies', 'comments', 'notifications', 'attachments', 'custom_field_definitions', 'custom_field_values', 'automations', 'project_templates', 'wiki_history', 'channels', 'chat_messages', 'objectives', 'key_results', 'time_off_requests', 'calendar_events', 'expenses', 'workspace_join_requests', 'dashboard_widgets', 'invoice_line_items'];

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
    
    // 2. Determine resource type and check if allowed
    const isDeleteRequest = resource.endsWith('/delete');
    const actualResource = isDeleteRequest ? resource.replace('/delete', '') : resource;

    if (typeof actualResource !== 'string' || !ALLOWED_RESOURCES.includes(actualResource)) {
        return res.status(404).json({ error: "Resource not found or not allowed." });
    }
    
    // 3. Handle request based on type (delete or standard CRUD)
    if (isDeleteRequest) {
        if (req.method === 'POST') {
            const { id } = req.body;
            if (!id) return res.status(400).json({ error: 'ID is required for delete' });

            const query = (supabase.from(actualResource) as any).delete().eq('id', id);

            // Add an ownership check for dashboard widgets for extra security
            if (actualResource === 'dashboard_widgets') {
                query.eq('user_id', user.id);
            }

            const { error } = await query;
            if (error) throw error;
            
            return res.status(204).send(undefined);
        } else {
            res.setHeader('Allow', ['POST']);
            return res.status(405).end('Method Not Allowed for this endpoint.');
        }
    }

    // Standard CRUD operations
    const bodyInSnakeCase = req.body ? keysToSnake(req.body) : req.body;

    switch (req.method) {
        case 'GET': {
            const { data, error } = await (supabase.from(actualResource) as any).select('*');
            if (error) throw error;
            return res.status(200).json(data);
        }
        case 'POST': {
            const { data, error } = await (supabase.from(actualResource) as any).insert(bodyInSnakeCase).select();
            if (error) throw error;
            return res.status(201).json(data);
        }
        case 'PUT': {
            const recordToUpdate = { ...bodyInSnakeCase };
            const id = recordToUpdate.id; 
            if (id) delete recordToUpdate.id;
            const updateData = recordToUpdate;

            if (!id) return res.status(400).json({ error: 'ID is required for update' });
            
            const { data, error } = await (supabase.from(actualResource) as any)
              .update(updateData)
              .eq('id', id)
              .select();
            if (error) throw error;
            return res.status(200).json(data);
        }
        default:
            res.setHeader('Allow', ['GET', 'POST', 'PUT']);
            return res.status(405).end('Method Not Allowed');
    }
  } catch(error: any) {
     console.error(`Error with resource ${resource}:`, error);
     const errorMessage = error.message || 'An internal server error occurred.';
     return res.status(500).json({ error: errorMessage });
  }
}