
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { state } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { Notification, Task, Deal } from '../types.ts';

export let supabase: SupabaseClient | null = null;
const channels: RealtimeChannel[] = [];

// Initialize the Supabase client by fetching config from the server
export async function initSupabase() {
    if (supabase) return;

    try {
        const response = await fetch('/api/app-config');
        
        // Try to get a JSON body regardless of response status
        const responseBody = await response.json().catch(() => null);

        if (!response.ok) {
            // Use the specific error from the backend if available, otherwise use a generic message.
            const errorMessage = responseBody?.error || `Failed to fetch config with status: ${response.status}`;
            throw new Error(errorMessage);
        }
        
        const { supabaseUrl, supabaseAnonKey } = responseBody;

        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error("Supabase URL or Anon Key is missing in the server config response.");
        }

        supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
            },
            realtime: {
                params: {
                    eventsPerSecond: 10,
                },
            },
        });
        console.log("Supabase client initialized from API config.");
    } catch (error) {
        console.error("Supabase client initialization failed:", error);
        // Re-throw to be caught by the top-level bootstrap function in index.tsx
        throw error;
    }
}


// Function to manage a single subscription, ensuring no duplicates
function manageSubscription(channelName: string, config: any) {
    if (!supabase) return;

    // First, remove any existing channel with the same name to avoid duplicates
    const existingChannel = channels.find(c => c.topic === channelName);
    if (existingChannel) {
        supabase.removeChannel(existingChannel);
        const index = channels.indexOf(existingChannel);
        if (index > -1) {
            channels.splice(index, 1);
        }
    }

    // Separate the callback from the subscription options.
    const { callback, ...subscriptionOptions } = config;

    // Create and store the new channel
    const channel = supabase.channel(channelName).on(
        'postgres_changes',
        subscriptionOptions,
        callback
    ).subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
            console.log(`Successfully subscribed to ${channelName}`);
        }
        if (status === 'CHANNEL_ERROR') {
            console.error(`Failed to subscribe to ${channelName}:`, err);
        }
    });
    
    channels.push(channel);
}

// Subscribe to all relevant real-time updates based on current state
export function subscribeToRealtimeUpdates() {
    if (!supabase || !state.currentUser || !state.activeWorkspaceId) {
        console.log("Skipping realtime subscription: user or workspace not ready.");
        return;
    }

    // Notifications for the current user
    manageSubscription(`realtime:notifications:${state.currentUser.id}`, {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${state.currentUser.id}`,
        callback: (payload: any) => {
            console.log('Realtime: New notification received!', payload);
            const newNotification = payload.new as Notification;
            state.notifications.unshift(newNotification);
            renderApp();
        }
    });

    // Task updates for the current workspace
    manageSubscription(`realtime:tasks:${state.activeWorkspaceId}`, {
        event: '*', // Listen to INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'tasks',
        filter: `workspace_id=eq.${state.activeWorkspaceId}`,
        callback: (payload: any) => {
            console.log('Realtime: Task change received!', payload);
            const eventType = payload.eventType;
            const record = (eventType === 'DELETE' ? payload.old : payload.new) as Task;
            const index = state.tasks.findIndex(t => t.id === record.id);

            if (eventType === 'UPDATE') {
                if (index > -1) state.tasks[index] = { ...state.tasks[index], ...record };
            } else if (eventType === 'INSERT') {
                if (index === -1) state.tasks.push(record);
            } else if (eventType === 'DELETE') {
                if (index > -1) state.tasks.splice(index, 1);
            }
            renderApp();
        }
    });

    // Deal updates for the current workspace
    manageSubscription(`realtime:deals:${state.activeWorkspaceId}`, {
        event: '*', // Listen to INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'deals',
        filter: `workspace_id=eq.${state.activeWorkspaceId}`,
        callback: (payload: any) => {
            console.log('Realtime: Deal change received!', payload);
            const eventType = payload.eventType;
            const record = (eventType === 'DELETE' ? payload.old : payload.new) as Deal;
            const index = state.deals.findIndex(d => d.id === record.id);

            if (eventType === 'UPDATE') {
                if (index > -1) state.deals[index] = { ...state.deals[index], ...record };
            } else if (eventType === 'INSERT') {
                if (index === -1) state.deals.push(record);
            } else if (eventType === 'DELETE') {
                if (index > -1) state.deals.splice(index, 1);
            }
            renderApp();
        }
    });
}

// Unsubscribe from all channels on logout
export async function unsubscribeAll() {
    if (supabase) {
        await supabase.removeAllChannels();
        channels.length = 0; // Clear the array
        console.log("Unsubscribed from all realtime channels.");
    }
}
