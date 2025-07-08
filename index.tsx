
import { state, saveState } from './state.ts';
import { setupEventListeners } from './eventListeners.ts';
import { renderApp } from './app-renderer.ts';
import { getTaskCurrentTrackedSeconds, formatDuration } from './utils.ts';
import { closeSidePanels, closeModal } from './handlers/ui.ts';
import type { User } from './types.ts';

// The 'storage' event listener is no longer needed because the backend API
// is now the single source of truth, not localStorage.

async function fetchInitialData() {
    console.log("Fetching initial data from server...");
    try {
        // In a real app with authentication, you would first get the current user.
        // For now, we'll simulate fetching all data for a default view.
        const [
            profiles, projects, clients, tasks, deals, timeLogs, workspaces, workspaceMembers
        ] = await Promise.all([
            fetch('/api/data/profiles').then(res => res.json()), // Corrected from 'users' to 'profiles'
            fetch('/api/data/projects').then(res => res.json()),
            fetch('/api/data/clients').then(res => res.json()),
            fetch('/api/data/tasks').then(res => res.json()),
            fetch('/api/data/deals').then(res => res.json()),
            fetch('/api/data/time_logs').then(res => res.json()),
            fetch('/api/data/workspaces').then(res => res.json()),
            fetch('/api/data/workspace_members').then(res => res.json()),
            // Fetch other resources as needed...
        ]);

        // Note: This is a temporary assignment. The `profiles` table might not have all fields of the `User` type.
        // Once authentication is added, this will be handled differently.
        state.users = profiles; 
        state.projects = projects;
        state.clients = clients;
        state.tasks = tasks;
        state.deals = deals;
        state.timeLogs = timeLogs;
        state.workspaces = workspaces;
        state.workspaceMembers = workspaceMembers;

        // Simulate logging in as the first user and selecting the first workspace
        if (state.users.length > 0) {
            // Simplified login simulation until proper auth is in place
            state.currentUser = state.users[0]; 
        }
        if (state.workspaces.length > 0) {
            state.activeWorkspaceId = state.workspaces[0].id;
        }

        console.log("Initial data fetched and state populated.", state);
        renderApp();
    } catch (error) {
        console.error("Failed to fetch initial data:", error);
        // Display an error message to the user
        document.getElementById('app')!.innerHTML = `
            <div class="empty-state">
                <h3>Failed to load application data</h3>
                <p>Could not connect to the server. Please check your connection and try again.</p>
            </div>
        `;
    }
}


// --- INITIALIZATION ---
function init() {
    setupEventListeners();
    fetchInitialData(); // Fetch data instead of loading from localStorage

    window.addEventListener('hashchange', () => { 
        closeSidePanels(false); // don't re-render here, renderApp below will do it
        closeModal(false); // don't re-render here
        renderApp(); 
    });
    window.addEventListener('popstate', () => { 
        closeSidePanels(false); // don't re-render here
        closeModal(false); // don't re-render here
        renderApp(); 
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
}

init();