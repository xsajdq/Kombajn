

import { state, saveState } from './state.ts';
import { setupEventListeners } from './eventListeners.ts';
import { renderApp } from './app-renderer.ts';
import { getTaskCurrentTrackedSeconds, formatDuration } from './utils.ts';
import { validateSession, logout } from './services/auth.ts';
import { apiFetch } from './services/api.ts';
import type { User } from './types.ts';


export async function fetchInitialData() {
    console.log("Fetching initial data from server...");
    
    const [
        profiles, projects, clients, tasks, deals, timeLogs, workspaces, workspaceMembers, dependencies, dashboardWidgets
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
        apiFetch('/api/data/dashboard_widgets'),
    ]);

    // Populate state with fetched data
    state.users = profiles; 
    state.projects = projects;
    state.clients = clients;
    state.tasks = tasks;
    state.deals = deals;
    state.timeLogs = timeLogs;
    state.workspaces = workspaces;
    state.workspaceMembers = workspaceMembers;
    state.dependencies = dependencies;
    state.dashboardWidgets = dashboardWidgets;

    // Set the active workspace based on the current user's memberships
    const userWorkspaces = state.workspaceMembers.filter(m => m.userId === state.currentUser?.id);
    if (userWorkspaces.length > 0) {
        state.activeWorkspaceId = userWorkspaces[0].workspaceId;
    } else {
        // Handle case where user might not be in any workspace yet
        // This could involve prompting them to create or join one.
        console.warn("User is not a member of any workspace.");
        // For now, we might have to show a special state.
        // For simplicity, we'll log out if no workspace is found.
        await logout();
        return;
    }

    console.log("Initial data fetched and state populated.", state);
}

export async function bootstrapApp() {
    try {
        await fetchInitialData();
        renderApp();
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
    setupEventListeners();

    const user = await validateSession();
    if (user) {
        console.log("Session validated for user:", user);
        state.currentUser = user;
        await bootstrapApp();
    } else {
        console.log("No valid session found. Showing auth page.");
        state.currentPage = 'auth';
        renderApp();
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
}

init();