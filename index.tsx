
import { state, getInitialState } from './state.ts';
import { setupEventListeners } from './eventListeners.ts';
import { renderApp } from './app-renderer.ts';
import { getTaskCurrentTrackedSeconds, formatDuration } from './utils.ts';
import { apiFetch } from './services/api.ts';
import type { User, Workspace, WorkspaceMember, DashboardWidget, Invoice, InvoiceLineItem, Integration, ClientContact, Client, Notification, FilterView } from './types.ts';
import { initSupabase, subscribeToUserChannel, switchWorkspaceChannel, unsubscribeAll, supabase } from './services/supabase.ts';
import { startOnboarding } from './handlers/onboarding.ts';
import * as auth from './services/auth.ts';
import type { Session } from '@supabase/supabase-js';

let isBootstrapping = false;
let appInitialized = false;

export async function fetchInitialData(session: Session) {
    console.log("Fetching initial data from server via bootstrap...");
    
    console.log("Bootstrap API call started.");
    const data = await apiFetch('/api?action=bootstrap', {}, session);
    console.log("Bootstrap API call finished. Data received:", !!data);

    if (!data) {
        console.error("Bootstrap data received from API is null or undefined.");
        throw new Error("Bootstrap data is null or undefined.");
    }
    
    console.log("Bootstrap data keys:", Object.keys(data));

    // Set the current user first. This is crucial.
    if (!data.currentUser) {
        console.error("Bootstrap data is missing 'currentUser' property.");
        throw new Error("Bootstrap data is missing current user profile.");
    }
    console.log("Setting current user:", data.currentUser.id);
    state.currentUser = data.currentUser;
    
    // Populate state with essential bootstrap data
    console.log("Populating state with other bootstrap data...");
    state.users = data.profiles || [];
    state.workspaceJoinRequests = data.workspaceJoinRequests || [];
    state.dashboardWidgets = (data.dashboardWidgets || []).sort((a: DashboardWidget, b: DashboardWidget) => (a.sortOrder || 0) - (b.sortOrder || 0));
    state.integrations = data.integrations || [];
    state.filterViews = []; // Removed non-existent table data

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

    // Populate all operational data
    state.projects = data.projects || [];
    state.tasks = data.tasks || [];
    state.projectSections = data.projectSections || [];
    state.taskViews = data.taskViews || [];
    state.clients = data.clients || [];
    state.deals = data.deals || [];
    state.timeLogs = data.timeLogs || [];
    state.comments = data.comments || [];
    state.taskAssignees = data.taskAssignees || [];
    state.tags = data.tags || [];
    state.taskTags = data.taskTags || [];
    state.objectives = data.objectives || [];
    state.keyResults = data.keyResults || [];
    state.dealNotes = data.dealNotes || [];
    state.invoices = data.invoices || [];
    state.expenses = data.expenses || [];
    state.projectMembers = data.projectMembers || [];
    state.dependencies = data.dependencies || [];

    // Set the active workspace based on the current user's memberships
    console.log("Determining active workspace...");
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
        console.log("Active workspace set to:", state.activeWorkspaceId);

        // Since we loaded all data, mark pages as loaded for this workspace
        const loadedId = state.activeWorkspaceId;
        state.ui.dashboard.loadedWorkspaceId = loadedId;
        state.ui.projects.loadedWorkspaceId = loadedId;
        state.ui.tasks.loadedWorkspaceId = loadedId;
        state.ui.clients.loadedWorkspaceId = loadedId;
        state.ui.invoices.loadedWorkspaceId = loadedId;
        state.ui.sales.loadedWorkspaceId = loadedId;

        
        // If user is on the auth/setup page but has workspaces, redirect to dashboard.
        if (state.currentPage === 'auth' || state.currentPage === 'setup') {
            state.currentPage = 'dashboard';
        }
    } else {
        // If user has no workspace, show the setup page.
        console.log("User has no workspaces. Directing to setup.");
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

    console.log("Successfully populated state from bootstrap data.");
}

export async function bootstrapApp(session: Session) {
    if (isBootstrapping) {
        console.warn("Bootstrap called while already in progress.");
        return;
    }
    isBootstrapping = true;

    // Show loading indicator immediately.
    document.getElementById('app')!.innerHTML = `
        <div class="fixed inset-0 bg-background flex flex-col items-center justify-center text-text-main font-sans">
            <div class="w-full max-w-xs text-center p-4">
                <div class="w-full bg-border-color rounded-full h-1.5 mb-4 overflow-hidden">
                    <div class="bg-primary h-1.5 rounded-full animate-pulse" style="width: 75%"></div>
                </div>
                <p class="text-sm">Loading your workspace...</p>
            </div>
        </div>`;
        
    try {
        // fetchInitialData now handles getting the user and all other data in one call.
        await fetchInitialData(session);
        
        console.log("Rendering app for the first time...");
        history.replaceState({}, '', `/${state.currentPage}`);
        await renderApp();
        console.log("Initial render complete. Subscribing to realtime updates.");
        
        // Subscribe to user and workspace channels
        if (state.currentUser) {
            subscribeToUserChannel();
        }
        if (state.activeWorkspaceId) {
            await switchWorkspaceChannel(state.activeWorkspaceId);
        }
        
        appInitialized = true;
    } catch (error) {
        console.error(">>> BOOTSTRAP FAILED <<<", error);
        // If bootstrap fails, log the user out to reset the state and prevent being stuck.
        // The onAuthStateChange handler will catch the SIGNED_OUT event and render the login page.
        await auth.logout();
    } finally {
        isBootstrapping = false;
    }
}


async function init() {
    try {
        setupEventListeners();
        window.addEventListener('popstate', renderApp);
        window.addEventListener('state-change-realtime', renderApp as EventListener);

        await initSupabase();
        if (!supabase) {
            throw new Error("Supabase client failed to initialize.");
        }

        supabase.auth.onAuthStateChange(async (event, session) => {
            console.log(`Auth event: ${event}`);

            if (event === 'SIGNED_IN' || (event === 'INITIAL_SESSION' && session)) {
                if (appInitialized || isBootstrapping) {
                    console.log("Bootstrap skipped (already initialized or in progress).");
                    return;
                }
                // The only responsibility of this handler is to start the bootstrap process.
                await bootstrapApp(session);
                
            } else if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
                await unsubscribeAll();
                isBootstrapping = false;
                appInitialized = false;

                const initialAppState = getInitialState();
                Object.assign(state, initialAppState);
                
                state.currentUser = null;
                state.currentPage = 'auth';
                
                await renderApp();
            }
        });
        
        // Timer update interval
        setInterval(() => {
            // Update Global Timer
            const { isRunning, startTime } = state.ui.globalTimer;
            if (isRunning && startTime) {
                const elapsedSeconds = (Date.now() - startTime) / 1000;
                const formattedTime = formatDuration(elapsedSeconds);
                const display = document.getElementById('global-timer-display');
                if (display && display.textContent !== formattedTime) {
                    display.textContent = formattedTime;
                }
            }
            
            // Update Task-specific Timers
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