import { getState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { renderTextInput, renderSelect, modalFormGridClasses, formGroupClasses, labelClasses } from './formControls.ts';
import { html, TemplateResult } from 'lit-html';

export function AddExpenseModal() {
    const state = getState();
    const projects = state.projects.filter(p => p.workspaceId === state.activeWorkspaceId);
    
    const title = t('budget.modal_add_expense_title');
    const body = html`
        <form id="addExpenseForm" class="space-y-4">
            <div class="${modalFormGridClasses}">
                ${renderTextInput({ id: 'expenseDescription', label: t('budget.modal_expense_description'), required: true })}
                ${renderTextInput({ id: 'expenseAmount', label: t('budget.modal_expense_amount'), type: 'number', required: true, min: 0, step: 0.01 })}
            </div>
             <div class="${modalFormGridClasses}">
                ${renderTextInput({ id: 'expenseDate', label: t('budget.modal_expense_date'), type: 'date', value: new Date().toISOString().slice(0, 10), required: true })}
                ${renderTextInput({ id: 'expenseCategory', label: t('budget.modal_expense_category') })}
            </div>
            ${renderSelect({
                id: 'expenseProject', label: t('budget.modal_expense_project'),
                options: [{ value: '', text: '--' }, ...projects.map(p => ({ value: p.id, text: p.name }))]
            })}
             <div class="${formGroupClasses}">
                <label class="flex items-center gap-2">
                    <input type="checkbox" id="expenseIsBillable" class="h-4 w-4 rounded text-primary focus:ring-primary">
                    <span class="text-sm font-medium">Is this a billable expense?</span>
                </label>
            </div>
        </form>
    `;
    const footer = html`
        <button class="btn-close-modal">${t('modals.cancel')}</button>
        <button class="btn btn-primary" id="modal-save-btn">${t('modals.save')}</button>
    `;

    return { title, body, footer };
}