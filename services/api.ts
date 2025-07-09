// File: services/api.ts

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

    if (!response.ok) {
        // Specifically handle session expiry or invalid tokens
        if (response.status === 401) {
            localStorage.removeItem(TOKEN_KEY);
            window.location.reload(); // Force a reload, which will show the login page
        }
        const err = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(err.error || `Request to ${resource} failed with status ${response.status}`);
    }

    if (response.status === 204) { // Handle No Content response
        return null;
    }
    
    return response.json();
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