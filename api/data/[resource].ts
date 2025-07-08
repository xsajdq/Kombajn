// Plik: api/data/[resource].ts
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_RESOURCES = ['clients', 'projects', 'tasks', 'time_logs', 'invoices', 'deals', 'workspaces', 'workspace_members', 'project_members', 'profiles', 'task_dependencies', 'comments', 'notifications', 'attachments', 'custom_field_definitions', 'custom_field_values', 'automations', 'dashboard_widgets', 'project_templates', 'wiki_history', 'channels', 'chat_messages', 'objectives', 'key_results', 'time_off_requests', 'calendar_events', 'expenses'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { resource } = req.query;

  if (typeof resource !== 'string' || !ALLOWED_RESOURCES.includes(resource)) {
      return res.status(404).json({ error: "Resource not found or not allowed." });
  }
  
  // Explicitly check for environment variables to prevent crashes.
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      console.error('Supabase URL or Service Key is not set in environment variables.');
      return res.status(500).json({ error: 'Server configuration error: Database credentials are missing.' });
  }

  try {
    // Inicjalizujemy klienta Supabase używając bezpiecznych kluczy serwerowych.
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    
    switch (req.method) {
        case 'GET': {
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
            const { id, ...updateData } = req.body;
            if (!id) return res.status(400).json({ error: 'ID is required for update' });
            const { data, error } = await supabase.from(resource).update(updateData as any).eq('id', id).select();
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