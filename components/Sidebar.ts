import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { can } from '../permissions.ts';
import type { Permission } from '../types.ts';

export function Sidebar() {
    const allNavItems: {id: string, icon: string, text: string, permission?: Permission}[] = [
        { id: 'dashboard', icon: 'dashboard', text: t('sidebar.dashboard'), permission: 'view_dashboard' },
        { id: 'projects', icon: 'folder', text: t('sidebar.projects'), permission: 'view_projects' },
        { id: 'tasks', icon: 'checklist', text: t('sidebar.tasks'), permission: 'view_tasks' },
        { id: 'team-calendar', icon: 'calendar_month', text: t('sidebar.team_calendar'), permission: 'view_team_calendar' },
        { id: 'chat', icon: 'chat', text: t('sidebar.chat'), permission: 'view_chat' },
        { id: 'clients', icon: 'people', text: t('sidebar.clients'), permission: 'view_clients' },
        { id: 'sales', icon: 'monetization_on', text: t('sidebar.sales'), permission: 'view_sales' },
        { id: 'invoices', icon: 'receipt_long', text: t('sidebar.invoices'), permission: 'view_invoices' },
        { id: 'ai-assistant', icon: 'smart_toy', text: t('sidebar.ai_assistant'), permission: 'view_ai_assistant' },
        { id: 'hr', icon: 'groups', text: t('sidebar.hr'), permission: 'view_hr' },
        { id: 'reports', icon: 'assessment', text: t('sidebar.reports'), permission: 'view_reports' },
    ];
    
    const navItems = allNavItems.filter(item => !item.permission || can(item.permission));
    
    const allFooterNavItems: { id: string; icon: string; text: string; permission?: Permission; }[] = [
        { id: 'settings', icon: 'settings', text: t('sidebar.settings'), permission: 'view_settings' },
        { id: 'billing', icon: 'credit_card', text: t('sidebar.billing'), permission: 'manage_billing' }
    ];

    const footerNavItems = allFooterNavItems.filter(item => !item.permission || can(item.permission));


    return `
    <aside class="sidebar">
      <div class="sidebar-header">
        <span class="material-icons-sharp">hub</span>
        <h1>Kombajn</h1>
      </div>
      <nav aria-label="Main navigation">
        <ul class="nav-list">
          ${navItems.map(item => {
            const isActive = state.currentPage === item.id;
            return `
            <li class="nav-item">
              <a href="/${item.id}" class="${isActive ? 'active' : ''}" ${isActive ? 'aria-current="page"' : ''}>
                <span class="material-icons-sharp">${item.icon}</span>
                <span class="nav-text">${item.text}</span>
              </a>
            </li>
          `}).join('')}
        </ul>
      </nav>
      <div class="sidebar-footer">
          <nav aria-label="Footer navigation">
            <ul class="nav-list">
             ${footerNavItems.map(item => {
                const isActive = state.currentPage === item.id;
                return `
                <li class="nav-item">
                  <a href="/${item.id}" class="${isActive ? 'active' : ''}" ${isActive ? 'aria-current="page"' : ''}>
                    <span class="material-icons-sharp">${item.icon}</span>
                    <span class="nav-text">${item.text}</span>
                  </a>
                </li>
             `}).join('')}
            </ul>
          </nav>
      </div>
    </aside>
  `;
}
