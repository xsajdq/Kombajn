import { getState } from '../../state.ts';
import { t } from '../../i18n.ts';
import type { DashboardWidget, User, ConfigureWidgetModalData } from '../../types.ts';
import { renderSelect } from './formControls.ts';
import { html, TemplateResult } from 'lit-html';

export function ConfigureWidgetModal() {
    const state = getState();
    const modalData = (state.ui.modal.data || {}) as ConfigureWidgetModalData;
    const widget = modalData.widget as DashboardWidget;
    const title = t('modals.configure_widget');
    
    let body: TemplateResult | string = '';
    let footer: TemplateResult | string = '';

    if (widget.type === 'todaysTasks') {
        const workspaceMembers = state.workspaceMembers
            .filter(m => m.workspaceId === state.activeWorkspaceId)
            .map(m => state.users.find(u => u.id === m.userId))
            .filter(Boolean) as User[];
        const currentUserId = widget.config?.userId || state.currentUser?.id;
        body = html`
            <form id="configure-widget-form" data-widget-id="${widget.id}">
                ${renderSelect({
                    id: 'userId', label: 'Show tasks for:', value: currentUserId,
                    options: workspaceMembers.map(u => ({ value: u.id, text: u.name || 'Unknown User' }))
                })}
            </form>
        `;
        footer = html`
            <button class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 btn-close-modal">${t('modals.cancel')}</button>
            <button class="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-hover" id="modal-save-btn">${t('modals.save')}</button>
        `;
    } else {
        body = html`<p class="text-text-subtle">This widget is not configurable.</p>`;
        footer = html`<button class="btn-close-modal">${t('panels.close')}</button>`;
    }
    
    return { title, body, footer };
}