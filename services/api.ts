
// File: services/api.ts
import { keysToCamel } from '../utils.ts';
import { supabase } from './supabase.ts';

export async function apiFetch(resource: string, options: RequestInit = {}) {
    if (!supabase) {
        throw new Error("Supabase client is not initialized.");
    }
    const sessionResult = await supabase.auth.getSession();
    if (sessionResult.error) {
        throw new Error(`Failed to get session: ${sessionResult.error.message}`);
    }
    const token = sessionResult.data?.session?.access_token;
    
    const headers = new Headers(options.headers || {});
    
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    if (!headers.has('Content-Type') && options.body) {
        headers.set('Content-Type', 'application/json');
    }

    // Combine headers with the rest of the options without spreading the top-level object
    const finalOptions: RequestInit = {
        ...options,
        headers: headers
    };

    const response = await fetch(resource, finalOptions);

    if (response.status === 204) { // Handle No Content response
        return null;
    }

    // Try to parse JSON body, which may exist for both success and error responses
    const data = await response.json().catch(() => ({ 
        error: `Request to ${resource} failed with status ${response.status}: ${response.statusText}` 
    }));

    if (!response.ok) {
        throw new Error(data.error || `Request to ${resource} failed with status ${response.status}`);
    }

    return keysToCamel(data);
}


export function apiPost(resource: string, body: any) {
    return apiFetch(`/api/data/${resource}`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export function apiPut(resource: string, body: any) {
    return apiFetch(`/api/data/${resource}`, {
        method: 'PUT',
        body: JSON.stringify(body),
    });
}
