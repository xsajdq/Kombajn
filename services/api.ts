// File: services/api.ts

export async function apiPost(resource: string, body: any) {
    const response = await fetch(`/api/data/${resource}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || `Failed to create ${resource}`);
    }
    return response.json();
}

export async function apiPut(resource: string, body: any) {
    const response = await fetch(`/api/data/${resource}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || `Failed to update ${resource}`);
    }
    return response.json();
}
