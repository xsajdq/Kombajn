// File: services/auth.ts
import { state } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { User } from '../types.ts';
import { apiFetch } from './api.ts';
import { supabase } from './supabase.ts';

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
    
    // The onAuthStateChange listener will now handle the rest
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
    // The onAuthStateChange listener will now handle the rest
}

export async function logout(): Promise<void> {
    if (supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Error logging out:', error);
        }
    }
    // The onAuthStateChange listener will handle UI updates and state clearing.
}
