import { getState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { modalFormGridClasses, renderSelect, renderTextarea, formGroupClasses, labelClasses } from './formControls.ts';
import { formatDuration } from '../../utils.ts';
import { html, TemplateResult } from 'lit-html';
import type { AssignGlobalTimeModalData } from '../../types.ts';

export function AssignGlobalTimeModal() {
    const state = getState();
    const modalData = (state.ui.modal.data || {}) as AssignGlobalTimeModalData;
    const { trackedSeconds, selectedProjectId } = modalData;
    
    const workspaceProjects = state.projects.filter(p => {
        if (p.workspaceId !== state.activeWorkspaceId || p.isArchived) return false;
        if (p.privacy === 'public') return true;
        return state.projectMembers.some(pm => pm.projectId === p.id && pm.userId === state.currentUser?.id);
    });
    
    const filteredTasks = selectedProjectId ? state.tasks.filter(t => t.projectId === selectedProjectId) : [];

    const title = t('modals.add_timelog_comment_title');
    const body = html`
        <form id="assignGlobalTimeForm" class="space-y-4">
            <div class="${formGroupClasses}">
                <label for="global-timelog-amount" class="${labelClasses}">Time Tracked: <strong>${formatDuration(trackedSeconds)}</strong></label>
            </div>
             <div class="${modalFormGridClasses}">
                ${renderSelect({
                    id: 'assign-time-project-select', label: t('modals.project'), required: true, value: selectedProjectId,
                    options: [{value: '', text: t('modals.select_a_project')}, ...workspaceProjects.map(p => ({value: p.id, text: p.name}))]
                })}
                 ${renderSelect({
                    id: 'assign-time-task-select', label: t('tasks.col_task'), required: true, disabled: !selectedProjectId,
                    options: [{value: '', text: 'Select a task'}, ...filteredTasks.map(t => ({value: t.id, text: t.name}))]
                 })}
            </div>
            ${renderTextarea({ id: 'assign-time-comment', label: t('modals.comment_placeholder'), rows: 2 })}
        </form>
    `;
    const footer = html`
        <button class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 btn-close-modal">${t('modals.cancel')}</button>
        <button class="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-hover" id="modal-save-btn">${t('modals.save')}</button>
    `;

    return { title, body, footer };
}