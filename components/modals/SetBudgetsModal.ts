import { getState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { renderTextInput, modalFormGridClasses } from './formControls.ts';
import { html, TemplateResult } from 'lit-html';
import type { SetBudgetsModalData } from '../../types.ts';

export function SetBudgetsModal() {
    const state = getState();
    const modalData = getState().ui.modal.data! as SetBudgetsModalData;
    const period = modalData.period;
    const budgets = state.budgets.filter(b => b.workspaceId === state.activeWorkspaceId && b.period === period);
    
    const title = t('budget.modal_set_budgets_title');
    const body = html`
        <form id="setBudgetsForm" class="space-y-4" data-period="${period}">
            <div class="grid grid-cols-[1fr,auto] gap-2 items-center text-xs font-semibold text-text-subtle">
                <span>${t('budget.modal_category')}</span>
                <span class="text-right">${t('budget.modal_amount')}</span>
            </div>
            <div id="budgets-container" class="space-y-2">
                ${budgets.map(budget => html`
                    <div class="grid grid-cols-[1fr,auto] gap-2 items-center">
                        <input type="text" class="form-control" name="budget_category_${budget.id}" value="${budget.category}" required>
                        <input type="number" class="form-control w-32 text-right" name="budget_amount_${budget.id}" value="${budget.amount.toFixed(2)}" min="0" step="0.01" required>
                    </div>
                `)}
            </div>
            <button type="button" id="add-budget-category-btn" class="btn btn-secondary btn-sm">${t('budget.modal_add_category')}</button>
        </form>
    `;
    const footer = html`
        <button class="btn-close-modal">${t('modals.cancel')}</button>
        <button class="btn btn-primary" id="modal-save-btn">${t('modals.save')}</button>
    `;

    return { title, body, footer };
}