

import { getInitialState, setState, resetState, subscribe } from './state.ts';
import { setupEventListeners } from './eventListeners.ts';
import { renderApp, updateUI } from './app-renderer.ts';
import { getTaskCurrentTrackedSeconds, formatDuration } from './utils.ts';
import { initSupabase, subscribeToUserChannel, switchWorkspaceChannel, unsubscribeAll, supabase } from './services/supabase.ts';
import { startOnboarding } from './handlers/onboarding.ts';
import * as auth from './services/auth.ts';
import { fetchInitialData, fetchWorkspaceData } from './handlers/main.ts';
import type { Session } from '@supabase/supabase-js';
import { getState } from './state.ts';
import { t } from './i18n.ts';

let isBootstrapping = false;
let hasBootstrapped = false;

// This function now ONLY handles fetching data and setting state. It should THROW on error.
export async function bootstrapApp(session: Session) {
    if (isBootstrapping) return;
    isBootstrapping = true;
    
    // 1. Fetch core data needed for the shell (user, workspaces)
    await fetchInitialData(session);

    // 2. Determine active workspace
    const currentState = getState();
    const userWorkspaces = currentState.workspaceMembers.filter(m => m.userId === currentState.currentUser?.id);
    let activeWorkspaceId: string | null = null;
    let currentPage = currentState.currentPage;

    if (userWorkspaces.length > 0) {
        const lastActiveId = localStorage.getItem('activeWorkspaceId');
        const lastActiveWorkspaceExists = userWorkspaces.some(uw => uw.workspaceId === lastActiveId);
        activeWorkspaceId = (lastActiveId && lastActiveWorkspaceExists) ? lastActiveId : userWorkspaces[0].workspaceId;
        localStorage.setItem('activeWorkspaceId', activeWorkspaceId!);
        
        if (currentPage === 'auth' || currentPage === 'setup') {
            currentPage = 'dashboard';
        }
    } else {
        currentPage = 'setup';
        activeWorkspaceId = null;
        localStorage.removeItem('activeWorkspaceId');
    }
    
    setState({ activeWorkspaceId, currentPage }, []);
    history.replaceState({}, '', `/${currentPage}`);
    
    // 3. Fetch all detailed workspace data. If this fails, the error will be caught by main().
    if (activeWorkspaceId && currentPage !== 'setup') {
        await fetchWorkspaceData(activeWorkspaceId);
    }
    
    // 4. Subscribe to channels after fetching data
    if (getState().currentUser) await subscribeToUserChannel();
    if (activeWorkspaceId) await switchWorkspaceChannel(activeWorkspaceId);
    
    isBootstrapping = false;
}


async function main() {
    const app = document.getElementById('app')!;
    const showLoader = () => {
        app.innerHTML = `<div class="flex items-center justify-center h-screen"><div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div></div>`;
    };
    const showError = (message: string) => {
        app.innerHTML = `<div class="flex flex-col items-center justify-center h-screen text-center p-4">
            <h3 class="text-xl font-semibold mb-2">${t('errors.load_failed_title')}</h3>
            <p class="text-text-subtle mb-4 max-w-md">${message}</p>
            <button onclick="window.location.reload()" class="px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary-hover">${t('errors.refresh')}</button>
        </div>`;
    };

    showLoader();

    try {
        // Connect the state management to the UI renderer.
        subscribe(updateUI);
        
        setupEventListeners();
        window.addEventListener('popstate', () => {
            // When using browser back/forward, close any open side panels
            // and update all main layout components.
            setState(prevState => ({
                ui: {
                    ...prevState.ui,
                    openedProjectId: null,
                    openedClientId: null,
                    openedDealId: null,
                }
            }), ['page', 'sidebar', 'header', 'side-panel']);
        });

        await initSupabase();
        if (!supabase) throw new Error("Supabase client failed to initialize.");

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) console.error("Error getting initial session:", sessionError);

        if (session) {
            // 1. Fetch all data first.
            await bootstrapApp(session);
            hasBootstrapped = true;
            // 2. Then render the complete app with populated state.
            await renderApp();
            
            // 3. Handle post-render actions like onboarding
            const { workspaces, activeWorkspaceId } = getState();
            const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
            if (activeWorkspace && !activeWorkspace.onboardingCompleted) {
                setTimeout(() => startOnboarding(), 500);
            }
        } else {
            setState({ currentPage: 'auth' }, []);
            await renderApp();
        }
        
        supabase.auth.onAuthStateChange(async (event, session) => {
            // Set auth token for Realtime on sign-in or token refresh to prevent WebSocket errors
            if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
                if (supabase) {
                    supabase.realtime.setAuth(session.access_token);
                    console.log('Supabase Realtime auth token set/refreshed.');
                }
            }
        
            if (event === 'SIGNED_IN' && session && !hasBootstrapped) {
                showLoader();
                try {
                    await bootstrapApp(session);
                    hasBootstrapped = true;
                    await renderApp();
                    const { workspaces, activeWorkspaceId } = getState();
                    const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
                    if (activeWorkspace && !activeWorkspace.onboardingCompleted) {
                        setTimeout(() => startOnboarding(), 500);
                    }
                } catch (error) {
                    showError((error as Error).message);
                }
            } else if (event === 'SIGNED_OUT') {
                if (supabase) {
                    supabase.realtime.setAuth(null); // Important to clear the token on sign out
                }
                await unsubscribeAll();
                isBootstrapping = false;
                hasBootstrapped = false;
                resetState();
                setState({ currentUser: null, currentPage: 'auth' }, []);
                await renderApp();
            }
        });
        
        setInterval(() => {
            try {
                const { ui, activeTimers, tasks, currentPage } = getState();
                const { isRunning, startTime } = ui.globalTimer;
                if (isRunning && startTime) {
                    const elapsedSeconds = (Date.now() - startTime) / 1000;
                    const formattedTime = formatDuration(elapsedSeconds);
                    const display = document.getElementById('global-timer-display');
                    if (display && display.textContent !== formattedTime) display.textContent = formattedTime;
                }
                
                if (Object.keys(activeTimers).length === 0 && !ui.openedProjectId && currentPage !== 'dashboard') return;

                Object.keys(activeTimers).forEach(taskId => {
                    const task = tasks.find(t => t.id === taskId);
                    if (task) {
                        const currentSeconds = getTaskCurrentTrackedSeconds(task);
                        const formattedTime = formatDuration(currentSeconds);
                         document.querySelectorAll(`[data-timer-task-id="${taskId}"] .task-tracked-time, [data-task-id="${taskId}"] .task-tracked-time`).forEach(el => {
                            if (el.textContent !== formattedTime) el.textContent = formattedTime;
                        });
                    }
                });

                if (ui.openedProjectId) {
                    const projectTotalTimeEl = document.querySelector<HTMLElement>('.project-total-time');
                    if (projectTotalTimeEl) {
                        const projectTasks = tasks.filter(t => t.projectId === ui.openedProjectId);
                        const totalSeconds = projectTasks.reduce((sum, task) => sum + getTaskCurrentTrackedSeconds(task), 0);
                        const formattedTotalTime = formatDuration(totalSeconds);
                        if (projectTotalTimeEl.textContent !== formattedTotalTime) projectTotalTimeEl.textContent = formattedTotalTime;
                    }
                }
            } catch (error) {
                console.error("Error inside setInterval timer update:", error);
                // This catch block prevents the interval from crashing the app.
            }
        }, 1000);
    } catch (error) {
        console.error("Application initialization failed:", error);
        const errorMessage = (error as Error).message || t('errors.init_failed_message');
        showError(errorMessage);
    }
}

main();