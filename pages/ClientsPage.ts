import { getState, setState } from '../state.ts';
import { t } from '../i18n.ts';
import { can } from '../permissions.ts';
import { formatCurrency, formatDate, filterItems } from '../utils.ts';
import { fetchClientsForWorkspace } from '../handlers/clients.ts';

export async function initClientsPage() {
    const state = getState();
    const { activeWorkspaceId } = state;
    if (!activeWorkspaceId) return;

    if (state.ui.clients.loadedWorkspaceId !== activeWorkspaceId) {
        // Set loading state and loaded ID immediately to prevent re-fetching loops.
        setState(prevState => ({
            ui: {
                ...prevState.ui,
                clients: { ...prevState.ui.clients, isLoading: true, loadedWorkspaceId: activeWorkspaceId }
            }
        }), ['page']);
        
        await fetchClientsForWorkspace(activeWorkspaceId);
    }
}

export function ClientsPage() {
    const state = getState();
    const { activeWorkspaceId } = state;
    if (!activeWorkspaceId) return '';

    if (state.ui.clients.isLoading) {
        return `<div class="flex items-center justify-center h-full">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>`;
    }
    
    const allClients = state.clients.filter(c => c.workspaceId === activeWorkspaceId);
    
    const filteredClients = filterItems(
        allClients, 
        state.ui.clients.filters, 
        ['name', 'category'],
        state.clientTags, 
        'clientId'
    );

    const canManage = can('manage_clients');
    const workspaceTags = state.tags.filter(t => t.workspaceId === activeWorkspaceId);

    const totalClients = allClients.length;
    const activeClients = allClients.filter(c => (c.status ?? 'active') === 'active').length;
    const totalProjects = state.projects.filter(p => p.workspaceId === activeWorkspaceId).length;
    
    const totalRevenue = state.invoices
        .filter(i => i.workspaceId === activeWorkspaceId && i.status === 'paid')
        .reduce((sum, invoice) => {
            return sum + invoice.items.reduce((itemSum, item) => itemSum + item.quantity * item.unitPrice, 0);
        }, 0);

    const { text: filterText, status: filterStatus, tagIds: filterTagIds } = state.ui.clients.filters;

    return `
    <div class="space-y-6">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h2 class="text-2xl font-bold">${t('clients.title')}</h2>
            </div>
            <button class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-primary text-white hover:bg-primary-hover" data-modal-target="addClient" ${!canManage ? 'disabled' : ''}>
                <span class="material-icons-sharp text-base">add</span> ${t('clients.add_client')}
            </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-content p-4 rounded-lg flex items-center gap-4">
                <div class="p-3 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-500">
                    <span class="material-icons-sharp">business</span>
                </div>
                <div>
                    <p class="text-sm text-text-subtle">Total Clients</p>
                    <strong class="text-xl font-semibold">${totalClients}</strong>
                </div>
            </div>
            <div class="bg-content p-4 rounded-lg flex items-center gap-4">
                <div class="p-3 rounded-full bg-green-100 dark:bg-green-900/50 text-green-500">
                    <span class="material-icons-sharp">person</span>
                </div>
                <div>
                    <p class="text-sm text-text-subtle">Active Clients</p>
                    <strong class="text-xl font-semibold">${activeClients}</strong>
                </div>
            </div>
            <div class="bg-content p-4 rounded-lg flex items-center gap-4">
                <div class="p-3 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-500">
                    <span class="material-icons-sharp">folder</span>
                </div>
                <div>
                    <p class="text-sm text-text-subtle">Total Projects</p>
                    <strong class="text-xl font-semibold">${totalProjects}</strong>
                </div>
            </div>
            <div class="bg-content p-4 rounded-lg flex items-center gap-4">
                <div class="p-3 rounded-full bg-orange-100 dark:bg-orange-900/50 text-orange-500">
                    <span class="material-icons-sharp">payments</span>
                </div>
                <div>
                    <p class="text-sm text-text-subtle">Total Revenue</p>
                    <strong class="text-xl font-semibold">${formatCurrency(totalRevenue)}</strong>
                </div>
            </div>
        </div>

        <div class="bg-content p-4 rounded-lg">
            <div class="flex flex-col sm:flex-row gap-4">
                <div class="relative flex-grow">
                    <span class="material-icons-sharp absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle">search</span>
                    <input type="text" id="client-search-input" class="w-full pl-10 pr-4 py-2 bg-background border border-border-color rounded-md" value="${filterText}" placeholder="Search clients...">
                </div>
                 <div class="flex items-center p-1 bg-background rounded-lg">
                    <button class="px-3 py-1 text-sm font-medium rounded-md ${filterStatus === 'all' ? 'bg-content shadow-sm' : ''}" data-client-filter-status="all">All</button>
                    <button class="px-3 py-1 text-sm font-medium rounded-md ${filterStatus === 'active' ? 'bg-content shadow-sm' : ''}" data-client-filter-status="active">Active</button>
                    <button class="px-3 py-1 text-sm font-medium rounded-md ${filterStatus === 'archived' ? 'bg-content shadow-sm' : ''}" data-client-filter-status="archived">Archived</button>
                </div>
                 <div class="relative" id="client-filter-tags-container">
                    <button id="client-filter-tags-toggle" class="w-full sm:w-48 form-control text-left flex justify-between items-center">
                        <span class="truncate">${filterTagIds.length > 0 ? `${filterTagIds.length} tags selected` : 'Filter by tag'}</span>
                        <span class="material-icons-sharp text-base">arrow_drop_down</span>
                    </button>
                    <div id="client-filter-tags-dropdown" class="multiselect-dropdown hidden">
                        <div class="multiselect-list">
                        ${workspaceTags.map(tag => `
                            <label class="multiselect-list-item">
                                <input type="checkbox" value="${tag.id}" data-filter-key="tagIds" ${filterTagIds.includes(tag.id) ? 'checked' : ''}>
                                <span class="tag-chip" style="background-color: ${tag.color}20; border-color: ${tag.color}">${tag.name}</span>
                            </label>
                        `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        ${filteredClients.length > 0 ? `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${filteredClients.map(client => {
                    const projectCount = state.projects.filter(p => p.clientId === client.id).length;
                    const primaryContact = client.contacts && client.contacts.length > 0 ? client.contacts[0] : { name: client.contactPerson, email: client.email };
                    const initials = (client.name || '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
                    const status = client.status || 'active';
                    const statusClass = status === 'active' 
                        ? 'bg-green-100 dark:bg-green-900/50 text-green-700' 
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
                    const statusText = status.charAt(0).toUpperCase() + status.slice(1);
                    const clientTags = state.clientTags.filter(ct => ct.clientId === client.id).map(ct => state.tags.find(t => t.id === ct.tagId)).filter(Boolean);

                    return `
                    <div class="bg-content p-5 rounded-lg shadow-sm flex flex-col space-y-4 cursor-pointer hover:shadow-md transition-shadow" data-client-id="${client.id}" role="button" tabindex="0">
                        <div class="flex items-start justify-between">
                            <div class="flex items-center gap-3">
                                <div class="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 flex items-center justify-center text-lg font-semibold">${initials}</div>
                                <div>
                                    <strong class="font-semibold text-lg">${client.name}</strong>
                                    <p class="text-sm text-text-subtle">${primaryContact?.name || ''}</p>
                                </div>
                            </div>
                            <span class="px-2 py-1 text-xs font-medium rounded-full ${statusClass}">${statusText}</span>
                        </div>
                        ${clientTags.length > 0 ? `
                            <div class="flex flex-wrap gap-1.5 pt-2 border-t border-border-color">
                                ${clientTags.map(tag => `<span class="tag-chip" style="background-color: ${tag!.color}20; border-color: ${tag!.color}">${tag!.name}</span>`).join('')}
                            </div>
                        ` : ''}
                        <div class="text-sm text-text-subtle space-y-2 border-t border-border-color pt-4 mt-auto">
                            <div class="flex items-center gap-2">
                                <span class="material-icons-sharp text-base">email</span>
                                <span>${primaryContact?.email || t('misc.not_applicable')}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="material-icons-sharp text-base">folder</span>
                                <span>${projectCount} ${t('clients.active_projects')}</span>
                            </div>
                        </div>
                    </div>
                `}).join('')}
            </div>
        ` : `
            <div class="flex flex-col items-center justify-center h-96 bg-content rounded-lg border-2 border-dashed border-border-color">
                <span class="material-icons-sharp text-5xl text-text-subtle">people_outline</span>
                <h3 class="text-lg font-medium mt-4">${t('clients.no_clients_yet')}</h3>
                <p class="text-sm text-text-subtle mt-1">${t('clients.no_clients_desc')}</p>
                 <button class="mt-4 px-4 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-primary text-white hover:bg-primary-hover" data-modal-target="addClient" ${!canManage ? 'disabled' : ''}>
                    ${t('clients.add_client')}
                </button>
            </div>
        `}
    </div>
    `;
}