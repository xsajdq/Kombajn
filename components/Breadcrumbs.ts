import { getState } from '../state.ts';
import { t } from '../i18n.ts';
import type { Project, Client, Deal, TaskDetailModalData } from '../types.ts';
import { html, TemplateResult } from 'lit-html';

type BreadcrumbItem = {
    text: string;
    link?: string;
    isSwitcher?: boolean;
    switcherType?: 'project' | 'client' | 'deal';
    id?: string;
};

function renderSwitcher(item: BreadcrumbItem): TemplateResult {
    const state = getState();
    let entities: (Project | Client | Deal)[] = [];
    let entityType = item.switcherType!;
    
    switch (entityType) {
        case 'project':
            entities = state.projects.filter(p => p.workspaceId === state.activeWorkspaceId);
            break;
        case 'client':
            entities = state.clients.filter(c => c.workspaceId === state.activeWorkspaceId);
            break;
        case 'deal':
            entities = state.deals.filter(d => d.workspaceId === state.activeWorkspaceId);
            break;
    }

    return html`
        <div class="relative">
            <button class="breadcrumb-switcher" data-breadcrumb-switcher aria-haspopup="true" aria-expanded="false">
                <span>${item.text}</span>
                <span class="material-icons-sharp text-base">expand_more</span>
            </button>
            <div class="breadcrumb-switcher-menu hidden">
                <input type="text" class="form-control" placeholder="Search..." oninput="
                    const query = this.value.toLowerCase();
                    this.nextElementSibling.querySelectorAll('.switcher-menu-item').forEach(item => {
                        item.style.display = item.textContent.toLowerCase().includes(query) ? '' : 'none';
                    });
                ">
                <div class="switcher-menu-list">
                    ${entities.map(entity => html`
                        <button class="switcher-menu-item ${entity.id === item.id ? 'active' : ''}" 
                                data-switch-entity-id="${entity.id}" 
                                data-entity-type="${entityType}">
                            ${entity.name}
                        </button>
                    `)}
                </div>
            </div>
        </div>
    `;
}

export function Breadcrumbs(): TemplateResult | '' {
    const state = getState();
    const { currentPage, ui } = state;
    const breadcrumbs: BreadcrumbItem[] = [{ text: t('sidebar.dashboard'), link: '/dashboard' }];

    const pageMap: Partial<Record<typeof currentPage, { text: string; link: string }>> = {
        projects: { text: t('sidebar.projects'), link: '/projects' },
        tasks: { text: t('sidebar.tasks'), link: '/tasks' },
        clients: { text: t('sidebar.clients'), link: '/clients' },
        sales: { text: t('sidebar.sales'), link: '/sales' },
        settings: { text: t('sidebar.settings'), link: '/settings' },
        hr: { text: t('sidebar.hr'), link: '/hr' },
        reports: { text: t('sidebar.reports'), link: '/reports' },
        invoices: { text: t('sidebar.invoices'), link: '/invoices' },
        goals: { text: t('sidebar.goals'), link: '/goals' },
        inventory: { text: t('sidebar.inventory'), link: '/inventory' },
        'budget-and-expenses': { text: t('sidebar.budget-and-expenses'), link: '/budget-and-expenses' },
        'team-calendar': { text: t('sidebar.team_calendar'), link: '/team-calendar' },
        chat: { text: t('sidebar.chat'), link: '/chat' },
        'ai-assistant': { text: t('sidebar.ai_assistant'), link: '/ai-assistant' },
    };

    // Task detail modal is a special case that defines the whole path from scratch
    if (ui.modal.isOpen && ui.modal.type === 'taskDetail' && (ui.modal.data as TaskDetailModalData)?.taskId) {
        const taskId = (ui.modal.data as TaskDetailModalData).taskId;
        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
            const project = state.projects.find(p => p.id === task.projectId);
            if (project) {
                breadcrumbs.push({ text: t('sidebar.projects'), link: '/projects' });
                breadcrumbs.push({ text: project.name, link: `/projects/${project.slug || project.id}` });
            } else {
                breadcrumbs.push({ text: t('sidebar.tasks'), link: '/tasks' });
            }
            breadcrumbs.push({ text: task.name });
        }
    } else {
        // Build base path for the current page
        if (currentPage !== 'dashboard' && pageMap[currentPage]) {
            breadcrumbs.push(pageMap[currentPage]!);
        }

        // Append details for open side panels
        if (ui.openedProjectId) {
            const project = state.projects.find(p => p.id === ui.openedProjectId);
            if (project) {
                breadcrumbs.push({ text: project.name, isSwitcher: true, switcherType: 'project', id: project.id });
            }
        } else if (ui.openedClientId) {
            const client = state.clients.find(c => c.id === ui.openedClientId);
            if (client) {
                breadcrumbs.push({ text: client.name, isSwitcher: true, switcherType: 'client', id: client.id });
            }
        } else if (ui.openedDealId) {
            const deal = state.deals.find(d => d.id === ui.openedDealId);
            if (deal) {
                breadcrumbs.push({ text: deal.name, isSwitcher: true, switcherType: 'deal', id: deal.id });
            }
        }

        // Append details for tabs within pages
        if (currentPage === 'settings' && ui.settings.activeTab !== 'general') {
            breadcrumbs.push({ text: t(`settings.tab_${ui.settings.activeTab}`) });
        } else if (currentPage === 'hr' && ui.hr.activeTab !== 'employees') {
            breadcrumbs.push({ text: t(`hr.tabs.${ui.hr.activeTab}`) });
        }
    }

    if (breadcrumbs.length <= 1 && currentPage !== 'dashboard') {
        return '';
    }

    return html`
        <div class="breadcrumb-container">
            ${breadcrumbs.map((item, index) => {
                const isLast = index === breadcrumbs.length - 1;
                let content: TemplateResult | string = '';

                if (isLast) {
                    if (item.isSwitcher) {
                        content = renderSwitcher(item);
                    } else {
                        content = html`<span class="truncate">${item.text}</span>`;
                    }
                } else {
                    content = html`<a href="${item.link}">${item.text}</a>`;
                }

                return html`
                    <div class="breadcrumb-item ${isLast ? 'current' : ''}">
                        ${content}
                        ${!isLast ? html`<span class="material-icons-sharp text-base breadcrumb-separator">chevron_right</span>` : ''}
                    </div>
                `;
            })}
        </div>
    `;
}