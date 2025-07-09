// api/auth/login.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../utils/supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    
    try {
        const supabase = getSupabaseAdmin();
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            // Provide a more user-friendly error message
            if (error.message.includes('Invalid login credentials')) {
                throw new Error('Invalid email or password.');
            }
            throw error;
        }
        
        // Fetch the corresponding profile to return to the client
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('id, name, initials, avatarUrl, contractInfoNotes, employmentInfoNotes')
            .eq('id', data.user.id)
            .single();

        if (profileError) {
             console.error(`Login success but couldn't find profile for user ${data.user.id}. Error: ${profileError.message}`);
             throw new Error('Login succeeded but user profile could not be retrieved.');
        }

        // Combine auth user data (for email) and profile data
        const responseUser = {
            ...profileData,
            email: data.user.email
        };

        return res.status(200).json({ session: data.session, user: responseUser });

    } catch (error: any) {
        return res.status(401).json({ error: error.message });
    }
}