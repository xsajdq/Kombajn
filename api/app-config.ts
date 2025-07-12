
// api/app-config.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import configHandler from './_handlers/config';
import tokenHandler from './_handlers/integrations/token';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { action } = req.query;

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // This route handles getting the integration token for Google Picker
    if (action === 'token') {
        return tokenHandler(req, res);
    }
    
    // The default action is to get the public supabase config
    return configHandler(req, res);
}
