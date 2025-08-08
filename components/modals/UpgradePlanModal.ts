import { getState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { html, TemplateResult } from 'lit-html';
import type { UpgradePlanModalData } from '../../types.ts';

export function UpgradePlanModal() {
    const modalData = (getState().ui.modal.data || {}) as UpgradePlanModalData;
    const title = "Upgrade Your Plan";
    const body = html`
        <p>${modalData.message || 'You have reached the limit for your current plan.'}</p>
        <p class="mt-2">Please upgrade your plan to continue.</p>
    `;
    const footer = html`
        <button class="btn-close-modal">${t('modals.cancel')}</button>
        <a href="/billing" class="btn btn-primary">Go to Billing</a>
    `;
    
    return { title, body, footer };
}