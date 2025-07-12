// api/auth/signup.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const supabase = getSupabaseAdmin();
    const { name, email, password } = req.body;
    let createdUserId: string | null = null;

    try {
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters.' });
        }

        // Step 1: Create the user.
        // We still pass name in metadata in case a trigger is used by other flows (e.g., social auth)
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm for this app's purpose.
            options: { data: { name } }
        });

        if (authError) {
            if (authError.message.includes('User already registered')) {
                return res.status(409).json({ error: 'A user with this email already exists.' });
            }
            throw authError; // Rethrow other auth errors
        }
        
        if (!authData || !authData.user) {
            throw new Error('User creation did not return a user object.');
        }

        createdUserId = authData.user.id;

        // Step 2: Explicitly create/retrieve the profile using the robust RPC function.
        // This avoids race conditions with the trigger and ensures profile exists.
        const { data: profiles, error: rpcError } = await supabase
            .rpc('create_profile_if_not_exists', {
                user_id: createdUserId,
                user_email: email,
                user_name: name,
            });

        if (rpcError || !profiles || profiles.length === 0) {
            // If profile creation fails, we must delete the auth user to allow a retry.
            // This is a critical cleanup step.
            if (createdUserId) {
                console.log(`Profile creation/retrieval failed for ${createdUserId}. Deleting auth user.`);
                await supabase.auth.admin.deleteUser(createdUserId);
            }
            throw new Error(`User auth created, but profile creation failed. Reason: ${rpcError?.message || 'Unknown RPC error'}`);
        }
        
        const profileData = profiles[0];

        // Step 3: Now that user and profile exist, sign in to get a session.
        const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({ email, password });

        if (sessionError || !sessionData.session) {
            throw new Error(`Login after signup failed: ${sessionError?.message}`);
        }

        // The Supabase client automatically converts snake_case to camelCase
        const userForClient = {
            ...profileData,
            avatarUrl: profileData.avatar_url
        };
        delete (userForClient as any).avatar_url;


        return res.status(200).json({ session: sessionData.session, user: userForClient });

    } catch (error: any) {
        // A generic catch block for any failure in the process
        console.error('Signup process failed:', error.message);
        return res.status(500).json({ error: error.message || 'An unexpected server error occurred during signup.' });
    }
}
