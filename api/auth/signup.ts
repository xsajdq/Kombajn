
// api/auth/signup.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../utils/supabaseAdmin.ts';

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

        // Step 1: Create the user in the auth schema
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm for this app's purpose. Real-world might send an email.
        });

        if (authError) {
            console.error('Supabase auth error during signup:', authError.message);
            if (authError.message.includes('User already registered') || authError.message.toLowerCase().includes('unique constraint')) {
                return res.status(409).json({ error: 'A user with this email already exists.' });
            }
            return res.status(500).json({ error: `Authentication service error: ${authError.message}` });
        }

        if (!authData || !authData.user) {
            console.error('User creation did not return a user object.');
            return res.status(500).json({ error: 'User creation failed unexpectedly.' });
        }

        const user = authData.user;

        // Step 2: Create the public profile linked to the auth user
        const initials = name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
        const { data: profileDataArray, error: profileError } = await (supabase
            .from('profiles') as any)
            .insert([{ id: user.id, name, initials }])
            .select('id, name, initials');

        if (profileError) {
            console.error(`Profile creation failed for user ${user.id}. Attempting to roll back auth user. Profile Error:`, profileError);
            try {
                const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
                if (deleteError) {
                    // This is a critical state. The auth user exists but the profile doesn't.
                    // Log this for manual intervention.
                    console.error(`CRITICAL: Failed to roll back auth user ${user.id} after profile creation failure. Manual cleanup required. Delete Error:`, deleteError);
                } else {
                    console.log(`Successfully rolled back auth user ${user.id}.`);
                }
            } catch (rollbackError) {
                console.error(`CRITICAL: An unexpected error occurred during auth user rollback for user ${user.id}. Manual cleanup required. Rollback Error:`, rollbackError);
            }
            // Return the original profile error to the client.
            return res.status(500).json({ error: `Could not create user profile: ${profileError.message}` });
        }
        
        if (!profileDataArray || profileDataArray.length === 0) {
            await supabase.auth.admin.deleteUser(user.id);
            console.error('Profile insert succeeded but returned no data. Rolled back auth user.');
            return res.status(500).json({ error: 'Profile creation failed after insert.' });
        }
        
        const profileData = profileDataArray[0];

        // Step 3: Sign in the newly created user to get a session for the client
        const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({ email, password });

        if (sessionError) {
            console.error('Sign-in after signup failed:', sessionError.message);
            return res.status(500).json({ error: `Login after signup failed: ${sessionError.message}` });
        }
        
        if (!sessionData.session) {
             console.error('Login after signup did not return a session.');
             return res.status(500).json({ error: 'Session could not be created after signup.' });
        }
        
        const responseUser = {
            ...profileData,
            email: user.email
        };

        return res.status(200).json({ session: sessionData.session, user: responseUser });

    } catch (error: any) {
        console.error('Unexpected error in signup handler:', error);
        return res.status(500).json({ error: 'An unexpected server error occurred.' });
    }
}
