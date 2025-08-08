import { getState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { renderTextInput, renderSelect, renderTextarea, modalFormGridClasses } from './formControls.ts';
import { html, TemplateResult } from 'lit-html';
import type { User, AssignInventoryItemModalData } from '../../types.ts';

export function AssignInventoryItemModal() {
    const state = getState();
    const modalData = getState().ui.modal.data! as AssignInventoryItemModalData;
    const item = state.inventoryItems.find(i => i.id === modalData.itemId);
    const employees = state.workspaceMembers
        .filter(m => m.workspaceId === state.activeWorkspaceId)
        .map(m => state.users.find(u => u.id === m.userId))
        .filter((u): u is User => !!u);

    if (!item) return null;
    
    const title = `${t('modals.modal_assign_item_title')}: ${item.name}`;
    const body = html`
        <form id="assignInventoryItemForm" data-item-id="${item.id}" class="space-y-4">
            ${renderSelect({
                id: 'assign-employee-select', label: t('modals.modal_assign_to'), required: true,
                options: employees.map(e => ({ value: e.id, text: e.name || '' }))
            })}
            <div class="${modalFormGridClasses}">
                ${renderTextInput({ id: 'assignmentDate', label: t('modals.modal_assignment_date'), type: 'date', value: new Date().toISOString().slice(0, 10), required: true })}
                ${renderTextInput({ id: 'returnDate', label: t('modals.modal_return_date'), type: 'date' })}
            </div>
            ${renderTextInput({ id: 'serialNumber', label: t('modals.modal_serial_number') })}
            ${renderTextarea({ id: 'notes', label: t('modals.modal_notes'), rows: 3 })}
        </form>
    `;
    const footer = html`
        <button class="btn-close-modal">${t('modals.cancel')}</button>
        <button class="btn btn-primary" id="modal-save-btn">${t('modals.save')}</button>
    `;

    return { title, body, footer };
}