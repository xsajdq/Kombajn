
import { getState, setState } from '../state.ts';
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
    const state = getState();
    const newPath = `/${state.currentPage}`;
    if (window.location.pathname !== newPath) {
        history.pushState({}, '', newPath);
    }
}

export function toggleCommandPalette(force?: boolean) {
    const state = getState();
    const isOpen = force ?? !state.ui.isCommandPaletteOpen;
    setState(prevState => ({
        ui: {
            ...prevState.ui,
            isCommandPaletteOpen: isOpen,
            commandPaletteQuery: isOpen ? '' : prevState.ui.commandPaletteQuery,
        }
    }), ['command-palette']);
    
    if (isOpen) {
        document.getElementById('command-palette-input')?.focus();
    }
}

export function toggleTaskFilters(force?: boolean) {
    setState(prevState => ({ ui: { ...prevState.ui, tasks: { ...prevState.ui.tasks, isFilterOpen: force ?? !prevState.ui.tasks.isFilterOpen } } }), ['page']);
}

export function openProjectPanel(projectId: string) {
    if (document.activeElement instanceof HTMLElement) {
        lastFocusedElement = document.activeElement;
    }
    setState(prevState => ({
        ui: {
            ...prevState.ui,
            openedProjectId: projectId,
            openedClientId: null,
            openedDealId: null,
            openedProjectTab: 'overview',
            isWikiEditing: false,
        }
    }), ['side-panel']);
}

export function openClientPanel(clientId: string) {
    if (document.activeElement instanceof HTMLElement) {
        lastFocusedElement = document.activeElement;
    }
    setState(prevState => ({
        ui: {
            ...prevState.ui,
            openedClientId: clientId,
            openedProjectId: null,
            openedDealId: null,
        }
    }), ['side-panel']);
}

export function openDealPanel(dealId: string) {
    if (document.activeElement instanceof HTMLElement) {
        lastFocusedElement = document.activeElement;
    }
    setState(prevState => ({
        ui: {
            ...prevState.ui,
            openedDealId: dealId,
            openedProjectId: null,
            openedClientId: null,
        }
    }), ['side-panel']);
}

export function closeSidePanels(shouldRender = true) {
    const state = getState();
    let changed = false;
    if (state.ui.openedProjectId || state.ui.openedClientId || state.ui.openedDealId) {
        changed = true;
    }

    if (changed) {
        setState(prevState => ({
            ui: {
                ...prevState.ui,
                openedProjectId: null,
                openedClientId: null,
                openedDealId: null,
                isWikiEditing: false,
            }
        }), shouldRender ? ['side-panel'] : []);

        updateUrlOnPanelClose();
        
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
    setState(prevState => ({
        ui: {
            ...prevState.ui,
            modal: { isOpen: true, type, data: modalData, justOpened: true }
        }
    }), ['modal']);
}

export function closeModal(shouldRender = true) {
    const state = getState();
    if(state.ui.modal.isOpen){
        const modalType = state.ui.modal.type;
        setState(prevState => ({
            ui: {
                ...prevState.ui,
                modal: { isOpen: false, type: null, data: undefined, justOpened: false },
                mention: { query: null, target: null, activeIndex: 0, rect: null },
            }
        }), shouldRender ? ['modal'] : []);

        if (modalType === 'taskDetail') {
            updateUrlOnPanelClose();
        }

        if (lastFocusedElement) {
            lastFocusedElement.focus();
            lastFocusedElement = null;
        }
    }
}
