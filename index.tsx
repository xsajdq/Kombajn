import { state, getInitialState } from './state.ts';
import { setupEventListeners } from './eventListeners.ts';
import { renderApp, updateUI } from './app-renderer.ts';
import { getTaskCurrentTrackedSeconds, formatDuration } from './utils.ts';
import { initSupabase, subscribeToUserChannel, switchWorkspaceChannel, unsubscribeAll, supabase } from './services/supabase.ts';
import { startOnboarding } from './handlers/onboarding.ts';
import * as auth from './services/auth.ts';
import { fetchInitialData, fetchWorkspaceData } from './handlers/main.ts';
import type { Session } from '@supabase/supabase-js';

let isBootstrapping = false;
let appInitialized = false;

export async function bootstrapApp(session: Session) {
    if (isBootstrapping || appInitialized) return;
    isBootstrapping = true;
    
    try {
        // 1. Fetch core data needed for the shell (user, workspaces)
        await fetchInitialData(session);

        // 2. Determine active workspace
        const userWorkspaces = state.workspaceMembers.filter(m => m.userId === state.currentUser?.id);
        if (userWorkspaces.length > 0) {
            const lastActiveId = localStorage.getItem('activeWorkspaceId');
            const lastActiveWorkspaceExists = userWorkspaces.some(uw => uw.workspaceId === lastActiveId);
            state.activeWorkspaceId = (lastActiveId && lastActiveWorkspaceExists) ? lastActiveId : userWorkspaces[0].workspaceId;
            localStorage.setItem('activeWorkspaceId', state.activeWorkspaceId!);
            
            if (state.currentPage === 'auth' || state.currentPage === 'setup') state.currentPage = 'dashboard';
        } else {
            state.currentPage = 'setup';
            state.activeWorkspaceId = null;
            localStorage.removeItem('activeWorkspaceId');
        }

        history.replaceState({}, '', `/${state.currentPage}`);
        
        // 3. Set loading state and render the app shell (with a loading indicator in the dashboard)
        if (state.activeWorkspaceId && state.currentPage !== 'setup') {
            state.ui.dashboard.isLoading = true;
        }
        await renderApp(); // Render the shell

        // 4. Fetch the detailed workspace data in the background
        if (state.activeWorkspaceId && state.currentPage !== 'setup') {
            await fetchWorkspaceData(state.activeWorkspaceId);
            state.ui.dashboard.isLoading = false;
            updateUI(['page']); // Re-render ONLY the page content with the new data
        }
        
        // 5. Subscribe to channels and handle onboarding
        if (state.currentUser) await subscribeToUserChannel();
        if (state.activeWorkspaceId) await switchWorkspaceChannel(state.activeWorkspaceId);
        
        const activeWorkspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
        if (activeWorkspace && !activeWorkspace.onboardingCompleted) {
            setTimeout(() => startOnboarding(), 500);
        }
        
        appInitialized = true;
    } catch (error) {
        console.error(">>> BOOTSTRAP FAILED <<<", error);
        await auth.logout();
    } finally {
        isBootstrapping = false;
    }
}


async function main() {
    // The app shell will be rendered first, with its own internal loading state.
    // This avoids a jarring full-screen loader.

    try {
        setupEventListeners();
        window.addEventListener('popstate', () => updateUI(['page', 'sidebar']));
        window.addEventListener('ui-update', (e: CustomEvent) => updateUI(e.detail));

        await initSupabase();
        if (!supabase) throw new Error("Supabase client failed to initialize.");

        // Handle the initial session on page load
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) console.error("Error getting initial session:", sessionError);

        if (session) {
            await bootstrapApp(session);
        } else {
            state.currentPage = 'auth';
            await renderApp();
        }
        
        // Listen for subsequent auth changes
        supabase.auth.onAuthStateChange(async (event, session) => {
            console.log(`Auth event: ${event}`);

            if (event === 'SIGNED_IN' && session) {
                // If user just signed in, bootstrap the app. The guard inside bootstrapApp will prevent re-runs.
                await bootstrapApp(session);
            } else if (event === 'SIGNED_OUT') {
                await unsubscribeAll();
                isBootstrapping = false;
                appInitialized = false;
                Object.assign(state, getInitialState());
                state.currentUser = null;
                state.currentPage = 'auth';
                await renderApp();
            }
        });
        
        // Timer update interval
        setInterval(() => {
            const { isRunning, startTime } = state.ui.globalTimer;
            if (isRunning && startTime) {
                const elapsedSeconds = (Date.now() - startTime) / 1000;
                const formattedTime = formatDuration(elapsedSeconds);
                const display = document.getElementById('global-timer-display');
                if (display && display.textContent !== formattedTime) display.textContent = formattedTime;
            }
            
            if (Object.keys(state.activeTimers).length === 0 && !state.ui.openedProjectId && state.currentPage !== 'dashboard') return;

            Object.keys(state.activeTimers).forEach(taskId => {
                const task = state.tasks.find(t => t.id === taskId);
                if (task) {
                    const currentSeconds = getTaskCurrentTrackedSeconds(task);
                    const formattedTime = formatDuration(currentSeconds);
                     document.querySelectorAll(`[data-timer-task-id="${taskId}"] .task-tracked-time, [data-task-id="${taskId}"] .task-tracked-time`).forEach(el => {
                        if (el.textContent !== formattedTime) el.textContent = formattedTime;
                    });
                }
            });

            if (state.ui.openedProjectId) {
                const projectTotalTimeEl = document.querySelector<HTMLElement>('.project-total-time');
                if (projectTotalTimeEl) {
                    const projectTasks = state.tasks.filter(t => t.projectId === state.ui.openedProjectId);
                    const totalSeconds = projectTasks.reduce((sum, task) => sum + getTaskCurrentTrackedSeconds(task), 0);
                    const formattedTotalTime = formatDuration(totalSeconds);
                    if (projectTotalTimeEl.textContent !== formattedTotalTime) projectTotalTimeEl.textContent = formattedTotalTime;
                }
            }
        }, 1000);
    } catch (error) {
        console.error("Application initialization failed:", error);
        const errorMessage = (error as Error).message || 'Could not initialize the application.';
        document.getElementById('app')!.innerHTML = `<div class="empty-state"><h3>Failed to load application</h3><p>${errorMessage}</p></div>`;
    }
}

main();