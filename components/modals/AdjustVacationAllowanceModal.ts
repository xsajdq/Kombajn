import { getState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { renderTextInput } from './formControls.ts';
import { html, TemplateResult } from 'lit-html';
import type { AdjustVacationAllowanceModalData } from '../../types.ts';

export function AdjustVacationAllowanceModal() {
    const state = getState();
    const modalData = getState().ui.modal.data! as AdjustVacationAllowanceModalData;
    const user = state.users.find(u => u.id === modalData.userId);
    if (!user) return null;
    
    const title = `Adjust Vacation for ${user.name}`;
    const body = html`
        <form id="adjust-vacation-form" data-user-id="${user.id}">
            ${renderTextInput({
                id: 'vacation-allowance',
                label: `Total Vacation Allowance (${t('hr.hours')})`,
                type: 'number',
                value: modalData.currentAllowance,
                required: true
            })}
        </form>
    `;
    const footer = html`
        <button class="btn-close-modal">${t('modals.cancel')}</button>
        <button class="btn btn-primary" id="modal-save-btn">${t('modals.save')}</button>
    `;
    
    return { title, body, footer };
}