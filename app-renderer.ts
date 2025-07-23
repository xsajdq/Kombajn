import { state } from './state.ts';
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

type UIComponent = 'header' | 'sidebar' | 'page' | 'modal' | 'side-panel' | 'fab' | 'onboarding' | 'command-palette' | 'mention-popover' | 'all';

async function AppLayout() {
    if (!state.currentUser) {
        return AuthPage();
    }
    
    if (state.currentPage === 'setup') {
        return AuthPage({ isSetup: true });
    }
    
    const pageContent = await router();
    
    return `
    <div class="flex h-screen bg-background text-text-main font-sans">
        ${Sidebar()}
        <div class="flex-1 flex flex-col overflow-hidden relative">
            ${AppHeader({ currentUser: state.currentUser, activeWorkspaceId: state.activeWorkspaceId! })}
            <main class="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8">
                ${pageContent}
            </main>
            
            <div id="side-panel-container" class="${(state.ui.openedProjectId || state.ui.openedClientId || state.ui.openedDealId) ? 'is-open' : ''}">
                ${renderSidePanel()}
            </div>
            <div id="side-panel-overlay" class="fixed inset-0 bg-black bg-opacity-50 z-30 transition-opacity duration-300 ${ (state.ui.openedProjectId || state.ui.openedClientId || state.ui.openedDealId) ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none' }"></div>
        </div>
        
        <div id="modal-container">${state.ui.modal.isOpen ? Modal() : ''}</div>
        <div id="command-palette-container">${state.ui.isCommandPaletteOpen ? CommandPalette() : ''}</div>
        <div id="fab-container">${FloatingActionButton()}</div>
        <div id="onboarding-container">${state.ui.onboarding.isActive ? OnboardingGuide() : ''}</div>
        <div id="mention-popover-container"></div>
    </div>
    `;
}

function renderSidePanel() {
    const { openedProjectId, openedClientId, openedDealId } = state.ui;
    if (openedProjectId) return ProjectDetailPanel({ projectId: openedProjectId });
    if (openedClientId) return ClientDetailPanel({ clientId: openedClientId });
    if (openedDealId) return DealDetailPanel({ dealId: openedDealId });
    return '';
}

function postRenderActions() {
    document.documentElement.lang = state.settings.language;
    if (state.settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    if (state.ui.modal.justOpened) {
        state.ui.modal.justOpened = false;
    }

    if (state.ui.openedProjectId || state.ui.openedClientId || state.ui.openedDealId) {
        const panel = document.querySelector<HTMLElement>('.side-panel');
        panel?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();
    }
    
    if (state.ui.modal.isOpen) {
        const modal = document.querySelector<HTMLElement>('.modal-content');
        modal?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();
    }

    if (state.currentPage === 'reports') initReportsPage();
    if (state.currentPage === 'tasks') initTasksPage();
    if (state.currentPage === 'dashboard') initDashboardCharts();
}


export async function renderApp() {
    const app = document.getElementById('app')!;
    if (!app) return;
    
    app.innerHTML = await AppLayout();
    
    if (!state.currentUser || state.currentPage === 'setup') {
        return;
    }
    
    postRenderActions();
}

export async function updateUI(componentsToUpdate: UIComponent[]) {
    const app = document.getElementById('app');
    if (!app) return;

    for (const component of componentsToUpdate) {
        switch (component) {
            case 'header':
                const header = app.querySelector('header');
                if (header) header.outerHTML = AppHeader({ currentUser: state.currentUser!, activeWorkspaceId: state.activeWorkspaceId! });
                break;
            case 'sidebar':
                const sidebar = app.querySelector('aside');
                if (sidebar) sidebar.outerHTML = Sidebar();
                break;
            case 'page':
                const main = app.querySelector('main');
                if (main) main.innerHTML = await router();
                break;
            case 'modal':
                const modalContainer = document.getElementById('modal-container');
                if (modalContainer) modalContainer.innerHTML = state.ui.modal.isOpen ? Modal() : '';
                break;
            case 'side-panel':
                const sidePanelContainer = document.getElementById('side-panel-container');
                const sidePanelOverlay = document.getElementById('side-panel-overlay');
                const shouldBeOpen = !!(state.ui.openedProjectId || state.ui.openedClientId || state.ui.openedDealId);
                if (sidePanelContainer) {
                    sidePanelContainer.innerHTML = renderSidePanel();
                    sidePanelContainer.classList.toggle('is-open', shouldBeOpen);
                }
                if (sidePanelOverlay) {
                    sidePanelOverlay.classList.toggle('opacity-100', shouldBeOpen);
                    sidePanelOverlay.classList.toggle('pointer-events-auto', shouldBeOpen);
                    sidePanelOverlay.classList.toggle('opacity-0', !shouldBeOpen);
                    sidePanelOverlay.classList.toggle('pointer-events-none', !shouldBeOpen);
                }
                break;
            case 'command-palette':
                const commandPaletteContainer = document.getElementById('command-palette-container');
                if (commandPaletteContainer) commandPaletteContainer.innerHTML = state.ui.isCommandPaletteOpen ? CommandPalette() : '';
                break;
            case 'fab':
                const fabContainer = document.getElementById('fab-container');
                if (fabContainer) fabContainer.innerHTML = FloatingActionButton();
                break;
             case 'onboarding':
                const onboardingContainer = document.getElementById('onboarding-container');
                if (onboardingContainer) onboardingContainer.innerHTML = state.ui.onboarding.isActive ? OnboardingGuide() : '';
                break;
            case 'mention-popover':
                 const mentionContainer = document.getElementById('mention-popover-container');
                if (mentionContainer) mentionContainer.innerHTML = MentionPopover();
                break;
        }
    }
    postRenderActions();
}
