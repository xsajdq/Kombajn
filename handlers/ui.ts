import { state, saveState } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
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
            return; // showModal calls renderApp
    }
    renderApp();
}

function updateUrlOnPanelClose() {
    // When a panel closes, revert the URL to the main page URL for that section
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
    renderApp();
    if (state.ui.isCommandPaletteOpen) {
        document.getElementById('command-palette-input')?.focus();
    }
}

export function toggleTaskFilters(force?: boolean) {
    state.ui.tasks.isFilterOpen = force ?? !state.ui.tasks.isFilterOpen;
    renderApp();
}

export function openProjectPanel(projectId: string) {
    if (document.activeElement instanceof HTMLElement) {
        lastFocusedElement = document.activeElement;
    }
    state.ui.openedProjectId = projectId;
    state.ui.openedClientId = null;
    state.ui.openedDealId = null;
    state.ui.openedProjectTab = 'overview'; // Reset to default tab
    state.ui.isWikiEditing = false; // Ensure wiki edit mode is off
}

export function openClientPanel(clientId: string) {
    if (document.activeElement instanceof HTMLElement) {
        lastFocusedElement = document.activeElement;
    }
    state.ui.openedClientId = clientId;
    state.ui.openedProjectId = null;
    state.ui.openedDealId = null;
}

export function openDealPanel(dealId: string) {
    if (document.activeElement instanceof HTMLElement) {
        lastFocusedElement = document.activeElement;
    }
    state.ui.openedDealId = dealId;
    state.ui.openedProjectId = null;
    state.ui.openedClientId = null;
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
        state.ui.isWikiEditing = false; // Reset wiki edit state when any panel closes
        updateUrlOnPanelClose(); // Update URL when panel is closed
        if (shouldRender) {
            renderApp();
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
        // Ensure that items array exists for new invoices.
        if (!modalData.items) {
            modalData.items = [{ id: Date.now().toString(), invoiceId: '', description: '', quantity: 1, unitPrice: 0 }];
        }
        // Initialize dates if they don't exist in the data
        if (!modalData.issueDate) {
            modalData.issueDate = new Date().toISOString().slice(0, 10);
        }
        if (!modalData.dueDate) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 14); // Default due date 14 days from now
            modalData.dueDate = dueDate.toISOString().slice(0, 10);
        }
    }
    state.ui.modal = { isOpen: true, type, data: modalData, justOpened: true };
    renderApp();
}

export function closeModal(shouldRender = true) {
    if(state.ui.modal.isOpen){
        const modalType = state.ui.modal.type;
        state.ui.modal = { isOpen: false, type: null, data: undefined, justOpened: false };
        // Reset mention state when any modal closes
        state.ui.mention = { query: null, target: null, activeIndex: 0, rect: null };
        saveState();

        // Update URL if a detail modal was closed
        if (modalType === 'taskDetail') {
            updateUrlOnPanelClose();
        }

        if (shouldRender) {
            renderApp();
        }
        if (lastFocusedElement) {
            lastFocusedElement.focus();
            lastFocusedElement = null;
        }
    }
}