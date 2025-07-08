// Plik: api/data/[resource].ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../utils/supabaseAdmin.ts';

const ALLOWED_RESOURCES = ['clients', 'projects', 'tasks', 'time_logs', 'invoices', 'deals', 'workspaces', 'workspace_members', 'project_members', 'profiles', 'task_dependencies', 'comments', 'notifications', 'attachments', 'custom_field_definitions', 'custom_field_values', 'automations', 'dashboard_widgets', 'project_templates', 'wiki_history', 'channels', 'chat_messages', 'objectives', 'key_results', 'time_off_requests', 'calendar_events', 'expenses'];

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

    switch (req.method) {
        case 'GET': {
            // Here you could add Row Level Security (RLS) in Supabase to filter data
            // based on the authenticated user's ID (user.id).
            // For now, we fetch all data for simplicity as the app filters by workspaceId on the client.
            const { data, error } = await supabase.from(resource).select('*');
            if (error) throw error;
            return res.status(200).json(data);
        }
        case 'POST': {
            const objectsToInsert = Array.isArray(req.body) ? req.body : [req.body];
            const { data, error } = await supabase.from(resource).insert(objectsToInsert as any).select();
            if (error) throw error;
            return res.status(201).json(data);
        }
        case 'PUT': {
            const updatePayload: { [key: string]: any; id?: any; } = req.body;
            const id = updatePayload.id;
            delete updatePayload.id;

            if (!id) return res.status(400).json({ error: 'ID is required for update' });
            
            const { data, error } = await supabase.from(resource).update(updatePayload).eq('id', id).select();
            if (error) throw error;
            return res.status(200).json(data);
        }
        case 'DELETE': {
             const { id } = req.body;
             if (!id) return res.status(400).json({ error: 'ID is required for delete' });
             const { error } = await supabase.from(resource).delete().eq('id', id);
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