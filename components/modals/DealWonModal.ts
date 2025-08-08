import { getState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { html, TemplateResult } from 'lit-html';
import type { DealWonModalData } from '../../types.ts';

export function DealWonModal() {
    const modalData = (getState().ui.modal.data || {}) as DealWonModalData;
    const title = 'Deal Won!';
    const body = html`
        <p>Congratulations on winning the deal: <strong>${modalData.dealName}</strong>.</p>
        <p class="mt-4">Would you like to create a new project for this client?</p>
    `;
    const footer = html`
        <button class="btn-close-modal">${t('modals.cancel')}</button>
        <button class="btn btn-primary" id="create-project-from-deal-btn" data-client-id="${modalData.clientId}" data-deal-name="${modalData.dealName}">${t('modals.create_project')}</button>
    `;

    return { title, body, footer };
}