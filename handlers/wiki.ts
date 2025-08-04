import { getState, setState } from '../state.ts';
import { t } from '../i18n.ts';
import { WikiHistory } from '../types.ts';
import { closeModal } from './ui.ts';
import { updateUI } from '../app-renderer.ts';
import { apiPost, apiPut } from '../services/api.ts';

export function startWikiEdit() {
    setState(prevState => ({ ui: { ...prevState.ui, isWikiEditing: true } }), ['side-panel']);
}

export function cancelWikiEdit() {
    setState(prevState => ({ ui: { ...prevState.ui, isWikiEditing: false } }), ['side-panel']);
}

export function saveWikiEdit() {
    const editor = document.getElementById('project-wiki-editor') as HTMLTextAreaElement;
    const state = getState();
    if (editor && state.ui.openedProjectId) {
        updateProjectWiki(state.ui.openedProjectId, editor.value);
    }
    setState(prevState => ({ ui: { ...prevState.ui, isWikiEditing: false } }), []);
}

export async function updateProjectWiki(projectId: string, content: string) {
    const state = getState();
    const project = state.projects.find(p => p.id === projectId);
    if (!project || !state.currentUser) return;

    const originalContent = project.wikiContent || '';
    if (originalContent === content) {
        updateUI(['side-panel']);
        return;
    }

    setState(prevState => ({
        projects: prevState.projects.map(p => p.id === projectId ? { ...p, wikiContent: content } : p)
    }), ['side-panel']);
    
    const statusEl = document.getElementById('wiki-save-status');
    if (statusEl) statusEl.textContent = t('panels.saved');

    try {
        await apiPut('projects', { id: projectId, wikiContent: content });

        const newHistoryEntry = await apiPost('wiki_history', {
            projectId: projectId,
            content: originalContent,
            userId: state.currentUser.id,
        });

        if (Array.isArray(newHistoryEntry) && newHistoryEntry[0]) {
            setState(prevState => ({ wikiHistory: [newHistoryEntry[0], ...prevState.wikiHistory] }), []);
        }
        
        setTimeout(() => {
            const currentStatusEl = document.getElementById('wiki-save-status');
            if (currentStatusEl) currentStatusEl.textContent = '';
        }, 2000);

    } catch (error) {
        console.error("Failed to save wiki:", error);
        alert("Could not save wiki content.");
        setState(prevState => ({
            projects: prevState.projects.map(p => p.id === projectId ? { ...p, wikiContent: originalContent } : p)
        }), ['side-panel']);
    }
}

export async function handleRestoreWikiVersion(historyId: string) {
    const state = getState();
    const historyEntry = state.wikiHistory.find(h => h.id === historyId);
    if (!historyEntry) return;

    await updateProjectWiki(historyEntry.projectId, historyEntry.content);
    
    setState(prevState => ({ ui: { ...prevState.ui, isWikiEditing: false } }), []);
    closeModal();
}