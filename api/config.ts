
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: "Method Not Allowed" });
    }
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
        const errorMsg = 'Server configuration error: SUPABASE_URL is missing.';
        console.error(errorMsg);
        return res.status(500).json({ error: errorMsg });
    }
    
    if (!supabaseAnonKey) {
        const errorMsg = 'Server configuration error: SUPABASE_ANON_KEY is missing.';
        console.error(errorMsg);
        return res.status(500).json({ error: errorMsg });
    }

    res.status(200).json({ supabaseUrl, supabaseAnonKey });
}
