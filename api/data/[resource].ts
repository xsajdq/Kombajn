
// Plik: api/data/[resource].ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin, keysToSnake } from '../_lib/supabaseAdmin';

const ALLOWED_RESOURCES = ['clients', 'projects', 'tasks', 'time_logs', 'invoices', 'deals', 'workspaces', 'workspace_members', 'project_members', 'profiles', 'task_dependencies', 'comments', 'notifications', 'attachments', 'custom_field_definitions', 'custom_field_values', 'automations', 'project_templates', 'wiki_history', 'channels', 'chat_messages', 'objectives', 'key_results', 'time_off_requests', 'calendar_events', 'expenses', 'workspace_join_requests'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { resource } = req.query;

  if (typeof resource !== 'string' || !ALLOWED_RESOURCES.includes(resource)) {
      return res.status(404).json({ error: "Resource not found or not allowed." });
  }
  
  try {
    const supabase = getSupabaseAdmin();
    
    // AUTHENTICATION CHECK: All data endpoints are now protected.
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Authentication token required.' });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
        return res.status(401).json({ error: authError?.message || 'Invalid or expired token.' });
    }
    
    // Convert incoming camelCase request body to snake_case for the database.
    const bodyInSnakeCase = req.body ? keysToSnake(req.body) : req.body;

    switch (req.method) {
        case 'GET': {
            // RLS in Supabase should filter data.
            // Data is returned in snake_case, and the client's apiFetch will convert it to camelCase.
            const { data, error } = await (supabase.from(resource) as any).select('*');
            if (error) throw error;
            return res.status(200).json(data);
        }
        case 'POST': {
            // The body is already converted to snake_case.
            const { data, error } = await (supabase.from(resource) as any).insert(bodyInSnakeCase).select();
            if (error) throw error;
            return res.status(201).json(data);
        }
        case 'PUT': {
            // The body is already converted to snake_case.
            const recordToUpdate = { ...bodyInSnakeCase };
            const id = recordToUpdate.id; // 'id' column is not converted, which is correct.
            delete recordToUpdate.id;
            const updateData = recordToUpdate;

            if (!id) return res.status(400).json({ error: 'ID is required for update' });
            
            const { data, error } = await (supabase.from(resource) as any)
              .update(updateData)
              .eq('id', id)
              .select();
            if (error) throw error;
            return res.status(200).json(data);
        }
        case 'DELETE': {
             // DELETE often just takes an ID, so the body might be simple { id: '...' }
             const id = bodyInSnakeCase.id;
             if (!id) return res.status(400).json({ error: 'ID is required for delete' });
             const { error } = await (supabase.from(resource) as any).delete().eq('id', id);
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