import { state, saveState } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { AppState } from '../types.ts';

let lastFocusedElement: HTMLElement | null = null;

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

export function openProjectPanel(projectId: string) {
    if (document.activeElement instanceof HTMLElement) {
        lastFocusedElement = document.activeElement;
    }
    state.ui.openedProjectId = projectId;
    state.ui.openedClientId = null;
    state.ui.openedProjectTab = 'tasks'; // Reset to default tab
    state.ui.isWikiEditing = false; // Ensure wiki edit mode is off
    renderApp();
}

export function openClientPanel(clientId: string) {
    if (document.activeElement instanceof HTMLElement) {
        lastFocusedElement = document.activeElement;
    }
    state.ui.openedClientId = clientId;
    state.ui.openedProjectId = null;
    renderApp();
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
    if (changed) {
        state.ui.isWikiEditing = false; // Reset wiki edit state when any panel closes
    }
    if (changed && shouldRender) {
        const panel = document.querySelector<HTMLElement>('.side-panel');
        if (panel) {
            panel.classList.remove('is-open');
            panel.addEventListener('transitionend', () => {
                renderApp();
                if (lastFocusedElement) {
                    lastFocusedElement.focus();
                    lastFocusedElement = null;
                }
            }, { once: true });
        } else {
           renderApp();
           if (lastFocusedElement) {
               lastFocusedElement.focus();
               lastFocusedElement = null;
           }
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
            modalData.items = [{ id: Date.now(), description: '', quantity: 1, unitPrice: 0 }];
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
        state.ui.modal = { isOpen: false, type: null, data: undefined, justOpened: false };
        // Reset mention state when any modal closes
        state.ui.mention = { query: null, target: null, activeIndex: 0 };
        saveState();
        if (shouldRender) {
            renderApp();
        }
        if (lastFocusedElement) {
            lastFocusedElement.focus();
            lastFocusedElement = null;
        }
    }
}

export function toggleTaskFilters(force?: boolean) {
    state.ui.isTaskFilterOpen = force ?? !state.ui.isTaskFilterOpen;
    // This UI state is ephemeral, no need to save it to localStorage
    renderApp();
}