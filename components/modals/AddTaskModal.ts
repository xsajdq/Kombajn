import { getState } from '../../state.ts';
import { t } from '../../i18n.ts';
import { formGroupClasses, labelClasses, renderTextInput, renderTextarea, renderSelect, renderMultiUserSelect } from './formControls.ts';
import type { ProjectSection, Task, AddTaskModalData } from '../../types.ts';
import { getUserInitials } from '../../utils.ts';
import { html, TemplateResult } from 'lit-html';

export function AddTaskModal() {
    const state = getState();
    const modalData = (state.ui.modal.data || {}) as AddTaskModalData;
    const projectIdFromPanel = modalData.projectId;
    
    const workspaceProjects = state.projects.filter(p => {
        if (p.workspaceId !== state.activeWorkspaceId || p.isArchived) return false;
        if (p.privacy === 'public') return true;
        return state.projectMembers.some(pm => pm.projectId === p.id && pm.userId === state.currentUser?.id);
    });
     const workspaceMembers = state.workspaceMembers
        .filter(m => m.workspaceId === state.activeWorkspaceId)
        .map(m => state.users.find(u => u.id === m.userId))
        .filter(Boolean);

    const workspaceTags = state.tags.filter(t => t.workspaceId === state.activeWorkspaceId);
    const projectSectionsForSelectedProject: ProjectSection[] = projectIdFromPanel 
        ? state.projectSections.filter(ps => ps.projectId === projectIdFromPanel) 
        : [];
    const taskViews = state.taskViews.filter(tv => tv.workspaceId === state.activeWorkspaceId);

    const title = t('modals.add_task_title');
    const body = html`
        <form id="taskForm" class="space-y-4">
            ${renderTextInput({ id: 'taskName', label: t('modals.task_name'), required: true, containerClassName: formGroupClasses })}
            ${renderTextarea({ id: 'taskDescription', label: t('modals.description'), containerClassName: formGroupClasses, rows: 3 })}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                ${renderSelect({
                    id: 'taskProject', label: t('modals.project'), required: true, value: projectIdFromPanel,
                    options: [{value: '', text: t('modals.select_a_project')}, ...workspaceProjects.map(p => ({value: p.id, text: p.name}))]
                })}
                 <div class="${formGroupClasses} ${projectSectionsForSelectedProject.length > 0 ? '' : 'hidden'}" id="project-section-group">
                    <label for="projectSection" class="${labelClasses}">${t('modals.project_section')}</label>
                    <select id="projectSection" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition">
                        <option value="">${t('tasks.default_board')}</option>
                        ${projectSectionsForSelectedProject.map((ps: ProjectSection) => html`<option value="${ps.id}">${ps.name}</option>`)}
                    </select>
                </div>
                ${renderSelect({
                    id: 'taskView', label: t('modals.task_view'),
                    options: [{value: '', text: '-- No View --'}, ...taskViews.map(tv => ({value: tv.id, text: tv.name}))]
                })}
                ${renderMultiUserSelect({
                    id: 'taskAssigneesSelector',
                    label: t('modals.assignees'),
                    users: workspaceMembers as any,
                    selectedUserIds: [],
                    unassignedText: t('modals.unassigned'),
                    containerClassName: formGroupClasses
                })}
                <div class="${formGroupClasses}">
                    <label class="${labelClasses}">${t('modals.dates')}</label>
                    <div class="grid grid-cols-2 gap-2">
                         ${renderTextInput({ id: 'taskStartDate', label: '', value: new Date().toISOString().slice(0, 10), type: 'date', containerClassName: '' })}
                         ${renderTextInput({ id: 'taskDueDate', label: '', type: 'date', containerClassName: '' })}
                    </div>
                </div>
                 ${renderSelect({
                    id: 'taskPriority', label: t('modals.priority'), value: 'medium',
                    options: [
                        { value: '', text: t('modals.priority_none') },
                        { value: 'low', text: t('modals.priority_low') },
                        { value: 'medium', text: t('modals.priority_medium') },
                        { value: 'high', text: t('modals.priority_high') },
                    ]
                 })}
                ${renderTextInput({ id: 'taskEstimatedHours', label: t('modals.estimated_hours'), placeholder: 'e.g., 4h, 30m, 1.5h' })}
                 ${renderSelect({
                    id: 'taskType', label: t('modals.task_type'),
                    options: [
                        { value: '', text: '--' },
                        { value: 'feature', text: t('modals.task_type_feature') },
                        { value: 'bug', text: t('modals.task_type_bug') },
                        { value: 'chore', text: t('modals.task_type_chore') },
                    ]
                 })}
                <div class="${formGroupClasses} sm:col-span-2">
                    <label class="${labelClasses}">${t('modals.tags')}</label>
                    <div id="taskTagsSelector" class="multiselect-container" data-type="tag">
                         <div class="multiselect-display">
                            <span class="subtle-text">Select tags...</span>
                        </div>
                        <div class="multiselect-dropdown hidden">
                            <div class="multiselect-list">
                            ${workspaceTags.map(tag => html`
                                <label class="multiselect-list-item">
                                    <input type="checkbox" name="taskTags" value="${tag.id}">
                                    <span class="tag-chip" style="background-color: ${tag.color}20; border-color: ${tag.color}">${tag.name}</span>
                                </label>
                            `)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    `;
    const footer = html`
        <button class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 btn-close-modal">${t('modals.cancel')}</button>
        <button class="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-hover" id="modal-save-btn">${t('modals.save')}</button>
    `;
    const maxWidth = 'max-w-3xl';
    
    return { title, body, footer, maxWidth };
}