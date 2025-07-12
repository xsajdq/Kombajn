
import { state } from '../state.ts';
import { t } from '../i18n.ts';

export function AIAssistantPage() {
    const { loading, error, suggestedTasks } = state.ai;
    const workspaceProjects = state.projects.filter(p => p.workspaceId === state.activeWorkspaceId);

    let resultsContent = '';
    if (loading) {
        resultsContent = `
            <div class="loading-container">
                <div class="loading-progress-bar"></div>
                <p>AI is thinking...</p>
            </div>`;
    } else if (error) {
        resultsContent = `<div class="ai-error-message">${error}</div>`;
    } else if (suggestedTasks) {
        if (suggestedTasks.length === 0) {
             resultsContent = `<div class="empty-state-ai"><span class="material-icons-sharp">check_circle</span><p>${t('ai_assistant.all_tasks_added')}</p></div>`;
        } else {
             resultsContent = `
                <h4>${t('ai_assistant.suggestions_title')}</h4>
                <div class="ai-suggestions-list">
                    ${suggestedTasks.map((task, index) => `
                        <div class="ai-suggestion-card">
                            <div class="ai-suggestion-content">
                                <strong>${task.name}</strong>
                                <p class="subtle-text">${task.description}</p>
                            </div>
                            <button class="btn btn-secondary btn-sm add-ai-task-btn" data-task-index="${index}">
                                <span class="material-icons-sharp">add</span> ${t('ai_assistant.add_to_project')}
                            </button>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }

    return `
        <div class="ai-assistant-container">
            <h2>${t('ai_assistant.title')}</h2>
            <p class="subtle-text" style="margin-bottom: 2rem;">${t('ai_assistant.description')}</p>

            <div class="card">
                <form id="ai-task-generator-form">
                    <div class="form-group">
                        <label for="ai-prompt">${t('ai_assistant.prompt_label')}</label>
                        <textarea id="ai-prompt" class="form-control" rows="4" placeholder="${t('ai_assistant.prompt_placeholder')}" required></textarea>
                    </div>
                    <div class="form-group" style="margin-top: 1rem;">
                        <label for="ai-project-select">${t('ai_assistant.project_select_label')}</label>
                        <select id="ai-project-select" class="form-control" ${workspaceProjects.length === 0 ? 'disabled' : ''}>
                             ${workspaceProjects.length > 0 ?
                                workspaceProjects.map(p => `<option value="${p.id}">${p.name}</option>`).join('') :
                                `<option>${t('ai_assistant.project_select_empty')}</option>`
                             }
                        </select>
                    </div>
                    <button type="submit" class="btn btn-primary" style="margin-top: 1.5rem;" ${workspaceProjects.length === 0 || loading ? 'disabled' : ''}>
                        <span class="material-icons-sharp">auto_awesome</span>
                        ${loading ? t('ai_assistant.generating_button') : t('ai_assistant.generate_button')}
                    </button>
                </form>
            </div>

            <div id="ai-results-container" class="card">
                ${resultsContent || `<div class="empty-state-ai"><span class="material-icons-sharp">smart_toy</span><p>${t('ai_assistant.suggestions_appear_here')}</p></div>`}
            </div>
        </div>
    `;
}
