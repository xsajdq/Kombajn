
import { state } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import { apiPut } from '../services/api.ts';
import { t } from '../i18n.ts';

type OnboardingStep = {
    targetSelector?: string;
    title: string;
    content: string;
    preAction?: () => void;
};

export const onboardingSteps: OnboardingStep[] = [
    {
        title: t('onboarding.step0_title'),
        content: t('onboarding.step0_content'),
    },
    {
        targetSelector: '.nav-item a[href="#/projects"]',
        title: t('onboarding.step1_title'),
        content: t('onboarding.step1_content'),
    },
    {
        targetSelector: '.projects-page-new-project-btn',
        title: t('onboarding.step2_title'),
        content: t('onboarding.step2_content'),
        preAction: () => {
            window.location.hash = '#/projects';
        }
    },
    {
        targetSelector: '.nav-item a[href="#/tasks"]',
        title: t('onboarding.step3_title'),
        content: t('onboarding.step3_content'),
        preAction: () => {
            window.location.hash = '#/tasks';
        }
    },
    {
        targetSelector: '.nav-item a[href="#/settings"]',
        title: t('onboarding.step4_title'),
        content: t('onboarding.step4_content'),
        preAction: () => {
            window.location.hash = '#/settings';
        }
    },
    {
        title: t('onboarding.step5_title'),
        content: t('onboarding.step5_content'),
        preAction: () => {
            window.location.hash = '#/dashboard';
        }
    }
];

export function startOnboarding() {
    console.log("Starting onboarding...");
    state.ui.onboarding = { isActive: true, step: 0 };
    renderApp();
}

export function nextStep() {
    const currentStep = state.ui.onboarding.step;
    if (currentStep >= onboardingSteps.length - 1) {
        finishOnboarding();
    } else {
        const nextStepIndex = currentStep + 1;
        const nextStepConfig = onboardingSteps[nextStepIndex];
        
        if (nextStepConfig.preAction) {
            nextStepConfig.preAction();
        }

        state.ui.onboarding.step = nextStepIndex;
        // The preAction might have changed the hash, which triggers renderApp.
        // If not, we trigger it manually.
        if (!nextStepConfig.preAction) {
            renderApp();
        }
    }
}

export async function finishOnboarding() {
    const { activeWorkspaceId } = state;
    state.ui.onboarding.isActive = false;
    renderApp();

    if (activeWorkspaceId) {
        const workspace = state.workspaces.find(w => w.id === activeWorkspaceId);
        if (workspace && !workspace.onboardingCompleted) {
            try {
                // Update the state optimistically
                workspace.onboardingCompleted = true;
                await apiPut('workspaces', { id: activeWorkspaceId, onboardingCompleted: true });
                console.log("Onboarding completed and saved.");
            } catch (error) {
                // Revert if API call fails
                if (workspace) workspace.onboardingCompleted = false;
                console.error("Failed to save onboarding completion status:", error);
            }
        }
    }
}
