import { getState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { renderTextInput } from './formControls.ts';
import { html, TemplateResult } from 'lit-html';
import type { AddProjectSectionModalData } from '../../types.ts';

export function AddProjectSectionModal() {
    const modalData = (getState().ui.modal.data || {}) as AddProjectSectionModalData;
    const title = t('modals.add_project_section_title');
    const body = html`
        <form id="add-project-section-form" data-project-id="${modalData.projectId}">
            ${renderTextInput({ id: 'project-section-name', label: 'Section Name', required: true })}
        </form>
    `;
    const footer = html`
        <button class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 btn-close-modal">${t('modals.cancel')}</button>
        <button class="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-hover" id="modal-save-btn">${t('modals.save')}</button>
    `;

    return { title, body, footer, maxWidth: 'max-w-md' };
}