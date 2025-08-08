import { getState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { modalFormGridClasses, renderTextInput, renderSelect, formGroupClasses, labelClasses } from './formControls.ts';
import type { AddProjectModalData, Project } from '../../types.ts';
import { getUserInitials } from '../../utils.ts';
import { html, TemplateResult } from 'lit-html';

export function AddProjectModal() {
    const state = getState();
    const modalData = (state.ui.modal.data || {}) as AddProjectModalData;
    const workspaceProjects = state.projects.filter(p => {
        if (p.workspaceId !== state.activeWorkspaceId || p.isArchived) return false;
        if (p.privacy === 'public') return true;
        return state.projectMembers.some(pm => pm.projectId === p.id && pm.userId === state.currentUser?.id);
    });
    const workspaceClients = state.clients.filter(c => c.workspaceId === state.activeWorkspaceId);
    const workspaceMembers = state.workspaceMembers
        .filter(m => m.workspaceId === state.activeWorkspaceId)
        .map(m => state.users.find(u => u.id === m.userId))
        .filter(Boolean);

    const isEdit = !!modalData.projectId;
    const project = isEdit ? workspaceProjects.find(p => p.id === modalData.projectId) : null;
    const title = isEdit ? `Edit Project` : t('modals.add_project_title');
    const templates = state.projectTemplates.filter(pt => pt.workspaceId === state.activeWorkspaceId);
    
    const existingMemberIds = isEdit ? new Set(state.projectMembers.filter(pm => pm.projectId === project!.id).map(pm => pm.userId)) : new Set([state.currentUser?.id]);
    const projectNameFromDeal = modalData.projectName;
    const workspaceTags = state.tags.filter(t => t.workspaceId === state.activeWorkspaceId);
    const projectTagIds = isEdit ? new Set(state.projectTags.filter(pt => pt.projectId === project!.id).map(pt => pt.tagId)) : new Set();

    const body = html`
        <form id="projectForm" class="space-y-4">
             <input type="hidden" id="projectId" value="${project?.id || ''}">
             ${renderTextInput({ id: 'projectName', label: t('modals.project_name'), value: project?.name || projectNameFromDeal, required: true, containerClassName: formGroupClasses })}
            <div class="${modalFormGridClasses}">
                ${renderSelect({
                    id: 'projectClient', label: t('modals.assign_to_client'), value: project?.clientId || modalData.clientId, required: true,
                    options: [ { value: '', text: t('modals.select_a_client') }, ...workspaceClients.map(c => ({ value: c.id, text: c.name })) ]
                })}
                ${renderSelect({
                    id: 'projectTemplate', label: t('modals.create_from_template'), disabled: isEdit,
                    options: [ { value: '', text: t('modals.select_template') }, ...templates.map(t => ({ value: t.id, text: t.name })) ]
                })}
                ${renderTextInput({ id: 'projectHourlyRate', label: t('modals.hourly_rate'), value: project?.hourlyRate, type: 'number', placeholder: 'e.g. 100', min: 0, step: 0.01 })}
                ${renderTextInput({ id: 'projectBudgetHours', label: 'Budget (hours)', value: project?.budgetHours, type: 'number', placeholder: 'e.g. 100', min: 0 })}
                ${renderTextInput({ id: 'projectBudgetCost', label: t('modals.budget_cost'), value: project?.budgetCost, type: 'number', placeholder: 'e.g. 10000', min: 0 })}
                ${renderTextInput({ id: 'projectCategory', label: t('modals.project_category'), value: project?.category, placeholder: 'e.g. Marketing' })}
            </div>
             <div class="${formGroupClasses}">
                <label class="${labelClasses}">${t('modals.tags')}</label>
                <div id="projectTagsSelector" class="multiselect-container" data-entity-type="project" ${isEdit ? `data-entity-id="${project!.id}"` : ''}>
                    <div class="multiselect-display">
                        <span class="subtle-text">Select tags...</span>
                    </div>
                    <div class="multiselect-dropdown hidden">
                        <div class="multiselect-list">
                            ${workspaceTags.map(tag => html`
                                <label class="multiselect-list-item">
                                    <input type="checkbox" name="project_tags" value="${tag.id}" ?checked=${projectTagIds.has(tag.id)}>
                                    <span class="tag-chip" style="background-color: ${tag.color}20; border-color: ${tag.color}">${tag.name}</span>
                                </label>
                            `)}
                        </div>
                    </div>
                </div>
            </div>
            <div class="${formGroupClasses}">
                <label class="${labelClasses}">${t('modals.privacy')}</label>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <input type="radio" id="privacy-public" name="privacy" value="public" class="sr-only peer" ?checked=${project?.privacy === 'public' || !isEdit}>
                        <label for="privacy-public" class="flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer transition-all h-full border-border-color peer-checked:bg-primary/10 peer-checked:border-primary peer-checked:ring-2 peer-checked:ring-primary">
                            <span class="material-icons-sharp text-3xl mb-2">public</span>
                            <strong>${t('modals.privacy_public')}</strong>
                            <p class="text-xs text-text-subtle text-center">${t('modals.privacy_public_desc')}</p>
                        </label>
                    </div>
                    <div>
                        <input type="radio" id="privacy-private" name="privacy" value="private" class="sr-only peer" ?checked=${project?.privacy === 'private'}>
                        <label for="privacy-private" class="flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer transition-all h-full border-border-color peer-checked:bg-primary/10 peer-checked:border-primary peer-checked:ring-2 peer-checked:ring-primary">
                            <span class="material-icons-sharp text-3xl mb-2">lock</span>
                            <strong>${t('modals.privacy_private')}</strong>
                            <p class="text-xs text-text-subtle text-center">${t('modals.privacy_private_desc')}</p>
                        </label>
                    </div>
                </div>
            </div>

            <div id="project-members-section" class="form-group ${project?.privacy !== 'private' && isEdit ? 'hidden' : ''} transition-all duration-300">
                <label class="${labelClasses}">${t('modals.invite_members')}</label>
                <div class="max-h-40 overflow-y-auto border border-border-color rounded-lg p-2 space-y-2">
                    ${workspaceMembers.map(user => {
                        if (!user) return '';
                        const isCreator = user.id === state.currentUser?.id;
                        const isExistingMember = isEdit && existingMemberIds.has(user.id);
                        const displayName = user.name || user.email || 'Unnamed User';

                        return html`
                        <label class="flex items-center gap-2 p-1.5 rounded-md hover:bg-background">
                            <input type="checkbox" name="project_members" value="${user.id}" class="h-4 w-4 rounded text-primary focus:ring-primary" ?checked=${isCreator || isExistingMember} ?disabled=${isCreator}>
                            <div class="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold">${getUserInitials(user)}</div>
                            <span class="text-sm">${displayName} ${isCreator ? `(${t('hr.you')})` : ''}</span>
                        </label>
                        `;
                    })}
                </div>
            </div>
        </form>
    `;
    const footer = html`
        <button class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 btn-close-modal">${t('modals.cancel')}</button>
        <button class="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-hover" id="modal-save-btn">${t('modals.save')}</button>
    `;

    return { title, body, footer };
}