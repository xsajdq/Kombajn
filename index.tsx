
import { state, getInitialState } from './state.ts';
import { setupEventListeners } from './eventListeners.ts';
import { renderApp } from './app-renderer.ts';
import { getTaskCurrentTrackedSeconds, formatDuration } from './utils.ts';
import { apiFetch } from './services/api.ts';
import type { User, Workspace, WorkspaceMember, DashboardWidget, Invoice, InvoiceLineItem, Integration, ClientContact, Client, Notification } from './types.ts';
import { initSupabase, subscribeToRealtimeUpdates, unsubscribeAll, supabase } from './services/supabase.ts';
import { startOnboarding } from './handlers/onboarding.ts';

let isBootstrapping = false;

export async function fetchInitialData() {
    console.log("Fetching initial data from server via bootstrap...");
    
    console.log("Bootstrap API call started.");
    const data = await apiFetch('/api/bootstrap');
    console.log("Bootstrap API call finished.");

    if (!data) {
        throw new Error("Bootstrap data is null or undefined.");
    }
    
    // Set the current user first. This is crucial.
    if (!data.currentUser) {
        throw new Error("Bootstrap data is missing current user profile.");
    }
    state.currentUser = data.currentUser;
    
    // Populate state with fetched data
    state.users = data.profiles || [];
    state.workspaceJoinRequests = data.workspaceJoinRequests || [];
    state.dashboardWidgets = (data.dashboardWidgets || []).sort((a: DashboardWidget, b: DashboardWidget) => (a.sortOrder || 0) - (b.sortOrder || 0));

    // Manually map workspace structure to create nested subscription object
    state.workspaces = (data.workspaces || []).map((w: any) => ({
        ...w,
        subscription: {
            planId: w.subscriptionPlanId,
            status: w.subscriptionStatus
        },
        planHistory: w.planHistory || []
    }));
    state.workspaceMembers = data.workspaceMembers || [];

    // Merge fetched notifications with any that have arrived via realtime, to prevent overwriting.
    const existingNotificationIds = new Set(state.notifications.map(n => n.id));
    const newNotificationsFromFetch = (data.notifications || []).filter((n: Notification) => !existingNotificationIds.has(n.id));
    state.notifications.push(...newNotificationsFromFetch);

    // Set the active workspace based on the current user's memberships
    const userWorkspaces = state.workspaceMembers.filter(m => m.userId === state.currentUser?.id);
    if (userWorkspaces.length > 0) {
        const lastActiveId = localStorage.getItem('activeWorkspaceId');
        const lastActiveWorkspaceExists = userWorkspaces.some(uw => uw.workspaceId === lastActiveId);
        
        if (lastActiveId && lastActiveWorkspaceExists) {
            state.activeWorkspaceId = lastActiveId;
        } else {
            state.activeWorkspaceId = userWorkspaces[0].workspaceId;
            localStorage.setItem('activeWorkspaceId', state.activeWorkspaceId);
        }
        
        // If user is on the auth/setup page but has workspaces, redirect to dashboard.
        if (state.currentPage === 'auth' || state.currentPage === 'setup') {
            state.currentPage = 'dashboard';
        }
    } else {
        // If user has no workspace, show the setup page.
        state.currentPage = 'setup';
        state.activeWorkspaceId = null; // Ensure it's null
        localStorage.removeItem('activeWorkspaceId');
    }

    // After setting the active workspace, check if onboarding is needed.
    const activeWorkspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    if (activeWorkspace && !activeWorkspace.onboardingCompleted) {
        // Delay slightly to ensure the initial page render is complete
        setTimeout(() => startOnboarding(), 500);
    }

    console.log("Initial data fetched and state populated.");
}

export async function bootstrapApp() {
    if (isBootstrapping) {
        console.warn("Bootstrap called while already in progress.");
        return;
    }
    isBootstrapping = true;

    // Show loading indicator immediately.
    document.getElementById('app')!.innerHTML = `
        <div class="global-loader">
            <div class="loading-container">
                <div class="loading-progress-bar"></div>
                <p>Loading your workspace...</p>
            </div>
        </div>`;
        
    try {
        // fetchInitialData now handles getting the user and all other data in one call.
        await fetchInitialData();
        
        console.log("Rendering app for the first time...");
        history.replaceState({}, '', `/${state.currentPage}`);
        await renderApp();
        subscribeToRealtimeUpdates();
    } catch (error) {
        console.error("Failed to fetch initial data:", error);
        document.getElementById('app')!.innerHTML = `
            <div class="empty-state">
                <h3>Failed to load application data</h3>
                <p>Could not connect to the server. Please check your connection and try again.</p>
                <p>Error: ${(error as Error).message}</p>
            </div>
        `;
    } finally {
        isBootstrapping = false;
    }
}


async function init() {
    try {
        setupEventListeners(bootstrapApp);
        window.addEventListener('popstate', renderApp);
        window.addEventListener('state-change-realtime', renderApp as EventListener);

        await initSupabase();
        if (!supabase) {
            throw new Error("Supabase client failed to initialize.");
        }

        supabase.auth.onAuthStateChange(async (event, session) => {
            console.log(`Auth event: ${event}`);

            if (event === 'SIGNED_IN' || (event === 'INITIAL_SESSION' && session)) {
                if (isBootstrapping) {
                    console.log("Bootstrap already in progress, skipping.");
                    return;
                }
                // The only responsibility of this handler is to start the bootstrap process.
                await bootstrapApp();
                
            } else if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
                await unsubscribeAll();
                isBootstrapping = false;

                const initialAppState = getInitialState();
                Object.assign(state, initialAppState);
                
                state.currentUser = null;
                state.currentPage = 'auth';
                
                await renderApp();
            }
        });
        
        // Timer update interval
        setInterval(() => {
            if (Object.keys(state.activeTimers).length === 0 && !state.ui.openedProjectId && state.currentPage !== 'dashboard') return;

            Object.keys(state.activeTimers).forEach(taskId => {
                const task = state.tasks.find(t => t.id === taskId);
                if (task) {
                    const currentSeconds = getTaskCurrentTrackedSeconds(task);
                    const formattedTime = formatDuration(currentSeconds);
                     document.querySelectorAll(`[data-timer-task-id="${taskId}"] .task-tracked-time, [data-task-id="${taskId}"] .task-tracked-time`).forEach(el => {
                        if (el.textContent !== formattedTime) {
                           el.textContent = formattedTime;
                        }
                    });
                }
            });

            if (state.ui.openedProjectId) {
                const projectTotalTimeEl = document.querySelector<HTMLElement>('.project-total-time');
                if (projectTotalTimeEl) {
                    const projectTasks = state.tasks.filter(t => t.projectId === state.ui.openedProjectId);
                    const totalSeconds = projectTasks.reduce((sum, task) => sum + getTaskCurrentTrackedSeconds(task), 0);
                    const formattedTotalTime = formatDuration(totalSeconds);
                    if (projectTotalTimeEl.textContent !== formattedTotalTime) {
                        projectTotalTimeEl.textContent = formattedTotalTime;
                    }
                }
            }
        }, 1000);
    } catch (error) {
        console.error("Application initialization failed:", error);
        const errorMessage = (error as Error).message || 'Could not initialize the application. Please check your connection and configuration.';
        document.getElementById('app')!.innerHTML = `
            <div class="empty-state">
                <h3>Failed to load application data</h3>
                <p>${errorMessage}</p>
            </div>
        `;
    }
}

init();
