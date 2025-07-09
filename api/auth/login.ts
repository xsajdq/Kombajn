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
            if (authError.message.includes('Invalid login credentials')) {
                throw new Error('Invalid email or password.');
            }
            throw authError;
        }

        if (!authData.user) {
            console.error('signInWithPassword succeeded but returned no user object.');
            throw new Error('Authentication failed unexpectedly. No user object returned.');
        }

        const user = authData.user;

        // Fetch profile(s) without .single() to handle 0 or >1 results gracefully
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, name, email, initials, avatar_url, contractInfoNotes, employmentInfoNotes')
            .eq('id', user.id);
            
        if (profileError) {
            console.error(`Error fetching profile for user ${user.id}:`, profileError.message);
            throw new Error(`Login succeeded but could not retrieve user profile. Reason: ${profileError.message}`);
        }

        let profileData;

        if (profiles && profiles.length > 0) {
            if (profiles.length > 1) {
                console.warn(`Duplicate profiles found for user ${user.id}. Using the first one found.`);
            }
            profileData = profiles[0];
        } else {
            // Self-healing: No profile found, so create one.
            console.warn(`User ${user.id} authenticated successfully but had no profile. Creating one now.`);
            
            const nameFromEmail = user.email!.split('@')[0];
            const initials = nameFromEmail.substring(0, 2).toUpperCase();

            const { data: newProfile, error: insertError } = await supabase
                .from('profiles')
                .insert({
                    id: user.id,
                    email: user.email,
                    name: nameFromEmail,
                    initials: initials
                })
                .select('id, name, email, initials, avatar_url, contractInfoNotes, employmentInfoNotes')
                .single();

            if (insertError) {
                console.error(`Failed to create missing profile for user ${user.id}. Error:`, insertError.message);
                throw new Error(`Login succeeded but failed to create the necessary user profile. Reason: ${insertError.message}`);
            }
            
            profileData = newProfile;
        }

        if (!profileData) {
             throw new Error('Login succeeded but user profile could not be retrieved or created.');
        }

        // The Supabase client automatically converts snake_case (avatar_url) to camelCase (avatarUrl)
        const userForClient = {
            ...profileData,
            avatarUrl: profileData.avatar_url
        };
        delete (userForClient as any).avatar_url;


        return res.status(200).json({ session: authData.session, user: userForClient });

    } catch (error: any) {
        // Use 500 for server-side logic failures after successful auth, 401 for auth failures
        const statusCode = error.message.includes('Invalid email or password') ? 401 : 500;
        return res.status(statusCode).json({ error: error.message });
    }
}
