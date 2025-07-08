// api/auth/logout.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../utils/supabaseAdmin.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    try {
        const supabase = getSupabaseAdmin();
        const token = req.headers.authorization?.split('Bearer ')[1];

        if (token) {
             // Supabase's `signOut` with a JWT just clears the client-side session,
             // which we are already doing. On the server, we can optionally
             // call `revokeUserTokens` if we were using refresh tokens.
             // For this simple stateless JWT flow, this endpoint is sufficient.
            await supabase.auth.admin.signOut(token);
        }
        
        return res.status(200).json({ message: 'Logged out successfully' });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}
