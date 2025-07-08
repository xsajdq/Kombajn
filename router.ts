

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

export function router() {
    const path = window.location.hash.slice(1) || '/';
    const [page] = path.split('/').filter(p => p);
    state.currentPage = page || 'dashboard';
    
    const userRole = getCurrentUserRole();
    const canAccessTeam = userRole === 'owner' || userRole === 'manager';
    const canAccessBilling = userRole === 'owner';

    switch (state.currentPage) {
        case 'projects': return ProjectsPage();
        case 'clients': return ClientsPage();
        case 'tasks': return TasksPage();
        case 'team-calendar': return TeamCalendarPage();
        case 'reports': return ReportsPage();
        case 'sales': return SalesPage();
        case 'invoices': return InvoicesPage();
        case 'ai-assistant': return AIAssistantPage();
        case 'settings': return SettingsPage();
        case 'chat': return ChatPage();
        case 'hr': return canAccessTeam ? HRPage() : DashboardPage(); // Guard route
        case 'billing': return canAccessBilling ? BillingPage() : DashboardPage(); // Guard route
        case 'dashboard':
        default:
            return DashboardPage();
    }
}