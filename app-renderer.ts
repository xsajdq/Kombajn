import { getState, setState } from './state.ts';
import { router } from './router.ts';
import { Sidebar } from './components/Sidebar.ts';
import { ProjectDetailPanel } from './components/ProjectDetailPanel.ts';
import { ClientDetailPanel } from './components/ClientDetailPanel.ts';
import { DealDetailPanel } from './components/DealDetailPanel.ts';
import { Modal } from './components/Modal.ts';
import { AppHeader } from './components/AppHeader.ts';
import { CommandPalette } from './components/CommandPalette.ts';
import { FloatingActionButton } from './components/FloatingActionButton.ts';
import { MentionPopover } from './components/MentionPopover.ts';
import { initReportsPage } from './pages/ReportsPage.ts';
import { initTasksPageView } from './pages/TasksPage.ts';
import { initDashboardCharts } from './pages/DashboardPage.ts';
import { AuthPage } from './pages/AuthPage.ts';
import { OnboardingGuide } from './components/OnboardingGuide.ts';
import { SlashCommandPopover } from './components/SlashCommandPopover.ts';
import { TextSelectionPopover } from './components/TextSelectionPopover.ts';
import type { UIComponent as UIComponentType } from './types.ts';
import { html, render, TemplateResult } from 'lit-html';

export type UIComponent = UIComponentType;

async function AppLayout(): Promise<TemplateResult> {
    const state = getState();
    if (!state.currentUser) {
        return AuthPage();
    }
    
    if (state.currentPage === 'setup') {
        return AuthPage({ isSetup: true });
    }
    
    const pageContent = await router();
    
    return html`
    <div class="relative h-full overflow-hidden md:flex">
        <div id="mobile-menu-overlay" class="fixed inset-0 bg-black/50 z-40 hidden md:hidden"></div>
        ${Sidebar()}
        <div class="flex-1 flex flex-col overflow-hidden relative min-h-0">
            ${AppHeader({ currentUser: state.currentUser, activeWorkspaceId: state.activeWorkspaceId! })}
            <main class="flex-1 overflow-x-hidden overflow-y-auto p-8">
                ${pageContent}
            </main>
            
            <div id="side-panel-container" class="${(state.ui.openedProjectId || state.ui.openedClientId || state.ui.openedDealId) ? 'is-open' : ''}">
                ${renderSidePanel()}
            </div>
            <div id="side-panel-overlay" class="fixed inset-0 bg-black bg-opacity-50 z-30 transition-opacity duration-300 ${ (state.ui.openedProjectId || state.ui.openedClientId || state.ui.openedDealId) ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none' }"></div>
        </div>
        
        <div id="modal-container">${state.ui.modal.isOpen ? Modal() : ''}</div>
        <div id="command-palette-container">${state.ui.isCommandPaletteOpen ? CommandPalette() : ''}</div>
        <div id="fab-container" class="fab-container">${FloatingActionButton()}</div>
        <div id="onboarding-container">${state.ui.onboarding.isActive ? OnboardingGuide() : ''}</div>
        <div id="mention-popover-container">${MentionPopover()}</div>
        <div id="slash-command-popover-container">${SlashCommandPopover()}</div>
        <div id="text-selection-popover-container">${TextSelectionPopover()}</div>
    </div>
    `;
}

function renderSidePanel() {
    const { openedProjectId, openedClientId, openedDealId } = getState().ui;
    if (openedProjectId) return ProjectDetailPanel({ projectId: openedProjectId });
    if (openedClientId) return ClientDetailPanel({ clientId: openedClientId });
    if (openedDealId) return DealDetailPanel({ dealId: openedDealId });
    return html``;
}

function postRenderActions() {
    const state = getState();
    document.documentElement.lang = state.settings.language;
    if (state.settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Animate and autofocus modal on open
    if (state.ui.modal.isOpen && state.ui.modal.justOpened) {
        // IMPORTANT: Reset the flag immediately and silently to prevent race conditions
        // from subsequent renders that might occur before the animation timeout fires.
        setState(prevState => ({ ui: { ...prevState.ui, modal: { ...prevState.ui.modal, justOpened: false }}}), []);

        const modalContent = document.getElementById('modal-content');
        if (modalContent) {
            // Use a short timeout to allow the browser to paint the element with its initial
            // `opacity-0` style before we remove the class to trigger the CSS transition.
            setTimeout(() => {
                modalContent.classList.remove('scale-95', 'opacity-0');

                // Autofocus the first focusable element after it becomes visible
                modalContent.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();
            }, 10);
        }
    }

    if (state.ui.openedProjectId || state.ui.openedClientId || state.ui.openedDealId) {
        const panel = document.querySelector<HTMLElement>('.side-panel');
        // Simple autofocus for side panels on open
        panel?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();
    }
    
    if (state.currentPage === 'reports') initReportsPage();
    if (state.currentPage === 'tasks') initTasksPageView();
    if (state.currentPage === 'dashboard') initDashboardCharts();
}


export async function renderApp() {
    const app = document.getElementById('app')!;
    if (!app) return;
    
    render(await AppLayout(), app);
    
    postRenderActions();
}

export async function updateUI(componentsToUpdate: UIComponent[]) {
    // If the componentsToUpdate array is empty, it's a "silent" state update.
    // We must not trigger a re-render to avoid infinite loops, especially from the router.
    if (componentsToUpdate.length === 0) {
        return;
    }

    // With lit-html, we can simply re-render the entire app layout.
    // lit-html is efficient and will only update the parts of the DOM that have changed.
    // This dramatically simplifies the update logic and removes the need for manual diffing.
    await renderApp();
}