
import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { can } from '../permissions.ts';
import type { Deal } from '../types.ts';
import { formatCurrency, getUserInitials } from '../utils.ts';

function renderDealCard(deal: Deal) {
    const client = state.clients.find(c => c.id === deal.clientId);
    const owner = state.users.find(u => u.id === deal.ownerId);

    return `
        <div class="bg-content p-3 rounded-md shadow-sm border border-border-color cursor-pointer deal-card" data-deal-id="${deal.id}" role="button" tabindex="0" draggable="true">
            <p class="font-semibold text-sm mb-2">${deal.name}</p>
            <p class="text-lg font-bold text-primary mb-2">${formatCurrency(deal.value, 'PLN')}</p>
            <div class="flex items-center text-xs text-text-subtle mb-3">
                <span class="material-icons-sharp text-sm mr-1.5">business</span>
                <span>${client?.name || t('misc.no_client')}</span>
            </div>
            <div class="flex justify-between items-center">
                ${owner ? `
                    <div class="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold" title="${t('sales.deal_owner')}: ${owner.name || getUserInitials(owner)}">${getUserInitials(owner)}</div>
                ` : `
                    <div class="w-6 h-6 rounded-full bg-background flex items-center justify-center text-text-subtle" title="${t('tasks.unassigned')}">
                         <span class="material-icons-sharp text-base">person_outline</span>
                    </div>
                `}
            </div>
        </div>
    `;
}

function renderKanbanBoard() {
    const deals = state.deals.filter(d => d.workspaceId === state.activeWorkspaceId);
    const stages = state.pipelineStages
        .filter(s => s.workspaceId === state.activeWorkspaceId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    
    if (stages.length === 0) {
        return `
            <div class="flex flex-col items-center justify-center h-full bg-content rounded-lg border-2 border-dashed border-border-color">
                <span class="material-icons-sharp text-5xl text-text-subtle">construction</span>
                <h3 class="text-lg font-medium mt-4">Pipeline Not Set Up</h3>
                <p class="text-sm text-text-subtle mt-1">An administrator needs to configure deal stages in Settings > Pipeline.</p>
                ${can('manage_workspace_settings') ? `<a href="/settings" class="mt-4 px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary-hover">Go to Settings</a>` : ''}
            </div>
        `;
    }

    const dealsByStage: { [key: string]: Deal[] } = {};
    stages.forEach(stage => dealsByStage[stage.id] = []);
    deals.forEach(deal => {
        if (dealsByStage[deal.stageId]) {
            dealsByStage[deal.stageId].push(deal);
        }
    });

    return `
        <div class="flex-1 overflow-x-auto">
            <div class="inline-flex h-full space-x-4 p-1">
                ${stages.map(stage => {
                    const columnDeals = dealsByStage[stage.id];
                    const totalValue = columnDeals.reduce((sum, deal) => sum + deal.value, 0);

                    return `
                         <div class="flex-shrink-0 w-72 h-full flex flex-col bg-background rounded-lg" data-stage-id="${stage.id}">
                            <div class="p-3 font-semibold text-text-main flex justify-between items-center border-b border-border-color">
                                <span>${stage.name} <span class="text-sm font-normal text-text-subtle">${columnDeals.length}</span></span>
                            </div>
                            <div class="px-3 py-2 text-sm font-medium text-text-subtle border-b border-border-color">
                                ${formatCurrency(totalValue, 'PLN')}
                            </div>
                            <div class="flex-1 min-h-0 overflow-y-auto p-2 space-y-3">
                                ${columnDeals.length > 0 ? columnDeals.map(renderDealCard).join('') : `<div class="h-full"></div>`}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

export function SalesPage() {
    const canManage = can('manage_deals');
    const { sales: { isLoading } } = state.ui;

    return `
    <div class="h-full flex flex-col">
        <div class="flex justify-between items-center mb-4">
            <h2 class="text-2xl font-bold">${t('sales.title')}</h2>
            <button class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-primary text-white hover:bg-primary-hover disabled:bg-primary/50 disabled:cursor-not-allowed" data-modal-target="addDeal" ${!canManage ? 'disabled' : ''}>
                <span class="material-icons-sharp text-base">add</span> ${t('sales.new_deal')}
            </button>
        </div>
        ${isLoading ? `
            <div class="flex items-center justify-center h-full">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        ` : renderKanbanBoard()}
    </div>
    `;
}