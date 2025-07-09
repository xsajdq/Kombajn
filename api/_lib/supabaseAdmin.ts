// api/_lib/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

let supabaseAdmin: SupabaseClient;

export function getSupabaseAdmin(): SupabaseClient {
    if (supabaseAdmin) {
        return supabaseAdmin;
    }
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
        console.error('Supabase credentials are not set in environment variables.');
        throw new Error('Server configuration error: Database credentials are missing.');
    }
    // The admin client uses the service_role key, which bypasses RLS.
    // Be careful with queries using this client.
    supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
    return supabaseAdmin;
}
