import { getState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { renderTextarea } from './formControls.ts';
import { html, TemplateResult } from 'lit-html';
import type { EmployeeDetailModalData } from '../../types.ts';

export function EmployeeDetailModal() {
    const state = getState();
    const modalData = (state.ui.modal.data || {}) as EmployeeDetailModalData;
    const user = state.users.find(u => u.id === modalData.userId);
    if (!user) return null;

    const title = `Details for ${user.name}`;
    const body = html`
        <form id="employee-detail-form" data-user-id="${user.id}" class="space-y-4">
            ${renderTextarea({ id: 'contract-info-notes', label: 'Contract Info', value: user.contractInfoNotes, rows: 5 })}
            ${renderTextarea({ id: 'employment-info-notes', label: 'Employment Info', value: user.employmentInfoNotes, rows: 5 })}
        </form>
    `;
    const footer = html`
        <button class="btn-close-modal">${t('modals.cancel')}</button>
        <button class="btn btn-primary" id="modal-save-btn">${t('modals.save')}</button>
    `;

    return { title, body, footer };
}