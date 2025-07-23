import { state, getInitialState } from './state.ts';
import { setupEventListeners } from './eventListeners.ts';
import { renderApp, updateUI } from './app-renderer.ts';
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
    console.log("Fetching core data...");
    const data = await apiFetch('/api?action=bootstrap', {}, session);

    if (!data) throw new Error("Bootstrap data is null or undefined.");
    
    state.currentUser = data.currentUser;
    if (!state.currentUser) throw new Error("Bootstrap data is missing current user profile.");

    state.users = data.profiles || [];
    state.workspaces = (data.workspaces || []).map((w: any) => ({
        ...w,
        subscription: { planId: w.subscriptionPlanId, status: w.subscriptionStatus },
        planHistory: w.planHistory || []
    }));
    state.workspaceMembers = data.workspaceMembers || [];
    state.workspaceJoinRequests = data.workspaceJoinRequests || [];
    
    // Notifications and integrations are global to the user, load them here.
    state.notifications = data.notifications || [];
    state.integrations = data.integrations || [];
    state.filterViews = [];
    
    console.log("Core data fetched successfully.");
}

async function fetchWorkspaceData(workspaceId: string) {
    console.log(`Fetching data for workspace ${workspaceId}...`);
    
    // Mark dashboard as loading for this workspace
    state.ui.dashboard.isLoading = true;
    updateUI(['page']);

    try {
        const [
            dashboardWidgetsRes, projectsRes, tasksRes, clientsRes, invoicesRes, timeLogsRes, commentsRes,
        ] = await Promise.all([
            apiFetch(`/api?action=data&resource=dashboard_widgets&userId=${state.currentUser?.id}`),
            apiFetch(`/api?action=data&resource=projects&workspaceId=${workspaceId}`),
            apiFetch(`/api?action=data&resource=tasks&workspaceId=${workspaceId}`),
            apiFetch(`/api?action=data&resource=clients&workspaceId=${workspaceId}`),
            apiFetch(`/api?action=data&resource=invoices&workspaceId=${workspaceId}`),
            apiFetch(`/api?action=data&resource=time_logs&workspaceId=${workspaceId}`),
            apiFetch(`/api?action=data&resource=comments&workspaceId=${workspaceId}`),
        ]);
        
        state.dashboardWidgets = (dashboardWidgetsRes || []).sort((a: DashboardWidget, b: DashboardWidget) => (a.sortOrder || 0) - (b.sortOrder || 0));
        state.projects = projectsRes || [];
        state.tasks = tasksRes || [];
        state.clients = clientsRes || [];
        state.invoices = invoicesRes || [];
        state.timeLogs = timeLogsRes || [];
        state.comments = commentsRes || [];

        // Fix: Fetch invoice line items separately and attach them to invoices
        if (state.invoices.length > 0) {
            const invoiceIds = state.invoices.map(i => i.id);
            const lineItems: InvoiceLineItem[] = await apiFetch(`/api?action=data&resource=invoice_line_items&invoiceId=in.(${invoiceIds.join(',')})`);
            
            const lineItemsByInvoiceId = new Map<string, InvoiceLineItem[]>();
            for (const item of lineItems) {
                if (!lineItemsByInvoiceId.has(item.invoiceId)) {
                    lineItemsByInvoiceId.set(item.invoiceId, []);
                }
                lineItemsByInvoiceId.get(item.invoiceId)!.push(item);
            }

            for (const invoice of state.invoices) {
                invoice.items = lineItemsByInvoiceId.get(invoice.id) || [];
            }
        }
        
        // This is a simplified fetch for dashboard dependencies, more granular fetches will happen on page loads
        const [taskAssigneesRes, projectSectionsRes, taskViewsRes] = await Promise.all([
             apiFetch(`/api?action=data&resource=task_assignees&workspaceId=${workspaceId}`),
             apiFetch(`/api?action=data&resource=project_sections&workspaceId=${workspaceId}`),
             apiFetch(`/api?action=data&resource=task_views&workspaceId=${workspaceId}`),
        ]);
        
        state.taskAssignees = taskAssigneesRes || [];
        state.projectSections = projectSectionsRes || [];
        state.taskViews = taskViewsRes || [];

        state.ui.dashboard.loadedWorkspaceId = workspaceId;
        console.log(`Successfully fetched data for workspace ${workspaceId}.`);
    } catch (error) {
        console.error("Failed to fetch workspace data:", error);
    } finally {
        state.ui.dashboard.isLoading = false;
        // Don't call render here, the caller will handle it.
    }
}


export async function bootstrapApp(session: Session) {
    if (isBootstrapping) return;
    isBootstrapping = true;

    document.getElementById('app')!.innerHTML = `<div class="fixed inset-0 bg-background flex items-center justify-center"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>`;
        
    try {
        await fetchInitialData(session);

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

        if (state.activeWorkspaceId) {
            await fetchWorkspaceData(state.activeWorkspaceId);
        }

        history.replaceState({}, '', `/${state.currentPage}`);
        await renderApp();
        
        if (state.currentUser) subscribeToUserChannel();
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


async function init() {
    try {
        setupEventListeners();
        window.addEventListener('popstate', () => updateUI(['page', 'sidebar']));
        window.addEventListener('ui-update', (e: CustomEvent) => updateUI(e.detail));

        await initSupabase();
        if (!supabase) throw new Error("Supabase client failed to initialize.");

        supabase.auth.onAuthStateChange(async (event, session) => {
            console.log(`Auth event: ${event}`);

            if (event === 'SIGNED_IN' || (event === 'INITIAL_SESSION' && session)) {
                if (appInitialized || isBootstrapping) return;
                await bootstrapApp(session);
            } else if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
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

init();