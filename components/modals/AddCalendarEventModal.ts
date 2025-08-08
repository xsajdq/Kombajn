import { getState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { renderTextInput, renderSelect, modalFormGridClasses } from './formControls.ts';
import { html, TemplateResult } from 'lit-html';

export function AddCalendarEventModal() {
    const title = t('team_calendar.add_event');
    const today = new Date().toISOString().slice(0, 10);

    const body = html`
        <form id="add-calendar-event-form" class="space-y-4">
            ${renderTextInput({ id: 'event-title', label: 'Title', required: true })}
            <div class="${modalFormGridClasses}">
                ${renderTextInput({ id: 'event-start-date', label: 'Start Date', type: 'date', value: today, required: true })}
                ${renderTextInput({ id: 'event-end-date', label: 'End Date', type: 'date', value: today, required: true })}
            </div>
            ${renderSelect({
                id: 'event-type', label: 'Type',
                options: [
                    { value: 'event', text: t('team_calendar.event') },
                    { value: 'on-call', text: t('team_calendar.on-call') },
                ]
            })}
        </form>
    `;
    const footer = html`
        <button class="btn-close-modal">${t('modals.cancel')}</button>
        <button class="btn btn-primary" id="modal-save-btn">${t('modals.save')}</button>
    `;
    
    return { title, body, footer };
}