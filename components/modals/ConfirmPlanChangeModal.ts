import { getState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { html, TemplateResult } from 'lit-html';
import type { ConfirmPlanChangeModalData } from '../../types.ts';

export function ConfirmPlanChangeModal() {
    const modalData = (getState().ui.modal.data || {}) as ConfirmPlanChangeModalData;
    const planName = t(`billing.plan_${modalData.planId}`);
    
    const title = 'Confirm Plan Change';
    const body = html`<p>Are you sure you want to change to the <strong>${planName}</strong> plan?</p>`;
    const footer = html`
        <button class="btn-close-modal">${t('modals.cancel')}</button>
        <button class="btn btn-primary" id="modal-save-btn">${t('billing.btn_change_plan')}</button>
    `;

    return { title, body, footer };
}