





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

    // The detail panel is now managed by the page itself for Clients and Projects
    const shouldShowGlobalSidePanel = (openedProjectId && state.currentPage !== 'projects') || 
                                      (openedClientId && state.currentPage !== 'clients') || 
                                      (openedDealId && state.currentPage !== 'sales');


    if (!currentUser || !activeWorkspaceId) {
        // This state should ideally not be reached if the top-level auth check works,
        // but it's a safe fallback.
        return `<div id="app" class="flex justify-center items-center h-screen">
                    <div class="text-text-subtle">Initializing...</div>
                </div>`;
    }

    return `
    <div class="flex h-screen bg-background text-text-main font-sans">
        ${Sidebar()}
        <div class="flex-1 flex flex-col overflow-hidden relative">
            ${AppHeader({ currentUser, activeWorkspaceId })}
            <main class="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8">
                ${pageContent}
            </main>
            
            <div id="side-panel-container" class="${shouldShowGlobalSidePanel ? 'is-open' : ''}">
                ${(openedProjectId && state.currentPage !== 'projects') ? ProjectDetailPanel({ projectId: openedProjectId }) : ''}
                ${(openedClientId && state.currentPage !== 'clients') ? ClientDetailPanel({ clientId: openedClientId }) : ''}
                ${(openedDealId && state.currentPage !== 'sales') ? DealDetailPanel({ dealId: openedDealId }) : ''}
            </div>
            <div id="side-panel-overlay" class="fixed inset-0 bg-black bg-opacity-50 z-30 transition-opacity duration-300 ${ shouldShowGlobalSidePanel ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none' }"></div>

        </div>
        
        ${modal.isOpen ? Modal() : ''}
        ${isCommandPaletteOpen ? CommandPalette() : ''}
        ${FloatingActionButton()}
        ${onboarding.isActive ? OnboardingGuide() : ''}
        <div id="mention-popover-container"></div>
    </div>
    `;
}

export async function renderApp() {
    const app = document.getElementById('app')!;
    if (!app) return;
    document.documentElement.lang = state.settings.language;
    
    const mainContent = document.querySelector('main.flex-1');
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
    
    const newMainContent = document.querySelector('main.flex-1');
    if (newMainContent) {
        newMainContent.scrollTop = scrollPositions.main.top;
        newMainContent.scrollLeft = scrollPositions.main.left;
    }

    const newSidePanelContent = document.querySelector('.side-panel-content');
    if (newSidePanelContent) {
        newSidePanelContent.scrollTop = scrollPositions.sidePanel.top;
        newSidePanelContent.scrollLeft = scrollPositions.sidePanel.left;
    }

    // Post-render actions: Use Tailwind's dark mode convention
    if (state.settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    if (state.ui.modal.justOpened) {
        state.ui.modal.justOpened = false;
    }
    
    // Side panel focus management
    if (state.ui.openedProjectId || state.ui.openedClientId || state.ui.openedDealId) {
        const panel = document.querySelector<HTMLElement>('.side-panel');
        if (panel) {
            const firstFocusable = panel.querySelector<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            firstFocusable?.focus();
        }
    }
    
    // Modal focus management
    if (state.ui.modal.isOpen) {
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