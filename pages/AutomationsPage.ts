
import { getState, setState } from '../state.ts';
import { t } from '../i18n.ts';
import { can } from '../permissions.ts';
import { fetchAutomationsForWorkspace } from '../handlers/automations.ts';
import type { Automation } from '../types.ts';
import { html, TemplateResult } from 'lit-html';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';

export async function initAutomationsPage() {
    const state = getState();
    const { activeWorkspaceId } = state;
    if (!activeWorkspaceId) return;

    // A simple check if automations are already loaded.
    // This can be improved with a more robust loading state similar to other pages if needed.
    if (state.automations.length === 0 || state.automations.every(a => a.workspaceId !== activeWorkspaceId)) {
        await fetchAutomationsForWorkspace(activeWorkspaceId);
    }
}

function renderAutomationRow(automation: Automation): TemplateResult {
    const state = getState();
    const project = automation.projectId ? state.projects.find(p => p.id === automation.projectId) : null;
    const scope = project ? project.name : t('automations.scope_workspace');
    
    let triggerDescription = '';
    if (automation.trigger.type === 'taskStatusChanged') {
        triggerDescription = `When task status becomes <strong>${t(`tasks.${automation.trigger.to}`)}</strong>`;
    } else if (automation.trigger.type === 'taskCreated') {
        triggerDescription = `When a task is created`;
    }

    return html`
        <tr>
            <td class="px-4 py-3 font-medium">${automation.name}</td>
            <td class="px-4 py-3">
                <label class="toggle-switch">
                    <input type="checkbox" class="toggle-switch-input" ?checked=${automation.isEnabled}>
                    <div class="toggle-switch-track">
                        <span class="toggle-switch-thumb"></span>
                    </div>
                </label>
            </td>
            <td class="px-4 py-3">${scope}</td>
            <td class="px-4 py-3">${unsafeHTML(triggerDescription)}</td>
            <td class="px-4 py-3">${automation.actions.length}</td>
            <td class="px-4 py-3 text-right">
                <button class="btn-icon" data-modal-target="automations" data-automation-id="${automation.id}" data-project-id="${automation.projectId || ''}">${t('misc.edit')}</button>
            </td>
        </tr>
    `;
}

export function AutomationsPage(): TemplateResult {
    const state = getState();
    const canManage = can('manage_automations');
    const automations = state.automations.filter(a => a.workspaceId === state.activeWorkspaceId);

    return html`
        <div class="space-y-6">
            <div class="flex justify-between items-center">
                <div>
                    <h2 class="text-2xl font-bold">${t('automations.title')}</h2>
                    <p class="text-text-subtle">${t('automations.subtitle')}</p>
                </div>
                ${canManage ? html`<button class="btn btn-primary" data-modal-target="automations" data-project-id="">${t('automations.new_automation')}</button>` : ''}
            </div>

            <div class="bg-content rounded-lg shadow-sm">
                ${automations.length > 0 ? html`
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="text-xs text-text-subtle uppercase bg-background">
                            <tr>
                                <th class="px-4 py-2 text-left">${t('automations.col_name')}</th>
                                <th class="px-4 py-2 text-left">${t('automations.col_status')}</th>
                                <th class="px-4 py-2 text-left">${t('automations.col_scope')}</th>
                                <th class="px-4 py-2 text-left">${t('automations.col_trigger')}</th>
                                <th class="px-4 py-2 text-left">${t('automations.col_actions')}</th>
                                <th class="px-4 py-2 text-right"></th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-border-color">
                            ${automations.map(renderAutomationRow)}
                        </tbody>
                    </table>
                </div>
                ` : html`
                <div class="text-center p-8">
                    <p class="font-semibold">${t('automations.no_automations_title')}</p>
                    <p class="text-sm text-text-subtle mt-1">${t('automations.no_automations_desc')}</p>
                </div>
                `}
            </div>
        </div>
    `;
}
