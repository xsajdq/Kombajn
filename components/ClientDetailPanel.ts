import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { getCurrentUserRole } from '../handlers/main.ts';

export function ClientDetailPanel({ clientId }: { clientId: string }) {
    const client = state.clients.find(c => c.id === clientId && c.workspaceId === state.activeWorkspaceId);
    if (!client) return '';
    const associatedProjects = state.projects.filter(p => p.clientId === clientId && p.workspaceId === state.activeWorkspaceId);
    const userRole = getCurrentUserRole();
    const canManage = userRole === 'owner' || userRole === 'manager';

    return `
        <div class="side-panel" role="region" aria-label="Client Details Panel">
            <div class="side-panel-header">
                <h2>${client.name}</h2>
                 <button class="btn-icon btn-close-panel" aria-label="${t('panels.close')}">
                    <span class="material-icons-sharp">close</span>
                </button>
            </div>
            <div class="side-panel-content">
                <div class="card">
                    <div class="card-header-flex">
                       <h4>${t('panels.client_details')}</h4>
                       <button class="btn btn-secondary btn-sm" data-modal-target="addClient" data-client-id-edit="${client.id}" ${!canManage ? 'disabled' : ''}>${t('panels.edit_client')}</button>
                    </div>
                    <div class="client-details-grid" style="margin-top: 1rem;">
                        <div><strong>${t('modals.company_name')}:</strong> <p>${client.name}</p></div>
                        <div><strong>${t('modals.vat_id')}:</strong> <p>${client.vatId || t('misc.not_applicable')}</p></div>
                        <div><strong>${t('modals.contact_person')}:</strong> <p>${client.contactPerson || t('misc.not_applicable')}</p></div>
                        <div><strong>${t('modals.email')}:</strong> <p>${client.email || t('misc.not_applicable')}</p></div>
                        <div><strong>${t('modals.phone')}:</strong> <p>${client.phone || t('misc.not_applicable')}</p></div>
                    </div>
                </div>
                <div class="card">
                    <h4>${t('panels.associated_projects')}</h4>
                     ${associatedProjects.length > 0 ? `
                        <div class="item-list">
                            ${associatedProjects.map(project => `
                                <div class="item-card clickable" data-project-id="${project.id}" role="button" tabindex="0">
                                    <span class="material-icons-sharp">folder</span>
                                    <div style="flex-grow: 1;">
                                        <strong>${project.name}</strong>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                         <p>${t('panels.projects_soon')}</p>
                    `}
                </div>
            </div>
        </div>
    `;
}