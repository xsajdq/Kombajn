import { getState, setState } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import { apiPut } from '../services/api.ts';
import { t } from '../i18n.ts';

export type OnboardingStep = {
    targetSelector?: string;
    titleKey: string;
    contentKey: string;
    preAction?: () => void;
};

export const onboardingSteps: OnboardingStep[] = [
    {
        titleKey: 'onboarding.step0_title',
        contentKey: 'onboarding.step0_content',
    },
    {
        targetSelector: '#workspace-switcher',
        titleKey: 'onboarding.step1_title',
        contentKey: 'onboarding.step1_content',
    },
    {
        targetSelector: '#app-sidebar nav',
        titleKey: 'onboarding.step2_title',
        contentKey: 'onboarding.step2_content',
    },
    {
        targetSelector: '.projects-page-new-project-btn',
        titleKey: 'onboarding.step3_title',
        contentKey: 'onboarding.step3_content',
        preAction: () => {
            history.pushState({}, '', '/projects');
            setState({ currentPage: 'projects' }, ['page', 'sidebar']);
        }
    },
    {
        targetSelector: '[data-view-mode="board"]',
        titleKey: 'onboarding.step4_title',
        contentKey: 'onboarding.step4_content',
        preAction: () => {
            history.pushState({}, '', '/tasks');
            setState({ currentPage: 'tasks' }, ['page', 'sidebar']);
        }
    },
    {
        targetSelector: '#global-timer-container',
        titleKey: 'onboarding.step5_title',
        contentKey: 'onboarding.step5_content',
        preAction: () => {
            history.pushState({}, '', '/dashboard');
            setState({ currentPage: 'dashboard' }, ['page', 'sidebar']);
        }
    },
    {
        targetSelector: '#notification-bell',
        titleKey: 'onboarding.step6_title',
        contentKey: 'onboarding.step6_content',
    },
    {
        titleKey: 'onboarding.step7_title',
        contentKey: 'onboarding.step7_content',
    },
    {
        targetSelector: 'a[href="/settings"]',
        titleKey: 'onboarding.step8_title',
        contentKey: 'onboarding.step8_content',
        preAction: () => {
            history.pushState({}, '', '/settings');
            setState({ currentPage: 'settings' }, ['page', 'sidebar']);
        }
    },
    {
        titleKey: 'onboarding.step9_title',
        contentKey: 'onboarding.step9_content',
        preAction: () => {
            history.pushState({}, '', '/dashboard');
            setState({ currentPage: 'dashboard' }, ['page', 'sidebar']);
        }
    }
];


export function startOnboarding() {
    console.log("Starting onboarding...");
    setState(prevState => ({
        ui: { ...prevState.ui, onboarding: { isActive: true, step: 0 } }
    }), ['onboarding']);
}

export function nextStep() {
    const currentStep = getState().ui.onboarding.step;
    if (currentStep >= onboardingSteps.length - 1) {
        finishOnboarding();
    } else {
        const nextStepIndex = currentStep + 1;
        const nextStepConfig = onboardingSteps[nextStepIndex];
        
        // The preAction will trigger its own setState and render.
        // If there's no preAction, we trigger the render ourselves.
        if (nextStepConfig.preAction) {
            // Update the step number silently before the action,
            // so the action's render shows the correct new step.
            setState(prevState => ({
                ui: { ...prevState.ui, onboarding: { ...prevState.ui.onboarding, step: nextStepIndex } }
            }), []);
            nextStepConfig.preAction();
        } else {
            setState(prevState => ({
                ui: { ...prevState.ui, onboarding: { ...prevState.ui.onboarding, step: nextStepIndex } }
            }), ['onboarding']);
        }
    }
}

export async function finishOnboarding() {
    const { activeWorkspaceId } = getState();
    
    setState(prevState => ({
        ui: { ...prevState.ui, onboarding: { isActive: false, step: 0 } }
    }), ['onboarding']);

    if (activeWorkspaceId) {
        const workspace = getState().workspaces.find(w => w.id === activeWorkspaceId);
        if (workspace && !workspace.onboardingCompleted) {
            // Optimistic update
            setState(prevState => ({
                workspaces: prevState.workspaces.map(w => w.id === activeWorkspaceId ? { ...w, onboardingCompleted: true } : w)
            }), []);
            try {
                await apiPut('workspaces', { id: activeWorkspaceId, onboardingCompleted: true });
                console.log("Onboarding completed and saved.");
            } catch (error) {
                 setState(prevState => ({
                    workspaces: prevState.workspaces.map(w => w.id === activeWorkspaceId ? { ...w, onboardingCompleted: false } : w)
                }), []);
                console.error("Failed to save onboarding completion status:", error);
            }
        }
    }
}