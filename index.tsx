

import { state, saveState } from './state.ts';
import { setupEventListeners } from './eventListeners.ts';
import { renderApp } from './app-renderer.ts';
import { getTaskCurrentTrackedSeconds, formatDuration } from './utils.ts';
import { validateSession, logout } from './services/auth.ts';
import { apiFetch } from './services/api.ts';
import type { User, Workspace, WorkspaceMember, DashboardWidget, Invoice, InvoiceLineItem } from './types.ts';
import { initSupabase, subscribeToRealtimeUpdates } from './services/supabase.ts';
import { startOnboarding } from './handlers/onboarding.ts';


export async function fetchInitialData() {
    console.log("Fetching initial data from server...");
    
    const [
        profiles, projects, clients, tasks, deals, timeLogs, rawWorkspaces, rawWorkspaceMembers, dependencies, workspaceJoinRequests, notifications, dashboardWidgets, comments, taskAssignees, tags, taskTags, objectives, keyResults, dealNotes, invoices, invoiceLineItems
    ] = await Promise.all([
        apiFetch('/api/data/profiles'),
        apiFetch('/api/data/projects'),
        apiFetch('/api/data/clients'),
        apiFetch('/api/data/tasks'),
        apiFetch('/api/data/deals'),
        apiFetch('/api/data/time_logs'),
        apiFetch('/api/data/workspaces'),
        apiFetch('/api/data/workspace_members'),
        apiFetch('/api/data/task_dependencies'),
        apiFetch('/api/data/workspace_join_requests'),
        apiFetch('/api/data/notifications'),
        apiFetch('/api/data/dashboard_widgets'),
        apiFetch('/api/data/comments'),
        apiFetch('/api/data/task_assignees'),
        apiFetch('/api/data/tags'),
        apiFetch('/api/data/task_tags'),
        apiFetch('/api/data/objectives'),
        apiFetch('/api/data/key_results'),
        apiFetch('/api/data/deal_notes'),
        apiFetch('/api/data/invoices'),
        apiFetch('/api/data/invoice_line_items'),
    ]);

    // Populate state with fetched data
    state.users = profiles; 
    state.projects = projects;
    state.clients = clients;
    state.tasks = tasks;
    state.deals = deals;
    state.timeLogs = timeLogs;
    state.comments = comments;
    state.taskAssignees = taskAssignees;
    state.tags = tags;
    state.taskTags = taskTags;
    state.objectives = objectives;
    state.keyResults = keyResults;
    state.dealNotes = dealNotes;

    // Stitch together invoices and their line items
    const lineItemsByInvoiceId = new Map<string, InvoiceLineItem[]>();
    invoiceLineItems.forEach((item: InvoiceLineItem) => {
        if (!lineItemsByInvoiceId.has(item.invoiceId)) {
            lineItemsByInvoiceId.set(item.invoiceId, []);
        }
        lineItemsByInvoiceId.get(item.invoiceId)!.push(item);
    });

    state.invoices = invoices.map((invoice: Invoice) => ({
        ...invoice,
        items: lineItemsByInvoiceId.get(invoice.id) || []
    }));

    // Data from the API is now camelCase, but the Workspace type has a nested structure.
    // We still need to manually map this.
    state.workspaces = rawWorkspaces.map((w: any) => ({
        ...w,
        subscription: {
            planId: w.subscriptionPlanId,
            status: w.subscriptionStatus
        },
        planHistory: w.planHistory || []
    }));
    // All API data is now automatically converted to camelCase.
    state.workspaceMembers = rawWorkspaceMembers;
    state.dependencies = dependencies;
    state.workspaceJoinRequests = workspaceJoinRequests;
    state.notifications = notifications;
    state.dashboardWidgets = dashboardWidgets.sort((a: DashboardWidget, b: DashboardWidget) => (a.sortOrder || 0) - (b.sortOrder || 0));

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

    console.log("Initial data fetched and state populated.", state);
}

export async function bootstrapApp() {
    try {
        await fetchInitialData();
        // Sync the URL with the state determined by the data before rendering.
        // This prevents race conditions where the router sees an old URL.
        window.location.hash = `#/${state.currentPage}`;
        await renderApp();
    } catch (error) {
        console.error("Failed to fetch initial data:", error);
        document.getElementById('app')!.innerHTML = `
            <div class="empty-state">
                <h3>Failed to load application data</h3>
                <p>Could not connect to the server. Please check your connection and try again.</p>
            </div>
        `;
    }
}


async function init() {
    try {
        setupEventListeners(bootstrapApp);
        window.addEventListener('hashchange', renderApp);

        // validateSession will call initSupabase if needed.
        const user = await validateSession();
        if (user) {
            console.log("Session validated for user:", user);
            state.currentUser = user;
            await bootstrapApp();
            // After bootstrapping, we have the user and workspace, so we can subscribe.
            subscribeToRealtimeUpdates();
        } else {
            console.log("No valid session found. Showing auth page.");
            state.currentPage = 'auth';
            await renderApp();
        }
        
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