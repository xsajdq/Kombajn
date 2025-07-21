import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { can } from '../permissions.ts';
import { formatCurrency, formatDate } from '../utils.ts';

export function ClientsPage() {
    const { activeWorkspaceId } = state;
    if (!activeWorkspaceId) return '';

    const clients = state.clients.filter(c => c.workspaceId === activeWorkspaceId);
    const canManage = can('manage_clients');

    // Calculate summary stats
    const totalClients = clients.length;
    // For now, "active" means any client that exists.
    const activeClients = totalClients;
    const totalProjects = state.projects.filter(p => p.workspaceId === activeWorkspaceId).length;
    
    const totalRevenue = state.invoices
        .filter(i => i.workspaceId === activeWorkspaceId && i.status === 'paid')
        .reduce((sum, invoice) => {
            return sum + invoice.items.reduce((itemSum, item) => itemSum + item.quantity * item.unitPrice, 0);
        }, 0);

    return `
    <div class="clients-page-container">
        <div class="page-header">
            <div>
                <h2>${t('clients.title')}</h2>
                <p class="subtle-text">Manage your client relationships</p>
            </div>
            <button class="btn btn-primary" data-modal-target="addClient" ${!canManage ? 'disabled' : ''}>
                <span class="material-icons-sharp">add</span> Add Client
            </button>
        </div>

        <div class="clients-toolbar card">
            <div class="form-group search-group">
                 <span class="material-icons-sharp">search</span>
                 <input type="text" id="client-search" class="form-control" placeholder="Search clients...">
            </div>
            <div class="form-group">
                <select id="client-status-filter" class="form-control">
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
            </div>
            <button class="btn btn-secondary">
                <span class="material-icons-sharp">filter_list</span>
                Filter
            </button>
        </div>

        <div class="clients-summary-grid">
            <div class="summary-card">
                <div class="summary-card-icon" style="color: #3b82f6; background-color: #dbeafe;">
                    <span class="material-icons-sharp">business</span>
                </div>
                <div class="summary-card-info">
                    <p>Total Clients</p>
                    <strong>${totalClients}</strong>
                </div>
            </div>
            <div class="summary-card">
                <div class="summary-card-icon" style="color: #22c55e; background-color: #dcfce7;">
                    <span class="material-icons-sharp">person</span>
                </div>
                <div class="summary-card-info">
                    <p>Active Clients</p>
                    <strong>${activeClients}</strong>
                </div>
            </div>
            <div class="summary-card">
                <div class="summary-card-icon" style="color: #a855f7; background-color: #f3e8ff;">
                    <span class="material-icons-sharp">folder</span>
                </div>
                <div class="summary-card-info">
                    <p>Total Projects</p>
                    <strong>${totalProjects}</strong>
                </div>
            </div>
            <div class="summary-card">
                <div class="summary-card-icon" style="color: #f97316; background-color: #ffedd5;">
                    <span class="material-icons-sharp">payments</span>
                </div>
                <div class="summary-card-info">
                    <p>Total Revenue</p>
                    <strong>${formatCurrency(totalRevenue, 'USD')}</strong>
                </div>
            </div>
        </div>

        ${clients.length > 0 ? `
            <div class="clients-grid-v2">
                ${clients.map(client => {
                    const projectsForClient = state.projects.filter(p => p.clientId === client.id);
                    const projectCount = projectsForClient.length;
                    
                    const revenueForClient = state.invoices
                        .filter(i => i.clientId === client.id && i.status === 'paid')
                        .reduce((sum, invoice) => sum + invoice.items.reduce((itemSum, item) => itemSum + item.quantity * item.unitPrice, 0), 0);
                    
                    const clientInvoices = state.invoices.filter(i => i.clientId === client.id);
                    const sinceDate = clientInvoices.length > 0 
                        ? clientInvoices.reduce((earliest, inv) => new Date(inv.issueDate) < new Date(earliest) ? inv.issueDate : earliest, clientInvoices[0].issueDate)
                        : null;

                    const primaryContact = client.contacts && client.contacts.length > 0 ? client.contacts[0] : {
                        name: client.contactPerson,
                        email: client.email,
                        phone: client.phone,
                        role: 'Primary Contact'
                    };
                    
                    const initials = (client.name || '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

                    return `
                    <div class="card client-card-v2">
                        <div class="client-card-v2-header">
                            <div class="client-avatar">${initials}</div>
                            <div class="client-info">
                                <strong>${client.name}</strong>
                                <p>${primaryContact?.name || ''}</p>
                            </div>
                            <span class="status-tag active">Active</span>
                        </div>
                        <div class="client-card-v2-body">
                            <div class="contact-item">
                                <span class="material-icons-sharp">email</span>
                                <span>${primaryContact?.email || t('misc.not_applicable')}</span>
                            </div>
                            <div class="contact-item">
                                <span class="material-icons-sharp">phone</span>
                                <span>${primaryContact?.phone || t('misc.not_applicable')}</span>
                            </div>
                             <div class="contact-item">
                                <span class="material-icons-sharp">location_on</span>
                                <span>${client.address || t('misc.not_applicable')}</span>
                            </div>
                        </div>
                        <div class="client-card-v2-footer">
                            <div class="footer-stat">
                                <label>Projects</label>
                                <strong>${projectCount}</strong>
                            </div>
                            <div class="footer-stat">
                                <label>Revenue</label>
                                <strong>${formatCurrency(revenueForClient, 'USD')}</strong>
                            </div>
                            <div class="footer-stat">
                                <label>Since</label>
                                <strong>${sinceDate ? sinceDate.replace(/-/g, '-') : t('misc.not_applicable')}</strong>
                            </div>
                        </div>
                        <div class="client-card-v2-actions">
                            <button class="btn btn-primary" data-client-id="${client.id}">View Details</button>
                            <button class="btn btn-secondary" data-modal-target="addClient" data-client-id="${client.id}">Edit</button>
                            <button class="btn btn-secondary danger" data-delete-client-id="${client.id}">Delete</button>
                        </div>
                    </div>
                `}).join('')}
            </div>
        ` : `
            <div class="empty-state">
                <span class="material-icons-sharp">people_outline</span>
                <h3>${t('clients.no_clients_yet')}</h3>
                <p>${t('clients.no_clients_desc')}</p>
                 <button class="btn btn-primary" data-modal-target="addClient" ${!canManage ? 'disabled' : ''}>
                    ${t('clients.add_client')}
                </button>
            </div>
        `}
    </div>
    `;
}
