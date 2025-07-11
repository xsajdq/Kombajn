

export interface User {
    id: string;
    name?: string;
    email?: string;
    avatarUrl?: string; // URL to an image
    initials: string;
    contractInfoNotes?: string;
    employmentInfoNotes?: string;
    vacationAllowanceHours?: number; // Total vacation hours for the year
}

export type Role = 'owner' | 'manager' | 'member' | 'client';

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
}
export interface Project {
    id: string;
    workspaceId: string;
    name: string;
    clientId: string;
    wikiContent: string;
    hourlyRate?: number;
    privacy: 'public' | 'private';
}
export interface Task {
    id: string;
    workspaceId: string;
    name: string;
    projectId: string;
    dealId?: string; // Link task to a sales deal
    status: 'backlog' | 'todo' | 'inprogress' | 'inreview' | 'done';
    description?: string;
    startDate?: string; // YYYY-MM-DD
    dueDate?: string; // YYYY-MM-DD
    priority?: 'low' | 'medium' | 'high' | null;
    parentId?: string; // For subtasks
    recurrence?: 'none' | 'daily' | 'weekly' | 'monthly'; // For recurring tasks
}

export interface TaskDependency {
    id: string;
    workspaceId: string;
    blockingTaskId: string; // The task that must be completed first
    blockedTaskId: string;  // The task that is waiting
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
    fileType: string;
    fileSize: number; // in bytes
    createdAt: string; // ISO
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
export interface Comment {
    id: string;
    workspaceId: string;
    taskId: string;
    userId: string;
    content: string;
    createdAt: string; // ISO 8601 date string
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
    action: NotificationAction;
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
export interface AutomationAction {
    type: 'assignUser';
    userId: string;
}
export interface Automation {
    id: string;
    workspaceId: string;
    projectId: string;
    trigger: AutomationTrigger;
    action: AutomationAction;
}

export type DashboardWidgetType = 'myTasks' | 'projectStatus' | 'teamWorkload' | 'recentActivity';
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
    };
}


export type Command = {
    id: string;
    name: string;
    action: () => void;
    icon?: string;
    shortcut?: string;
};

export type DateRangeFilter = 'all' | 'today' | 'tomorrow' | 'yesterday' | 'this_week' | 'overdue';

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
    projectId: string;
    title: string;
    description?: string;
}

export interface KeyResult {
    id: string;
    objectiveId: string;
    title: string;
    type: 'number' | 'percentage';
    startValue: number;
    targetValue: number;
    currentValue: number;
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
    projectId: string;
    description: string;
    amount: number;
    date: string; // YYYY-MM-DD
    invoiceId?: string;
}

export interface Deal {
    id: string;
    workspaceId: string;
    name: string;
    clientId: string;
    stage: 'lead' | 'contacted' | 'demo' | 'proposal' | 'won' | 'lost';
    value: number;
    ownerId: string;
    expectedCloseDate?: string; // YYYY-MM-DD
    createdAt: string; // ISO
}

export interface DealNote {
    id: string;
    workspaceId: string;
    dealId: string;
    userId: string;
    content: string;
    createdAt: string; // ISO
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


export interface AppState {
    currentPage: 'dashboard' | 'projects' | 'tasks' | 'clients' | 'invoices' | 'ai-assistant' | 'settings' | 'team-calendar' | 'sales' | 'reports' | 'chat' | 'hr' | 'billing' | 'auth' | 'setup';
    currentUser: User | null;
    activeWorkspaceId: string | null;
    workspaces: Workspace[];
    workspaceMembers: WorkspaceMember[];
    projectMembers: ProjectMember[];
    users: User[];
    clients: Client[];
    projects: Project[];
    tasks: Task[];
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
    dealNotes: DealNote[];
    workspaceJoinRequests: WorkspaceJoinRequest[];
    publicHolidays: PublicHoliday[];
    ai: { loading: boolean; error: string | null; suggestedTasks: AiSuggestedTask[] | null; };
    settings: {
        theme: 'light' | 'dark' | 'minimal';
        language: 'en' | 'pl';
        defaultKanbanWorkflow: 'simple' | 'advanced';
    };
    activeTimers: { [taskId: string]: number }; // taskId -> startTime
    ui: {
        openedClientId: string | null;
        openedProjectId: string | null;
        openedDealId: string | null;
        openedProjectTab: 'tasks' | 'wiki' | 'files' | 'access' | 'okrs';
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
        };
        tasksViewMode: 'board' | 'list' | 'calendar' | 'gantt';
        tasksKanbanMode: 'simple' | 'advanced'; // Note: This might be deprecated by the new filter design
        isTaskFilterOpen: boolean;
        taskFilters: {
            text: string;
            assigneeId: string;
            priority: string;
            projectId: string;
            status: string;
            dateRange: DateRangeFilter;
        };
        invoiceFilters: {
            clientId: string;
            status: string;
            dateStart: string;
            dateEnd: string;
        };
        calendarDate: string; // YYYY-MM for the calendar view
        teamCalendarView: 'month' | 'week' | 'day';
        teamCalendarDate: string; // YYYY-MM-DD for the team calendar view
        activeChannelId: string | null;
        isWikiEditing: boolean;
        taskDetail: {
            activeTab: 'activity' | 'subtasks' | 'dependencies' | 'attachments';
        };
        dealDetail: {
            activeTab: 'activity' | 'tasks';
        };
        modal: {
            isOpen: boolean;
            type: 'addClient' | 'addProject' | 'addTask' | 'addInvoice' | 'taskDetail' | 'addCommentToTimeLog' | 'upgradePlan' | 'automations' | 'configureWidget' | 'addWidget' | 'wikiHistory' | 'addManualTimeLog' | 'addObjective' | 'addKeyResult' | 'addTimeOffRequest' | 'addCalendarEvent' | 'addExpense' | 'employeeDetail' | 'rejectTimeOffRequest' | 'confirmPlanChange' | 'addDeal' | 'adjustVacationAllowance' | null;
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
            activeTab: 'general' | 'customFields' | 'workspace' | 'profile';
        };
        dashboard: {
            isEditing: boolean;
        };
        hr: {
             activeTab: 'employees' | 'requests' | 'vacation' | 'history' | 'reviews';
        }
        onboarding: {
            isActive: boolean;
            step: number;
        };
    };
}