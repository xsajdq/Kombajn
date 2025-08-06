

import { getState, setState } from './state.ts';
import { ProjectsPage } from './pages/ProjectsPage.ts';
import { ClientsPage, initClientsPage } from './pages/ClientsPage.ts';
import { TasksPage, initTasksPage } from './pages/TasksPage.ts';
import { ReportsPage } from './pages/ReportsPage.ts';
import { InvoicesPage, initInvoicesPage } from './pages/InvoicesPage.ts';
import { AIAssistantPage } from './pages/AIAssistantPage.ts';
import { SettingsPage } from './pages/SettingsPage.ts';
import { DashboardPage } from './pages/DashboardPage.ts';
import { HRPage } from './pages/TeamPage.ts';
import { BillingPage } from './pages/BillingPage.ts';
import { ChatPage } from './pages/ChatPage.ts';
import { TeamCalendarPage, initTeamCalendarPage } from './pages/TeamCalendarPage.ts';
import { SalesPage, initSalesPage } from './pages/SalesPage.ts';
import { AuthPage } from './pages/AuthPage.ts';
import type { AppState } from './types.ts';
import { can } from './permissions.ts';
import { openProjectPanel, openClientPanel, openDealPanel, showModal } from './handlers/ui.ts';
import { updateUI } from './app-renderer.ts';
import { GoalsPage } from './pages/GoalsPage.ts';
import { InventoryPage } from './pages/InventoryPage.ts';
import { BudgetPage } from './pages/BudgetPage.ts';

export async function router() {
    let state = getState();
    // If no user is authenticated, always show the authentication page.
    if (!state.currentUser) {
        setState({ currentPage: 'auth' }, []);
        return AuthPage();
    }
    
    if (state.currentPage === 'setup') {
        return AuthPage({ isSetup: true });
    }

    const path = window.location.pathname || '/';
    const pathSegments = path.split('/').filter(p => p);
    const [page, id] = pathSegments;
    
    const isCustomTaskView = page === 'task-view';
    const newPage = isCustomTaskView ? 'tasks' : (page || 'dashboard') as AppState['currentPage'];
    
    // Update state without triggering re-render, as this function is called during a render cycle.
    setState(prevState => ({
        currentPage: newPage,
        ui: {
            ...prevState.ui,
            activeTaskViewId: isCustomTaskView ? id : null
        }
    }), []);
    
    // This part handles opening a detail view from a direct URL load (deep linking).
    // Re-fetch state after potential update.
    state = getState();
    if (id && !isCustomTaskView) {
        switch (newPage) {
            case 'projects':
                if (state.ui.openedProjectId !== id) openProjectPanel(id);
                break;
            case 'clients':
                if (state.ui.openedClientId !== id) openClientPanel(id);
                break;
            case 'tasks':
                if (!state.ui.modal.isOpen || state.ui.modal.type !== 'taskDetail' || state.ui.modal.data?.taskId !== id) {
                    showModal('taskDetail', { taskId: id });
                }
                break;
            case 'sales':
                if (state.ui.openedDealId !== id) openDealPanel(id);
                break;
        }
    }

    // This router now guards every route with a permission check.
    // If a user doesn't have permission, they are redirected to the dashboard.
    // The sidebar logic in tandem with this prevents users from seeing or accessing unauthorized pages.
    switch (newPage) {
        case 'projects':        return can('view_projects') ? ProjectsPage() : DashboardPage();
        case 'clients':         await initClientsPage(); return can('view_clients') ? ClientsPage() : DashboardPage();
        case 'tasks':           await initTasksPage(); return can('view_tasks') ? TasksPage() : DashboardPage();
        case 'team-calendar':   await initTeamCalendarPage(); return can('view_team_calendar') ? await TeamCalendarPage() : DashboardPage();
        case 'reports':         return can('view_reports') ? ReportsPage() : DashboardPage();
        case 'sales':           await initSalesPage(); return can('view_sales') ? SalesPage() : DashboardPage();
        case 'invoices':        await initInvoicesPage(); return can('view_invoices') ? InvoicesPage() : DashboardPage();
        case 'ai-assistant':    return can('view_ai_assistant') ? AIAssistantPage() : DashboardPage();
        case 'settings':        return can('view_settings') ? SettingsPage() : DashboardPage();
        case 'chat':            return can('view_chat') ? ChatPage() : DashboardPage();
        case 'hr':              return can('view_hr') ? await HRPage() : DashboardPage();
        case 'billing':         return can('manage_billing') ? BillingPage() : DashboardPage();
        case 'goals':           return can('view_goals') ? GoalsPage() : DashboardPage();
        case 'inventory':       return can('view_inventory') ? InventoryPage() : DashboardPage();
        case 'budget-and-expenses': return can('view_budgets') ? BudgetPage() : DashboardPage();
        case 'auth':            return AuthPage(); // Fallback case
        case 'dashboard':
        default:
            return can('view_dashboard') ? DashboardPage() : ProjectsPage(); // Default to projects if dashboard is disabled
    }
}