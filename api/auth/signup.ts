// api/auth/signup.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const supabase = getSupabaseAdmin();
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters.' });
        }

        // Step 1: Create the user, passing the name in the metadata for the trigger to use.
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm for this app's purpose.
            options: {
                data: {
                    name: name
                }
            }
        });

        if (authError) {
            console.error('Supabase auth error during signup:', authError.message);
            if (authError.message.includes('User already registered') || authError.message.toLowerCase().includes('unique constraint')) {
                return res.status(409).json({ error: 'A user with this email already exists.' });
            }
            // The trigger will fail if the profile table has constraints that are not met.
            if (authError.message.includes('database error')) {
                 return res.status(500).json({ error: `Could not create user profile. A database error occurred, possibly related to table constraints. Details: ${authError.message}` });
            }
            return res.status(500).json({ error: `Authentication service error: ${authError.message}` });
        }

        if (!authData || !authData.user) {
            console.error('User creation did not return a user object.');
            return res.status(500).json({ error: 'User creation failed unexpectedly.' });
        }

        // Step 2: The database trigger 'on_auth_user_created' has already created the profile.
        // Now, sign in the user to get a session.
        const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({ email, password });

        if (sessionError || !sessionData.session) {
            console.error('Sign-in after signup failed:', sessionError?.message);
            // Even if sign-in fails, the user exists. This is an issue.
            // However, the user can try logging in manually.
            return res.status(500).json({ error: `Login after signup failed: ${sessionError?.message}` });
        }
        
        // Step 3: Fetch the profile created by the trigger to return to the client.
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('id, name, email, initials, avatar_url, contractInfoNotes, employmentInfoNotes')
            .eq('id', authData.user.id)
            .single();
            
        if (profileError || !profileData) {
            // This is a critical state. The auth user exists but the profile trigger might have failed.
            console.error(`CRITICAL: User ${authData.user.id} was created but profile could not be fetched. Profile Error:`, profileError);
            return res.status(500).json({ error: 'User was created, but their profile could not be retrieved.' });
        }

        const userForClient = {
            ...profileData,
            avatarUrl: profileData.avatar_url
        };
        delete (userForClient as any).avatar_url;

        return res.status(200).json({ session: sessionData.session, user: userForClient });

    } catch (error: any) {
        console.error('Unexpected error in signup handler:', error);
        return res.status(500).json({ error: 'An unexpected server error occurred.' });
    }
}
