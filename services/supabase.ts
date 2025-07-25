import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { state } from '../state.ts';
import type { Notification, Task, Deal } from '../types.ts';
import { keysToCamel } from '../utils.ts';

export let supabase: SupabaseClient | null = null;
let userChannel: RealtimeChannel | null = null;
let workspaceChannel: RealtimeChannel | null = null;

export async function initSupabase() {
    if (supabase) return;

    try {
        const response = await fetch('/api?action=app-config');
        const responseBody = await response.json().catch(() => null);

        if (!response.ok) {
            // Specifically check for the 500 error which indicates missing env vars on the server.
            if (response.status === 500 && responseBody && responseBody.error === 'Server configuration error: Supabase credentials missing.') {
                throw new Error("Could not connect to the database. The server is missing the required SUPABASE_URL and SUPABASE_ANON_KEY environment variables. Please add them to your Vercel project settings.");
            }
            // Generic error for other failures.
            const errorMessage = responseBody?.error || `Failed to fetch application configuration (Status: ${response.status}). Please check your network connection and server status.`;
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
        throw error;
    }
}

export async function subscribeToUserChannel() {
    if (!supabase || !state.currentUser || (userChannel && (userChannel.state === 'joined' || userChannel.state === 'joining'))) return;

    if (userChannel) await supabase.removeChannel(userChannel);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        console.error("No session token found, cannot subscribe to user channel.");
        return;
    }

    // Explicitly set the auth token for the realtime client
    supabase.realtime.setAuth(session.access_token);

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
                if (!state.notifications.some(n => n.id === newNotification.id)) {
                    state.notifications.unshift(newNotification);
                    window.dispatchEvent(new CustomEvent('ui-update', { detail: ['header'] }));
                }
            }
        )
        .subscribe(async (status, err) => {
            if (status === 'SUBSCRIBED') {
                console.log(`Successfully subscribed to user channel for ${userId}`);
            }
            if (status === 'CHANNEL_ERROR' && err) {
                console.error(`Failed to subscribe to user channel:`, err);
                // Attempt to re-subscribe on channel error (e.g., token expired)
                console.log('Attempting to re-subscribe to user channel...');
                await supabase!.removeChannel(userChannel!);
                userChannel = null;
                setTimeout(subscribeToUserChannel, 3000); // Retry after 3 seconds
            }
        });
}


export async function switchWorkspaceChannel(workspaceId: string) {
    if (!supabase) return;

    if (workspaceChannel) {
        await supabase.removeChannel(workspaceChannel);
        workspaceChannel = null;
    }
    
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
                window.dispatchEvent(new CustomEvent('ui-update', { detail: ['page'] }));
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
                window.dispatchEvent(new CustomEvent('ui-update', { detail: ['page'] }));
            }
        )
        .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') console.log(`Successfully subscribed to workspace channel for ${workspaceId}`);
            if (status === 'CHANNEL_ERROR' && err) console.error(`Failed to subscribe to workspace channel:`, err);
        });
}

export async function unsubscribeAll() {
    if (supabase) {
        await supabase.removeAllChannels();
        userChannel = null;
        workspaceChannel = null;
        console.log("Unsubscribed from all realtime channels.");
    }
}