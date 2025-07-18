

import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { can } from '../permissions.ts';
import type { Deal } from '../types.ts';
import { fetchSalesData } from '../handlers/deals.ts';
import { formatCurrency } from '../utils.ts';

function renderDealCard(deal: Deal) {
    const client = state.clients.find(c => c.id === deal.clientId);
    const owner = state.users.find(u => u.id === deal.ownerId);

    return `
        <div class="deal-card" data-deal-id="${deal.id}" role="button" tabindex="0" draggable="true">
            <p class="deal-card-name">${deal.name}</p>
            <p class="deal-card-value">${formatCurrency(deal.value, 'PLN')}</p>
            <div class="deal-card-client">
                <span class="material-icons-sharp icon-sm">business</span>
                <span>${client?.name || t('misc.no_client')}</span>
            </div>
            <div class="deal-card-footer">
                ${owner ? `
                    <div class="avatar" title="${t('sales.deal_owner')}: ${owner.name || owner.initials}">${owner.initials}</div>
                ` : `
                    <div class="avatar-placeholder" title="${t('tasks.unassigned')}">
                         <span class="material-icons-sharp icon-sm">person_outline</span>
                    </div>
                `}
            </div>
        </div>
    `;
}

export function SalesPage() {
    fetchSalesData(); // Call the data fetching logic

    if (state.ui.sales.isLoading) {
        return `
            <div class="kanban-header">
                <h2>${t('sales.title')}</h2>
            </div>
            <div class="loading-container" style="height: 60vh;">
                <div class="loading-progress-bar"></div>
                <p>Loading sales pipeline...</p>
            </div>`;
    }

    const canManage = can('manage_deals');
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
        <div class="sales-page-container">
            <div class="kanban-header">
                <h2>${t('sales.title')}</h2>
                <button class="btn btn-primary" data-modal-target="addDeal" ${!canManage ? 'disabled' : ''}>
                    <span class="material-icons-sharp">add</span> ${t('sales.new_deal')}
                </button>
            </div>
            <div class="sales-board-wrapper">
                <div class="sales-board">
                    ${stages.map(stage => {
                        const columnDeals = dealsByStage[stage];
                        const totalValue = columnDeals.reduce((sum, deal) => sum + deal.value, 0);

                        return `
                            <div class="kanban-column" data-stage="${stage}">
                                <div class="kanban-column-header">
                                    <h4>${t(`sales.stage_${stage}`)}</h4>
                                    <span class="subtle-text">${columnDeals.length}</span>
                                </div>
                                <div class="kanban-column-summary">
                                    ${formatCurrency(totalValue, 'PLN')}
                                </div>
                                <div class="kanban-tasks">
                                    ${columnDeals.length > 0 ? columnDeals.map(renderDealCard).join('') : `<div class="empty-kanban-column"></div>`}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
}
