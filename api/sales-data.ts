
// api/sales-data.ts
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

        // Security: Check if user is a member of this workspace
        const { data: membership, error: memberError } = await supabase
            .from('workspace_members')
            .select('user_id')
            .eq('workspace_id', workspaceId)
            .eq('user_id', user.id)
            .single();
            
        if (memberError || !membership) {
            return res.status(403).json({ error: 'User is not a member of this workspace.' });
        }
        
        // 1. Fetch all deals for the workspace
        const { data: deals, error: dealsError } = await supabase
            .from('deals')
            .select('*')
            .eq('workspace_id', workspaceId);
        if (dealsError) throw dealsError;

        if (!deals || deals.length === 0) {
            return res.status(200).json(keysToCamel({ deals: [], clients: [], users: [] }));
        }

        // 2. Collect unique client and owner IDs from the deals
        const clientIds = [...new Set(deals.map(d => d.client_id))];
        const ownerIds = [...new Set(deals.map(d => d.owner_id))];

        // 3. Fetch the corresponding clients and users (profiles)
        const [clientsRes, usersRes] = await Promise.all([
            supabase.from('clients').select('*, client_contacts(*)').in('id', clientIds),
            supabase.from('profiles').select('id, name, initials, avatar_url').in('id', ownerIds)
        ]);
        
        if (clientsRes.error) throw clientsRes.error;
        if (usersRes.error) throw usersRes.error;

        const responseData = {
            deals: deals,
            clients: clientsRes.data || [],
            users: usersRes.data || [],
        };
        
        return res.status(200).json(keysToCamel(responseData));

    } catch (error: any) {
        console.error('Sales data fetch error:', error);
        return res.status(500).json({ error: `Failed to fetch sales data: ${error.message}` });
    }
}
