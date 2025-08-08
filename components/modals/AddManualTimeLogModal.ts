import { t } from '../../i18n.ts';
import { getState } from '../../state.ts';
import { formControlClasses, formGroupClasses, labelClasses, renderSelect, renderTextInput, renderTextarea } from './formControls.ts';
import { html, TemplateResult } from 'lit-html';
import type { AddManualTimeLogModalData } from '../../types.ts';

function renderTimePicker(initialSeconds: number = 0) {
    const hours = Math.floor(initialSeconds / 3600);
    // Snap to the nearest 5 minutes for the initial selection
    const minutes = Math.round((initialSeconds % 3600) / 60 / 5) * 5;

    const hoursOptions = Array.from({ length: 24 }, (_, i) => html`<div class="time-picker-option ${i === hours ? 'selected' : ''}" data-value="${i}">${String(i).padStart(2, '0')}</div>`);
    const minutesOptions = Array.from({ length: 12 }, (_, i) => {
        const minute = i * 5;
        return html`<div class="time-picker-option ${minute === minutes ? 'selected' : ''}" data-value="${minute}">${String(minute).padStart(2, '0')}</div>`;
    });

    return html`
        <div class="time-picker">
            <input type="hidden" id="time-picker-seconds" value="${initialSeconds}">
            <div class="time-picker-column" id="time-picker-hours">${hoursOptions}</div>
            <div class="time-picker-column" id="time-picker-minutes">${minutesOptions}</div>
        </div>
    `;
}

export function AddManualTimeLogModal() {
    const state = getState();
    const modalData = (getState().ui.modal.data ?? {}) as AddManualTimeLogModalData;
    const { taskId, selectedProjectId } = modalData;

    const projects = state.projects.filter(p => p.workspaceId === state.activeWorkspaceId);
    let tasks = state.tasks.filter(t => t.workspaceId === state.activeWorkspaceId && !t.isArchived);
    if (selectedProjectId) {
        tasks = tasks.filter(t => t.projectId === selectedProjectId);
    }

    const title = t('modals.add_manual_time_log_title');
    const body = html`
        <form id="manualTimeLogForm" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
                ${renderSelect({
                    id: 'timeLogProject', label: t('modals.project'), value: selectedProjectId || tasks.find(t => t.id === taskId)?.projectId,
                    options: [{ value: '', text: '--' }, ...projects.map(p => ({ value: p.id, text: p.name }))]
                })}
                ${renderSelect({
                    id: 'timeLogTask', label: t('tasks.col_task'), value: taskId, required: true,
                    options: [{ value: '', text: '--' }, ...tasks.map(t => ({ value: t.id, text: t.name }))]
                })}
            </div>
            <div class="grid grid-cols-2 gap-4">
                 ${renderTextInput({ id: 'timeLogDate', label: t('modals.date_worked'), type: 'date', value: new Date().toISOString().slice(0, 10), required: true })}
                 ${renderTextInput({ id: 'timeLogStartTime', label: t('modals.start_time'), type: 'time', value: '09:00', required: true })}
            </div>
            <div class="${formGroupClasses}">
                <label class="${labelClasses}">${t('modals.time_to_log')}</label>
                ${renderTimePicker(0)}
            </div>
             ${renderTextarea({ id: 'timeLogComment', label: 'Comment (optional)', rows: 2 })}
        </form>
    `;
    const footer = html`
        <button class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 btn-close-modal">${t('modals.cancel')}</button>
        <button class="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-hover" id="modal-save-btn">${t('modals.save_log')}</button>
    `;
    
    return { title, body, footer };
}