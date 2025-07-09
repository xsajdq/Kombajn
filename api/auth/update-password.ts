// api/auth/update-password.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const supabase = getSupabaseAdmin();
        const token = req.headers.authorization?.split('Bearer ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Authentication token is required.' });
        }

        // Get the user from the token to ensure the session is valid
        const { data: { user }, error: getUserError } = await supabase.auth.getUser(token);
        if (getUserError || !user) {
            return res.status(401).json({ error: getUserError?.message || 'Invalid session.' });
        }
        
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
        }

        // Use the admin client to update the user's password
        const { error: updateError } = await supabase.auth.admin.updateUserById(
            user.id,
            { password: newPassword }
        );

        if (updateError) {
            throw updateError;
        }

        return res.status(200).json({ message: 'Password updated successfully.' });

    } catch (error: any) {
        console.error('Password update failed:', error);
        return res.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
}