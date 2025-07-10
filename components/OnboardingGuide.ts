
import { state } from '../state.ts';
import { onboardingSteps } from '../handlers/onboarding.ts';
import { t } from '../i18n.ts';

export function OnboardingGuide() {
    const { step } = state.ui.onboarding;
    const currentStep = onboardingSteps[step];
    if (!currentStep) return '';

    let highlightStyles = '';
    let tooltipStyles = '';
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
    if (!targetElementExists) {
        tooltipStyles = `
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            max-width: 450px;
        `;
    }

    return `
        <div class="onboarding-overlay">
            ${targetElementExists ? `<div class="onboarding-highlight" style="${highlightStyles}"></div>` : ''}
            <div class="onboarding-tooltip" style="${tooltipStyles}">
                <h4>${currentStep.title}</h4>
                <p>${currentStep.content}</p>
                <div class="onboarding-footer">
                    <button class="btn btn-link onboarding-skip-btn">${t('onboarding.skip')}</button>
                    <button class="btn btn-primary onboarding-next-btn">
                        ${isLastStep ? t('onboarding.finish') : t('onboarding.next')}
                    </button>
                </div>
            </div>
        </div>
    `;
}
