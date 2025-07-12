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

        // Use a secure RPC function to get or create the profile, bypassing any RLS issues.
        const nameFromEmail = user.email!.split('@')[0];
        const { data: profiles, error: rpcError } = await supabase
            .rpc('create_profile_if_not_exists', {
                user_id: user.id,
                user_email: user.email,
                user_name: nameFromEmail
            });

        if (rpcError) {
            console.error(`RPC create_profile_if_not_exists failed for user ${user.id}:`, rpcError);
            throw new Error(`Login succeeded but could not retrieve or create user profile. Reason: ${rpcError.message}`);
        }

        if (!profiles || profiles.length === 0) {
             throw new Error('Login succeeded but user profile could not be retrieved or created via RPC.');
        }

        const profileData = profiles[0];

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