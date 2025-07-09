

import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { WikiHistory } from '../types.ts';
import { closeModal } from './ui.ts';
import { renderApp } from '../app-renderer.ts';
import { apiPost, apiPut } from '../services/api.ts';

export function startWikiEdit() {
    state.ui.isWikiEditing = true;
    renderApp();
}

export function cancelWikiEdit() {
    state.ui.isWikiEditing = false;
    renderApp();
}

export function saveWikiEdit() {
    const editor = document.getElementById('project-wiki-editor') as HTMLTextAreaElement;
    if (editor && state.ui.openedProjectId) {
        updateProjectWiki(state.ui.openedProjectId, editor.value);
    }
    state.ui.isWikiEditing = false;
    // updateProjectWiki will re-render on success
}

export async function updateProjectWiki(projectId: string, content: string) {
    const project = state.projects.find(p => p.id === projectId);
    if (project && state.currentUser) {
        if (project.wikiContent === content) return;

        const originalContent = project.wikiContent;
        // Optimistic update
        project.wikiContent = content;
        
        const statusEl = document.getElementById('wiki-save-status');
        if (statusEl) statusEl.textContent = t('panels.saved');
        renderApp();


        try {
            // Persist the change
            await apiPut('projects', { id: projectId, wikiContent: content });

            // Persist history entry
            await apiPost('wiki_history', {
                projectId: projectId,
                content: originalContent, // save the previous content
                userId: state.currentUser.id,
            });

            // Fetch latest history to update state (optional, but good practice)
            const history = await apiPost('wiki_history/get_for_project', { projectId });
            state.wikiHistory = history;
            
            setTimeout(() => {
                const currentStatusEl = document.getElementById('wiki-save-status');
                if (currentStatusEl) currentStatusEl.textContent = '';
            }, 2000);

        } catch (error) {
            console.error("Failed to save wiki:", error);
            alert("Could not save wiki content.");
            // Revert on failure
            project.wikiContent = originalContent;
            renderApp();
        }
    }
}

export async function handleRestoreWikiVersion(historyId: string) {
    const historyEntry = state.wikiHistory.find(h => h.id === historyId);
    if (!historyEntry) return;

    // This will save the current content to history and then update with the old content
    await updateProjectWiki(historyEntry.projectId, historyEntry.content);
    
    // The user is restoring, so they probably want to view it, not edit it.
    state.ui.isWikiEditing = false;
    closeModal();
}