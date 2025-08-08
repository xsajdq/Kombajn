import { getState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { renderTextarea } from './formControls.ts';
import { html, TemplateResult } from 'lit-html';
import type { RejectTimeOffRequestModalData } from '../../types.ts';

export function RejectTimeOffRequestModal() {
    const modalData = (getState().ui.modal.data || {}) as RejectTimeOffRequestModalData;
    const title = 'Reject Time Off Request';
    const body = html`
        <form id="reject-time-off-form" data-request-id="${modalData.requestId}">
            ${renderTextarea({ id: 'rejection-reason', label: 'Reason for Rejection', required: true })}
        </form>
    `;
    const footer = html`
        <button class="btn-close-modal">${t('modals.cancel')}</button>
        <button class="btn btn-danger" id="modal-save-btn">${t('hr.reject')}</button>
    `;

    return { title, body, footer };
}