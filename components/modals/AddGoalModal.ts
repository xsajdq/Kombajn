import { getState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { renderTextInput, renderTextarea, renderSelect, modalFormGridClasses } from './formControls.ts';
import { html, TemplateResult } from 'lit-html';
import type { User, AddGoalModalData } from '../../types.ts';

export function AddGoalModal() {
    const state = getState();
    const modalData = (getState().ui.modal.data ?? {}) as AddGoalModalData;
    const isEdit = !!modalData.goalId;
    const goal = isEdit ? state.objectives.find(o => o.id === modalData.goalId) : null;
    const milestones = isEdit ? state.keyResults.filter(kr => kr.objectiveId === goal!.id) : [];
    
    const users = state.workspaceMembers
        .filter(m => m.workspaceId === state.activeWorkspaceId)
        .map(m => state.users.find(u => u.id === m.userId))
        .filter((u): u is User => !!u);
        
    const title = isEdit ? t('modals.edit_goal_title') : t('modals.add_goal_title');
    const body = html`
        <form id="addGoalForm" class="space-y-4" data-goal-id="${goal?.id || ''}">
            ${renderTextInput({ id: 'goalTitle', label: t('modals.goal_title'), value: goal?.title, required: true })}
            ${renderTextarea({ id: 'goalDescription', label: t('modals.goal_description'), value: goal?.description, rows: 3 })}
            <div class="${modalFormGridClasses}">
                ${renderSelect({
                    id: 'goalOwner', label: t('modals.goal_owner'), value: goal?.ownerId,
                    options: [{value: '', text: 'Unassigned'}, ...users.map(u => ({ value: u.id, text: u.name || '' }))]
                })}
                ${renderTextInput({ id: 'goalDueDate', label: t('modals.due_date_optional'), type: 'date', value: goal?.dueDate })}
            </div>
             <div class="${modalFormGridClasses}">
                ${renderTextInput({ id: 'goalCategory', label: t('modals.goal_category'), value: goal?.category })}
                ${renderSelect({
                    id: 'goalPriority', label: t('modals.goal_priority'), value: goal?.priority,
                    options: [
                        {value: 'low', text: 'Low'},
                        {value: 'medium', text: 'Medium'},
                        {value: 'high', text: 'High'},
                    ]
                })}
            </div>
            ${renderSelect({
                id: 'goalStatus', label: t('modals.goal_status'), value: goal?.status,
                options: [
                    { value: 'in_progress', text: t('goals.status_in_progress') },
                    { value: 'completed', text: t('goals.status_completed') },
                    { value: 'on_hold', text: t('goals.status_on_hold') },
                ]
            })}
             <div class="pt-4 mt-4 border-t border-border-color">
                <h4 class="font-semibold text-md mb-2">${t('modals.goal_tracking')}</h4>
                <div class="${modalFormGridClasses}">
                    ${renderTextInput({ id: 'goalTargetValue', label: t('modals.goal_target_value'), type: 'number', value: goal?.targetValue, required: true })}
                    ${renderTextInput({ id: 'goalCurrentValue', label: t('modals.goal_current_value'), type: 'number', value: goal?.currentValue, required: true })}
                    ${renderTextInput({ id: 'goalValueUnit', label: t('modals.goal_value_unit'), value: goal?.valueUnit })}
                </div>
            </div>
            <div class="pt-4 mt-4 border-t border-border-color">
                <h4 class="font-semibold text-md mb-2">${t('modals.milestones')}</h4>
                <div id="milestones-container" class="space-y-2">
                    ${milestones.map(ms => html`
                        <div class="milestone-item flex items-center gap-2" data-id="${ms.id}">
                            <input type="checkbox" class="h-4 w-4 rounded text-primary focus:ring-primary milestone-checkbox" data-milestone-id="${ms.id}" ?checked=${ms.completed}>
                            <input type="text" class="form-control flex-grow milestone-input" value="${ms.title}">
                            <button type="button" class="btn-icon remove-milestone-btn"><span class="material-icons-sharp text-base text-danger">delete</span></button>
                        </div>
                    `)}
                </div>
                <div class="flex items-center gap-2 mt-2">
                    <input type="text" id="new-milestone-input" class="form-control" placeholder="Add a new milestone...">
                    <button type="button" id="add-milestone-btn" class="btn btn-secondary">${t('modals.add_milestone')}</button>
                </div>
            </div>
        </form>
    `;
    const footer = html`
        <button class="btn-close-modal">${t('modals.cancel')}</button>
        <button class="btn btn-primary" id="modal-save-btn">${t('modals.save')}</button>
    `;

    return { title, body, footer };
}