// File: services/api.ts
import { keysToCamel } from '../utils.ts';
import { supabase } from './supabase.ts';
import type { Session } from '@supabase/supabase-js';

function fetchWithTimeout(resource: string, options: RequestInit = {}, timeout = 15000) { // 15 seconds timeout
    return Promise.race([
        fetch(resource, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Request to ${resource} timed out after ${timeout / 1000}s`)), timeout)
        )
    ]) as Promise<Response>;
}

export async function apiFetch(resource: string, options: RequestInit = {}, session?: Session | null) {
    console.log(`[apiFetch] Calling: ${resource}`);
    if (!supabase) {
        throw new Error("Supabase client is not initialized.");
    }

    try {
        // If a session object is passed directly (from onAuthStateChange), use its token.
        // Otherwise, fall back to fetching the session from the client.
        const token = session
            ? session.access_token
            : (await supabase.auth.getSession()).data.session?.access_token;
        
        const headers = new Headers(options.headers || {});
        
        if (token) {
            headers.set('Authorization', `Bearer ${token}`);
        }
        if (!headers.has('Content-Type') && options.body) {
            headers.set('Content-Type', 'application/json');
        }

        const finalOptions: RequestInit = {
            ...options,
            headers: headers
        };

        const response = await fetchWithTimeout(resource, finalOptions);

        if (response.status === 204) {
            console.log(`[apiFetch] Response 204 (No Content) for: ${resource}`);
            return null;
        }

        const data = await response.json().catch(() => ({ 
            error: `Request to ${resource} failed with status ${response.status}: ${response.statusText}. Could not parse JSON response.` 
        }));

        if (!response.ok) {
            console.error(`[apiFetch] Response NOT OK for: ${resource}`, { status: response.status, data });
            throw new Error(data.error || `Request to ${resource} failed with status ${response.status}`);
        }

        console.log(`[apiFetch] Response OK for: ${resource}`);
        return keysToCamel(data);

    } catch (error) {
        console.error(`[apiFetch] Fetch failed for: ${resource}`, error);
        throw error; // Re-throw the error to be handled by the caller
    }
}


export function apiPost(resource: string, body: any) {
    return apiFetch(`/api?action=data&resource=${resource}`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export function apiPut(resource: string, body: any) {
    return apiFetch(`/api?action=data&resource=${resource}`, {
        method: 'PUT',
        body: JSON.stringify(body),
    });
}