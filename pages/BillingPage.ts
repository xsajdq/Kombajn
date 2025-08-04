
import { getState } from '../state.ts';
import { t } from '../i18n.ts';
import { formatDate, getUsage, PLANS } from '../utils.ts';
import type { PlanId } from '../types.ts';
import { can } from '../permissions.ts';

export function BillingPage() {
    if (!can('manage_billing')) {
        return `<div class="flex flex-col items-center justify-center h-full text-center">
            <span class="material-icons-sharp text-5xl text-text-subtle">lock</span>
            <h3 class="text-lg font-medium mt-2">${t('billing.access_denied')}</h3>
            <p class="text-sm text-text-subtle">${t('billing.access_denied_desc')}</p>
        </div>`;
    }
    const state = getState();
    const activeWorkspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    if (!activeWorkspace) return 'Error: Active workspace not found.';

    const usage = getUsage(activeWorkspace.id);
    const currentPlan = activeWorkspace.subscription.planId;
    const planLimits = PLANS[currentPlan];

    const ownedWorkspacesCount = state.workspaces.filter(w => {
        const membership = state.workspaceMembers.find(m => m.workspaceId === w.id && m.userId === state.currentUser?.id);
        return membership && membership.role === 'owner';
    }).length;

    const renderUsageMeter = (label: string, value: number, limit: number) => {
        const percentage = limit === Infinity ? 0 : Math.min((value / limit) * 100, 100);
        return `
            <div class="space-y-1">
                <div class="flex justify-between items-center text-sm">
                    <span class="font-medium">${label}</span>
                    <span class="text-text-subtle">${value} / ${limit === Infinity ? t('billing.unlimited') : limit}</span>
                </div>
                <div class="w-full bg-background rounded-full h-2">
                    <div class="h-2 rounded-full ${percentage > 90 ? 'bg-danger' : percentage > 70 ? 'bg-warning' : 'bg-primary'}" style="width: ${percentage}%;"></div>
                </div>
            </div>
        `;
    };
    
    const renderPlanCard = (planId: PlanId) => {
        const planDetails = PLANS[planId];
        const isCurrent = currentPlan === planId;
        const isEnterprise = planId === 'enterprise';
        const priceText = t(`billing.price_${planId}`);

        const features = [
            planDetails.workspaces === Infinity ? t('billing.feature_unlimited_workspaces') : t('billing.feature_workspaces').replace('{count}', planDetails.workspaces.toString()),
            planDetails.projects === Infinity ? t('billing.feature_unlimited_projects') : t('billing.feature_projects').replace('{count}', planDetails.projects.toString()),
            planDetails.users === Infinity ? t('billing.feature_unlimited_users') : t('billing.feature_users').replace('{count}', planDetails.users.toString()),
            planDetails.invoices === Infinity ? t('billing.feature_unlimited_invoices') : t('billing.feature_invoices').replace('{count}', planDetails.invoices.toString()),
        ];

        return `
            <div class="border-2 p-4 rounded-lg text-center flex flex-col ${isCurrent ? 'border-primary ring-2 ring-primary' : 'border-border-color'}">
                <h4 class="font-bold text-lg">${t(`billing.plan_${planId}`)}</h4>
                <p class="text-3xl font-bold my-2">${priceText}</p>
                <p class="text-sm text-text-subtle mb-4">${!isEnterprise ? t('billing.per_month') : '&nbsp;'}</p>
                <ul class="space-y-2 my-4 text-left text-sm flex-grow">
                    ${features.map(f => `<li class="flex items-center gap-2"><span class="material-icons-sharp text-success text-base">check_circle</span> ${f}</li>`).join('')}
                </ul>
                <button class="w-full mt-4 px-3 py-2 text-sm font-medium rounded-md ${isCurrent ? 'bg-content border border-border-color cursor-default' : 'bg-primary text-white hover:bg-primary-hover'}" data-plan-id="${planId}" ${isCurrent ? 'disabled' : ''}>
                    ${isCurrent ? t('billing.btn_current_plan') : t('billing.btn_change_plan')}
                </button>
            </div>
        `;
    };

    return `
        <div class="space-y-8">
            <h2 class="text-2xl font-bold">${t('billing.title')}</h2>
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2">
                    <h3 class="font-semibold mb-3">${t('billing.current_plan')}</h3>
                    <div class="bg-content p-5 rounded-lg shadow-sm space-y-4">
                        ${renderUsageMeter(t('billing.workspaces'), ownedWorkspacesCount, planLimits.workspaces)}
                        ${renderUsageMeter(t('billing.projects'), usage.projects, planLimits.projects)}
                        ${renderUsageMeter(t('billing.users'), usage.users, planLimits.users)}
                        ${renderUsageMeter(t('billing.invoices_month'), usage.invoicesThisMonth, planLimits.invoices)}
                    </div>
                </div>
                <div>
                     <h3 class="font-semibold mb-3">${t('billing.billing_history')}</h3>
                     <div class="bg-content p-5 rounded-lg shadow-sm">
                        <table class="w-full text-sm">
                            <thead class="text-left">
                                <tr>
                                    <th class="py-2 font-semibold text-text-subtle">${t('billing.history_plan')}</th>
                                    <th class="py-2 font-semibold text-text-subtle">${t('billing.history_date')}</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-border-color">
                                ${(activeWorkspace.planHistory || []).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(change => `
                                    <tr>
                                        <td class="py-2">${t(`billing.plan_${change.planId}`)}</td>
                                        <td class="py-2">${formatDate(change.date, { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                     </div>
                </div>
            </div>
             <div class="space-y-3">
                <h3 class="font-semibold">${t('billing.change_plan')}</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                    ${(Object.keys(PLANS) as PlanId[]).map(renderPlanCard).join('')}
                </div>
            </div>
        </div>
    `;
}
