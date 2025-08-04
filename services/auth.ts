// File: services/auth.ts
import { renderApp } from '../app-renderer.ts';
import type { User } from '../types.ts';
import { apiFetch } from './api.ts';
import { supabase } from './supabase.ts';
import { t } from '../i18n.ts';

export async function login(email: string, password: string): Promise<void> {
    if (!supabase) throw new Error("Supabase client not initialized.");
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        // Provide a user-friendly error message
        if (error.message.includes('Invalid login credentials')) {
            throw new Error(t('errors.invalid_credentials'));
        }
        throw error;
    }
    // The `onAuthStateChange` listener in index.tsx will handle the bootstrap process.
}

export async function signup(name: string, email: string, password: string): Promise<void> {
    if (!supabase) throw new Error("Supabase client not initialized.");

    // Pass the user's name in the metadata, so the database trigger can create the profile correctly.
    const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
            data: {
                name: name,
            }
        }
    });

    if (error) {
        if (error.message.includes('User already registered')) {
            throw new Error(t('errors.user_exists'));
        }
        throw error;
    }
     // The `onAuthStateChange` listener in index.tsx will handle the bootstrap process.
     // Supabase may require email confirmation, which the user needs to complete.
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