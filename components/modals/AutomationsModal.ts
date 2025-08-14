

import { getState, setState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { html, TemplateResult } from 'lit-html';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import type { AutomationsModalData, Automation, AutomationTrigger, AutomationCondition, AutomationAction, Task } from '../../types.ts';
import { renderTextInput, renderSelect } from './formControls.ts';
import { generateId } from '../../state.ts';

function renderTrigger(trigger: AutomationTrigger) {
    const taskStatues: Task['status'][] = ['backlog', 'todo', 'inprogress', 'inreview', 'done'];
    const triggerOptions = [
        { value: 'taskStatusChanged', text: 'Task status is changed' },
        { value: 'taskCreated', text: 'Task is created' }
    ];

    let triggerSpecifics = html``;
    if (trigger.type === 'taskStatusChanged') {
        triggerSpecifics = html`
            <span class="text-sm">to</span>
            <select name="trigger-value" class="form-control">
                ${taskStatues.map(s => html`<option value="${s}" ?selected=${s === trigger.to}>${t(`tasks.${s}`)}</option>`)}
            </select>
        `;
    }

    return html`
        <div class="automation-builder-row">
            <span class="font-semibold">When</span>
            <select name="trigger-type" class="form-control">
                ${triggerOptions.map(opt => html`<option value="${opt.value}" ?selected=${opt.value === trigger.type}>${opt.text}</option>`)}
            </select>
            ${triggerSpecifics}
        </div>
    `;
}

function renderCondition(condition: AutomationCondition, index: number) {
    const state = getState();
    const conditionFields = [
        { value: 'taskPriority', text: 'Task Priority' },
        { value: 'taskAssignee', text: 'Task Assignee' }
    ];

    let operators: { value: string, text: string }[] = [];
    let valueInput = html``;

    switch(condition.field) {
        case 'taskPriority':
            operators = [{value: 'is', text: 'is'}, {value: 'isNot', text: 'is not'}];
            valueInput = html`
                <select name="condition-value-${index}" class="form-control">
                    <option value="high" ?selected=${condition.value === 'high'}>High</option>
                    <option value="medium" ?selected=${condition.value === 'medium'}>Medium</option>
                    <option value="low" ?selected=${condition.value === 'low'}>Low</option>
                </select>
            `;
            break;
        case 'taskAssignee':
            const members = state.workspaceMembers.map(m => state.users.find(u => u.id === m.userId)).filter(Boolean);
            operators = [{value: 'is', text: 'is'}, {value: 'isNot', text: 'is not'}, {value: 'isSet', text: 'is set'}, {value: 'isUnset', text: 'is not set'}];
            if (condition.operator !== 'isSet' && condition.operator !== 'isUnset') {
                 valueInput = html`
                    <select name="condition-value-${index}" class="form-control">
                        ${members.map(m => html`<option value="${m!.id}" ?selected=${condition.value === m!.id}>${m!.name}</option>`)}
                    </select>
                `;
            }
            break;
    }

    return html`
         <div class="automation-builder-row" data-condition-index="${index}">
            <span class="font-semibold">And if</span>
            <select name="condition-field-${index}" class="form-control">
                ${conditionFields.map(opt => html`<option value="${opt.value}" ?selected=${opt.value === condition.field}>${opt.text}</option>`)}
            </select>
            <select name="condition-operator-${index}" class="form-control">
                ${operators.map(opt => html`<option value="${opt.value}" ?selected=${opt.value === condition.operator}>${opt.text}</option>`)}
            </select>
            ${valueInput}
            <button type="button" class="btn-icon" data-remove-condition-index="${index}"><span class="material-icons-sharp">close</span></button>
        </div>
    `;
}

function renderAction(action: AutomationAction, index: number) {
    const state = getState();
    const actionTypes = [
        { value: 'changeStatus', text: 'Change status to' },
        { value: 'assignUser', text: 'Assign user to' },
        { value: 'changePriority', text: 'Change priority to' }
    ];

    let valueInput = html``;
    switch(action.type) {
        case 'changeStatus':
            const taskStatues: Task['status'][] = ['backlog', 'todo', 'inprogress', 'inreview', 'done'];
            valueInput = html`
                <select name="action-value-${index}" class="form-control">
                    ${taskStatues.map(s => html`<option value="${s}" ?selected=${s === action.status}>${t(`tasks.${s}`)}</option>`)}
                </select>
            `;
            break;
        case 'assignUser':
            const members = state.workspaceMembers.map(m => state.users.find(u => u.id === m.userId)).filter(Boolean);
            valueInput = html`
                 <select name="action-value-${index}" class="form-control">
                    ${members.map(m => html`<option value="${m!.id}" ?selected=${action.userId === m!.id}>${m!.name}</option>`)}
                </select>
            `;
            break;
        case 'changePriority':
            valueInput = html`
                <select name="action-value-${index}" class="form-control">
                    <option value="high" ?selected=${action.priority === 'high'}>High</option>
                    <option value="medium" ?selected=${action.priority === 'medium'}>Medium</option>
                    <option value="low" ?selected=${action.priority === 'low'}>Low</option>
                </select>
            `;
            break;
    }

    return html`
        <div class="automation-builder-row" data-action-index="${index}">
            <span class="font-semibold">Then</span>
            <select name="action-type-${index}" class="form-control">${actionTypes.map(opt => html`<option value="${opt.value}" ?selected=${opt.value === action.type}>${opt.text}</option>`)}</select>
            ${valueInput}
            <button type="button" class="btn-icon" data-remove-action-index="${index}"><span class="material-icons-sharp">close</span></button>
        </div>
    `;
}

function renderAutomationForm(automation?: Automation) {
    const defaultTrigger: AutomationTrigger = { type: 'taskStatusChanged', to: 'inprogress' };
    const defaultCondition: AutomationCondition = { field: 'taskPriority', operator: 'is', value: 'high' };
    const defaultAction: AutomationAction = { type: 'assignUser', userId: getState().currentUser!.id };

    return html`
        <form id="add-automation-form" data-automation-id="${automation?.id || ''}" class="bg-background p-4 rounded-lg border border-border-color space-y-4">
            ${renderTextInput({ id: 'automation-name', label: 'Automation Name', value: automation?.name || '', required: true, containerClassName: '' })}
            
            <div id="trigger-container" class="space-y-2">
                 <h4 class="font-semibold text-sm">Trigger</h4>
                ${renderTrigger(automation?.trigger || defaultTrigger)}
            </div>

            <div id="conditions-container" class="space-y-2">
                <div class="flex justify-between items-center">
                    <h4 class="font-semibold text-sm">Conditions</h4>
                    <button type="button" id="add-condition-btn" class="btn btn-secondary btn-sm">Add Condition</button>
                </div>
                ${(automation?.conditions || []).map((cond, i) => renderCondition(cond, i))}
            </div>

            <div id="actions-container" class="space-y-2">
                 <div class="flex justify-between items-center">
                    <h4 class="font-semibold text-sm">Actions</h4>
                    <button type="button" id="add-action-btn" class="btn btn-secondary btn-sm">Add Action</button>
                </div>
                ${(automation?.actions || []).map((act, i) => renderAction(act, i))}
            </div>

            <div class="flex justify-end gap-2 pt-4 border-t border-border-color">
                <button type="button" id="cancel-automation-form-btn" class="btn btn-secondary">${t('modals.cancel')}</button>
                <button type="button" id="save-automation-btn" class="btn btn-primary">${t('modals.save')}</button>
            </div>
        </form>
    `;
}

export function AutomationsModal() {
    const state = getState();
    const modalData = (state.ui.modal.data || {}) as AutomationsModalData;
    const projectId = modalData.projectId;
    const project = state.projects.find(p => p.id === projectId);
    const title = t('modals.automations_title', { projectName: project?.name || 'Project' });
    const automations = state.automations.filter(a => a.projectId === projectId);

    const body = html`
        <div class="space-y-6">
            <div class="flex justify-between items-center">
                <h4 class="font-semibold">${t('panels.automations_title')}</h4>
                <button id="show-add-automation-form-btn" class="btn btn-primary btn-sm">
                    <span class="material-icons-sharp text-base">add</span>
                    ${t('panels.add_automation')}
                </button>
            </div>

            <div id="automations-list" class="space-y-2">
                ${automations.length > 0 ? automations.map(auto => {
                    let triggerDescription = '';
                    if (auto.trigger.type === 'taskStatusChanged') {
                        triggerDescription = `When a task is moved to <strong>${t(`tasks.${auto.trigger.to}`)}</strong>...`;
                    } else if (auto.trigger.type === 'taskCreated') {
                        triggerDescription = 'When a task is created...';
                    }
                    return html`
                        <div class="bg-background p-3 rounded-lg flex justify-between items-center">
                            <div>
                                <p class="font-semibold">${auto.name}</p>
                                <p class="text-xs text-text-subtle">${unsafeHTML(triggerDescription)}</p>
                            </div>
                            <div class="flex items-center gap-2">
                                <button class="btn-icon" data-edit-automation-id="${auto.id}" title="${t('misc.edit')}"><span class="material-icons-sharp text-base">edit</span></button>
                                <button class="btn-icon" data-delete-resource="automations" data-delete-id="${auto.id}" data-delete-confirm="Are you sure you want to delete this automation?" title="${t('modals.delete')}"><span class="material-icons-sharp text-base text-danger">delete</span></button>
                            </div>
                        </div>
                    `;
                }) : html`<p class="text-sm text-center text-text-subtle py-8">${t('panels.no_automations')}</p>`}
            </div>

            <div id="add-automation-view" class="hidden">
                ${renderAutomationForm()}
            </div>
        </div>
    `;
    const footer = html`<button class="btn-close-modal">${t('panels.close')}</button>`;
    const maxWidth = 'max-w-4xl';

    return { title, body, footer, maxWidth };
}
