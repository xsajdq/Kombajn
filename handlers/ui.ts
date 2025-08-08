

import { getState, setState } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import type { AppState, ModalData, ModalType } from '../types.ts';
import { t } from '../i18n.ts';

let lastFocusedElement: HTMLElement | null = null;

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'info';
    if (type === 'success') icon = 'check_circle';
    if (type === 'error') icon = 'error';

    toast.innerHTML = `
        <span class="material-icons-sharp">${icon}</span>
        <span class="flex-1">${message}</span>
        <button class="toast-close-btn">
            <span class="material-icons-sharp">close</span>
        </button>
    `;

    const close = () => {
        toast.classList.add('exiting');
        toast.addEventListener('animationend', () => toast.remove());
    };

    toast.querySelector('.toast-close-btn')?.addEventListener('click', close);
    setTimeout(close, duration);

    container.appendChild(toast);
}


export function updateUrlAndShowDetail(type: 'task' | 'project' | 'client' | 'deal', id: string) {
    const state = getState();
    let path = '';
    let slug = '';

    switch (type) {
        case 'project':
            const project = state.projects.find(p => p.id === id);
            slug = project?.slug || id;
            path = `/projects/${slug}`;
            openProjectPanel(id);
            history.pushState({ id }, '', path);
            break;
        case 'client':
            const client = state.clients.find(c => c.id === id);
            slug = client?.slug || id;
            path = `/clients/${slug}`;
            openClientPanel(id);
            history.pushState({ id }, '', path);
            break;
        case 'deal':
            const deal = state.deals.find(d => d.id === id);
            slug = deal?.slug || id;
            path = `/sales/${slug}`;
            openDealPanel(id);
            history.pushState({ id }, '', path);
            break;
        case 'task':
            const task = state.tasks.find(t => t.id === id);
            slug = task?.slug || id;
            path = `/tasks/${slug}`;
            history.pushState({ id }, '', path);
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

export function showModal(type: ModalType, data?: ModalData) {
    if (document.activeElement instanceof HTMLElement) {
        lastFocusedElement = document.activeElement;
    }
    const modalData = data || {};
    if (type === 'addInvoice' && 'items' in modalData) {
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