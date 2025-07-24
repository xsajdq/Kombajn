

import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { can } from '../permissions.ts';
import type { Permission } from '../types.ts';

type NavItem = {
    id: string;
    icon: string;
    text: string;
    permission?: Permission;
};

export function Sidebar() {
    const allNavItems: NavItem[] = [
        { id: 'dashboard', icon: 'dashboard', text: t('sidebar.dashboard'), permission: 'view_dashboard' },
        { id: 'goals', icon: 'track_changes', text: t('sidebar.goals'), permission: 'view_goals' },
        { id: 'projects', icon: 'folder', text: t('sidebar.projects'), permission: 'view_projects' },
        { id: 'tasks', icon: 'checklist', text: t('sidebar.tasks'), permission: 'view_tasks' },
    ];
    
    const customTaskViews: NavItem[] = (state.taskViews || [])
        .filter(tv => tv.workspaceId === state.activeWorkspaceId)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .map(tv => ({
            id: `task-view/${tv.id}`,
            icon: tv.icon,
            text: tv.name
        }));

    const allMainItems: NavItem[] = [
        ...allNavItems,
        ...customTaskViews,
        { id: 'team-calendar', icon: 'calendar_month', text: t('sidebar.team_calendar'), permission: 'view_team_calendar' },
        { id: 'chat', icon: 'chat', text: t('sidebar.chat'), permission: 'view_chat' },
        { id: 'clients', icon: 'people', text: t('sidebar.clients'), permission: 'view_clients' },
        { id: 'sales', icon: 'monetization_on', text: t('sidebar.sales'), permission: 'view_sales' },
        { id: 'invoices', icon: 'receipt_long', text: t('sidebar.invoices'), permission: 'view_invoices' },
        { id: 'inventory', icon: 'inventory_2', text: t('sidebar.inventory'), permission: 'view_inventory' },
        { id: 'budget-and-expenses', icon: 'account_balance_wallet', text: t('sidebar.budget-and-expenses'), permission: 'view_budgets' },
        { id: 'ai-assistant', icon: 'smart_toy', text: t('sidebar.ai_assistant'), permission: 'view_ai_assistant' },
        { id: 'hr', icon: 'groups', text: t('sidebar.hr'), permission: 'view_hr' },
        { id: 'reports', icon: 'assessment', text: t('sidebar.reports'), permission: 'view_reports' },
    ];
    
    const navItems = allMainItems.filter(item => !item.permission || can(item.permission));
    
    const allFooterNavItems: NavItem[] = [
        { id: 'settings', icon: 'settings', text: t('sidebar.settings'), permission: 'view_settings' },
        { id: 'billing', icon: 'credit_card', text: t('sidebar.billing'), permission: 'manage_billing' }
    ];

    const footerNavItems = allFooterNavItems.filter(item => !item.permission || can(item.permission));

    return `
    <aside class="flex flex-col h-screen w-64 bg-content border-r border-border-color text-sidebar-text">
      <div class="flex items-center p-4 border-b border-border-color">
        <span class="material-icons-sharp text-primary">hub</span>
        <h1 class="text-lg font-bold ml-2 text-text-main">Kombajn</h1>
      </div>
      <nav class="flex-grow p-2" aria-label="Main navigation">
        <ul class="space-y-1">
          ${navItems.map(item => {
            const isTaskView = item.id.startsWith('task-view/');
            const isActive = isTaskView
              ? state.ui.activeTaskViewId === item.id.split('/')[1]
              : state.currentPage === item.id && !state.ui.activeTaskViewId;

            return `
            <li>
              <a href="/${item.id}" class="flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'hover:bg-background'}" ${isActive ? 'aria-current="page"' : ''}>
                <span class="material-icons-sharp">${item.icon}</span>
                <span class="ml-3">${item.text}</span>
              </a>
            </li>
          `}).join('')}
        </ul>
      </nav>
      <div class="mt-auto p-2 border-t border-border-color">
          <nav aria-label="Footer navigation">
            <ul class="space-y-1">
             ${footerNavItems.map(item => {
                const isActive = state.currentPage === item.id;
                return `
                <li>
                  <a href="/${item.id}" class="flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'hover:bg-background'}" ${isActive ? 'aria-current="page"' : ''}>
                    <span class="material-icons-sharp">${item.icon}</span>
                    <span class="ml-3">${item.text}</span>
                  </a>
                </li>
             `}).join('')}
            </ul>
          </nav>
      </div>
    </aside>
  `;
}