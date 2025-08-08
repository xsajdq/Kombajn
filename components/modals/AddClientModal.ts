import { getState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { modalFormGridClasses, renderTextInput, renderSelect, formControlClasses } from './formControls.ts';
import type { AddClientModalData, Client } from '../../types.ts';
import { html, TemplateResult } from 'lit-html';

function renderClientContactFormRow(contact?: any): TemplateResult {
    const id = contact?.id || `new-${Date.now()}`;
    return html`
        <div class="grid grid-cols-[1fr,1fr,1fr,1fr,auto] gap-2 items-center contact-form-row" data-contact-id="${id}">
            <input type="text" class="${formControlClasses}" data-field="name" placeholder="${t('modals.contact_person')}" value="${contact?.name || ''}" required>
            <input type="email" class="${formControlClasses}" data-field="email" placeholder="${t('modals.email')}" value="${contact?.email || ''}">
            <input type="text" class="${formControlClasses}" data-field="phone" placeholder="${t('modals.phone')}" value="${contact?.phone || ''}">
            <input type="text" class="${formControlClasses}" data-field="role" placeholder="${t('modals.contact_role')}" value="${contact?.role || ''}">
            <button type="button" class="p-2 text-danger hover:bg-danger/10 rounded-full remove-contact-row-btn" title="${t('modals.remove_item')}"><span class="material-icons-sharp">delete</span></button>
        </div>
    `;
}

export function AddClientModal() {
    const state = getState();
    const modalData = (state.ui.modal.data || {}) as AddClientModalData;
    const workspaceClients = state.clients.filter(c => c.workspaceId === state.activeWorkspaceId);

    const isEdit = !!modalData.clientId;
    const client = isEdit ? workspaceClients.find(c => c.id === modalData.clientId) : null;
    const contacts = client?.contacts || [];
    
    const title = isEdit ? t('modals.edit_client_title') : t('modals.add_client_title');
    const body = html`
        <form id="clientForm" class="space-y-4">
            <input type="hidden" id="clientId" value="${client?.id || ''}">
            <div class="${modalFormGridClasses}">
                ${renderTextInput({ id: 'clientName', label: t('modals.company_name'), value: client?.name, required: true })}
                ${renderTextInput({ id: 'clientVatId', label: t('modals.vat_id'), value: client?.vatId })}
                ${renderTextInput({ id: 'clientCategory', label: t('modals.category'), value: client?.category })}
                ${renderSelect({
                    id: 'clientHealthStatus', label: t('modals.health_status'), value: client?.healthStatus || undefined,
                    options: [
                        { value: '', text: '--' },
                        { value: 'good', text: t('modals.health_status_good') },
                        { value: 'at_risk', text: t('modals.health_status_at_risk') },
                        { value: 'neutral', text: t('modals.health_status_neutral') },
                    ]
                })}
                 ${renderSelect({
                    id: 'clientStatus', label: t('modals.status'), value: client?.status || 'active',
                    options: [ { value: 'active', text: 'Active' }, { value: 'archived', text: 'Archived' } ]
                })}
            </div>

            <h4 class="text-md font-semibold pt-4 mt-4 border-t border-border-color">${t('modals.contacts')}</h4>
            <div id="client-contacts-container" class="space-y-2">
                ${contacts.map(renderClientContactFormRow)}
            </div>
            <button type="button" id="add-contact-row-btn" class="mt-2 px-3 py-1.5 text-sm font-medium text-text-main bg-background border border-border-color rounded-md hover:bg-border-color transition-colors flex items-center gap-1">
                <span class="material-icons-sharp text-base">add</span> ${t('modals.add_contact')}
            </button>
            <input type="hidden" id="deleted-contact-ids" value="">
        </form>
    `;
    const footer = html`
        <button class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 btn-close-modal">${t('modals.cancel')}</button>
        <button class="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-hover" id="modal-save-btn">${t('modals.save')}</button>
    `;

    return { title, body, footer };
}