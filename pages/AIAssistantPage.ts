
import { state } from '../state.ts';
import { t } from '../i18n.ts';

export function AIAssistantPage() {
    const { loading, error, suggestedTasks } = state.ai;
    const workspaceProjects = state.projects.filter(p => p.workspaceId === state.activeWorkspaceId);

    let resultsContent = '';
    if (loading) {
        resultsContent = `
            <div class="flex flex-col items-center justify-center p-8">
                <div class="w-full max-w-xs text-center">
                    <div class="w-full bg-border-color rounded-full h-1.5 mb-4 overflow-hidden">
                        <div class="bg-primary h-1.5 rounded-full animate-pulse" style="width: 75%"></div>
                    </div>
                    <p class="text-sm text-text-subtle">AI is thinking...</p>
                </div>
            </div>`;
    } else if (error) {
        resultsContent = `<div class="p-4 text-center text-danger bg-danger/10 rounded-md">${error}</div>`;
    } else if (suggestedTasks) {
        if (suggestedTasks.length === 0) {
             resultsContent = `
                <div class="flex flex-col items-center justify-center p-8 text-center">
                    <span class="material-icons-sharp text-4xl text-success">check_circle</span>
                    <p class="mt-2 font-medium">${t('ai_assistant.all_tasks_added')}</p>
                </div>`;
        } else {
             resultsContent = `
                <h4 class="font-semibold px-6">${t('ai_assistant.suggestions_title')}</h4>
                <div class="divide-y divide-border-color">
                    ${suggestedTasks.map((task, index) => `
                        <div class="p-4 flex justify-between items-start gap-4">
                            <div class="flex-1">
                                <strong class="font-semibold">${task.name}</strong>
                                <p class="text-sm text-text-subtle mt-1">${task.description}</p>
                            </div>
                            <button class="px-3 py-1.5 text-xs font-medium flex items-center gap-1 rounded-md bg-content border border-border-color hover:bg-background add-ai-task-btn" data-task-index="${index}">
                                <span class="material-icons-sharp text-base">add</span> ${t('ai_assistant.add_to_project')}
                            </button>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }

    return `
        <div class="max-w-3xl mx-auto space-y-6">
            <div class="text-center">
                <h2 class="text-2xl font-bold">${t('ai_assistant.title')}</h2>
                <p class="text-text-subtle mt-1">${t('ai_assistant.description')}</p>
            </div>

            <div class="bg-content p-6 rounded-lg shadow-sm border border-border-color">
                <form id="ai-task-generator-form" class="space-y-4">
                    <div>
                        <label for="ai-prompt" class="block text-sm font-medium text-text-subtle mb-1.5">${t('ai_assistant.prompt_label')}</label>
                        <textarea id="ai-prompt" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" rows="4" placeholder="${t('ai_assistant.prompt_placeholder')}" required></textarea>
                    </div>
                    <div>
                        <label for="ai-project-select" class="block text-sm font-medium text-text-subtle mb-1.5">${t('ai_assistant.project_select_label')}</label>
                        <select id="ai-project-select" class="w-full bg-background border border-border-color rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" ${workspaceProjects.length === 0 ? 'disabled' : ''}>
                             ${workspaceProjects.length > 0 ?
                                workspaceProjects.map(p => `<option value="${p.id}">${p.name}</option>`).join('') :
                                `<option>${t('ai_assistant.project_select_empty')}</option>`
                             }
                        </select>
                    </div>
                    <button type="submit" class="w-full sm:w-auto px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 rounded-md bg-primary text-white hover:bg-primary-hover disabled:bg-primary/50 disabled:cursor-not-allowed" ${workspaceProjects.length === 0 || loading ? 'disabled' : ''}>
                        <span class="material-icons-sharp text-base">auto_awesome</span>
                        ${loading ? t('ai_assistant.generating_button') : t('ai_assistant.generate_button')}
                    </button>
                </form>
            </div>

            <div id="ai-results-container" class="bg-content rounded-lg shadow-sm border border-border-color">
                ${resultsContent || `
                    <div class="flex flex-col items-center justify-center p-8 text-center">
                        <span class="material-icons-sharp text-4xl text-text-subtle">smart_toy</span>
                        <p class="mt-2 text-text-subtle">${t('ai_assistant.suggestions_appear_here')}</p>
                    </div>
                `}
            </div>
        </div>
    `;
}
