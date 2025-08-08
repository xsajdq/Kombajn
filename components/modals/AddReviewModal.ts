import { getState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { renderSelect, renderTextarea } from './formControls.ts';
import { html, TemplateResult } from 'lit-html';
import type { AddReviewModalData } from '../../types.ts';

export function AddReviewModal() {
    const state = getState();
    const modalData = (state.ui.modal.data || {}) as AddReviewModalData;
    const { employeeId } = modalData;
    const employee = state.users.find(u => u.id === employeeId);
    
    const title = t('modals.add_review_title', { name: employee?.name || '' });
    const body = html`
        <form id="addReviewForm" data-employee-id="${employeeId}" class="space-y-4">
            ${renderSelect({
                id: 'reviewRating', label: t('modals.rating'), required: true,
                options: [1, 2, 3, 4, 5].map(n => ({ value: n.toString(), text: `${n} star${n > 1 ? 's' : ''}`}))
            })}
            ${renderTextarea({ id: 'reviewNotes', label: t('modals.review_notes'), rows: 5, required: true })}
        </form>
    `;
    const footer = html`
        <button class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 btn-close-modal">${t('modals.cancel')}</button>
        <button class="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-hover" id="modal-save-btn">${t('modals.save')}</button>
    `;

    return { title, body, footer };
}