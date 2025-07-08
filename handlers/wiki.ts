

import { state, saveState, generateId } from '../state.ts';
import { t } from '../i18n.ts';
import { WikiHistory } from '../types.ts';
import { closeModal } from './ui.ts';
import { renderApp } from '../app-renderer.ts';

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
    renderApp();
}

export function updateProjectWiki(projectId: string, content: string) {
    const project = state.projects.find(p => p.id === projectId);
    if (project && state.currentUser) {
        // Don't save if content is identical
        if (project.wikiContent === content) return;

        // Save the current state to history before updating
        const historyEntry: WikiHistory = {
            id: generateId(),
            projectId: projectId,
            content: project.wikiContent,
            userId: state.currentUser.id,
            createdAt: new Date().toISOString(),
        };
        state.wikiHistory.push(historyEntry);

        project.wikiContent = content;
        saveState();
        
        const statusEl = document.getElementById('wiki-save-status');
        if (statusEl) {
            statusEl.textContent = t('panels.saved');
            setTimeout(() => {
                if (statusEl) statusEl.textContent = '';
            }, 2000);
        }
    }
}

export function handleRestoreWikiVersion(historyId: string) {
    const historyEntry = state.wikiHistory.find(h => h.id === historyId);
    if (!historyEntry) return;

    const project = state.projects.find(p => p.id === historyEntry.projectId);
    if (!project || !state.currentUser) return;

    // Save the current version to history before restoring an old one
    const currentContentHistory: WikiHistory = {
        id: generateId(),
        projectId: project.id,
        content: project.wikiContent,
        userId: state.currentUser.id,
        createdAt: new Date().toISOString(),
    };
    state.wikiHistory.push(currentContentHistory);
    
    // Restore content
    project.wikiContent = historyEntry.content;
    
    // The user is restoring, so they probably want to view it, not edit it.
    state.ui.isWikiEditing = false;

    closeModal(); // This also saves and re-renders
}