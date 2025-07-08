// api/auth/signup.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../utils/supabaseAdmin.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    
    try {
        const supabase = getSupabaseAdmin();
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required.' });
        }
        if (password.length < 6) {
             return res.status(400).json({ error: 'Password must be at least 6 characters.' });
        }

        // Create the user in the auth schema
        const { data: { user }, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm for this app's purpose. Real-world might send an email.
        });

        if (authError) throw authError;
        if (!user) throw new Error('User could not be created in Supabase Auth.');

        // Create the public profile linked to the auth user
        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .insert([{ id: user.id, name, initials }])
            .select()
            .single();
        
        if (profileError) {
            // If profile creation fails, we should ideally delete the auth user to avoid orphans.
            await supabase.auth.admin.deleteUser(user.id);
            console.error(`Failed to create profile for ${user.id}. Rolled back auth user creation. Error: ${profileError.message}`);
            throw new Error(`Could not create user profile: ${profileError.message}`);
        }

        // Sign in the newly created user to get a session for the client
        const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({ email, password });

        if (sessionError) throw sessionError;

        return res.status(200).json({ session: sessionData.session, user: profileData });

    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
}