
import { getState } from '../state.ts';
import { onboardingSteps } from '../handlers/onboarding.ts';
import { t } from '../i18n.ts';

export function OnboardingGuide() {
    const state = getState();
    const { step } = state.ui.onboarding;
    const currentStep = onboardingSteps[step];
    if (!currentStep) return '';

    let highlightStyles = '';
    let tooltipStyles = 'transform -translate-x-1/2 -translate-y-1/2';
    let targetElementExists = false;

    if (currentStep.targetSelector) {
        const targetElement = document.querySelector<HTMLElement>(currentStep.targetSelector);
        if (targetElement) {
            targetElementExists = true;
            const rect = targetElement.getBoundingClientRect();
            const padding = 10;
            highlightStyles = `
                position: absolute;
                top: ${rect.top - padding}px;
                left: ${rect.left - padding}px;
                width: ${rect.width + (padding * 2)}px;
                height: ${rect.height + (padding * 2)}px;
            `;
            // Position tooltip below the element
            tooltipStyles = `
                top: ${rect.bottom + 15}px;
                left: ${rect.left}px;
            `;
        }
    }

    const isLastStep = step === onboardingSteps.length - 1;

    // Center tooltip if no target
    const tooltipPositionClasses = targetElementExists 
        ? '' 
        : 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2';

    return `
        <div class="fixed inset-0 bg-black/70 z-50">
            ${targetElementExists ? `<div class="absolute bg-background rounded-lg mix-blend-destination-out" style="${highlightStyles}"></div>` : ''}
            <div class="absolute bg-content p-6 rounded-lg shadow-lg max-w-sm w-full" style="${tooltipStyles}">
                <h4 class="text-lg font-bold mb-2">${currentStep.title}</h4>
                <p class="text-sm text-text-subtle">${currentStep.content}</p>
                <div class="mt-6 flex justify-between items-center">
                    <button class="text-sm text-text-subtle hover:underline onboarding-skip-btn">${t('onboarding.skip')}</button>
                    <button class="px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary-hover onboarding-next-btn">
                        ${isLastStep ? t('onboarding.finish') : t('onboarding.next')}
                    </button>
                </div>
            </div>
        </div>
    `;
}
