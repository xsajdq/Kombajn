import { state } from '../state.ts';
import { t } from '../i18n.ts';
import type { Role } from '../types.ts';

export function Sidebar({ userRole }: { userRole: Role | null }) {
    const navItems = [
        { id: 'dashboard', icon: 'dashboard', text: t('sidebar.dashboard') },
        { id: 'projects', icon: 'folder', text: t('sidebar.projects') },
        { id: 'tasks', icon: 'checklist', text: t('sidebar.tasks') },
        { id: 'team-calendar', icon: 'calendar_month', text: t('sidebar.team_calendar') },
        { id: 'chat', icon: 'chat', text: t('sidebar.chat') },
        { id: 'clients', icon: 'people', text: t('sidebar.clients') },
        { id: 'sales', icon: 'monetization_on', text: t('sidebar.sales') },
        { id: 'invoices', icon: 'receipt_long', text: t('sidebar.invoices') },
        { id: 'ai-assistant', icon: 'smart_toy', text: t('sidebar.ai_assistant') },
    ];

    if (userRole === 'owner' || userRole === 'manager') {
        navItems.push({ id: 'hr', icon: 'groups', text: t('sidebar.hr') });
    }
    navItems.push({ id: 'reports', icon: 'assessment', text: t('sidebar.reports') });
    
    const footerNavItems = [
        { id: 'settings', icon: 'settings', text: t('sidebar.settings') }
    ];

    if (userRole === 'owner') {
        footerNavItems.push({ id: 'billing', icon: 'credit_card', text: t('sidebar.billing') });
    }


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
              <a href="#/${item.id}" class="${isActive ? 'active' : ''}" ${isActive ? 'aria-current="page"' : ''}>
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
                  <a href="#/${item.id}" class="${isActive ? 'active' : ''}" ${isActive ? 'aria-current="page"' : ''}>
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