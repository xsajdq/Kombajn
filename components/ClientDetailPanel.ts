

import { getState } from '../state.ts';
import { t } from '../i18n.ts';
import { can } from '../permissions.ts';
import { html, TemplateResult } from 'lit-html';

function renderDetailItem(icon: string, label: string, value: string | undefined | null): TemplateResult {
    return html`
        <div class="client-detail-item">
            <span class="material-icons-sharp">${icon}</span>
            <div>
                <label>${label}</label>
                <p>${value || t('misc.not_applicable')}</p>
            </div>
        </div>
    `;
}

export function ClientDetailPanel({ clientId }: { clientId: string }): TemplateResult | '' {
    const state = getState();
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

    const clientTags = state.clientTags.filter(ct => ct.clientId === client.id).map(ct => state.tags.find(t => t.id === ct.tagId)).filter(Boolean);
    const workspaceTags = state.tags.filter(t => t.workspaceId === state.activeWorkspaceId);


    return html`
        <div class="side-panel" role="region" aria-label="Client Details Panel">
            <div class="side-panel-header">
                <h2>${client.name}</h2>
                <div class="flex items-center gap-2">
                    <button class="btn-icon" data-copy-link="clients/${client.slug || client.id}" title="${t('misc.copy_link')}">
                        <span class="material-icons-sharp">link</span>
                    </button>
                    ${canManage ? html`
                        <div class="relative">
                            <button class="btn-icon" data-menu-toggle="client-actions-${client.id}" aria-haspopup="true" aria-expanded="false" title="Client Actions">
                                <span class="material-icons-sharp">more_vert</span>
                            </button>
                            <div id="client-actions-${client.id}" class="absolute top-full right-0 mt-1 w-40 bg-content rounded-md shadow-lg border border-border-color z-10 hidden">
                                <div class="py-1">
                                    <button class="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-background" data-modal-target="addClient" data-client-id="${client.id}">
                                        <span class="material-icons-sharp text-base">edit</span>
                                        ${t('misc.edit')}
                                    </button>
                                    <button class="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm text-danger hover:bg-danger/10" data-delete-resource="clients" data-delete-id="${client.id}" data-delete-confirm="Are you sure you want to delete this client and all associated data (projects, tasks, invoices)? This is irreversible.">
                                        <span class="material-icons-sharp text-base">delete</span>
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    <button class="btn-icon btn-close-panel" aria-label="${t('panels.close')}">
                        <span class="material-icons-sharp">close</span>
                    </button>
                </div>
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
                    <h4>${t('modals.tags')}</h4>
                    <div id="client-tags-selector" class="multiselect-container" data-entity-type="client" data-entity-id="${client.id}">
                        <div class="multiselect-display">
                            ${clientTags.length > 0 ? clientTags.map(tag => html`
                                <div class="selected-tag-item" style="background-color: ${tag!.color}20; border-color: ${tag!.color}80;">
                                    <span>${tag!.name}</span>
                                    <button class="remove-tag-btn" data-tag-id="${tag!.id}">&times;</button>
                                </div>
                            `) : html`<span class="subtle-text">No tags</span>`}
                        </div>
                        <div class="multiselect-dropdown hidden">
                            <div class="multiselect-list">
                                ${workspaceTags.map(tag => {
                                    const isSelected = clientTags.some(ct => ct!.id === tag.id);
                                    return html`
                                    <label class="multiselect-list-item ${isSelected ? 'bg-primary/10' : ''}">
                                        <input type="checkbox" value="${tag.id}" ?checked=${isSelected}>
                                        <span class="tag-chip" style="background-color: ${tag.color}20; border-color: ${tag.color}">${tag.name}</span>
                                    </label>
                                `})}
                            </div>
                            <div class="multiselect-add-new">
                                <input type="text" class="form-control" placeholder="Create new tag...">
                            </div>
                        </div>
                    </div>
                </div>

                <div class="side-panel-section">
                    <h4>${t('panels.client_contacts')}</h4>
                     ${client.contacts && client.contacts.length > 0 ? html`
                        <div class="contact-card-list">
                            ${client.contacts.map(contact => html`
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
                            `)}
                        </div>
                    ` : html`
                         <p class="subtle-text">No contacts added.</p>
                    `}
                </div>

                <div class="side-panel-section">
                    <h4>${t('panels.associated_projects')}</h4>
                     ${associatedProjects.length > 0 ? html`
                        <div class="item-list associated-projects-list">
                            ${associatedProjects.map(project => html`
                                <div class="item-card clickable" data-project-id="${project.id}" role="button" tabindex="0">
                                    <span class="material-icons-sharp">folder</span>
                                    <div style="flex-grow: 1;">
                                        <strong>${project.name}</strong>
                                    </div>
                                    <span class="material-icons-sharp">chevron_right</span>
                                </div>
                            `)}
                        </div>
                    ` : html`
                         <p class="subtle-text">${t('panels.projects_soon')}</p>
                    `}
                </div>
            </div>
        </div>
    `;
}