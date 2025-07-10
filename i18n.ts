
import { state } from './state.ts';

const translations = {
    en: {
        sidebar: { dashboard: 'Dashboard', projects: 'Projects', tasks: 'Tasks', team_calendar: 'Team Calendar', clients: 'Clients', sales: 'Sales', reports: 'Reports', invoices: 'Invoices', ai_assistant: 'AI Assistant', hr: 'HR', settings: 'Settings', billing: 'Billing', chat: 'Chat' },
        dashboard: {
            title: 'Dashboard', total_projects: 'Total Projects', total_clients: 'Total Clients', recent_projects: 'Recent Projects', action_items: 'Action Items (To Do)', no_projects_yet: "No projects yet. Create one from the 'Projects' page.", no_tasks_todo: "No tasks in 'To Do'. Great job!",
            edit_dashboard: 'Edit Dashboard', add_widget: 'Add Widget', done_editing: 'Done Editing',
            widget_my_tasks_title: 'My Tasks', widget_project_status_title: 'Project Status', widget_team_workload_title: 'Team Workload', widget_recent_activity_title: 'Recent Activity',
            no_tasks_assigned: 'No tasks assigned to you.',
            select_project_for_widget: 'Select a project to display data.',
            no_activity_yet: 'No recent activity in this workspace.',
            grid_columns: 'Grid Columns'
        },
        tasks: {
            title: 'Tasks', new_task: 'New Task', board_view: 'Board View', list_view: 'List View', calendar_view: 'Calendar View', gantt_view: 'Gantt View',
            search_placeholder: "Search by name or description...",
            all_assignees: "All Assignees", all_priorities: "All Priorities", all_projects: "All Projects", all_statuses: "All Statuses",
            filter_by_date: "Filter by date", date_all: "Any date", date_today: "Today", date_tomorrow: "Tomorrow", date_yesterday: "Yesterday", date_this_week: "This week", date_overdue: "Overdue",
            reset_filters: "Reset Filters",
            filters_button_text: 'Filters',
            automations_button_text: 'Automations',
            backlog: "Backlog", todo: "To Do", inprogress: "In Progress", inreview: "In Review", done: "Done",
            no_tasks_found: "No tasks found. Click 'New Task' to create one.", no_tasks_match_filters: "No tasks match the current filters.",
            col_task: 'Task', col_project: 'Project', col_assignee: 'Assignee', col_due_date: 'Due Date', col_priority: 'Priority', col_status: 'Status', col_time: 'Time',
            unassigned: "Unassigned", priority_none: "None", priority_low: "Low", priority_medium: "Medium", priority_high: "High",
            start_timer: 'Start timer', stop_timer: 'Stop timer',
            subtask_progress: '{completed}/{total}'
        },
        sales: {
            title: 'Sales Pipeline',
            new_deal: 'New Deal',
            stage_lead: 'Lead In',
            stage_contacted: 'Contact Made',
            stage_demo: 'Demo Scheduled',
            stage_proposal: 'Proposal Made',
            stage_won: 'Won',
            stage_lost: 'Lost',
            no_deals: 'No deals in this stage yet.',
            deal_value: 'Value',
            deal_owner: 'Owner',
            deal_client: 'Client',
            expected_close: 'Expected Close'
        },
        calendar: { prev_month: 'Previous month', next_month: 'Next month', weekdays: { sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat' } },
        team_calendar: { title: 'Team Calendar', add_event: 'Add Event', add_leave: 'Add Leave Request', time_off: 'Time Off', event: 'Event', on_call: 'On-call', public_holiday: 'Public Holiday', leave_type_vacation: 'Vacation', leave_type_sick_leave: 'Sick Leave', leave_type_other: 'Other' },
        clients: { title: 'Clients', new_client: 'New Client', no_clients_yet: 'No Clients Yet', no_clients_desc: 'Add your first client to associate with projects.', add_client: 'Add Client' },
        projects: { title: 'Projects', new_project: 'New Project', no_projects_yet: 'No Projects Yet', no_projects_desc: 'Create your first project to start organizing your work.', create_project: 'Create Project', project_is_private: 'Private Project' },
        reports: {
            title: 'Reports',
            tab_productivity: 'Productivity', tab_time: 'Time Tracking', tab_financial: 'Financial',
            filter_date_range: 'Date Range', filter_project: 'Project', filter_user: 'User', filter_client: 'Client',
            all_projects: 'All Projects', all_users: 'All Users', all_clients: 'All Clients',
            report_task_status_title: 'Task Status', report_user_activity_title: 'User Activity',
            report_time_tracking_title: 'Time Tracking Details', report_revenue_by_client_title: 'Revenue by Client', report_overdue_invoices_title: 'Overdue Invoices',
            export_csv: 'Export CSV', export_pdf: 'Export PDF',
            no_data: 'No data available for the selected filters.',
            col_user: 'User', col_tasks_completed: 'Tasks Completed', col_time_tracked: 'Time Tracked',
            col_date: 'Date', col_task: 'Task', col_project: 'Project', col_client: 'Client', col_time: 'Time', col_comment: 'Comment',
            col_invoice_number: 'Invoice #', col_due_date: 'Due Date', col_amount: 'Amount', col_days_overdue: 'Days Overdue'
        },
        invoices: { title: 'Invoices', new_invoice: 'New Invoice', invoice_singular: 'Invoice', no_invoices_yet: 'No Invoices Yet', no_invoices_desc: 'Create your first invoice to bill a client.', col_number: 'Number', col_client: 'Client', col_issued: 'Issued', col_due: 'Due', col_total: 'Total', col_status: 'Status', col_actions: 'Actions', download_pdf: 'Download PDF', unit_price: "Unit Price", total_price: "Total Price", generated_item_desc: 'Work on project {projectName} ({hours} hours)', generated_expense_desc: 'Expense: {expenseDesc}', mark_as_paid: 'Mark as Paid', mark_as_unpaid: 'Mark as Unpaid', all_clients: 'All Clients', all_statuses: 'All Statuses', status_pending: 'Pending', status_paid: 'Paid', status_overdue: 'Overdue', toggle_filters: 'Toggle Filters', send_by_email: 'Send by Email', status_sent: 'Sent', email_template_subject: 'Invoice {invoiceNumber} from {companyName}', email_template_body: 'Hello,\n\nThis email is regarding invoice {invoiceNumber}.\nPlease download the PDF and attach it to this email before sending.\n\nBest regards,\n{companyName}', client_email_missing: 'Client email address is not configured.' },
        ai_assistant: { title: 'AI Assistant', description: 'Describe your project idea, and the AI will generate a list of actionable tasks to get you started.', prompt_label: 'Describe your project idea', prompt_placeholder: 'e.g., A mobile app for a local restaurant that allows users to browse the menu and book a table.', project_select_label: 'Add tasks to project', project_select_empty: 'Please create a project first', generate_button: 'Generate Tasks', generating_button: 'Generating...', suggestions_title: 'Suggested Tasks', add_to_project: 'Add to project', suggestions_appear_here: 'Suggestions will appear here', all_tasks_added: 'All suggested tasks have been added.' },
        settings: { title: 'Settings', dark_mode: 'Dark Mode', dark_mode_desc: 'Enable or disable dark theme for the application.', language: 'Language', language_desc: 'Choose the application language.', english: 'English', polish: 'Polski', default_workflow: 'Default Kanban Workflow', workflow_desc: 'Choose the default set of columns for the task board.', workflow_simple: 'Simple (3 columns)', workflow_advanced: 'Advanced (5 columns)', tab_general: 'General', tab_custom_fields: 'Custom Fields', tab_workspace: 'Workspace', add_field: 'Add Field', field_name: 'Field Name', field_type: 'Field Type', field_type_text: 'Text', field_type_number: 'Number', field_type_date: 'Date', field_type_checkbox: 'Checkbox', no_custom_fields: 'No custom fields defined yet.', company_details: 'Company Details', company_name: 'Company Name', company_address: 'Company Address', company_vat_id: 'VAT ID', company_email: 'Company Email (for communication)', bank_details: 'Bank Details', bank_name: 'Bank Name', bank_account: 'Bank Account', company_logo: 'Company Logo', upload_logo: 'Upload Logo', remove_logo: 'Remove Logo', logo_preview: 'Logo Preview', tab_profile: 'Profile', profile_details: 'Profile Details', full_name: 'Full Name', email_address: 'Email Address', avatar: 'Avatar', upload_avatar: 'Upload new photo', change_password: 'Change Password', new_password: 'New Password', confirm_new_password: 'Confirm New Password', password_mismatch: "New passwords do not match.", profile_updated: "Profile updated successfully!", password_updated: "Password updated successfully!", update_profile: "Update Profile", update_password: "Update Password", error_updating_profile: "Error updating profile.", error_updating_password: "Error updating password." },
        hr: {
            title: 'HR',
            tabs: { employees: 'Employees', requests: 'Requests', history: 'Leave History', reviews: 'Reviews' },
            invite_member: 'Invite Member', invite_by_email: 'Invite by email', select_role: 'Select role', invite: 'Invite', create_workspace_title: 'Create new workspace', workspace_name_label: 'Workspace Name', create_button: 'Create', members_in: 'Members in', you: 'you', role_owner: 'Owner', role_manager: 'Manager', role_member: 'Member', role_client: 'Client', cannot_remove_owner: "Cannot remove the last owner of a workspace.", workspace_limit_reached: "You have reached your workspace limit for the current plan.", workspace_name_exists: "A workspace with this name already exists. Please choose a different name.", access_denied: "Access Denied", access_denied_desc: "You do not have permission to view this page.", remove: "Remove", no_pending_requests: 'No pending leave requests.', join_requests_title: "Workspace Join Requests", approve: "Approve", reject: "Reject"
        },
        billing: { title: 'Billing', current_plan: 'Your Current Plan', change_plan: 'Change Plan', workspaces: 'Workspaces', projects: 'Projects', users: 'Users', invoices_month: 'Invoices (this month)', unlimited: 'Unlimited', per_month: 'per month', btn_current_plan: 'Current Plan', btn_change_plan: 'Change Plan', plan_free: 'Free', price_free: '$0', plan_starter: 'Starter', price_starter: '$29', plan_pro: 'Pro', price_pro: '$79', plan_business: 'Business', price_business: '$149', plan_enterprise: 'Enterprise', price_enterprise: 'Contact us', feature_workspaces: '{count} workspaces', feature_unlimited_workspaces: 'Unlimited workspaces', feature_projects: '{count} projects', feature_unlimited_projects: 'Unlimited projects', feature_users: '{count} users', feature_unlimited_users: 'Unlimited users', feature_invoices: '{count} invoices/mo', feature_unlimited_invoices: 'Unlimited invoices', limit_reached_projects: 'You have reached your project limit for the {planName} plan. Please upgrade to create more.', limit_reached_users: 'You have reached your user limit for the {planName} plan. Please upgrade to invite more.', limit_reached_invoices: 'You have reached your monthly invoice limit for the {planName} plan. Please upgrade to create more.', billing_history: 'Billing History', history_plan: 'Plan', history_date: 'Date', confirm_plan_change_title: 'Confirm Plan Change', confirm_plan_change_message: 'Are you sure you want to change to the {planName} plan?', access_denied: 'Access Denied', access_denied_desc: 'Only workspace owners can manage billing.' },
        panels: { close: 'Close', client_details: 'Client Details', edit_client: 'Edit', associated_projects: 'Associated Projects', projects_soon: 'Projects for this client will appear here.', project_overview: 'Overview', total_time_tracked: 'Total Time Tracked', tasks: 'Tasks', client_info: 'Client Info', client_not_found: 'Client not found.', no_tasks_in_stage: 'No tasks in this stage.', add_task: 'Add Task', tab_tasks: 'Tasks', tab_wiki: 'Wiki', tab_files: 'Files', tab_access: 'Access', saved: 'Saved!', history: 'History', no_files: 'No files uploaded yet.', upload_file: 'Upload File', seller: 'Seller', buyer: 'Buyer', project_access: 'Project Access', role_admin: 'Admin', role_editor: 'Editor', role_commenter: 'Commenter', role_viewer: 'Viewer', invite_to_project: 'Invite to Project', no_automations: 'No automations configured for this project.', automations_title: 'Automations', add_automation: 'Add Automation', when: 'When', trigger_status_change: 'Status changes to', then: 'Then', action_assign_user: 'assign user', save_as_template: 'Save as template' },
        modals: {
            cancel: 'Cancel', save: 'Save',
            add_client_title: 'Add New Client', edit_client_title: 'Edit Client',
            company_name: 'Company Name', vat_id: 'VAT ID', contact_person: 'Contact Person', email: 'Email', phone: 'Phone',
            add_project_title: 'Add New Project', project_name: 'Project Name', assign_to_client: 'Assign to client', select_a_client: 'Select a client', hourly_rate: 'Default Hourly Rate (PLN)', privacy: 'Privacy', privacy_public: 'Public', privacy_public_desc: 'Everyone in the workspace can see this project.', privacy_private: 'Private', privacy_private_desc: 'Only invited members can see this project.', create_from_template: 'Create from Template', select_template: 'None (start fresh)',
            add_task_title: 'Add New Task', task_name: 'Task Name', description: 'Description', project: 'Project', select_a_project: 'Select a project', assignee: 'Assignee', unassigned: 'Unassigned', start_date: 'Start Date', due_date: 'Due Date',
            task_details_title: 'Task Details', status: 'Status', priority: 'Priority',
            status_backlog: 'Backlog', status_todo: 'To Do', status_inprogress: 'In Progress', status_inreview: 'In Review', status_done: 'Done',
            priority_none: 'None', priority_low: 'Low', priority_medium: 'Medium', priority_high: 'High',
            details: 'Details', activity: 'Activity', no_activity: 'No activity yet.', add_comment: 'Add a comment...', comment_button: 'Comment', logged: 'logged',
            add_timelog_comment_title: 'Add a comment to your time log', time_tracked: 'Time tracked', save_without_comment: 'Save without comment', save_log: 'Save Log', comment_placeholder: 'What did you work on?',
            create_invoice_title: 'Create Invoice', client: 'Client', issue_date: 'Issue Date', invoice_items: 'Invoice Items', item_description: 'Description', item_qty: 'Qty', item_price: 'Unit Price', add_item: 'Add Item', remove_item: 'Remove Item', total: 'Total', generate_from_time: 'Generate from unbilled time & expenses',
            automations_title: 'Project Automations',
            configure_widget: 'Configure Widget', add_widget: 'Add Widget to Dashboard',
            wiki_history_title: 'Wiki History', version_from: 'Version from {date} by {user}', restore: 'Restore',
            subtasks: 'Subtasks', attachments: 'Attachments', dependencies: 'Dependencies',
            add_subtask: 'Add a new subtask...', add_dependency: 'Add dependency (task must be completed first)', select_task: 'Select a task', blocked_by: 'Blocked by', blocking: 'Blocking',
            add_attachment: 'Add attachment',
            repeat: 'Repeat', repeat_none: 'Does not repeat', repeat_daily: 'Daily', repeat_weekly: 'Weekly', repeat_monthly: 'Monthly',
            custom_fields: 'Custom Fields',
            add_manual_time_log_title: 'Add Manual Time Log', add_time_log_button: 'Add Time', time_to_log: 'Time to Log (e.g., 1h 30m)', time_placeholder: 'e.g., 2h 30m', date_worked: 'Date Worked',
            okrs: 'OKRs', add_objective_title: 'Add Objective', objective_title: 'Objective Title', add_key_result_title: 'Add Key Result', kr_title: 'Key Result Title', kr_type: 'Type', kr_type_number: 'Number', kr_type_percentage: 'Percentage', kr_start: 'Start Value', kr_target: 'Target Value', kr_current: 'Current Value',
            expenses: 'Expenses', add_expense_title: 'Add Expense', expense_description: 'Description', expense_amount: 'Amount (PLN)',
            employee_detail_title: 'Employee Details', contract_notes: 'Contract Notes', employment_notes: 'Employment & HR Notes',
            add_time_off_request_title: 'Add Time Off Request', leave_type: 'Leave Type', leave_type_vacation: 'Vacation', leave_type_sick_leave: 'Sick Leave', leave_type_other: 'Other',
            reject_request_title: 'Reject Request', rejection_reason: 'Reason for rejection (required)',
            status_pending: 'Pending', status_paid: 'Paid', status_overdue: 'Overdue', status_approved: 'Approved', status_rejected: 'Rejected',
            add_deal_title: 'Add New Deal', edit_deal_title: 'Edit Deal', deal_name: 'Deal Name', deal_client: 'Client', deal_value: 'Value (PLN)', deal_owner: 'Owner', deal_stage: 'Stage', deal_close_date: 'Expected Close Date',
        },
        misc: { not_applicable: 'N/A', no_project: 'No Project', no_client: 'No Client', edit: 'Edit' },
        notifications: { title: 'Notifications', mark_all_read: 'Mark all as read', no_notifications: 'You have no new notifications.', comment_added: '{user} commented on {taskName}', task_assigned: 'You have been assigned to task {taskName}', status_changed: 'Status for {taskName} was changed to {status}', user_mentioned: '{user} mentioned you in {taskName}', join_request: '{user} wants to join workspace {workspaceName}' },
        command_palette: { placeholder: 'Type a command or search...', no_results: 'No results found', cmd_new_task: 'Create new task', cmd_toggle_theme: 'Toggle light/dark theme', cmd_go_dashboard: 'Go to Dashboard', cmd_go_projects: 'Go to Projects', cmd_go_tasks: 'Go to Tasks', cmd_go_settings: 'Go to Settings', cmd_toggle_notifications: 'Toggle notifications', cmd_new_project: 'Create new project', cmd_new_client: 'Create new client', cmd_new_invoice: 'Create new invoice', cmd_go_hr: 'Go to HR' },
        setup: { title: "Let's get you set up", create_workspace_header: "Create a new workspace", create_workspace_placeholder: "Your company or team name", create_workspace_button: "Create Workspace", join_workspace_header: "Or join an existing one", join_workspace_placeholder: "Enter workspace name", join_workspace_button: "Request to Join", request_pending_title: "Request Sent!", request_pending_message: "Your request to join <strong>{workspaceName}</strong> has been sent. You will be notified once the owner approves it. Please check back later." }
    },
    pl: {
        sidebar: { dashboard: 'Pulpit', projects: 'Projekty', tasks: 'Zadania', team_calendar: 'Kalendarz Zespołu', clients: 'Klienci', sales: 'Sprzedaż', reports: 'Raporty', invoices: 'Faktury', ai_assistant: 'Asystent AI', hr: 'Kadry', settings: 'Ustawienia', billing: 'Rozliczenia', chat: 'Czat' },
        dashboard: {
            title: 'Pulpit', total_projects: 'Wszystkich projektów', total_clients: 'Wszystkich klientów', recent_projects: 'Ostatnie projekty', action_items: 'Zadania do zrobienia', no_projects_yet: "Brak projektów. Utwórz nowy w zakładce 'Projekty'.", no_tasks_todo: "Brak zadań w 'Do zrobienia'. Dobra robota!",
            edit_dashboard: 'Edytuj pulpit', add_widget: 'Dodaj widżet', done_editing: 'Zakończ edycję',
            widget_my_tasks_title: 'Moje zadania', widget_project_status_title: 'Status projektu', widget_team_workload_title: 'Obciążenie zespołu', widget_recent_activity_title: 'Ostatnia aktywność',
            no_tasks_assigned: 'Nie masz przypisanych żadnych zadań.',
            select_project_for_widget: 'Wybierz projekt, aby wyświetlić dane.',
            no_activity_yet: 'Brak ostatniej aktywności w tym obszarze roboczym.',
            grid_columns: 'Liczba kolumn'
        },
        tasks: {
            title: 'Zadania', new_task: 'Nowe zadanie', board_view: 'Tablica', list_view: 'Lista', calendar_view: 'Kalendarz', gantt_view: 'Gantt',
            search_placeholder: "Szukaj po nazwie lub opisie...",
            all_assignees: "Wszyscy przypisani", all_priorities: "Wszystkie priorytety", all_projects: "Wszystkie projekty", all_statuses: "Wszystkie statusy",
            filter_by_date: "Filtruj po dacie", date_all: "Dowolna data", date_today: "Dzisiaj", date_tomorrow: "Jutro", date_yesterday: "Wczoraj", date_this_week: "Ten tydzień", date_overdue: "Zaległe",
            reset_filters: "Resetuj filtry",
            filters_button_text: 'Filtry',
            automations_button_text: 'Automatyzacje',
            backlog: "Backlog", todo: "Do zrobienia", inprogress: "W toku", inreview: "Weryfikacja", done: "Zakończone",
            no_tasks_found: "Nie znaleziono zadań. Kliknij 'Nowe zadanie', aby je utworzyć.", no_tasks_match_filters: "Brak zadań pasujących do obecnych filtrów.",
            col_task: 'Zadanie', col_project: 'Projekt', col_assignee: 'Przypisany', col_due_date: 'Termin', col_priority: 'Priorytet', col_status: 'Status', col_time: 'Czas',
            unassigned: "Nieprzypisane", priority_none: "Brak", priority_low: "Niski", priority_medium: "Średni", priority_high: "Wysoki",
            start_timer: 'Uruchom stoper', stop_timer: 'Zatrzymaj stoper',
            subtask_progress: '{completed}/{total}'
        },
        sales: {
            title: 'Lejek Sprzedażowy',
            new_deal: 'Nowa Szansa',
            stage_lead: 'Nowy Lead',
            stage_contacted: 'Nawiązano Kontakt',
            stage_demo: 'Umówiono Demo',
            stage_proposal: 'Wysłano Ofertę',
            stage_won: 'Wygrana',
            stage_lost: 'Przegrana',
            no_deals: 'Brak szans w tym etapie.',
            deal_value: 'Wartość',
            deal_owner: 'Opiekun',
            deal_client: 'Klient',
            expected_close: 'Przew. zamknięcie'
        },
        calendar: { prev_month: 'Poprzedni miesiąc', next_month: 'Następny miesiąc', weekdays: { sun: 'Niedz', mon: 'Pon', tue: 'Wt', wed: 'Śr', thu: 'Czw', fri: 'Pt', sat: 'Sob' } },
        team_calendar: { title: 'Kalendarz Zespołu', add_event: 'Dodaj wydarzenie', add_leave: 'Zgłoś urlop/zwolnienie', time_off: 'Urlop/Zwolnienie', event: 'Wydarzenie', on_call: 'Dyżur', public_holiday: 'Święto państwowe', leave_type_vacation: 'Urlop wypoczynkowy', leave_type_sick_leave: 'Zwolnienie lekarskie', leave_type_other: 'Inne' },
        clients: { title: 'Klienci', new_client: 'Nowy Klient', no_clients_yet: 'Brak Klientów', no_clients_desc: 'Dodaj swojego pierwszego klienta, aby powiązać go z projektami.', add_client: 'Dodaj Klienta' },
        projects: { title: 'Projekty', new_project: 'Nowy Projekt', no_projects_yet: 'Brak Projektów', no_projects_desc: 'Utwórz swój pierwszy projekt, aby zacząć organizować pracę.', create_project: 'Utwórz Projekt', project_is_private: 'Projekt prywatny' },
        reports: {
            title: 'Raporty',
            tab_productivity: 'Produktywność', tab_time: 'Śledzenie czasu', tab_financial: 'Finanse',
            filter_date_range: 'Zakres dat', filter_project: 'Projekt', filter_user: 'Użytkownik', filter_client: 'Klient',
            all_projects: 'Wszystkie projekty', all_users: 'Wszyscy użytkownicy', all_clients: 'Wszyscy klienci',
            report_task_status_title: 'Status zadań', report_user_activity_title: 'Aktywność użytkowników',
            report_time_tracking_title: 'Szczegóły śledzenia czasu', report_revenue_by_client_title: 'Przychody według klientów', report_overdue_invoices_title: 'Zaległe faktury',
            export_csv: 'Eksportuj CSV', export_pdf: 'Eksportuj PDF',
            no_data: 'Brak danych dla wybranych filtrów.',
            col_user: 'Użytkownik', col_tasks_completed: 'Zakończone zadania', col_time_tracked: 'Zarejestrowany czas',
            col_date: 'Data', col_task: 'Zadanie', col_project: 'Projekt', col_client: 'Klient', col_time: 'Czas', col_comment: 'Komentarz',
            col_invoice_number: 'Nr faktury', col_due_date: 'Termin płatności', col_amount: 'Kwota', col_days_overdue: 'Dni po terminie'
        },
        invoices: { title: 'Faktury', new_invoice: 'Nowa Faktura', invoice_singular: 'Faktura', no_invoices_yet: 'Brak Faktur', no_invoices_desc: 'Utwórz swoją pierwszą fakturę, aby rozliczyć się z klientem.', col_number: 'Numer', col_client: 'Klient', col_issued: 'Wystawiono', col_due: 'Termin', col_total: 'Suma', col_status: 'Status', col_actions: 'Akcje', download_pdf: 'Pobierz PDF', unit_price: "Cena jedn.", total_price: "Cena całkowita", generated_item_desc: 'Praca nad projektem {projectName} ({hours} godzin)', generated_expense_desc: 'Wydatek: {expenseDesc}', mark_as_paid: 'Oznacz jako opłaconą', mark_as_unpaid: 'Oznacz jako nieopłaconą', all_clients: 'Wszyscy Klienci', all_statuses: 'Wszystkie Statusy', status_pending: 'Oczekująca', status_paid: 'Opłacona', status_overdue: 'Zaległa', toggle_filters: 'Pokaż/ukryj filtry', send_by_email: 'Wyślij e-mailem', status_sent: 'Wysłano', email_template_subject: 'Faktura {invoiceNumber} od {companyName}', email_template_body: 'Dzień dobry,\n\nw nawiązaniu do faktury {invoiceNumber}.\nProszę pobrać plik PDF i załączyć go do tej wiadomości przed wysłaniem.\n\nZ poważaniem,\n{companyName}', client_email_missing: 'Adres e-mail klienta nie jest skonfigurowany.' },
        ai_assistant: { title: 'Asystent AI', description: 'Opisz swój pomysł na projekt, a sztuczna inteligencja wygeneruje listę praktycznych zadań, które pomogą Ci zacząć.', prompt_label: 'Opisz swój pomysł na projekt', prompt_placeholder: 'np. Aplikacja mobilna dla lokalnej restauracji, która umożliwia przeglądanie menu i rezerwację stolika.', project_select_label: 'Dodaj zadania do projektu', project_select_empty: 'Proszę najpierw utworzyć projekt', generate_button: 'Generuj Zadania', generating_button: 'Generowanie...', suggestions_title: 'Sugerowane zadania', add_to_project: 'Dodaj do projektu', suggestions_appear_here: 'Sugestie pojawią się tutaj', all_tasks_added: 'Wszystkie sugerowane zadania zostały dodane.' },
        settings: { title: 'Ustawienia', dark_mode: 'Tryb ciemny', dark_mode_desc: 'Włącz lub wyłącz ciemny motyw aplikacji.', language: 'Język', language_desc: 'Wybierz język aplikacji.', english: 'Angielski', polish: 'Polski', default_workflow: 'Domyślny przepływ Kanban', workflow_desc: 'Wybierz domyślny zestaw kolumn dla tablicy zadań.', workflow_simple: 'Prosty (3 kolumny)', workflow_advanced: 'Zaawansowany (5 kolumn)', tab_general: 'Ogólne', tab_custom_fields: 'Pola niestandardowe', tab_workspace: 'Obszar roboczy', add_field: 'Dodaj pole', field_name: 'Nazwa pola', field_type: 'Typ pola', field_type_text: 'Tekst', field_type_number: 'Liczba', field_type_date: 'Data', field_type_checkbox: 'Pole wyboru', no_custom_fields: 'Nie zdefiniowano jeszcze pól niestandardowych.', company_details: 'Dane firmy', company_name: 'Nazwa firmy', company_address: 'Adres firmy', company_vat_id: 'NIP', company_email: 'Firmowy e-mail (do komunikacji)', bank_details: 'Dane bankowe', bank_name: 'Nazwa banku', bank_account: 'Konto bankowe', company_logo: 'Logo firmy', upload_logo: 'Wgraj logo', remove_logo: 'Usuń logo', logo_preview: 'Podgląd logo', tab_profile: 'Profil', profile_details: 'Szczegóły profilu', full_name: 'Imię i nazwisko', email_address: 'Adres e-mail', avatar: 'Awatar', upload_avatar: 'Wgraj nowe zdjęcie', change_password: 'Zmień hasło', new_password: 'Nowe hasło', confirm_new_password: 'Potwierdź nowe hasło', password_mismatch: "Nowe hasła nie są zgodne.", profile_updated: "Profil zaktualizowano pomyślnie!", password_updated: "Hasło zaktualizowano pomyślnie!", update_profile: "Aktualizuj profil", update_password: "Aktualizuj hasło", error_updating_profile: "Błąd aktualizacji profilu.", error_updating_password: "Błąd aktualizacji hasła." },
        hr: {
            title: 'Kadry',
            tabs: { employees: 'Pracownicy', requests: 'Wnioski', history: 'Historia urlopów', reviews: 'Oceny' },
            invite_member: 'Zaproś członka', invite_by_email: 'Zaproś przez e-mail', select_role: 'Wybierz rolę', invite: 'Zaproś', create_workspace_title: 'Utwórz nowy obszar roboczy', workspace_name_label: 'Nazwa obszaru roboczego', create_button: 'Utwórz', members_in: 'Członkowie w', you: 'ty', role_owner: 'Właściciel', role_manager: 'Menedżer', role_member: 'Członek', role_client: 'Klient', cannot_remove_owner: "Nie można usunąć ostatniego właściciela obszaru roboczego.", workspace_limit_reached: "Osiągnąłeś limit obszarów roboczych dla obecnego planu.", workspace_name_exists: "Obszar roboczy o tej nazwie już istnieje. Proszę wybrać inną nazwę.", access_denied: "Dostęp zabroniony", access_denied_desc: "Nie masz uprawnień do przeglądania tej strony.", remove: "Usuń", no_pending_requests: 'Brak oczekujących wniosków urlopowych.', join_requests_title: "Prośby o dołączenie do obszaru", approve: "Zatwierdź", reject: "Odrzuć"
        },
        billing: { title: 'Rozliczenia', current_plan: 'Twój obecny plan', change_plan: 'Zmień plan', workspaces: 'Obszary robocze', projects: 'Projekty', users: 'Użytkownicy', invoices_month: 'Faktury (w tym m-cu)', unlimited: 'Nielimitowane', per_month: 'miesięcznie', btn_current_plan: 'Obecny plan', btn_change_plan: 'Zmień plan', plan_free: 'Darmowy', price_free: '0 zł', plan_starter: 'Starter', price_starter: '129 zł', plan_pro: 'Pro', price_pro: '349 zł', plan_business: 'Business', price_business: '659 zł', plan_enterprise: 'Enterprise', price_enterprise: 'Skontaktuj się', feature_workspaces: '{count} obszary robocze', feature_unlimited_workspaces: 'Nielimitowane obszary robocze', feature_projects: '{count} projektów', feature_unlimited_projects: 'Nielimitowane projekty', feature_users: '{count} użytkowników', feature_unlimited_users: 'Nielimitowani użytkownicy', feature_invoices: '{count} faktur/m-c', feature_unlimited_invoices: 'Nielimitowane faktury', limit_reached_projects: 'Osiągnąłeś limit projektów dla planu {planName}. Proszę, zaktualizuj plan, aby utworzyć więcej.', limit_reached_users: 'Osiągnąłeś limit użytkowników dla planu {planName}. Proszę, zaktualizuj plan, aby zaprosić więcej osób.', limit_reached_invoices: 'Osiągnąłeś miesięczny limit faktur dla planu {planName}. Proszę, zaktualizuj plan, aby utworzyć więcej.', billing_history: 'Historia rozliczeń', history_plan: 'Plan', history_date: 'Data', confirm_plan_change_title: 'Potwierdź zmianę planu', confirm_plan_change_message: 'Czy na pewno chcesz zmienić plan na {planName}?', access_denied: 'Dostęp zabroniony', access_denied_desc: 'Tylko właściciele obszaru roboczego mogą zarządzać rozliczeniami.' },
        panels: { close: 'Zamknij', client_details: 'Szczegóły klienta', edit_client: 'Edytuj', associated_projects: 'Powiązane projekty', projects_soon: 'Projekty tego klienta pojawią się tutaj.', project_overview: 'Przegląd', total_time_tracked: 'Całkowity zarejestrowany czas', tasks: 'Zadania', client_info: 'Informacje o kliencie', client_not_found: 'Nie znaleziono klienta.', no_tasks_in_stage: 'Brak zadań na tym etapie.', add_task: 'Dodaj zadanie', tab_tasks: 'Zadania', tab_wiki: 'Wiki', tab_files: 'Pliki', tab_access: 'Dostęp', saved: 'Zapisano!', history: 'Historia', no_files: 'Nie wgrano jeszcze żadnych plików.', upload_file: 'Wgraj plik', seller: 'Sprzedawca', buyer: 'Nabywca', project_access: 'Dostęp do projektu', role_admin: 'Admin', role_editor: 'Edytor', role_commenter: 'Komentujący', role_viewer: 'Przeglądający', invite_to_project: 'Zaproś do projektu', no_automations: 'Brak skonfigurowanych automatyzacji dla tego projektu.', automations_title: 'Automatyzacje', add_automation: 'Dodaj automatyzację', when: 'Gdy', trigger_status_change: 'Status zmieni się na', then: 'Wtedy', action_assign_user: 'przypisz użytkownika', save_as_template: 'Zapisz jako szablon' },
        modals: {
            cancel: 'Anuluj', save: 'Zapisz',
            add_client_title: 'Dodaj Nowego Klienta', edit_client_title: 'Edytuj Klienta',
            company_name: 'Nazwa Firmy', vat_id: 'NIP', contact_person: 'Osoba Kontaktowa', email: 'E-mail', phone: 'Telefon',
            add_project_title: 'Dodaj Nowy Projekt', project_name: 'Nazwa Projektu', assign_to_client: 'Przypisz do klienta', select_a_client: 'Wybierz klienta', hourly_rate: 'Domyślna stawka godzinowa (PLN)', privacy: 'Prywatność', privacy_public: 'Publiczny', privacy_public_desc: 'Wszyscy w obszarze roboczym widzą ten projekt.', privacy_private: 'Prywatny', privacy_private_desc: 'Tylko zaproszeni członkowie widzą ten projekt.', create_from_template: 'Utwórz z szablonu', select_template: 'Brak (zacznij od zera)',
            add_task_title: 'Dodaj Nowe Zadanie', task_name: 'Nazwa Zadania', description: 'Opis', project: 'Projekt', select_a_project: 'Wybierz projekt', assignee: 'Przypisany', unassigned: 'Nieprzypisany', start_date: 'Data rozpoczęcia', due_date: 'Termin wykonania',
            task_details_title: 'Szczegóły Zadania', status: 'Status', priority: 'Priorytet',
            status_backlog: 'Backlog', status_todo: 'Do zrobienia', status_inprogress: 'W toku', status_inreview: 'Weryfikacja', status_done: 'Zakończone',
            priority_none: 'Brak', priority_low: 'Niski', priority_medium: 'Średni', priority_high: 'Wysoki',
            details: 'Szczegóły', activity: 'Aktywność', no_activity: 'Brak aktywności.', add_comment: 'Dodaj komentarz...', comment_button: 'Skomentuj', logged: 'zarejestrował(a)',
            add_timelog_comment_title: 'Dodaj komentarz do swojego wpisu czasu', time_tracked: 'Zarejestrowany czas', save_without_comment: 'Zapisz bez komentarza', save_log: 'Zapisz wpis', comment_placeholder: 'Nad czym pracowałeś/aś?',
            create_invoice_title: 'Utwórz Fakturę', client: 'Klient', issue_date: 'Data wystawienia', invoice_items: 'Pozycje na fakturze', item_description: 'Opis', item_qty: 'Ilość', item_price: 'Cena jedn.', add_item: 'Dodaj pozycję', remove_item: 'Usuń pozycję', total: 'Suma', generate_from_time: 'Generuj z nierozliczonego czasu i wydatków',
            automations_title: 'Automatyzacje Projektu',
            configure_widget: 'Konfiguruj widżet', add_widget: 'Dodaj widżet do pulpitu',
            wiki_history_title: 'Historia Wiki', version_from: 'Wersja z {date} autorstwa {user}', restore: 'Przywróć',
            subtasks: 'Podzadania', attachments: 'Załączniki', dependencies: 'Zależności',
            add_subtask: 'Dodaj nowe podzadanie...', add_dependency: 'Dodaj zależność (zadanie musi być ukończone jako pierwsze)', select_task: 'Wybierz zadanie', blocked_by: 'Blokowane przez', blocking: 'Blokuje',
            add_attachment: 'Dodaj załącznik',

            repeat: 'Powtarzaj', repeat_none: 'Nie powtarza się', repeat_daily: 'Codziennie', repeat_weekly: 'Tygodniowo', repeat_monthly: 'Miesięcznie',
            custom_fields: 'Pola niestandardowe',
            add_manual_time_log_title: 'Dodaj ręczny wpis czasu', add_time_log_button: 'Dodaj czas', time_to_log: 'Czas do zaraportowania (np. 1h 30m)', time_placeholder: 'np. 2h 30m', date_worked: 'Data pracy',
            okrs: 'OKR-y', add_objective_title: 'Dodaj Cel (Objective)', objective_title: 'Tytuł celu', add_key_result_title: 'Dodaj Kluczowy Rezultat', kr_title: 'Tytuł kluczowego rezultatu', kr_type: 'Typ', kr_type_number: 'Liczbowy', kr_type_percentage: 'Procentowy', kr_start: 'Wartość początkowa', kr_target: 'Wartość docelowa', kr_current: 'Wartość aktualna',
            expenses: 'Wydatki', add_expense_title: 'Dodaj wydatek', expense_description: 'Opis', expense_amount: 'Kwota (PLN)',
            employee_detail_title: 'Szczegóły pracownika', contract_notes: 'Notatki dot. umowy', employment_notes: 'Notatki dot. zatrudnienia i kadrowe',
            add_time_off_request_title: 'Zgłoś urlop/zwolnienie', leave_type: 'Rodzaj nieobecności', leave_type_vacation: 'Urlop wypoczynkowy', leave_type_sick_leave: 'Zwolnienie lekarskie', leave_type_other: 'Inne',
            reject_request_title: 'Odrzuć wniosek', rejection_reason: 'Powód odrzucenia (wymagany)',
            status_pending: 'Oczekująca', status_paid: 'Opłacona', status_overdue: 'Zaległa', status_approved: 'Zatwierdzony', status_rejected: 'Odrzucony',
            add_deal_title: 'Dodaj nową szansę', edit_deal_title: 'Edytuj szansę', deal_name: 'Nazwa szansy', deal_client: 'Klient', deal_value: 'Wartość (PLN)', deal_owner: 'Opiekun', deal_stage: 'Etap', deal_close_date: 'Przewidywana data zamknięcia',
        },
        misc: { not_applicable: 'B/D', no_project: 'Brak projektu', no_client: 'Brak klienta', edit: 'Edytuj' },
        notifications: { title: 'Powiadomienia', mark_all_read: 'Oznacz wszystkie jako przeczytane', no_notifications: 'Nie masz nowych powiadomień.', comment_added: '{user} skomentował(a) {taskName}', task_assigned: 'Przydzielono Ci zadanie {taskName}', status_changed: 'Status dla {taskName} zmieniono na {status}', user_mentioned: '{user} wspomniał(a) o Tobie w {taskName}', join_request: '{user} chce dołączyć do obszaru roboczego {workspaceName}' },
        command_palette: { placeholder: 'Wpisz komendę lub szukaj...', no_results: 'Nie znaleziono wyników', cmd_new_task: 'Utwórz nowe zadanie', cmd_toggle_theme: 'Zmień motyw jasny/ciemny', cmd_go_dashboard: 'Przejdź do Pulpitu', cmd_go_projects: 'Przejdź do Projektów', cmd_go_tasks: 'Przejdź do Zadań', cmd_go_settings: 'Przejdź do Ustawień', cmd_toggle_notifications: 'Pokaż/ukryj powiadomienia', cmd_new_project: 'Utwórz nowy projekt', cmd_new_client: 'Utwórz nowego klienta', cmd_new_invoice: 'Utwórz nową fakturę', cmd_go_hr: 'Przejdź do Kadr' },
        setup: { title: "Zaczynajmy", create_workspace_header: "Utwórz nowy obszar roboczy", create_workspace_placeholder: "Nazwa Twojej firmy lub zespołu", create_workspace_button: "Utwórz obszar", join_workspace_header: "Lub dołącz do istniejącego", join_workspace_placeholder: "Wpisz nazwę obszaru roboczego", join_workspace_button: "Wyślij prośbę o dołączenie", request_pending_title: "Wysłano prośbę!", request_pending_message: "Twoja prośba o dołączenie do <strong>{workspaceName}</strong> została wysłana. Zostaniesz powiadomiony/a, gdy właściciel ją zatwierdzi. Sprawdź ponownie później." }
    }
};

export function t(key: string): string {
    const lang = state.settings.language;
    const keys = key.split('.');
    let result: any = translations[lang];

    for (const k of keys) {
        result = result?.[k];
        if (result === undefined) {
            console.warn(`Translation not found for key: ${key} in language: ${lang}`);
            return key;
        }
    }

    return result as string;
}