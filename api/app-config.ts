import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
    // Set CORS headers to allow requests from any origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: "Method Not Allowed" });
    }
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        console.error('[api/app-config] CRITICAL: Supabase environment variables are missing.');
        // This detailed error is crucial for debugging on Vercel.
        return res.status(500).json({ error: 'Server configuration error: The SUPABASE_URL and SUPABASE_ANON_KEY environment variables are not set on the server.' });
    }

    return res.status(200).json({ supabaseUrl, supabaseAnonKey });
}
