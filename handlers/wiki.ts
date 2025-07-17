

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
    if (!project || !state.currentUser) return;

    const originalContent = project.wikiContent || '';
    if (originalContent === content) {
        // If content hasn't changed, no need to do anything.
        // This is important to prevent creating empty history entries on first save.
        return;
    }

    // Optimistic update
    project.wikiContent = content;
    
    const statusEl = document.getElementById('wiki-save-status');
    if (statusEl) statusEl.textContent = t('panels.saved');
    renderApp();

    try {
        // Persist the new content to the project
        await apiPut('projects', { id: projectId, wikiContent: content });

        // Persist the *previous* content to the history table
        const newHistoryEntry = await apiPost('wiki_history', {
            projectId: projectId,
            content: originalContent,
            userId: state.currentUser.id,
        });

        // Add the new history record to the state. apiPost returns an array.
        if (Array.isArray(newHistoryEntry) && newHistoryEntry[0]) {
            state.wikiHistory.unshift(newHistoryEntry[0]);
        }
        
        // Hide "Saved!" message after 2 seconds
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

export async function handleRestoreWikiVersion(historyId: string) {
    const historyEntry = state.wikiHistory.find(h => h.id === historyId);
    if (!historyEntry) return;

    // This will save the current content to history and then update with the old content
    await updateProjectWiki(historyEntry.projectId, historyEntry.content);
    
    // The user is restoring, so they probably want to view it, not edit it.
    state.ui.isWikiEditing = false;
    closeModal();
}