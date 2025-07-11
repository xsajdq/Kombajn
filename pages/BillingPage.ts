import { state } from '../state.ts';
import { t } from '../i18n.ts';
import { formatDate, getUsage, PLANS } from '../utils.ts';
import type { PlanId } from '../types.ts';
import { can } from '../permissions.ts';

export function BillingPage() {
    if (!can('manage_billing')) {
        return `<div class="empty-state">
            <span class="material-icons-sharp">lock</span>
            <h3>${t('billing.access_denied')}</h3>
            <p>${t('billing.access_denied_desc')}</p>
        </div>`;
    }

    const activeWorkspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    if (!activeWorkspace) return 'Error: Active workspace not found.';

    const usage = getUsage(activeWorkspace.id);
    const currentPlan = activeWorkspace.subscription.planId;
    const planLimits = PLANS[currentPlan];

    const ownedWorkspacesCount = state.workspaces.filter(w => {
        const membership = state.workspaceMembers.find(m => m.workspaceId === w.id && m.userId === state.currentUser?.id);
        return membership && membership.roles.includes('owner');
    }).length;

    const renderUsageMeter = (label: string, value: number, limit: number) => {
        const percentage = limit === Infinity ? 0 : Math.min((value / limit) * 100, 100);
        return `
            <div class="usage-meter">
                <div class="usage-meter-label">
                    <span>${label}</span>
                    <span>${value} / ${limit === Infinity ? t('billing.unlimited') : limit}</span>
                </div>
                <div class="usage-meter-bar">
                    <div class="usage-meter-progress" style="width: ${percentage}%;"></div>
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
            <div class="card plan-card ${isCurrent ? 'active' : ''}">
                <h4>${t(`billing.plan_${planId}`)}</h4>
                <p class="plan-price">${priceText}</p>
                <p class="plan-price-note">${!isEnterprise ? t('billing.per_month') : '&nbsp;'}</p>
                <ul class="plan-features">
                    ${features.map(f => `<li><span class="material-icons-sharp">check_circle</span> ${f}</li>`).join('')}
                </ul>
                <button class="btn ${isCurrent ? 'btn-secondary' : 'btn-primary'}" data-plan-id="${planId}" ${isCurrent ? 'disabled' : ''}>
                    ${isCurrent ? t('billing.btn_current_plan') : t('billing.btn_change_plan')}
                </button>
            </div>
        `;
    };

    return `
        <div>
            <h2>${t('billing.title')}</h2>
            <div class="billing-grid">
                <div class="your-plan-section">
                    <h3>${t('billing.current_plan')}</h3>
                    <div class="card">
                        ${renderUsageMeter(t('billing.workspaces'), ownedWorkspacesCount, planLimits.workspaces)}
                        ${renderUsageMeter(t('billing.projects'), usage.projects, planLimits.projects)}
                        ${renderUsageMeter(t('billing.users'), usage.users, planLimits.users)}
                        ${renderUsageMeter(t('billing.invoices_month'), usage.invoicesThisMonth, planLimits.invoices)}
                    </div>
                </div>
                <div class="billing-history-section">
                     <h3>${t('billing.billing_history')}</h3>
                     <div class="card">
                        <table class="billing-history-table">
                            <thead>
                                <tr>
                                    <th>${t('billing.history_plan')}</th>
                                    <th>${t('billing.history_date')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(activeWorkspace.planHistory || []).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(change => `
                                    <tr>
                                        <td>${t(`billing.plan_${change.planId}`)}</td>
                                        <td>${formatDate(change.date)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                     </div>
                </div>
            </div>
             <div class="change-plan-section" style="margin-top: 2rem;">
                <h3>${t('billing.change_plan')}</h3>
                <div class="plan-cards-container">
                    ${(Object.keys(PLANS) as PlanId[]).map(renderPlanCard).join('')}
                </div>
            </div>
        </div>
    `;
}