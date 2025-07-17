// api/_handlers/auth/signup.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * @deprecated This API endpoint is no longer in use.
 * Authentication is now handled directly by the Supabase client-side SDK for improved security and reliability.
 * See services/auth.ts for the new implementation.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    return res.status(404).json({ 
        error: 'This endpoint is deprecated. Client-side authentication should be used.' 
    });
}