import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { state } from '../state.ts';
import type { Notification, Task, Deal } from '../types.ts';
import { keysToCamel } from '../utils.ts';

export let supabase: SupabaseClient | null = null;
let userChannel: RealtimeChannel | null = null;
let workspaceChannel: RealtimeChannel | null = null;

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

// Subscribe to notifications for the logged-in user. Should be called once after login.
export function subscribeToUserChannel() {
    if (!supabase || !state.currentUser) return;
    // Do nothing if already subscribed and connected
    if (userChannel && (userChannel.state === 'joined' || userChannel.state === 'joining')) return;

    // Unsubscribe from any existing channel before creating a new one
    if (userChannel) {
        supabase.removeChannel(userChannel);
    }

    const userId = state.currentUser.id;
    userChannel = supabase.channel(`user-notifications:${userId}`);
    userChannel
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${userId}`,
            },
            (payload) => {
                console.log('Realtime: New notification received!', payload);
                const newNotification = keysToCamel(payload.new) as Notification;
                // Prevent duplicate notifications
                if (!state.notifications.some(n => n.id === newNotification.id)) {
                    state.notifications.unshift(newNotification);
                    window.dispatchEvent(new CustomEvent('state-change-realtime'));
                }
            }
        )
        .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                console.log(`Successfully subscribed to user channel for ${userId}`);
            }
            if (status === 'CHANNEL_ERROR' && err) {
                console.error(`Failed to subscribe to user channel:`, err);
            }
        });
}

// Switch subscription to a new workspace. Unsubscribes from the old and subscribes to the new.
export async function switchWorkspaceChannel(workspaceId: string) {
    if (!supabase) return;

    // Unsubscribe from the old workspace channel if it exists
    if (workspaceChannel) {
        await supabase.removeChannel(workspaceChannel);
        workspaceChannel = null;
    }
    
    // Don't subscribe if there's no workspace ID (e.g., user has no workspaces)
    if (!workspaceId) return;

    workspaceChannel = supabase.channel(`workspace-data:${workspaceId}`);
    workspaceChannel
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${workspaceId}` },
            (payload) => {
                console.log('Realtime: Task change received!', payload);
                const eventType = payload.eventType;
                const record = keysToCamel(eventType === 'DELETE' ? payload.old : payload.new) as Task;
                const index = state.tasks.findIndex(t => t.id === record.id);

                if (eventType === 'UPDATE') {
                    if (index > -1) state.tasks[index] = { ...state.tasks[index], ...record };
                } else if (eventType === 'INSERT') {
                    if (index === -1) state.tasks.push(record);
                } else if (eventType === 'DELETE') {
                    if (index > -1) state.tasks.splice(index, 1);
                }
                window.dispatchEvent(new CustomEvent('state-change-realtime'));
            }
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'deals', filter: `workspace_id=eq.${workspaceId}` },
             (payload) => {
                console.log('Realtime: Deal change received!', payload);
                const eventType = payload.eventType;
                const record = keysToCamel(eventType === 'DELETE' ? payload.old : payload.new) as Deal;
                const index = state.deals.findIndex(d => d.id === record.id);

                if (eventType === 'UPDATE') {
                    if (index > -1) state.deals[index] = { ...state.deals[index], ...record };
                } else if (eventType === 'INSERT') {
                    if (index === -1) state.deals.push(record);
                } else if (eventType === 'DELETE') {
                    if (index > -1) state.deals.splice(index, 1);
                }
                window.dispatchEvent(new CustomEvent('state-change-realtime'));
            }
        )
        .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                console.log(`Successfully subscribed to workspace channel for ${workspaceId}`);
            }
            if (status === 'CHANNEL_ERROR' && err) {
                console.error(`Failed to subscribe to workspace channel:`, err);
            }
        });
}

// Unsubscribe from all channels on logout
export async function unsubscribeAll() {
    if (supabase) {
        await supabase.removeAllChannels();
        userChannel = null;
        workspaceChannel = null;
        console.log("Unsubscribed from all realtime channels.");
    }
}
