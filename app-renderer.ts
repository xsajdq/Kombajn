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
import { initTasksPage } from './pages/TasksPage.ts';
import { initDashboardCharts } from './pages/DashboardPage.ts';
import { AuthPage } from './pages/AuthPage.ts';
import { OnboardingGuide } from './components/OnboardingGuide.ts';
import { SlashCommandPopover } from './components/SlashCommandPopover.ts';
import { TextSelectionPopover } from './components/TextSelectionPopover.ts';
import { diff } from './dom-diff.ts';
import type { UIComponent as UIComponentType } from './types.ts';

export type UIComponent = UIComponentType;

async function AppLayout() {
    const state = getState();
    if (!state.currentUser) {
        return AuthPage();
    }
    
    if (state.currentPage === 'setup') {
        return AuthPage({ isSetup: true });
    }
    
    const pageContent = await router();
    
    return `
    <div class="relative h-screen overflow-hidden md:flex">
        <div id="mobile-menu-overlay" class="fixed inset-0 bg-black/50 z-40 hidden md:hidden"></div>
        ${Sidebar()}
        <div class="flex-1 flex flex-col overflow-hidden relative">
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
        <div id="mention-popover-container"></div>
        <div id="slash-command-popover-container"></div>
        <div id="text-selection-popover-container"></div>
    </div>
    `;
}

function renderSidePanel() {
    const { openedProjectId, openedClientId, openedDealId } = getState().ui;
    if (openedProjectId) return ProjectDetailPanel({ projectId: openedProjectId });
    if (openedClientId) return ClientDetailPanel({ clientId: openedClientId });
    if (openedDealId) return DealDetailPanel({ dealId: openedDealId });
    return '';
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
        const modalContent = document.getElementById('modal-content');
        if (modalContent) {
            // Use a short timeout to allow the element to be painted with its initial
            // transform/opacity styles before transitioning to the final state.
            setTimeout(() => {
                modalContent.classList.remove('scale-95', 'opacity-0');
            }, 10);

            // Autofocus the first focusable element
            modalContent.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();
        }
        // This is a transient flag, reset it without causing re-render loops.
        setState(prevState => ({ ui: { ...prevState.ui, modal: { ...prevState.ui.modal, justOpened: false }}}), []);
    }

    if (state.ui.openedProjectId || state.ui.openedClientId || state.ui.openedDealId) {
        const panel = document.querySelector<HTMLElement>('.side-panel');
        // Simple autofocus for side panels on open
        panel?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();
    }
    
    if (state.currentPage === 'reports') initReportsPage();
    if (state.currentPage === 'tasks') initTasksPage();
    if (state.currentPage === 'dashboard') initDashboardCharts();
}


export async function renderApp() {
    const app = document.getElementById('app')!;
    if (!app) return;
    
    app.innerHTML = await AppLayout();
    
    const state = getState();
    if (!state.currentUser || state.currentPage === 'setup') {
        return;
    }
    
    postRenderActions();
}

export async function updateUI(componentsToUpdate: UIComponent[]) {
    const app = document.getElementById('app');
    if (!app) return;

    for (const component of componentsToUpdate) {
        if (component === 'all') {
            await renderApp();
            return;
        }

        let oldNode: Element | null = null;
        let newContentString: string | Promise<string> = '';
        let isContainer = false;

        const state = getState();

        switch (component) {
            case 'header':
                oldNode = app.querySelector('header');
                newContentString = AppHeader({ currentUser: state.currentUser!, activeWorkspaceId: state.activeWorkspaceId! });
                break;
            case 'sidebar':
                oldNode = app.querySelector('aside');
                newContentString = Sidebar();
                break;
            case 'page':
                oldNode = app.querySelector('main');
                newContentString = router(); // router is async
                isContainer = true;
                break;
            case 'modal':
                oldNode = document.getElementById('modal-container');
                newContentString = state.ui.modal.isOpen ? Modal() : '';
                isContainer = true;
                break;
            case 'side-panel':
                oldNode = document.getElementById('side-panel-container');
                const shouldBeOpen = !!(state.ui.openedProjectId || state.ui.openedClientId || state.ui.openedDealId);

                // Explicitly manage the container's class state here, so the diffing logic below works correctly.
                oldNode?.classList.toggle('is-open', shouldBeOpen);
                
                const sidePanelOverlay = document.getElementById('side-panel-overlay');
                 if (sidePanelOverlay) {
                    sidePanelOverlay.classList.toggle('opacity-100', shouldBeOpen);
                    sidePanelOverlay.classList.toggle('pointer-events-auto', shouldBeOpen);
                    sidePanelOverlay.classList.toggle('opacity-0', !shouldBeOpen);
                    sidePanelOverlay.classList.toggle('pointer-events-none', !shouldBeOpen);
                }
                newContentString = renderSidePanel();
                isContainer = true;
                break;
            case 'command-palette':
                oldNode = document.getElementById('command-palette-container');
                newContentString = state.ui.isCommandPaletteOpen ? CommandPalette() : '';
                isContainer = true;
                break;
            case 'fab':
                oldNode = document.getElementById('fab-container');
                newContentString = FloatingActionButton();
                isContainer = true;
                break;
             case 'onboarding':
                oldNode = document.getElementById('onboarding-container');
                newContentString = state.ui.onboarding.isActive ? OnboardingGuide() : '';
                isContainer = true;
                break;
            case 'mention-popover':
                 oldNode = document.getElementById('mention-popover-container');
                newContentString = MentionPopover();
                isContainer = true;
                break;
            case 'slash-command-popover':
                oldNode = document.getElementById('slash-command-popover-container');
                newContentString = SlashCommandPopover();
                isContainer = true;
                break;
            case 'text-selection-popover':
                oldNode = document.getElementById('text-selection-popover-container');
                newContentString = TextSelectionPopover();
                isContainer = true;
                break;
        }

        if (oldNode) {
            const resolvedContent = await Promise.resolve(newContentString);
            const tempContainer = document.createElement(oldNode.tagName);
            
            if (isContainer) {
                // In updateUI, when diffing a container component like the main page content, the temporary container was created without any attributes. This caused the diffing algorithm to remove the attributes (like padding classes) from the actual DOM element. The fix is to copy the attributes from the old element to the temporary container before performing the diff, ensuring that essential layout styles are preserved during lazy-loading and other page updates.
                for (const attr of oldNode.attributes) {
                    tempContainer.setAttribute(attr.name, attr.value);
                }
            }
            
            tempContainer.innerHTML = resolvedContent;

            if (isContainer) {
                diff(oldNode, tempContainer);
            } else {
                const newNode = tempContainer.firstElementChild;
                if (newNode) {
                    diff(oldNode, newNode);
                } else if(oldNode.parentNode) {
                    // This handles cases where a component might render to nothing
                    oldNode.parentNode.replaceChild(tempContainer, oldNode);
                }
            }
        }
    }
    
    postRenderActions();
}