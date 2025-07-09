
// Plik: api/data/[resource].ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin, keysToSnake } from '../_lib/supabaseAdmin';

const ALLOWED_RESOURCES = ['clients', 'projects', 'tasks', 'time_logs', 'invoices', 'deals', 'workspaces', 'workspace_members', 'project_members', 'profiles', 'task_dependencies', 'comments', 'notifications', 'attachments', 'custom_field_definitions', 'custom_field_values', 'automations', 'project_templates', 'wiki_history', 'channels', 'chat_messages', 'objectives', 'key_results', 'time_off_requests', 'calendar_events', 'expenses', 'workspace_join_requests', 'dashboard_widgets', 'invoice_line_items'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const resource = req.query.resource as string;

  if (resource.endsWith('/delete')) {
      const actualResource = resource.replace('/delete', '');
      if (req.method === 'POST' && ALLOWED_RESOURCES.includes(actualResource)) {
        return handleDelete(req, res, actualResource);
      }
  }

  if (typeof resource !== 'string' || !ALLOWED_RESOURCES.includes(resource)) {
      return res.status(404).json({ error: "Resource not found or not allowed." });
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
            
            const { data, error } = await (supabase.from(resource) as any)
              .update(updateData)
              .eq('id', id)
              .select();
            if (error) throw error;
            return res.status(200).json(data);
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

async function handleDelete(req: VercelRequest, res: VercelResponse, resource: string) {
    try {
        const supabase = getSupabaseAdmin();
        const { id } = req.body; // Expecting { id: '...' } in body
        if (!id) return res.status(400).json({ error: 'ID is required for delete' });

        const { error } = await (supabase.from(resource) as any).delete().eq('id', id);
        if (error) throw error;
        
        return res.status(204).send(undefined);
    } catch (error: any) {
        console.error(`Error deleting from ${resource}:`, error);
        return res.status(500).json({ error: error.message });
    }
}
