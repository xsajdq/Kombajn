import { getState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { renderSelect, renderTextInput, modalFormGridClasses } from './formControls.ts';
import { html, TemplateResult } from 'lit-html';

export function AddTimeOffRequestModal() {
    const title = t('team_calendar.add_leave');
    const today = new Date().toISOString().slice(0, 10);
    const body = html`
        <form id="time-off-request-form" class="space-y-4">
            ${renderSelect({
                id: 'time-off-type',
                label: 'Type',
                options: [
                    { value: 'vacation', text: t('team_calendar.leave_type_vacation') },
                    { value: 'sick_leave', text: t('team_calendar.leave_type_sick_leave') },
                    { value: 'other', text: t('team_calendar.leave_type_other') },
                ]
            })}
            <div class="${modalFormGridClasses}">
                ${renderTextInput({ id: 'time-off-start-date', label: 'Start Date', type: 'date', value: today, required: true })}
                ${renderTextInput({ id: 'time-off-end-date', label: 'End Date', type: 'date', value: today, required: true })}
            </div>
        </form>
    `;
    const footer = html`
        <button class="btn-close-modal">${t('modals.cancel')}</button>
        <button class="btn btn-primary" id="modal-save-btn">Submit Request</button>
    `;
    
    return { title, body, footer };
}