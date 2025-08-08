import { getState } from '../state.ts';
import { t } from '../i18n.ts';
import { can } from '../permissions.ts';
import type { Permission } from '../types.ts';
import { Logo } from './Logo.ts';
import { html, TemplateResult } from 'lit-html';

type NavItem = {
    id: string;
    icon: string;
    text: string;
    permission?: Permission;
};

export function Sidebar(): TemplateResult {
    const state = getState();
    const allNavItems: NavItem[] = [
        { id: 'dashboard', icon: 'dashboard', text: t('sidebar.dashboard'), permission: 'view_dashboard' },
        { id: 'goals', icon: 'track_changes', text: t('sidebar.goals'), permission: 'view_goals' },
        { id: 'projects', icon: 'folder', text: t('sidebar.projects'), permission: 'view_projects' },
        { id: 'tasks', icon: 'checklist', text: t('sidebar.tasks'), permission: 'view_tasks' },
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
    
    const customTaskViews: NavItem[] = (state.taskViews || [])
        .filter(tv => tv.workspaceId === state.activeWorkspaceId)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .map(tv => ({
            id: `task-view/${tv.id}`,
            icon: tv.icon,
            text: tv.name
        }));

    const navItems = allNavItems.filter(item => !item.permission || can(item.permission));
    
    const allFooterNavItems: NavItem[] = [
        { id: 'settings', icon: 'settings', text: t('sidebar.settings'), permission: 'view_settings' },
        { id: 'billing', icon: 'credit_card', text: t('sidebar.billing'), permission: 'manage_billing' }
    ];

    const footerNavItems = allFooterNavItems.filter(item => !item.permission || can(item.permission));

    return html`
    <aside id="app-sidebar" class="flex flex-col h-full w-64 bg-content border-r border-border-color text-sidebar-text fixed top-0 left-0 transform -translate-x-full md:relative md:translate-x-0 transition-transform duration-300 ease-in-out z-50">
      <div class="flex items-center justify-center h-16 shrink-0 px-4 border-b border-border-color">
        ${Logo()}
      </div>
      <nav class="flex-grow p-2" aria-label="Main navigation">
        <ul class="space-y-1">
          ${navItems.map(item => {
            if (item.id === 'tasks') {
                const isParentActive = state.currentPage === 'tasks' || state.ui.activeTaskViewId !== null;
                return html`
                <li class="relative group/tasks">
                  <a href="/tasks" class="flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${isParentActive ? 'bg-primary/10 text-primary' : 'hover:bg-background'}">
                    <span class="material-icons-sharp">${item.icon}</span>
                    <span class="ml-3">${item.text}</span>
                  </a>
                  ${customTaskViews.length > 0 ? html`
                  <div class="absolute left-full top-0 ml-2 p-2 w-48 bg-content rounded-md shadow-lg border border-border-color z-20 
                               opacity-0 invisible -translate-x-2 group-hover/tasks:opacity-100 group-hover/tasks:visible group-hover/tasks:translate-x-0 transition-all duration-200 ease-in-out">
                    <ul class="space-y-1">
                        ${customTaskViews.map(view => {
                            const isViewActive = state.ui.activeTaskViewId === view.id.split('/')[1];
                            return html`
                                <li>
                                  <a href="/${view.id}" class="flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${isViewActive ? 'bg-primary/10 text-primary' : 'hover:bg-background'}">
                                    <span class="material-icons-sharp text-base">${view.icon}</span>
                                    <span class="ml-2">${view.text}</span>
                                  </a>
                                </li>
                            `;
                        })}
                    </ul>
                  </div>
                  ` : ''}
                </li>
                `;
            }
            
            const isActive = state.currentPage === item.id;
            return html`
            <li>
              <a href="/${item.id}" class="flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'hover:bg-background'}" ${isActive ? 'aria-current="page"' : ''}>
                <span class="material-icons-sharp">${item.icon}</span>
                <span class="ml-3">${item.text}</span>
              </a>
            </li>
          `;})}
        </ul>
      </nav>
      <div class="mt-auto p-2 border-t border-border-color">
          <nav aria-label="Footer navigation">
            <ul class="space-y-1">
             ${footerNavItems.map(item => {
                const isActive = state.currentPage === item.id;
                return html`
                <li>
                  <a href="/${item.id}" class="flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'hover:bg-background'}" ${isActive ? 'aria-current="page"' : ''}>
                    <span class="material-icons-sharp">${item.icon}</span>
                    <span class="ml-3">${item.text}</span>
                  </a>
                </li>
             `;})}
            </ul>
          </nav>
      </div>
    </aside>
  `;
}
