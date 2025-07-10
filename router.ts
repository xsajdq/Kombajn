

import { state } from './state.ts';
import { ProjectsPage } from './pages/ProjectsPage.ts';
import { ClientsPage } from './pages/ClientsPage.ts';
import { TasksPage } from './pages/TasksPage.ts';
import { ReportsPage } from './pages/ReportsPage.ts';
import { InvoicesPage } from './pages/InvoicesPage.ts';
import { AIAssistantPage } from './pages/AIAssistantPage.ts';
import { SettingsPage } from './pages/SettingsPage.ts';
import { DashboardPage } from './pages/DashboardPage.ts';
import { HRPage } from './pages/TeamPage.ts';
import { BillingPage } from './pages/BillingPage.ts';
import { ChatPage } from './pages/ChatPage.ts';
import { TeamCalendarPage } from './pages/TeamCalendarPage.ts';
import { SalesPage } from './pages/SalesPage.ts';
import { getCurrentUserRole } from './handlers/main.ts';
import { AuthPage } from './pages/AuthPage.ts';
import type { AppState } from './types.ts';

export async function router() {
    // If no user is authenticated, always show the authentication page.
    if (!state.currentUser) {
        state.currentPage = 'auth';
        return AuthPage();
    }
    
    if (state.currentPage === 'setup') {
        return AuthPage({ isSetup: true });
    }

    const path = window.location.hash.slice(1) || '/';
    const [page] = path.split('/').filter(p => p);
    
    state.currentPage = (page || 'dashboard') as AppState['currentPage'];
    
    const userRole = getCurrentUserRole();
    const canAccessTeam = userRole === 'owner' || userRole === 'manager';
    const canAccessBilling = userRole === 'owner';

    switch (state.currentPage) {
        case 'projects': return ProjectsPage();
        case 'clients': return ClientsPage();
        case 'tasks': return TasksPage();
        case 'team-calendar': return await TeamCalendarPage();
        case 'reports': return ReportsPage();
        case 'sales': return SalesPage();
        case 'invoices': return InvoicesPage();
        case 'ai-assistant': return AIAssistantPage();
        case 'settings': return SettingsPage();
        case 'chat': return ChatPage();
        case 'hr': return canAccessTeam ? HRPage() : DashboardPage(); // Guard route
        case 'billing': return canAccessBilling ? BillingPage() : DashboardPage(); // Guard route
        case 'auth': return AuthPage(); // Fallback case
        case 'dashboard':
        default:
            return DashboardPage();
    }
}