
import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { can } from '../permissions.ts';

function renderDetailItem(icon: string, label: string, value: string | undefined | null) {
    return `
        <div class="client-detail-item">
            <span class="material-icons-sharp">${icon}</span>
            <div>
                <label>${label}</label>
                <p>${value || t('misc.not_applicable')}</p>
            </div>
        </div>
    `;
}

export function ClientDetailPanel({ clientId }: { clientId: string }) {
    const client = state.clients.find(c => c.id === clientId && c.workspaceId === state.activeWorkspaceId);
    if (!client) return '';
    const associatedProjects = state.projects.filter(p => p.clientId === clientId && p.workspaceId === state.activeWorkspaceId);
    const canManage = can('manage_clients');
    
    let healthBadgeClass = '';
    let healthText = t('misc.not_applicable');
    let healthIcon = 'favorite_border';

    if (client.healthStatus) {
        if (client.healthStatus === 'good') {
            healthBadgeClass = 'health-good';
            healthText = t('modals.health_status_good');
            healthIcon = 'favorite';
        } else if (client.healthStatus === 'at_risk') {
            healthBadgeClass = 'health-at-risk';
            healthText = t('modals.health_status_at_risk');
            healthIcon = 'heart_broken';
        } else {
            healthBadgeClass = 'health-neutral';
            healthText = t('modals.health_status_neutral');
        }
    }


    return `
        <div class="side-panel" role="region" aria-label="Client Details Panel">
            <div class="side-panel-header">
                <h2>${client.name}</h2>
                <button class="btn-icon" data-copy-link="clients/${client.id}" title="${t('misc.copy_link')}">
                    <span class="material-icons-sharp">link</span>
                </button>
                 <button class="btn btn-secondary btn-sm" data-modal-target="addClient" data-client-id="${client.id}" ${!canManage ? 'disabled' : ''}>${t('misc.edit')}</button>
                 <button class="btn-icon btn-close-panel" aria-label="${t('panels.close')}">
                    <span class="material-icons-sharp">close</span>
                </button>
            </div>
            <div class="side-panel-content">
                <div class="side-panel-section">
                    <h4>${t('panels.client_details')}</h4>
                     <div class="client-detail-grid">
                        ${renderDetailItem('badge', t('modals.vat_id'), client.vatId)}
                        ${renderDetailItem('category', t('modals.category'), client.category)}
                    </div>
                     <div class="health-status-badge ${healthBadgeClass}">
                        <span class="material-icons-sharp">${healthIcon}</span>
                        <span>${healthText}</span>
                    </div>
                </div>

                <div class="side-panel-section">
                    <h4>${t('panels.client_contacts')}</h4>
                     ${client.contacts.length > 0 ? `
                        <div class="contact-card-list">
                            ${client.contacts.map(contact => `
                                <div class="contact-card-new">
                                    <div class="contact-card-header">
                                        <strong>${contact.name}</strong>
                                        <p class="subtle-text">${contact.role || 'Contact'}</p>
                                    </div>
                                    <div class="contact-card-body">
                                        <span><span class="material-icons-sharp icon-sm">alternate_email</span> ${contact.email || t('misc.not_applicable')}</span>
                                        <span><span class="material-icons-sharp icon-sm">call</span> ${contact.phone || t('misc.not_applicable')}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                         <p class="subtle-text">No contacts added.</p>
                    `}
                </div>

                <div class="side-panel-section">
                    <h4>${t('panels.associated_projects')}</h4>
                     ${associatedProjects.length > 0 ? `
                        <div class="item-list associated-projects-list">
                            ${associatedProjects.map(project => `
                                <div class="item-card clickable" data-project-id="${project.id}" role="button" tabindex="0">
                                    <span class="material-icons-sharp">folder</span>
                                    <div style="flex-grow: 1;">
                                        <strong>${project.name}</strong>
                                    </div>
                                    <span class="material-icons-sharp">chevron_right</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                         <p class="subtle-text">${t('panels.projects_soon')}</p>
                    `}
                </div>
            </div>
        </div>
    `;
}
