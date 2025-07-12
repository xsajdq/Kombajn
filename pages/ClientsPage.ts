import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { can } from '../permissions.ts';

export function ClientsPage() {
    const clients = state.clients.filter(c => c.workspaceId === state.activeWorkspaceId);
    const canManage = can('manage_clients');

    return `
    <div>
        <h2>
            <span>${t('clients.title')}</span>
            <button class="btn btn-primary" data-modal-target="addClient" ${!canManage ? 'disabled' : ''}>
                <span class="material-icons-sharp">add</span> ${t('clients.new_client')}
            </button>
        </h2>
        ${clients.length > 0 ? `
            <div class="clients-grid">
                ${clients.map(client => {
                    const activeProjectsCount = state.projects.filter(p => p.clientId === client.id).length;
                    return `
                    <div class="card client-card-new clickable" data-client-id="${client.id}" role="button" tabindex="0">
                        <div class="client-card-main">
                            <div class="client-card-header">
                                <div class="client-icon-wrapper">
                                    <span class="material-icons-sharp">business</span>
                                </div>
                                <h3>${client.name}</h3>
                            </div>
                            <div class="client-card-body">
                               <p><span class="material-icons-sharp icon-sm">person</span> ${client.contactPerson || t('misc.not_applicable')}</p>
                               <p><span class="material-icons-sharp icon-sm">email</span> ${client.email || t('misc.not_applicable')}</p>
                               <p><span class="material-icons-sharp icon-sm">phone</span> ${client.phone || t('misc.not_applicable')}</p>
                            </div>
                        </div>
                        <div class="client-card-stats">
                            <div class="stat-item">
                                <span class="stat-value">${activeProjectsCount}</span>
                                <span class="stat-label">${t('clients.active_projects')}</span>
                            </div>
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