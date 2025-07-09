
// api/_lib/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js';

let supabaseAdmin: any;

export function getSupabaseAdmin() {
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

function camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function convertKeys(obj: any, converter: (key: string) => string): any {
    if (Array.isArray(obj)) {
        return obj.map(v => convertKeys(v, converter));
    } else if (obj !== null && typeof obj === 'object' && obj.constructor === Object) {
        return Object.keys(obj).reduce((acc, key) => {
            acc[converter(key)] = convertKeys(obj[key], converter);
            return acc;
        }, {} as any);
    }
    return obj;
}

export const keysToSnake = (obj: any) => convertKeys(obj, camelToSnake);