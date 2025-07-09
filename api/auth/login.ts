// api/auth/login.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    
    try {
        const supabase = getSupabaseAdmin();
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

        if (authError) {
            // Provide a more user-friendly error message
            if (authError.message.includes('Invalid login credentials')) {
                throw new Error('Invalid email or password.');
            }
            throw authError;
        }
        
        const user = authData.user;

        // Fetch the corresponding profile to return to the client
        let { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('id, name, email, initials, avatarUrl, contractInfoNotes, employmentInfoNotes')
            .eq('id', user.id)
            .single();

        // SELF-HEALING: If profile doesn't exist, create it on-the-fly.
        // PGRST116 is the PostgREST code for "exact one row not found".
        if (profileError && profileError.code === 'PGRST116') {
            console.warn(`User ${user.id} authenticated successfully but had no profile. Creating one now.`);
            
            const nameFromEmail = user.email!.split('@')[0];
            const initials = nameFromEmail.substring(0, 2).toUpperCase();

            const { data: newProfileData, error: insertError } = await supabase
                .from('profiles')
                .insert({
                    id: user.id,
                    email: user.email,
                    name: nameFromEmail, // Use part of email as a default name
                    initials: initials
                })
                .select('id, name, email, initials, avatarUrl, contractInfoNotes, employmentInfoNotes')
                .single();

            if (insertError) {
                console.error(`Failed to create missing profile for user ${user.id}. Error:`, insertError);
                throw new Error('Login succeeded but failed to create the necessary user profile.');
            }
            
            profileData = newProfileData;
        } else if (profileError) {
            // A different, unexpected error occurred while fetching the profile
            console.error(`Login success but couldn't find profile for user ${user.id}. Error: ${profileError.message}`);
            throw new Error('Login succeeded but user profile could not be retrieved.');
        }

        return res.status(200).json({ session: authData.session, user: profileData });

    } catch (error: any) {
        return res.status(401).json({ error: error.message });
    }
}