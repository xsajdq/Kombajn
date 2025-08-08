import { getState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { html, TemplateResult } from 'lit-html';
import type { AutomationsModalData } from '../../types.ts';

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
                ${automations.length > 0 ? automations.map(auto => html`
                    <div class="bg-background p-3 rounded-lg flex justify-between items-center">
                        <div>
                            <p class="font-semibold">${auto.name}</p>
                            <p class="text-xs text-text-subtle">When status changes to <strong>${t(`tasks.${auto.trigger.status}`)}</strong>, perform ${auto.actions.length} action(s).</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <button class="btn-icon" data-edit-automation-id="${auto.id}" title="${t('misc.edit')}"><span class="material-icons-sharp text-base">edit</span></button>
                            <button class="btn-icon" data-delete-resource="automations" data-delete-id="${auto.id}" data-delete-confirm="Are you sure you want to delete this automation?" title="${t('modals.delete')}"><span class="material-icons-sharp text-base text-danger">delete</span></button>
                        </div>
                    </div>
                `) : html`<p class="text-sm text-center text-text-subtle py-8">${t('panels.no_automations')}</p>`}
            </div>

            <div id="add-automation-view" class="hidden">
                <!-- Form will be rendered here by click handler -->
            </div>
        </div>
    `;
    const footer = html`<button class="btn-close-modal">${t('panels.close')}</button>`;
    const maxWidth = 'max-w-4xl';

    return { title, body, footer, maxWidth };
}