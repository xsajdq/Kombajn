
// File: services/auth.ts
import { state } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { User } from '../types.ts';
import { apiFetch } from './api.ts';
import { unsubscribeAll, supabase, initSupabase } from './supabase.ts';

export async function login(email: string, password: string): Promise<void> {
    const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });

    if (!supabase) throw new Error("Supabase client not initialized.");

    // The backend API returns a session object. We set it in the client.
    // The apiFetch function has already converted snake_case to camelCase.
    await supabase.auth.setSession({
        access_token: data.session.accessToken,
        refresh_token: data.session.refreshToken,
    });
    
    state.currentUser = data.user;
}

export async function signup(name: string, email: string, password: string): Promise<void> {
    const data = await apiFetch('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ name, email, password })
    });
    
    if (!supabase) throw new Error("Supabase client not initialized.");

    // The backend API returns a session object. We set it in the client.
    await supabase.auth.setSession({
        access_token: data.session.accessToken,
        refresh_token: data.session.refreshToken,
    });
    state.currentUser = data.user;
}

export async function logout(): Promise<void> {
    await unsubscribeAll();
    
    if (supabase) {
        await supabase.auth.signOut();
    }
    
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
        // Reset all data arrays
        clients: [], projects: [], tasks: [], timeLogs: [], invoices: [],
        comments: [], notifications: [], deals: [], // etc.
    });
    renderApp();
}

export async function validateSession(): Promise<User | null> {
    if (!supabase) {
        // This can happen on first load, ensure supabase is initialized
        await initSupabase();
    }
    if (!supabase) {
        console.error("Supabase client could not be initialized.");
        return null;
    }
    
    // getSession() will automatically use the refresh token if the access token is expired
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
        return null; // No active session
    }

    try {
        // Session exists on the client. Now verify with our backend and get full profile data.
        // apiFetch will automatically use the valid token from the session.
        const data = await apiFetch('/api/auth/user');
        return data.user;
    } catch (e) {
        console.error('Session validation failed on backend, signing out.', e);
        // If our backend rejects the token, the session is invalid.
        await supabase.auth.signOut();
        return null;
    }
}
