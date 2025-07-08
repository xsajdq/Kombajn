import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { getCurrentUserRole } from '../handlers/main.ts';
import type { Deal } from '../types.ts';

function renderDealCard(deal: Deal) {
    const client = state.clients.find(c => c.id === deal.clientId);
    const owner = state.users.find(u => u.id === deal.ownerId);

    // Format currency to be more readable
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat(state.settings.language === 'pl' ? 'pl-PL' : 'en-US', {
            style: 'currency',
            currency: 'PLN', // Assuming PLN for now
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    }

    return `
        <div class="task-card" draggable="true" data-task-id="${deal.id}" role="button" tabindex="0" aria-label="${deal.name}">
            <p class="task-card-name">${deal.name}</p>
            <p class="subtle-text" style="margin-bottom: 0.75rem;">
                <span class="material-icons-sharp icon-sm" style="vertical-align: bottom; font-size: 1.1rem; margin-right: 0.25rem;">business</span>
                ${client?.name || t('misc.no_client')}
            </p>
            <div style="font-weight: 600; font-size: 1.1rem; margin-bottom: 1rem;">
                ${formatCurrency(deal.value)}
            </div>
            <div class="task-card-footer" style="margin-top: 0;">
                <div class="task-meta">
                    ${owner ? `
                        <div class="avatar" title="${t('sales.deal_owner')}: ${owner.name || owner.initials}">${owner.initials}</div>
                    ` : `
                        <div class="avatar-placeholder" title="${t('tasks.unassigned')}">
                             <span class="material-icons-sharp icon-sm">person_outline</span>
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;
}

export function SalesPage() {
    const userRole = getCurrentUserRole();
    const canManage = userRole === 'owner' || userRole === 'manager';

    const deals = state.deals.filter(d => d.workspaceId === state.activeWorkspaceId);
    
    const stages: Deal['stage'][] = ['lead', 'contacted', 'demo', 'proposal', 'won', 'lost'];

    const dealsByStage: { [key in Deal['stage']]: Deal[] } = {
        lead: [], contacted: [], demo: [], proposal: [], won: [], lost: [],
    };

    deals.forEach(deal => {
        if (dealsByStage[deal.stage]) {
            dealsByStage[deal.stage].push(deal);
        }
    });

    return `
        <div>
            <div class="kanban-header">
                <h2>${t('sales.title')}</h2>
                <button class="btn btn-primary" data-modal-target="addDeal" ${!canManage ? 'disabled' : ''}>
                    <span class="material-icons-sharp">add</span> ${t('sales.new_deal')}
                </button>
            </div>
            <div class="sales-board">
                ${stages.map(stage => {
                    const columnDeals = dealsByStage[stage];
                    const totalValue = columnDeals.reduce((sum, deal) => sum + deal.value, 0);

                    return `
                        <div class="kanban-column" data-stage="${stage}">
                            <h4>${t(`sales.stage_${stage}`)} (${columnDeals.length})</h4>
                             <div class="subtle-text" style="font-weight: 600; padding: 0 0.5rem 1rem;">
                                ${new Intl.NumberFormat('pl-PL').format(totalValue)} PLN
                            </div>
                            <div class="kanban-tasks">
                                ${columnDeals.length > 0 ? columnDeals.map(renderDealCard).join('') : `<div class="empty-kanban-column" style="padding:1rem; text-align:center; color: var(--subtle-text-color);">${t('sales.no_deals')}</div>`}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}