

import { state, saveState } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import type { AppState } from '../types.ts';

let lastFocusedElement: HTMLElement | null = null;

export function updateUrlAndShowDetail(type: 'task' | 'project' | 'client' | 'deal', id: string) {
    let path = '';
    // Modals are handled differently. Keep its direct call since the URL is more for bookmarking.
    if (type === 'task') {
        path = `/tasks/${id}`;
        if (path && window.location.pathname !== path) {
            history.pushState({ id }, '', path);
        }
        showModal('taskDetail', { taskId: id });
        return;
    }

    // For side panels, we simply change the URL and let the router handle the state change on re-render.
    switch (type) {
        case 'project': path = `/projects/${id}`; break;
        case 'client': path = `/clients/${id}`; break;
        case 'deal': path = `/sales/${id}`; break;
    }

    if (path && window.location.pathname !== path) {
        history.pushState({ id }, '', path);
        // Trigger a re-render which will invoke the router with the new URL
        renderApp();
    } else if (path && window.location.pathname === path) {
        // If URL is correct but panel somehow closed, re-render to enforce state.
        renderApp();
    }
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
    state.ui.isTaskFilterOpen = force ?? !state.ui.isTaskFilterOpen;
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