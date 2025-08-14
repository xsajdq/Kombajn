import { getState } from '../state.ts';
import { t } from '../i18n.ts';
import { formatDuration, getTaskCurrentTrackedSeconds, formatDate, formatCurrency, getUserInitials } from '../utils.ts';
import type { Task, Project, Attachment, Objective, Automation } from '../types.ts';
import { getUserProjectRole } from '../handlers/main.ts';
import { can } from '../permissions.ts';
import { html, TemplateResult } from 'lit-html';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';

declare const marked: any;
declare const DOMPurify: any;

function formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function renderOverviewTab(project: Project): TemplateResult {
    const state = getState();
    const projectTasks = state.tasks.filter(t => t.projectId === project.id && t.workspaceId === state.activeWorkspaceId);
    const completedTasks = projectTasks.filter(t => t.status === 'done').length;
    const progress = projectTasks.length > 0 ? (completedTasks / projectTasks.length) * 100 : 0;
    const today = new Date().toISOString().slice(0, 10);
    const overdueTasksCount = projectTasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done').length;
    
    const totalTrackedSeconds = projectTasks.reduce((sum, task) => sum + getTaskCurrentTrackedSeconds(task), 0);
    
    let budgetLabel = t('misc.not_applicable');
    if (project.budgetHours && project.budgetHours > 0) {
        budgetLabel = `${formatDuration(totalTrackedSeconds)} / ${project.budgetHours}h`;
    } else if (project.budgetCost && project.budgetCost > 0) {
        const actualCost = project.hourlyRate ? (totalTrackedSeconds / 3600) * project.hourlyRate : 0;
        budgetLabel = `${formatCurrency(actualCost)} / ${formatCurrency(project.budgetCost)}`;
    }

    const dueDates = projectTasks.filter(t => t.dueDate && t.status !== 'done').map(t => new Date(t.dueDate!));
    const latestDueDate = dueDates.length > 0 ? new Date(Math.max(...dueDates.map(d => d.getTime()))) : null;

    const members = state.projectMembers.filter(pm => pm.projectId === project.id);
    const memberUsers = members.map(m => state.users.find(u => u.id === m.userId)).filter(Boolean);

    const projectTags = state.projectTags.filter(pt => pt.projectId === project.id).map(pt => state.tags.find(t => t.id === pt.tagId)).filter(Boolean);

    const objectives = state.objectives.filter(o => o.projectId === project.id);

    const expenses = state.expenses.filter(e => e.projectId === project.id);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    return html`
        <div class="side-panel-content">
            <div class="project-overview-dashboard">
                
                <div class="bg-content p-4 rounded-lg shadow-sm project-health-section">
                    <div class="circular-progress-container">
                        <div class="circular-progress-bg"></div>
                        <div class="circular-progress-bar" style="--progress: ${progress}"></div>
                        <div class="circular-progress-text">${Math.round(progress)}%</div>
                    </div>
                    <div class="project-kpi-grid">
                        <div class="kpi-stat">
                            <span class="material-icons-sharp text-danger">warning_amber</span>
                            <div>
                                <div class="kpi-stat-value">${overdueTasksCount}</div>
                                <div class="kpi-stat-label">${t('panels.tasks_overdue')}</div>
                            </div>
                        </div>
                        <div class="kpi-stat">
                            <span class="material-icons-sharp text-primary">event</span>
                            <div>
                                <div class="kpi-stat-value">${latestDueDate ? formatDate(latestDueDate.toISOString()) : t('misc.not_applicable')}</div>
                                <div class="kpi-stat-label">${t('projects.col_due_date')}</div>
                            </div>
                        </div>
                        <div class="kpi-stat">
                            <span class="material-icons-sharp" style="color: #8b5cf6;">account_balance_wallet</span>
                            <div>
                                <div class="kpi-stat-value">${budgetLabel}</div>
                                <div class="kpi-stat-label">${t('projects.col_budget')}</div>
                            </div>
                        </div>
                         <div class="kpi-stat">
                            <span class="material-icons-sharp" style="color: #10b981;">receipt_long</span>
                            <div>
                                <div class="kpi-stat-value">${formatCurrency(totalExpenses)}</div>
                                <div class="kpi-stat-label">${t('modals.expenses')}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="bg-content p-4 rounded-lg shadow-sm project-team-section">
                        <h4 class="text-sm font-semibold mb-3">${t('panels.team')} (${memberUsers.length})</h4>
                        <div class="flex -space-x-2">
                            ${memberUsers.map(u => u ? html`
                                <div class="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold border-2 border-content" title="${u.name || getUserInitials(u)}">
                                    ${u.avatarUrl ? html`<img src="${u.avatarUrl}" alt="${u.name || ''}" class="w-full h-full rounded-full object-cover">` : getUserInitials(u)}
                                </div>
                            ` : '')}
                        </div>
                    </div>
                    <div class="bg-content p-4 rounded-lg shadow-sm">
                         <h4 class="text-sm font-semibold mb-3">${t('modals.tags')}</h4>
                         <div class="flex flex-wrap gap-1.5">
                            ${projectTags.length > 0 ? projectTags.map(tag => html`<span class="tag-chip" style="background-color: ${tag!.color}20; border-color: ${tag!.color}">${tag!.name}</span>`) : html`<span class="text-xs text-text-subtle">${t('misc.not_applicable')}</span>`}
                         </div>
                    </div>
                </div>
                
                 ${objectives.length > 0 ? html`
                    <div class="bg-content p-4 rounded-lg shadow-sm">
                        <h4 class="text-sm font-semibold mb-3">${t('modals.okrs')}</h4>
                        <div class="space-y-3">
                            ${objectives.map(obj => {
                                const progress = (obj.targetValue && obj.targetValue > 0) ? Math.min(100, (obj.currentValue / obj.targetValue) * 100) : 0;
                                return html`
                                    <div>
                                        <div class="flex justify-between items-center text-xs mb-1">
                                            <span class="font-medium">${obj.title}</span>
                                            <span class="text-text-subtle">${Math.round(progress)}%</span>
                                        </div>
                                        <div class="w-full bg-background rounded-full h-1.5"><div class="bg-primary h-1.5 rounded-full" style="width: ${progress}%;"></div></div>
                                    </div>
                                `;
                            })}
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function renderTasksTab(project: Project) { return html`<div class="p-4">${t('panels.tasks')} coming soon.</div>`; }
function renderWikiTab(project: Project) { return html`<div class="p-4">${t('panels.tab_wiki')} coming soon.</div>`; }
function renderFilesTab(project: Project) { return html`<div class="p-4">${t('panels.tab_files')} coming soon.</div>`; }
function renderAccessTab(project: Project) { return html`<div class="p-4">${t('panels.tab_access')} coming soon.</div>`; }
function renderOkrsTab(project: Project) { return html`<div class="p-4">${t('modals.okrs')} coming soon.</div>`; }
function renderExpensesTab(project: Project) { return html`<div class="p-4">${t('modals.expenses')} coming soon.</div>`; }

function renderAutomationsTab(project: Project): TemplateResult {
    const state = getState();
    const automations = state.automations.filter(a => a.projectId === project.id);
    const canManage = can('manage_automations');

    return html`
        <div class="side-panel-content">
            <div class="flex justify-end mb-4">
                ${canManage ? html`
                    <button class="btn btn-primary btn-sm"
                            data-modal-target="automations"
                            data-project-id="${project.id}">
                        <span class="material-icons-sharp text-base">add</span>
                        ${t('panels.add_automation')}
                    </button>
                ` : ''}
            </div>
            <div class="space-y-2">
                ${automations.length > 0 ? automations.map(auto => {
                    let triggerDescription = '';
                    if (auto.trigger.type === 'taskStatusChanged') {
                        triggerDescription = `When task status becomes <strong>${t(`tasks.${auto.trigger.to}`)}</strong>`;
                    } else if (auto.trigger.type === 'taskCreated') {
                        triggerDescription = `When a task is created`;
                    }
                    return html`
                        <div class="bg-background p-3 rounded-lg flex justify-between items-center">
                            <div>
                                <p class="font-semibold">${auto.name}</p>
                                <p class="text-xs text-text-subtle">${unsafeHTML(triggerDescription)}</p>
                            </div>
                             ${canManage ? html`
                                <div class="flex items-center gap-2">
                                    <button class="btn-icon" data-modal-target="automations" data-automation-id="${auto.id}" data-project-id="${project.id}"><span class="material-icons-sharp text-base">edit</span></button>
                                    <button class="btn-icon" data-delete-resource="automations" data-delete-id="${auto.id}"><span class="material-icons-sharp text-base text-danger">delete</span></button>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }) : html`
                    <div class="text-center py-8">
                        <p class="text-sm text-text-subtle">${t('panels.no_automations')}</p>
                    </div>
                `}
            </div>
        </div>
    `;
}

export function ProjectDetailPanel({ projectId }: { projectId: string }): TemplateResult | '' {
    const state = getState();
    const project = state.projects.find(p => p.id === projectId && p.workspaceId === state.activeWorkspaceId);
    if (!project) return '';

    const { openedProjectTab } = state.ui;
    const canManage = can('manage_projects');

    const tabs = [
        { id: 'overview', text: t('panels.project_overview'), content: renderOverviewTab(project) },
        { id: 'tasks', text: t('panels.tasks'), content: renderTasksTab(project) },
        { id: 'wiki', text: t('panels.tab_wiki'), content: renderWikiTab(project) },
        { id: 'files', text: t('panels.tab_files'), content: renderFilesTab(project) },
        { id: 'access', text: t('panels.tab_access'), content: renderAccessTab(project) },
        { id: 'okrs', text: t('modals.okrs'), content: renderOkrsTab(project) },
        { id: 'expenses', text: t('modals.expenses'), content: renderExpensesTab(project) },
        { id: 'automations', text: t('panels.automations_title'), content: renderAutomationsTab(project) }
    ];
    
    return html`
        <div class="side-panel" role="region" aria-label="Project Details Panel">
            <div class="side-panel-header">
                <h2>${project.name}</h2>
                <div class="flex items-center gap-2">
                    <button class="btn-icon" data-copy-link="projects/${project.slug || project.id}" title="${t('misc.copy_link')}">
                        <span class="material-icons-sharp">link</span>
                    </button>
                    ${canManage ? html`
                        <div class="relative">
                             <button class="btn-icon" data-menu-toggle="project-actions-${project.id}" aria-haspopup="true" aria-expanded="false" title="Project Actions">
                                <span class="material-icons-sharp">more_vert</span>
                            </button>
                            <div id="project-actions-${project.id}" class="absolute top-full right-0 mt-1 w-48 bg-content rounded-md shadow-lg border border-border-color z-10 hidden dropdown-menu">
                                <div class="py-1">
                                    <button class="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-background" data-modal-target="addProject" data-project-id="${project.id}">
                                        <span class="material-icons-sharp text-base">edit</span>
                                        ${t('misc.edit')}
                                    </button>
                                    <button class="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-background" data-save-template-project-id="${project.id}">
                                        <span class="material-icons-sharp text-base">file_copy</span>
                                        ${t('panels.save_as_template')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    <button class="btn-icon btn-close-panel" aria-label="${t('panels.close')}">
                        <span class="material-icons-sharp">close</span>
                    </button>
                </div>
            </div>
            <nav class="side-panel-tabs">
                ${tabs.map(tab => html`
                    <button class="side-panel-tab ${openedProjectTab === tab.id ? 'active' : ''}" 
                            data-tab-group="ui.openedProjectTab" 
                            data-tab-value="${tab.id}">
                        ${tab.text}
                    </button>
                `)}
            </nav>
            ${tabs.find(tab => tab.id === openedProjectTab)?.content || ''}
        </div>
    `;
}
