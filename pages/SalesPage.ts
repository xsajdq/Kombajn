

import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { can } from '../permissions.ts';
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
        <div class="deal-card" data-deal-id="${deal.id}" role="button" tabindex="0" draggable="true">
            <p class="deal-card-name">${deal.name}</p>
            <p class="deal-card-value">${formatCurrency(deal.value)}</p>
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
                        <div class="kanban-column" data-stage="${stage}" data-stage-color="${stage}">
                            <h4>${t(`sales.stage_${stage}`)}</h4>
                             <div class="subtle-text" style="font-weight: 600; padding: 0 0.5rem 1rem;">
                                ${new Intl.NumberFormat('pl-PL').format(totalValue)} PLN (${columnDeals.length})
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