



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

async function AppLayout() {
    // If there is no authenticated user, always show the AuthPage.
    if (!state.currentUser) {
        return AuthPage();
    }
    
    // If the user is authenticated but has no workspace, show the setup page.
    if (state.currentPage === 'setup') {
        return AuthPage({ isSetup: true });
    }
    
    const pageContent = await router();
    const { openedProjectId, openedClientId, openedDealId, modal, isCommandPaletteOpen, onboarding } = state.ui;
    const currentUser = state.currentUser;
    const activeWorkspaceId = state.activeWorkspaceId;
    const isOverlayVisible = openedProjectId || openedClientId || openedDealId || modal.isOpen;


    if (!currentUser || !activeWorkspaceId) {
        // This state should ideally not be reached if the top-level auth check works,
        // but it's a safe fallback.
        return `<div id="app" style="display: flex; justify-content: center; align-items: center; height: 100vh;">
                    <div class="loading-container"><p>Initializing...</p></div>
                </div>`;
    }

    return `
        ${Sidebar()}
        <div class="main-content-container" ${isOverlayVisible ? 'aria-hidden="true"' : ''}>
            ${AppHeader({ currentUser, activeWorkspaceId })}
            <main class="content">
                ${pageContent}
            </main>
        </div>
        ${openedProjectId ? `
            ${ProjectDetailPanel({ projectId: openedProjectId })}
            <div class="side-panel-overlay"></div>
        ` : ''}
        ${openedClientId ? `
            ${ClientDetailPanel({ clientId: openedClientId })}
            <div class="side-panel-overlay"></div>
        ` : ''}
        ${openedDealId ? `
            ${DealDetailPanel({ dealId: openedDealId })}
            <div class="side-panel-overlay"></div>
        ` : ''}
        ${modal.isOpen ? Modal() : ''}
        ${isCommandPaletteOpen ? CommandPalette() : ''}
        ${FloatingActionButton()}
        ${onboarding.isActive ? OnboardingGuide() : ''}
        <div id="mention-popover-container"></div>
    `;
}

export async function renderApp() {
    const app = document.getElementById('app')!;
    if (!app) return;
    document.documentElement.lang = state.settings.language;
    
    // Check if a side panel is currently open before re-rendering
    const wasPanelOpen = !!document.querySelector('.side-panel.is-open');

    const mainContent = document.querySelector('.content');
    const sidePanelContent = document.querySelector('.side-panel-content');

    const scrollPositions = {
        main: {
            top: mainContent?.scrollTop ?? 0,
            left: mainContent?.scrollLeft ?? 0,
        },
        sidePanel: {
            top: sidePanelContent?.scrollTop ?? 0,
            left: sidePanelContent?.scrollLeft ?? 0
        }
    };
    
    app.innerHTML = await AppLayout();

    // If the Auth or Setup Page is rendered, no further action is needed for most things.
    if (!state.currentUser || state.currentPage === 'setup') {
        return;
    }
    
    const newMainContent = document.querySelector('.content');
    if (newMainContent) {
        newMainContent.scrollTop = scrollPositions.main.top;
        newMainContent.scrollLeft = scrollPositions.main.left;
    }

    const newSidePanelContent = document.querySelector('.side-panel-content');
    if (newSidePanelContent) {
        newSidePanelContent.scrollTop = scrollPositions.sidePanel.top;
        newSidePanelContent.scrollLeft = scrollPositions.sidePanel.left;
    }


    // Post-render actions
    document.body.classList.remove('dark-theme', 'minimal-theme');
    if (state.settings.theme === 'dark') {
      document.body.classList.add('dark-theme');
    } else if (state.settings.theme === 'minimal') {
      document.body.classList.add('minimal-theme');
    }


    if (state.ui.modal.justOpened) {
        state.ui.modal.justOpened = false;
    }

    if (state.ui.openedProjectId || state.ui.openedClientId || state.ui.openedDealId) {
        const panel = document.querySelector<HTMLElement>('.side-panel');
        if (panel) {
            if (wasPanelOpen) {
                // Panel was already open, show it instantly without animation
                panel.classList.add('no-transition');
                panel.classList.add('is-open');
                setTimeout(() => {
                    panel.classList.remove('no-transition');
                }, 50); // Small delay to ensure styles apply before removing class
            } else {
                // It's a new panel, so animate it in.
                setTimeout(() => {
                    panel.classList.add('is-open');
                    const firstFocusable = panel.querySelector<HTMLElement>(
                        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                    );
                    firstFocusable?.focus();
                }, 10);
            }
        }
    }
    
    if (state.ui.modal.isOpen) {
        const overlay = document.querySelector<HTMLElement>('.modal-overlay');
        if (overlay) {
            setTimeout(() => {
                overlay.classList.add('is-open');
            }, 10);
        }
        const modal = document.querySelector<HTMLElement>('.modal-content');
        if (modal) {
            const firstFocusable = modal.querySelector<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            firstFocusable?.focus();
        }
    }

    if (state.currentPage === 'reports') {
        initReportsPage();
    }

    if (state.currentPage === 'tasks') {
        initTasksPage();
    }

    if (state.currentPage === 'dashboard') {
        initDashboardCharts();
    }
}

export function renderMentionPopover() {
    const container = document.getElementById('mention-popover-container');
    if (container) {
        container.innerHTML = MentionPopover();
    }
}