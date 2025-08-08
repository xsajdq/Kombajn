import { t } from '../../i18n.ts';
import type { DashboardWidgetType } from '../../types.ts';
import { html, TemplateResult } from 'lit-html';

export function AddWidgetModal() {
    const title = t('modals.add_widget');
    const footer = html`<button class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 btn-close-modal">${t('modals.cancel')}</button>`;
    const widgetTypes: { type: DashboardWidgetType, icon: string, name: string, metric?: string }[] = [
        { type: 'kpiMetric', icon: 'payments', name: t('dashboard.kpi_total_revenue'), metric: 'totalRevenue' },
        { type: 'kpiMetric', icon: 'folder_special', name: t('dashboard.kpi_active_projects'), metric: 'activeProjects' },
        { type: 'kpiMetric', icon: 'groups', name: t('dashboard.kpi_total_clients'), metric: 'totalClients' },
        { type: 'kpiMetric', icon: 'warning', name: t('dashboard.kpi_overdue_projects'), metric: 'overdueProjects' },
        { type: 'recentProjects', icon: 'folder', name: t('dashboard.widget_recent_projects_title') },
        { type: 'todaysTasks', icon: 'checklist', name: t('dashboard.widget_todays_tasks_title') },
        { type: 'activityFeed', icon: 'history', name: t('dashboard.widget_activity_feed_title') },
        { type: 'quickActions', icon: 'bolt', name: t('dashboard.widget_quick_actions_title') },
        { type: 'timeTrackingSummary', icon: 'timer', name: t('dashboard.widget_time_tracking_summary_title') },
        { type: 'invoiceSummary', icon: 'receipt_long', name: t('dashboard.widget_invoice_summary_title') },
        { type: 'goalProgress', icon: 'track_changes', name: t('dashboard.widget_goal_progress_title') },
    ];
    const body = html`
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
            ${widgetTypes.map(w => html`
                <button class="flex flex-col items-center justify-center p-4 bg-background hover:bg-border-color rounded-lg transition-colors text-center" data-add-widget-type="${w.type}" data-metric-type="${w.metric || ''}">
                    <span class="material-icons-sharp text-3xl text-primary mb-2">${w.icon}</span>
                    <span class="text-sm font-medium">${w.name}</span>
                </button>
            `)}
        </div>
    `;
    
    return { title, body, footer };
}