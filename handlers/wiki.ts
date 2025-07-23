import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { WikiHistory } from '../types.ts';
import { closeModal } from './ui.ts';
import { updateUI } from '../app-renderer.ts';
import { apiPost, apiPut } from '../services/api.ts';

export function startWikiEdit() {
    state.ui.isWikiEditing = true;
    updateUI(['side-panel']);
}

export function cancelWikiEdit() {
    state.ui.isWikiEditing = false;
    updateUI(['side-panel']);
}

export function saveWikiEdit() {
    const editor = document.getElementById('project-wiki-editor') as HTMLTextAreaElement;
    if (editor && state.ui.openedProjectId) {
        updateProjectWiki(state.ui.openedProjectId, editor.value);
    }
    state.ui.isWikiEditing = false;
}

export async function updateProjectWiki(projectId: string, content: string) {
    const project = state.projects.find(p => p.id === projectId);
    if (!project || !state.currentUser) return;

    const originalContent = project.wikiContent || '';
    if (originalContent === content) {
        updateUI(['side-panel']);
        return;
    }

    project.wikiContent = content;
    
    const statusEl = document.getElementById('wiki-save-status');
    if (statusEl) statusEl.textContent = t('panels.saved');
    updateUI(['side-panel']);

    try {
        await apiPut('projects', { id: projectId, wikiContent: content });

        const newHistoryEntry = await apiPost('wiki_history', {
            projectId: projectId,
            content: originalContent,
            userId: state.currentUser.id,
        });

        if (Array.isArray(newHistoryEntry) && newHistoryEntry[0]) {
            state.wikiHistory.unshift(newHistoryEntry[0]);
        }
        
        setTimeout(() => {
            const currentStatusEl = document.getElementById('wiki-save-status');
            if (currentStatusEl) currentStatusEl.textContent = '';
        }, 2000);

    } catch (error) {
        console.error("Failed to save wiki:", error);
        alert("Could not save wiki content.");
        project.wikiContent = originalContent;
        updateUI(['side-panel']);
    }
}

export async function handleRestoreWikiVersion(historyId: string) {
    const historyEntry = state.wikiHistory.find(h => h.id === historyId);
    if (!historyEntry) return;

    await updateProjectWiki(historyEntry.projectId, historyEntry.content);
    
    state.ui.isWikiEditing = false;
    closeModal();
}