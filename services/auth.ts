// File: services/auth.ts
import { state } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { User } from '../types.ts';
import { apiFetch } from './api.ts';

const TOKEN_KEY = 'kombajn_auth_token';

export function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}

export async function login(email: string, password: string): Promise<void> {
    const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
    setToken(data.session.access_token);
    state.currentUser = data.user;
}

export async function signup(name: string, email: string, password: string): Promise<void> {
    const data = await apiFetch('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ name, email, password })
    });
    setToken(data.session.access_token);
    state.currentUser = data.user;
}

export async function logout(): Promise<void> {
    const token = getToken();
    if (token) {
        await apiFetch('/api/auth/logout', { method: 'POST' });
    }
    clearToken();
    state.currentUser = null;
    state.currentPage = 'auth';
    // Reset state to initial to clear all user data
    Object.assign(state, {
        ...state, // keep settings
        currentPage: 'auth',
        currentUser: null,
        activeWorkspaceId: null,
        workspaces: [],
        workspaceMembers: [],
        users: [],
        // ... clear all other data arrays
    });
    renderApp();
}

export async function validateSession(): Promise<User | null> {
    const token = getToken();
    if (!token) return null;

    try {
        const data = await apiFetch('/api/auth/user');
        return data.user;
    } catch (e) {
        console.error('Session validation failed:', e);
        clearToken();
        return null;
    }
}