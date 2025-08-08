import { getState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { renderTextInput, renderSelect, renderTextarea, formGroupClasses } from './formControls.ts';
import { html, TemplateResult } from 'lit-html';

export function AiProjectPlannerModal() {
    const state = getState();
    const workspaceClients = state.clients.filter(c => c.workspaceId === state.activeWorkspaceId);

    const title = t('modals.ai_planner_title');
    const footer = html`
        <button class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 btn-close-modal">${t('modals.cancel')}</button>
        <button class="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-hover" id="modal-save-btn">${t('modals.create_project')}</button>
    `;
    const body = html`
        <form id="aiProjectForm" class="space-y-4">
            ${renderTextInput({ id: 'aiProjectName', label: t('modals.project_name'), required: true, containerClassName: formGroupClasses })}
            ${renderSelect({
                id: 'aiProjectClient', label: t('modals.assign_to_client'), required: true,
                options: [{value: '', text: t('modals.select_a_client')}, ...workspaceClients.map(c => ({value: c.id, text: c.name}))]
            })}
            ${renderTextarea({ id: 'aiProjectGoal', label: t('modals.ai_planner_goal_label'), required: true, placeholder: t('modals.ai_planner_goal_placeholder'), rows: 4 })}
        </form>
    `;

    return { title, body, footer };
}