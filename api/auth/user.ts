// api/auth/user.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../utils/supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
    
    try {
        const supabase = getSupabaseAdmin();
        const token = req.headers.authorization?.split('Bearer ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'No authentication token provided.' });
        }
        
        // Validate the token and get the authenticated user
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            throw error || new Error('User not found for the provided token.');
        }

        // Fetch the corresponding public profile data
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('id, name, initials, avatarUrl, contractInfoNotes, employmentInfoNotes')
            .eq('id', user.id)
            .single();

        if (profileError) {
             throw new Error(`User authenticated but profile not found: ${profileError.message}`);
        }
        
        // Combine auth user data (for email) and profile data
        const responseUser = {
            ...profileData,
            email: user.email
        };
        
        return res.status(200).json({ user: responseUser });

    } catch (error: any) {
        return res.status(401).json({ error: error.message });
    }
}