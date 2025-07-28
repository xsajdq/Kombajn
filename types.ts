

export interface User {
    id: string;
    name?: string;
    email?: string;
    avatarUrl?: string; // URL to an image
    initials: string;
    slackUserId?: string;
    contractInfoNotes?: string;
    employmentInfoNotes?: string;

    vacationAllowanceHours?: number; // Total vacation hours for the year
    kanbanViewMode?: 'simple' | 'detailed';
}

export type Role = 'owner' | 'admin' | 'manager' | 'member' | 'finance' | 'client';

export type Permission = 
    // Billing
    | 'manage_billing'
    // HR
    | 'view_hr'
    | 'manage_roles'
    | 'invite_users'
    | 'remove_users'
    // Workspace
    | 'manage_workspace_settings'
    // Main Entity Views
    | 'view_dashboard'
    | 'view_projects'
    | 'view_tasks'
    | 'view_clients'
    | 'view_sales'
    | 'view_invoices'
    | 'view_reports'
    | 'view_team_calendar'
    | 'view_chat'
    | 'view_ai_assistant'
    | 'view_settings'
    | 'view_goals'
    | 'view_inventory'
    | 'view_budgets'
    // Main Entity Management
    | 'manage_projects'
    | 'create_projects'
    | 'manage_clients'
    | 'manage_invoices'
    | 'manage_deals'
    | 'manage_tasks'
    | 'manage_automations'
    | 'manage_goals'
    | 'manage_inventory'
    | 'manage_budgets';


export type PlanId = 'free' | 'starter' | 'pro' | 'business' | 'enterprise';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due';

export interface PlanChange {
    planId: PlanId;
    date: string; // ISO 8601
}

export interface Workspace {
    id: string;
    name: string;
    companyName?: string;
    companyAddress?: string;
    companyVatId?: string;
    companyBankName?: string;
    companyBankAccount?: string;
    companyLogo?: string; // base64 data URL
    companyEmail?: string;
    subscription: {
        planId: PlanId;
        status: SubscriptionStatus;
    };
    planHistory?: PlanChange[];
    dashboardGridColumns?: number;
    onboardingCompleted?: boolean;
}

export interface WorkspaceMember {
    id: string; // Unique ID for the membership itself
    workspaceId: string;
    userId: string;
    role: Role;
}

export type ProjectRole = 'admin' | 'editor' | 'commenter' | 'viewer';

export interface ProjectMember {
    id: string; // Unique ID for this project membership
    projectId: string;
    userId: string;
    role: ProjectRole;
}


export interface ClientContact {
    id: string;
    clientId: string;
    workspaceId: string;
    name: string;
    email?: string;
    phone?: string;
    role?: string;
}
export interface Client {
    id:string;
    workspaceId: string;
    name: string; // Company Name
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    vatId?: string; // NIP for Polish context
    notes?: string;
    status?: 'active' | 'archived';
    // New fields
    healthStatus?: 'good' | 'at_risk' | 'neutral' | null;
    category?: string;
    contacts: ClientContact[];
}
export interface Project {
    id: string;
    workspaceId: string;
    name: string;
    clientId: string;
    wikiContent: string;
    hourlyRate?: number;
    privacy: 'public' | 'private';
    budgetHours?: number;
    // New fields
    budgetCost?: number;
    category?: string;
    isArchived?: boolean;
}

export interface ProjectSection {
    id: string;
    workspaceId: string;
    projectId: string;
    name: string;
    sortOrder?: number;
}
export interface Task {
    id: string;
    workspaceId: string;
    name: string;
    projectId: string;
    projectSectionId?: string | null;
    taskViewId?: string | null;
    dealId?: string; // Link task to a sales deal
    status: 'backlog' | 'todo' | 'inprogress' | 'inreview' | 'done';
    description?: string;
    startDate?: string; // YYYY-MM-DD
    dueDate?: string; // YYYY-MM-DD
    priority?: 'low' | 'medium' | 'high' | null;
    parentId?: string; // For subtasks
    recurrence?: 'none' | 'daily' | 'weekly' | 'monthly'; // For recurring tasks
    checklist?: { id: string; text: string; completed: boolean; }[];
    // New fields
    estimatedHours?: number; // in hours
    type?: 'feature' | 'bug' | 'chore' | null;
    isArchived: boolean;
    createdAt: string;
}

export interface TaskDependency {
    id: string;
    workspaceId: string;
    blockingTaskId: string; // The task that must be completed first
    blockedTaskId: string;  // The task that is waiting
    // New field
    reason?: string;
}

export interface TaskAssignee {
    taskId: string;
    userId: string;
    workspaceId: string;
}

export interface Tag {
    id: string;
    workspaceId: string;
    name: string;
    color?: string;
}

export interface TaskTag {
    taskId: string;
    tagId: string;
    workspaceId: string;
}

export interface Attachment {
    id: string;
    workspaceId: string;
    projectId: string; // All attachments belong to a project
    taskId?: string; // Optionally, to a specific task
    fileName: string;
    fileType?: string;
    fileSize?: number; // in bytes
    createdAt: string; // ISO
    
    // New fields for integrations
    provider: 'native' | 'google_drive';
    externalUrl?: string; // Link to the file (e.g., Google Drive link)
    fileId?: string; // ID of the file in the external service
    iconUrl?: string; // URL for the file type icon
}

export interface TimeLog {
    id: string;
    workspaceId: string;
    taskId: string;
    userId: string;
    trackedSeconds: number;
    comment?: string;
    createdAt: string; // ISO 8601 date string
    invoiceId?: string;
}

export interface CommentReaction {
    userId: string;
    emoji: string;
}
export interface Comment {
    id: string;
    workspaceId: string;
    taskId: string;
    userId: string;
    content: string;
    createdAt: string; // ISO 8601 date string
    parentId?: string;
    reactions?: CommentReaction[];
}

export interface NotificationAction {
    type: 'viewTask' | 'viewJoinRequests';
    taskId?: string;
}

export type NotificationType = 'new_comment' | 'new_assignment' | 'status_change' | 'mention' | 'join_request';

export interface Notification {
    id: string;
    userId: string; // The user who should see this
    workspaceId: string;
    actorId?: string;
    type: NotificationType;
    text: string;
    createdAt: string; // ISO 8601
    isRead: boolean;
    action: NotificationAction | null;
}

export interface InvoiceLineItem { id: string; invoiceId: string; description: string; quantity: number; unitPrice: number; }
export interface Invoice {
    id: string;
    workspaceId: string;
    invoiceNumber: string;
    clientId: string;
    issueDate: string; // YYYY-MM-DD
    dueDate: string; // YYYY-MM-DD
    items: InvoiceLineItem[];
    status: 'pending' | 'paid';
    emailStatus: 'sent' | 'not_sent';
}
export interface AiSuggestedTask {
    name: string;
    description: string;
}

export type CustomFieldType = 'text' | 'number' | 'date' | 'checkbox' | 'select';
export interface CustomFieldDefinition {
    id: string;
    workspaceId: string;
    name: string;
    type: CustomFieldType;
    options?: string[]; // For 'select' type
}

export interface CustomFieldValue {
    id: string;
    workspaceId: string;
    taskId: string;
    fieldId: string;
    value: any;
}

export interface AutomationTrigger {
    type: 'statusChange';
    status: Task['status'];
}

export type AutomationAction = 
    | { type: 'assignUser'; userId: string; }
    | { type: 'changeStatus'; status: Task['status']; };

export interface Automation {
    id: string;
    workspaceId: string;
    projectId: string;
    name: string;
    trigger: AutomationTrigger;
    actions: AutomationAction[];
}

export type DashboardWidgetType = 'kpiMetric' | 'recentProjects' | 'todaysTasks' | 'activityFeed' | 'quickActions' | 'schedule' | 'alerts' | 'weeklyPerformance' | 'timeTrackingSummary' | 'invoiceSummary';
export interface DashboardWidget {
    id: string;
    userId: string;
    workspaceId: string;
    type: DashboardWidgetType;
    x: number;
    y: number;
    w: number;
    h: number;
    sortOrder?: number;
    config: {
        title?: string;
        projectId?: string;
        userId?: string;
        metric?: 'totalRevenue' | 'activeProjects' | 'totalClients' | 'overdueProjects';
    };
}


export type Command = {
    id: string;
    name: string;
    action: () => void;
    icon?: string;
    shortcut?: string;
    permission?: Permission;
};

export type DateRangeFilter = 'all' | 'today' | 'tomorrow' | 'yesterday' | 'this_week' | 'overdue';

export interface TaskFilters {
    text: string;
    assigneeId: string;
    priority: string;
    projectId: string;
    status: string;
    dateRange: DateRangeFilter;
    tagIds: string[];
    isArchived: boolean;
}

export interface FilterView {
    id: string;
    workspaceId: string;
    userId: string;
    name: string;
    filters: TaskFilters;
}

// --- NEW ---
export interface ProjectTemplate {
    id: string;
    workspaceId: string;
    name: string;
    // We only copy a subset of task properties for a template
    tasks: {
        name: string;
        description?: string;
        priority?: 'low' | 'medium' | 'high';
    }[];
    automations: Omit<Automation, 'id' | 'workspaceId' | 'projectId'>[];
}

export interface WikiHistory {
    id: string;
    projectId: string;
    content: string;
    userId: string;
    createdAt: string; // ISO
}

export interface Channel {
    id: string;
    workspaceId: string;
    projectId?: string; // If it's a project channel
    name: string;
}

export interface ChatMessage {
    id: string;
    channelId: string;
    userId: string;
    content: string; // The message text, can include mentions
    createdAt: string; // ISO
}

export interface Objective {
    id: string;
    workspaceId: string;
    projectId?: string;
    title: string;
    description?: string;
    category?: string;
    status: 'in_progress' | 'completed' | 'on_hold' | 'archived';
    priority?: 'high' | 'medium' | 'low';
    dueDate?: string; // YYYY-MM-DD
    ownerId?: string; // User ID
    targetValue?: number;
    currentValue: number;
    valueUnit?: string; // e.g., '$', 'projects', '%'
}

export interface KeyResult {
    id: string;
    objectiveId: string;
    title: string;
    // These fields are from the original schema but will be ignored for the simple milestone view
    type: 'number' | 'percentage';
    startValue: number;
    targetValue: number;
    currentValue: number;
    // New field for simple checkable milestones
    completed: boolean;
}

export interface TimeOffRequest {
    id: string;
    workspaceId: string;
    userId: string;
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    type: 'vacation' | 'sick_leave' | 'other';
    status: 'approved' | 'pending' | 'rejected';
    rejectionReason?: string;
    createdAt: string; // ISO
}

export interface CalendarEvent {
    id: string;
    workspaceId: string;
    title: string;
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    isAllDay: boolean;
    type?: 'event' | 'on-call';
}

export interface Expense {
    id: string;
    workspaceId: string;
    projectId?: string;
    userId?: string;
    description: string;
    amount: number;
    date: string; // YYYY-MM-DD
    invoiceId?: string;
    isBillable?: boolean;
    category?: string;
    vendor?: string;
    receiptUrl?: string;
}

export interface PipelineStage {
    id: string;
    workspaceId: string;
    name: string;
    sortOrder: number;
    category: 'open' | 'won' | 'lost';
}

export interface Deal {
    id: string;
    workspaceId: string;
    name: string;
    clientId: string;
    stageId: string;
    value: number;
    ownerId: string;
    expectedCloseDate?: string; // YYYY-MM-DD
    createdAt: string; // ISO
    // New CRM fields
    probability: number; // Percentage 0-100
    priority?: 'low' | 'medium' | 'high' | null;
    lastActivityAt: string; // ISO string
    nextStep?: string;
}

export interface DealActivity {
    id: string;
    workspaceId: string;
    dealId: string;
    userId: string;
    content: string;
    createdAt: string; // ISO
    type: 'note' | 'call' | 'meeting' | 'email';
}

export interface WorkspaceJoinRequest {
    id: string;
    workspaceId: string;
    userId: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
}

export interface PublicHoliday {
    date: string;
    name: string;
}

export interface Integration {
    id: string;
    workspaceId: string;
    provider: 'slack' | 'google_drive' | 'google_gmail' | 'internal_settings';
    isActive: boolean;
    settings: {
        accessToken?: string;
        refreshToken?: string;
        tokenExpiry?: number; // Unix timestamp in seconds
        // Slack specific
        slackWorkspaceName?: string;
        slackTeamId?: string;
        slackBotUserId?: string;
        // Google specific
        googleUserEmail?: string;
        // Internal settings
        [key: string]: any;
    };
}

export interface TaskView {
    id: string;
    workspaceId: string;
    name: string;
    icon: string;
    sortOrder?: number;
}

export interface Review {
    id: string;
    workspaceId: string;
    employeeId: string;
    reviewerId: string;
    reviewDate: string; // YYYY-MM-DD
    notes: string;
    rating: number; // 1-5
    createdAt: string; // ISO
}

export interface UserTaskSortOrder {
    id: string;
    userId: string;
    taskId: string;
    workspaceId: string;
    status: Task['status'];
    sortOrder: number;
}

export interface InventoryItem {
    id: string;
    workspaceId: string;
    name: string;
    category?: string;
    sku?: string;
    location?: string;
    currentStock: number;
    targetStock: number;
    lowStockThreshold: number;
    unitPrice: number;
    createdAt: string;
}

export interface InventoryAssignment {
    id: string;
    workspaceId: string;
    itemId: string;
    employeeId: string;
    assignmentDate: string; // YYYY-MM-DD
    returnDate?: string; // YYYY-MM-DD
    notes?: string;
    serialNumber?: string;
    createdAt: string;
}

export interface Budget {
    id: string;
    workspaceId: string;
    category: string;
    period: string; // YYYY-MM-01 for monthly, YYYY-MM-DD for quarterly start
    amount: number;
}


export type SortByOption = 'manual' | 'dueDate' | 'priority' | 'name' | 'createdAt';

export interface AppState {
    currentPage: 'dashboard' | 'projects' | 'tasks' | 'clients' | 'invoices' | 'ai-assistant' | 'settings' | 'team-calendar' | 'sales' | 'reports' | 'chat' | 'hr' | 'billing' | 'auth' | 'setup' | 'goals' | 'inventory' | 'budget-and-expenses';
    currentUser: User | null;
    activeWorkspaceId: string | null;
    error: string | null;
    workspaces: Workspace[];
    workspaceMembers: WorkspaceMember[];
    projectMembers: ProjectMember[];
    users: User[];
    clients: Client[];
    clientContacts: ClientContact[];
    projects: Project[];
    tasks: Task[];
    projectSections: ProjectSection[];
    taskViews: TaskView[];
    taskAssignees: TaskAssignee[];
    tags: Tag[];
    taskTags: TaskTag[];
    dependencies: TaskDependency[];
    timeLogs: TimeLog[];
    comments: Comment[];
    invoices: Invoice[];
    notifications: Notification[];
    attachments: Attachment[];
    customFieldDefinitions: CustomFieldDefinition[];
    customFieldValues: CustomFieldValue[];
    automations: Automation[];
    dashboardWidgets: DashboardWidget[];
    projectTemplates: ProjectTemplate[];
    wikiHistory: WikiHistory[];
    channels: Channel[];
    chatMessages: ChatMessage[];
    objectives: Objective[];
    keyResults: KeyResult[];
    timeOffRequests: TimeOffRequest[];
    calendarEvents: CalendarEvent[];
    expenses: Expense[];
    deals: Deal[];
    dealActivities: DealActivity[];
    workspaceJoinRequests: WorkspaceJoinRequest[];
    publicHolidays: PublicHoliday[];
    integrations: Integration[];
    filterViews: FilterView[];
    reviews: Review[];
    inventoryItems: InventoryItem[];
    inventoryAssignments: InventoryAssignment[];
    userTaskSortOrders: UserTaskSortOrder[];
    budgets: Budget[];
    pipelineStages: PipelineStage[];
    ai: { loading: boolean; error: string | null; suggestedTasks: AiSuggestedTask[] | null; };
    settings: {
        theme: 'light' | 'dark' | 'minimal';
        language: 'en' | 'pl';
    };
    activeTimers: { [taskId: string]: number }; // taskId -> startTime
    ui: {
        openedClientId: string | null;
        openedProjectId: string | null;
        openedDealId: string | null;
        openedProjectTab: 'overview' | 'tasks' | 'wiki' | 'files' | 'access' | 'okrs' | 'expenses';
        isNotificationsOpen: boolean;
        isCommandPaletteOpen: boolean;
        commandPaletteQuery: string;
        notifications: {
            activeTab: 'new' | 'read';
        };
        commandPaletteActiveIndex: number;
        mention: {
            query: string | null;
            target: HTMLElement | null;
            activeIndex: number;
            rect: DOMRect | null;
        };
        tasks: {
            viewMode: 'board' | 'list' | 'calendar' | 'gantt' | 'workload';
            isFilterOpen: boolean;
            filters: TaskFilters;
            activeFilterViewId: string | null;
            isLoading: boolean;
            loadedWorkspaceId: string | null;
            sortBy: SortByOption;
        };
        invoiceFilters: {
            clientId: string;
            status: string;
            dateStart: string;
            dateEnd: string;
        };
        clientFilters: {
            text: string;
            status: 'all' | 'active' | 'archived';
        };
        calendarDate: string; // YYYY-MM for the calendar view
        teamCalendarView: 'month' | 'week' | 'day';
        teamCalendarDate: string; // YYYY-MM-DD for the team calendar view
        activeChannelId: string | null;
        activeTaskViewId: string | null;
        isWikiEditing: boolean;
        taskDetail: {
            activeTab: 'activity' | 'checklist' | 'subtasks' | 'dependencies' | 'attachments';
            isEditing: boolean;
        };
        dealDetail: {
            activeTab: 'activity' | 'tasks';
        };
        modal: {
            isOpen: boolean;
            type: 'addClient' | 'addProject' | 'addTask' | 'addInvoice' | 'taskDetail' | 'addCommentToTimeLog' | 'upgradePlan' | 'automations' | 'configureWidget' | 'addWidget' | 'wikiHistory' | 'addManualTimeLog' | 'addObjective' | 'addKeyResult' | 'addTimeOffRequest' | 'addCalendarEvent' | 'addExpense' | 'employeeDetail' | 'rejectTimeOffRequest' | 'confirmPlanChange' | 'addDeal' | 'adjustVacationAllowance' | 'aiProjectPlanner' | 'subtaskDetail' | 'assignGlobalTime' | 'addProjectSection' | 'addReview' | 'addGoal' | 'addInventoryItem' | 'assignInventoryItem' | 'setBudgets' | 'dealWon' | 'sendInvoiceEmail' | null;
            data?: any;
            justOpened?: boolean;
        };
        reports: {
            activeTab: 'productivity' | 'time' | 'financial';
            filters: {
                dateStart: string;
                dateEnd: string;
                projectId: string; // 'all' or project ID
                userId: string;    // 'all' or user ID
                clientId: string;  // 'all' or client ID
            }
        };
        settings: {
            activeTab: 'general' | 'customFields' | 'workspace' | 'profile' | 'integrations' | 'taskViews' | 'pipeline';
        };
        dashboard: {
            isEditing: boolean;
            isLoading: boolean;
            loadedWorkspaceId: string | null;
            activeTab: 'overview' | 'projects' | 'team' | 'analytics';
        };
        hr: {
             activeTab: 'employees' | 'requests' | 'vacation' | 'history' | 'reviews';
        };
        onboarding: {
            isActive: boolean;
            step: number;
        };
        sales: {
            isLoading: boolean;
            loadedWorkspaceId: string | null;
        };
        clients: {
            isLoading: boolean;
            loadedWorkspaceId: string | null;
            filters: {
                text: string;
                status: 'all' | 'active' | 'archived';
            };
        };
        invoices: {
            isLoading: boolean;
            loadedWorkspaceId: string | null;
        };
        projects: {
            isLoading: boolean;
            loadedWorkspaceId: string | null;
            viewMode: 'grid' | 'portfolio';
        };
        globalTimer: {
            isRunning: boolean;
            startTime: number | null;
        };
    };
}