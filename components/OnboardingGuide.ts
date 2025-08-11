import { getState } from '../state.ts';
import { OnboardingStep, onboardingSteps } from '../handlers/onboarding.ts';
import { t } from '../i18n.ts';
import { html, TemplateResult } from 'lit-html';

export function OnboardingGuide(): TemplateResult {
    const state = getState();
    const { step } = state.ui.onboarding;
    const currentStep = onboardingSteps[step];
    if (!currentStep) return html``;

    let highlightStyles = '';
    let tooltipStyles = 'top: 50%; left: 50%; transform: translate(-50%, -50%);';
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
                pointer-events: none;
            `;
            
            let top = rect.bottom + 15;
            let left = rect.left + rect.width / 2;
            let transform = 'translateX(-50%)';

            // A simple check to prevent the tooltip from going off-screen vertically.
            // Assumes an approximate tooltip height of 200px.
            if (top + 200 > window.innerHeight) {
                top = rect.top - 15;
                transform = 'translateX(-50%) translateY(-100%)';
            }

            tooltipStyles = `
                position: absolute;
                top: ${top}px;
                left: ${left}px;
                transform: ${transform};
            `;
        }
    }

    const isLastStep = step === onboardingSteps.length - 1;
    
    // The main overlay has the 'onboarding-skip-btn' class, making it clickable to dismiss.
    // The tooltip itself stops click propagation to prevent dismissing when clicked.
    // The highlight box has pointer-events: none so it doesn't interfere.
    return html`
        <div class="fixed inset-0 bg-black/70 z-50 onboarding-skip-btn">
            ${targetElementExists ? html`<div class="absolute bg-background rounded-lg mix-blend-destination-out" style="${highlightStyles}"></div>` : ''}
            <div class="absolute bg-content p-6 rounded-lg shadow-lg max-w-sm w-full" style="${tooltipStyles}" @click=${(e: Event) => e.stopPropagation()}>
                <h4 class="text-lg font-bold mb-2">${t(currentStep.titleKey)}</h4>
                <p class="text-sm text-text-subtle">${t(currentStep.contentKey)}</p>
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
