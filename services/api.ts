
// File: services/api.ts
import { keysToCamel } from '../utils.ts';

const TOKEN_KEY = 'kombajn_auth_token';

export async function apiFetch(resource: string, options: RequestInit = {}) {
    const token = localStorage.getItem(TOKEN_KEY);
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
        // Specifically handle session expiry or invalid tokens
        // BUT, do not reload on auth endpoints, as a failure there is expected (e.g., wrong password)
        const isAuthEndpoint = resource.startsWith('/api/auth/login') || resource.startsWith('/api/auth/signup');
        if (response.status === 401 && !isAuthEndpoint) {
            localStorage.removeItem(TOKEN_KEY);
            window.location.reload(); // Force a reload, which will show the login page
        }
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