
import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { can } from '../permissions.ts';
import { formatCurrency, formatDate } from '../utils.ts';

export function ClientsPage() {
    const { activeWorkspaceId } = state;
    if (!activeWorkspaceId) return '';

    const clients = state.clients.filter(c => c.workspaceId === activeWorkspaceId);
    const canManage = can('manage_clients');

    const totalClients = clients.length;
    const activeClients = totalClients;
    const totalProjects = state.projects.filter(p => p.workspaceId === activeWorkspaceId).length;
    
    const totalRevenue = state.invoices
        .filter(i => i.workspaceId === activeWorkspaceId && i.status === 'paid')
        .reduce((sum, invoice) => {
            return sum + invoice.items.reduce((itemSum, item) => itemSum + item.quantity * item.unitPrice, 0);
        }, 0);

    return `
    <div class="space-y-6">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h2 class="text-2xl font-bold">${t('clients.title')}</h2>
                <p class="text-text-subtle">Manage your client relationships</p>
            </div>
            <button class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-primary text-white hover:bg-primary-hover" data-modal-target="addClient" ${!canManage ? 'disabled' : ''}>
                <span class="material-icons-sharp text-base">add</span> Add Client
            </button>
        </div>

        <div class="bg-content p-3 rounded-lg border border-border-color flex flex-col sm:flex-row items-center gap-3">
            <div class="relative w-full sm:w-auto flex-grow">
                 <span class="material-icons-sharp absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle">search</span>
                 <input type="text" id="client-search" class="w-full pl-10 pr-4 py-2 bg-background border border-border-color rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" placeholder="Search clients...">
            </div>
            <select id="client-status-filter" class="w-full sm:w-auto bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition">
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
            </select>
            <button class="w-full sm:w-auto px-3 py-2 text-sm font-medium flex items-center justify-center gap-2 rounded-md bg-content border border-border-color hover:bg-background">
                <span class="material-icons-sharp text-base">filter_list</span>
                Filter
            </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-content p-4 rounded-lg flex items-center gap-4">
                <div class="p-3 rounded-full bg-blue-100 text-blue-500">
                    <span class="material-icons-sharp">business</span>
                </div>
                <div>
                    <p class="text-sm text-text-subtle">Total Clients</p>
                    <strong class="text-xl font-semibold">${totalClients}</strong>
                </div>
            </div>
            <div class="bg-content p-4 rounded-lg flex items-center gap-4">
                <div class="p-3 rounded-full bg-green-100 text-green-500">
                    <span class="material-icons-sharp">person</span>
                </div>
                <div>
                    <p class="text-sm text-text-subtle">Active Clients</p>
                    <strong class="text-xl font-semibold">${activeClients}</strong>
                </div>
            </div>
            <div class="bg-content p-4 rounded-lg flex items-center gap-4">
                <div class="p-3 rounded-full bg-purple-100 text-purple-500">
                    <span class="material-icons-sharp">folder</span>
                </div>
                <div>
                    <p class="text-sm text-text-subtle">Total Projects</p>
                    <strong class="text-xl font-semibold">${totalProjects}</strong>
                </div>
            </div>
            <div class="bg-content p-4 rounded-lg flex items-center gap-4">
                <div class="p-3 rounded-full bg-orange-100 text-orange-500">
                    <span class="material-icons-sharp">payments</span>
                </div>
                <div>
                    <p class="text-sm text-text-subtle">Total Revenue</p>
                    <strong class="text-xl font-semibold">${formatCurrency(totalRevenue, 'USD')}</strong>
                </div>
            </div>
        </div>

        ${clients.length > 0 ? `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${clients.map(client => {
                    const projectCount = state.projects.filter(p => p.clientId === client.id).length;
                    const revenueForClient = state.invoices
                        .filter(i => i.clientId === client.id && i.status === 'paid')
                        .reduce((sum, inv) => sum + inv.items.reduce((itemSum, item) => itemSum + item.quantity * item.unitPrice, 0), 0);
                    const firstInvoiceDate = state.invoices
                        .filter(i => i.clientId === client.id)
                        .map(i => new Date(i.issueDate))
                        .sort((a,b) => a.getTime() - b.getTime())[0];

                    const primaryContact = client.contacts && client.contacts.length > 0 ? client.contacts[0] : { name: client.contactPerson, email: client.email, phone: client.phone };
                    const initials = (client.name || '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

                    return `
                    <div class="bg-content p-5 rounded-lg shadow-sm flex flex-col space-y-4">
                        <div class="flex items-start justify-between">
                            <div class="flex items-center gap-3">
                                <div class="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-lg font-semibold">${initials}</div>
                                <div>
                                    <strong class="font-semibold text-lg">${client.name}</strong>
                                    <p class="text-sm text-text-subtle">${primaryContact?.name || ''}</p>
                                </div>
                            </div>
                            <span class="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Active</span>
                        </div>
                        <div class="text-sm text-text-subtle space-y-2 border-t border-border-color pt-4">
                            <div class="flex items-center gap-2">
                                <span class="material-icons-sharp text-base">email</span>
                                <span>${primaryContact?.email || t('misc.not_applicable')}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="material-icons-sharp text-base">phone</span>
                                <span>${primaryContact?.phone || t('misc.not_applicable')}</span>
                            </div>
                             <div class="flex items-center gap-2">
                                <span class="material-icons-sharp text-base">location_on</span>
                                <span>${client.address || t('misc.not_applicable')}</span>
                            </div>
                        </div>
                        <div class="flex justify-between items-center text-center border-t border-border-color pt-4">
                            <div>
                                <label class="text-xs text-text-subtle">Projects</label>
                                <strong class="block font-semibold">${projectCount}</strong>
                            </div>
                            <div>
                                <label class="text-xs text-text-subtle">Revenue</label>
                                <strong class="block font-semibold">${formatCurrency(revenueForClient, 'USD')}</strong>
                            </div>
                            <div>
                                <label class="text-xs text-text-subtle">Since</label>
                                <strong class="block font-semibold">${firstInvoiceDate ? formatDate(firstInvoiceDate.toISOString(), { year: 'numeric', month: '2-digit', day: '2-digit'}) : t('misc.not_applicable')}</strong>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 border-t border-border-color pt-4">
                            <button class="flex-1 px-3 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary-hover" data-client-id="${client.id}">View Details</button>
                            <button class="px-3 py-2 text-sm font-medium rounded-md bg-content border border-border-color hover:bg-background" data-modal-target="addClient" data-client-id="${client.id}">Edit</button>
                            <button class="px-3 py-2 text-sm font-medium rounded-md bg-content border border-border-color hover:bg-background text-danger" data-delete-client-id="${client.id}">Delete</button>
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
