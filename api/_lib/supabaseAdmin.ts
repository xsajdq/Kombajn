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

// List of keys that are intentionally camelCase in the database and should not be converted.
const CAMEL_CASE_EXCEPTIONS = new Set([
  'planHistory',
  'contractInfoNotes',
  'employmentInfoNotes',
]);

function camelToSnake(str: string): string {
    // If the key is a known exception, return it as is.
    if (CAMEL_CASE_EXCEPTIONS.has(str)) {
        return str;
    }
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function snakeToCamel(str: string): string {
    return str.replace(/_(\w)/g, (_, letter) => letter.toUpperCase());
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
export const keysToCamel = (obj: any) => convertKeys(obj, snakeToCamel);
