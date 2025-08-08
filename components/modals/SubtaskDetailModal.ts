import { getState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { html, TemplateResult } from 'lit-html';
import type { SubtaskDetailModalData } from '../../types.ts';
// Assume renderSidebar and other helpers are available or re-implemented here.
// For now, this will be a simplified version.

export function SubtaskDetailModal() {
    const modalData = (getState().ui.modal.data || {}) as SubtaskDetailModalData;
    const task = getState().tasks.find(t => t.id === modalData.taskId);
    if (!task) return null;

    const title = task.name;
    const body = html`
        <div class="subtask-detail-container" data-task-id="${task.id}">
            <textarea class="form-control" data-field="description" placeholder="Add a description...">${task.description || ''}</textarea>
        </div>
    `;
    const footer = html`
        <button class="btn-close-modal">${t('panels.close')}</button>
    `;

    return { title, body, footer, maxWidth: 'max-w-lg' };
}