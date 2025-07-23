import { state, saveState } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import type { AppState } from '../types.ts';

let lastFocusedElement: HTMLElement | null = null;

export function updateUrlAndShowDetail(type: 'task' | 'project' | 'client' | 'deal', id: string) {
    switch (type) {
        case 'project':
            openProjectPanel(id);
            history.pushState({ id }, '', `/projects/${id}`);
            break;
        case 'client':
            openClientPanel(id);
            history.pushState({ id }, '', `/clients/${id}`);
            break;
        case 'deal':
            openDealPanel(id);
            history.pushState({ id }, '', `/sales/${id}`);
            break;
        case 'task':
            history.pushState({ id }, '', `/tasks/${id}`);
            showModal('taskDetail', { taskId: id });
            return; 
    }
    updateUI(['side-panel']);
}

function updateUrlOnPanelClose() {
    const newPath = `/${state.currentPage}`;
    if (window.location.pathname !== newPath) {
        history.pushState({}, '', newPath);
    }
}

export function toggleCommandPalette(force?: boolean) {
    state.ui.isCommandPaletteOpen = force ?? !state.ui.isCommandPaletteOpen;
    if (state.ui.isCommandPaletteOpen) {
        state.ui.commandPaletteQuery = '';
    }
    updateUI(['command-palette']);
    if (state.ui.isCommandPaletteOpen) {
        document.getElementById('command-palette-input')?.focus();
    }
}

export function toggleTaskFilters(force?: boolean) {
    state.ui.tasks.isFilterOpen = force ?? !state.ui.tasks.isFilterOpen;
    updateUI(['page']);
}

export function openProjectPanel(projectId: string) {
    if (document.activeElement instanceof HTMLElement) {
        lastFocusedElement = document.activeElement;
    }
    state.ui.openedProjectId = projectId;
    state.ui.openedClientId = null;
    state.ui.openedDealId = null;
    state.ui.openedProjectTab = 'overview';
    state.ui.isWikiEditing = false;
    updateUI(['side-panel']);
}

export function openClientPanel(clientId: string) {
    if (document.activeElement instanceof HTMLElement) {
        lastFocusedElement = document.activeElement;
    }
    state.ui.openedClientId = clientId;
    state.ui.openedProjectId = null;
    state.ui.openedDealId = null;
    updateUI(['side-panel']);
}

export function openDealPanel(dealId: string) {
    if (document.activeElement instanceof HTMLElement) {
        lastFocusedElement = document.activeElement;
    }
    state.ui.openedDealId = dealId;
    state.ui.openedProjectId = null;
    state.ui.openedClientId = null;
    updateUI(['side-panel']);
}

export function closeSidePanels(shouldRender = true) {
    let changed = false;
    if (state.ui.openedProjectId) {
        state.ui.openedProjectId = null;
        changed = true;
    }
    if (state.ui.openedClientId) {
        state.ui.openedClientId = null;
        changed = true;
    }
    if (state.ui.openedDealId) {
        state.ui.openedDealId = null;
        changed = true;
    }

    if (changed) {
        state.ui.isWikiEditing = false;
        updateUrlOnPanelClose();
        if (shouldRender) {
            updateUI(['side-panel']);
        }
        if (lastFocusedElement) {
            lastFocusedElement.focus();
            lastFocusedElement = null;
        }
    }
}

export function showModal(type: AppState['ui']['modal']['type'], data?: any) {
    if (document.activeElement instanceof HTMLElement) {
        lastFocusedElement = document.activeElement;
    }
    const modalData = data || {};
    if (type === 'addInvoice') {
        if (!modalData.items) {
            modalData.items = [{ id: Date.now().toString(), invoiceId: '', description: '', quantity: 1, unitPrice: 0 }];
        }
        if (!modalData.issueDate) {
            modalData.issueDate = new Date().toISOString().slice(0, 10);
        }
        if (!modalData.dueDate) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 14);
            modalData.dueDate = dueDate.toISOString().slice(0, 10);
        }
    }
    state.ui.modal = { isOpen: true, type, data: modalData, justOpened: true };
    updateUI(['modal']);
}

export function closeModal(shouldRender = true) {
    if(state.ui.modal.isOpen){
        const modalType = state.ui.modal.type;
        state.ui.modal = { isOpen: false, type: null, data: undefined, justOpened: false };
        state.ui.mention = { query: null, target: null, activeIndex: 0, rect: null };
        saveState();

        if (modalType === 'taskDetail') {
            updateUrlOnPanelClose();
        }

        if (shouldRender) {
            updateUI(['modal']);
        }
        if (lastFocusedElement) {
            lastFocusedElement.focus();
            lastFocusedElement = null;
        }
    }
}
