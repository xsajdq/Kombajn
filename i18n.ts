
import { getState } from './state.ts';

const translations = {
    en: {
        sidebar: { dashboard: 'Dashboard', projects: 'Projects', tasks: 'Tasks', team_calendar: 'Team Calendar', clients: 'Clients', sales: 'Sales', reports: 'Reports', invoices: 'Invoices', ai_assistant: 'AI Assistant', hr: 'HR', settings: 'Settings', billing: 'Billing', chat: 'Chat', goals: 'Goals', inventory: 'Inventory', 'budget-and-expenses': 'Budget & Expenses' },
        dashboard: {
            title: 'Dashboard', welcome_message: 'Welcome back, {name}!', welcome_sub: "Here's your business overview.",
            kpi_total_revenue: 'Total Revenue', kpi_active_projects: 'Active Projects', kpi_total_clients: 'Total Clients', kpi_completion_rate: 'Completion Rate',
            kpi_hours_today: 'Hours Today', kpi_overdue_projects: 'Overdue Projects', kpi_team_productivity: 'Team Productivity', kpi_goals_met: 'Goals Met',
            vs_last_month: 'vs last month',
            widget_recent_projects_title: 'Recent Projects', widget_todays_tasks_title: "Tasks", widget_activity_feed_title: 'Recent Activity',
            widget_schedule_title: 'Schedule', widget_messages_title: 'Messages', widget_alerts_title: 'Alerts',
            widget_weekly_performance_title: 'Weekly Performance', widget_quick_actions_title: 'Quick Actions',
            widget_time_tracking_summary_title: 'Time Tracking Summary', widget_invoice_summary_title: 'Invoice Summary', widget_goal_progress_title: 'Goal Progress',
            action_new_project: 'New Project', action_add_client: 'Add Client', action_create_invoice: 'Create Invoice', action_schedule_meeting: 'Schedule Meeting',
            view_all: 'View All',
            edit_dashboard: 'Edit Dashboard', add_widget: 'Add Widget', done_editing: 'Done Editing',
            no_tasks_assigned: 'No tasks assigned to you.',
            select_project_for_widget: 'Select a project to display data.',
            no_activity_yet: 'No recent activity in this workspace.',
            grid_columns: 'Grid Columns',
            increase_width: 'Increase width',
            decrease_width: 'Decrease width',
            tasks_overdue: 'Overdue', tasks_today: 'Today', tasks_tomorrow: 'Tomorrow',
            invoices_pending: 'Pending', invoices_overdue: 'Overdue', time_today: 'Time Today',
            my_day_todays_schedule: "Today's Schedule",
            my_day_for_you: "For You",
            my_day_my_tasks: "My Tasks",
            my_day_overdue: "Overdue",
            my_day_today: "Today",
            my_day_tomorrow: "Tomorrow",
            my_day_no_tasks: "You're all clear! No tasks for this period.",
            my_day_no_schedule: "No events scheduled for today.",
            my_day_no_notifications: "You're all caught up!",
            my_day_quick_actions: "Quick Actions",
            my_day_log_time: "Log Time",
            my_day_active_projects: "My Active Projects",
            my_day_time_summary: "Today's Time Summary",
            tab_my_day: "My Day",
            tab_overview: "Overview",
        },
        projects: {
            no_projects_yet: 'No projects yet.',
            no_projects_desc: 'Add your first project to get started.',
            grid_view: 'Grid',
            portfolio_view: 'Portfolio',
            col_status: 'Status',
            col_progress: 'Progress',
            col_due_date: 'Due Date',
            col_budget: 'Budget',
            col_team: 'Team',
            status_on_track: 'On Track',
            status_at_risk: 'At Risk',
            status_completed: 'Completed',
            all_statuses: 'All Statuses',
        },
        goals: {
            title: 'Goals & Objectives',
            subtitle: 'Track and manage your business goals and KPIs',
            analytics: 'Analytics',
            new_goal: 'New Goal',
            total_goals: 'Total Goals',
            in_progress: 'In Progress',
            completed: 'Completed',
            avg_progress: 'Avg Progress',
            goal_categories: 'Goal Categories',
            active_goals: 'Active goals',
            search: 'Search goals...',
        },
        inventory: {
            title: 'Inventory Management',
            subtitle: 'Track and manage your company assets',
            add_item: 'Add Item',
            total_items: 'Total Items',
            total_value: 'Total Value',
            low_stock: 'Low Stock',
            out_of_stock: 'Out of Stock',
            inventory_by_category: 'Inventory by Category',
            items: 'Items',
            value: 'Value',
            search_inventory: 'Search by name, category, or SKU...',
            col_item: 'Item',
            col_sku: 'SKU',
            col_stock_level: 'Stock Level',
            col_unit_price: 'Unit Price',
            col_total_value: 'Total Value',
            col_status: 'Status',
            col_actions: 'Actions',
            status_in_stock: 'In Stock',
            status_low_stock: 'Low Stock',
            status_out_of_stock: 'Out of Stock',
            no_items: 'No inventory items found.',
            modal_add_item_title: 'Add New Item',
            modal_edit_item_title: 'Edit Item',
            modal_item_name: 'Item Name',
            modal_category: 'Category',
            modal_sku: 'SKU (Stock Keeping Unit)',
            modal_location: 'Location',
            modal_current_stock: 'Current Stock',
            modal_target_stock: 'Target Stock',
            modal_low_stock_threshold: 'Low Stock Threshold',
            modal_unit_price: 'Unit Price',
            modal_assign_item_title: 'Assign Item',
            modal_assign_to: 'Assign to Employee',
            modal_assignment_date: 'Assignment Date',
            modal_return_date: 'Expected Return Date',
            modal_serial_number: 'Serial Number (Optional)',
            modal_notes: 'Notes',
        },
    }
};

type NestedStringObject = { [key: string]: string | NestedStringObject };

function getTranslationsForLang(lang: 'en' | 'pl'): NestedStringObject {
    return (translations as any)[lang] || translations.en;
}

export function t(key: string, replacements?: { [key: string]: string | number }): string {
    const { language } = getState().settings;
    const langTranslations = getTranslationsForLang(language);

    const keys = key.split('.');
    let result: any = langTranslations;

    for (const k of keys) {
        if (result && typeof result === 'object' && k in result) {
            result = result[k];
        } else {
            console.warn(`Translation key not found: ${key}`);
            return key;
        }
    }

    if (typeof result === 'string' && replacements) {
        return Object.entries(replacements).reduce((acc, [placeholder, value]) => {
            return acc.replace(`{${placeholder}}`, String(value));
        }, result);
    }

    return typeof result === 'string' ? result : key;
}
