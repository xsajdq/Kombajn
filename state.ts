


import type { AppState, Workspace, User, WorkspaceMember, Role, Client, Project, Task, Invoice, TimeLog, Comment, Notification, Attachment, TaskDependency, CustomFieldDefinition, CustomFieldValue, Automation, DashboardWidget, ProjectMember, Channel, ProjectTemplate, WikiHistory, ChatMessage, Objective, KeyResult, TimeOffRequest, CalendarEvent, Expense, Deal, WorkspaceJoinRequest } from './types.ts';

export function generateId(): string {
    // A more robust ID generator
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// saveState is no longer needed as the server is the source of truth.
export function saveState() {
    // This function is now a no-op but can be kept for future caching strategies.
}

function getInitialState(): AppState {
    const now = new Date();
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    // This is now the blueprint for a clean, empty state.
    // Data will be fetched from the API.
    return {
        currentPage: 'dashboard',
        currentUser: null,
        activeWorkspaceId: null,
        workspaces: [],
        workspaceMembers: [],
        projectMembers: [],
        users: [],
        clients: [],
        projects: [],
        tasks: [],
        dependencies: [],
        timeLogs: [],
        comments: [],
        invoices: [],
        notifications: [],
        attachments: [],
        customFieldDefinitions: [],
        customFieldValues: [],
        automations: [],
        dashboardWidgets: [],
        projectTemplates: [],
        wikiHistory: [],
        channels: [],
        chatMessages: [],
        objectives: [],
        keyResults: [],
        timeOffRequests: [],
        calendarEvents: [],
        expenses: [],
        deals: [],
        workspaceJoinRequests: [],
        ai: { loading: false, error: null, suggestedTasks: null },
        settings: {
            // Settings can still be loaded from localStorage for user convenience
            darkMode: localStorage.getItem('darkMode') === 'true' || window.matchMedia?.('(prefers-color-scheme: dark)').matches,
            language: (localStorage.getItem('language') as 'en' | 'pl') || 'en',
            defaultKanbanWorkflow: (localStorage.getItem('defaultKanbanWorkflow') as 'simple' | 'advanced') || 'simple',
        },
        activeTimers: {},
        ui: {
            openedClientId: null,
            openedProjectId: null,
            openedProjectTab: 'tasks',
            isNotificationsOpen: false,
            isCommandPaletteOpen: false,
            commandPaletteQuery: '',
            commandPaletteActiveIndex: 0,
            mention: { query: null, target: null, activeIndex: 0 },
            tasksViewMode: 'board',
            tasksKanbanMode: 'simple',
            isTaskFilterOpen: false,
            taskFilters: { text: '', assigneeId: '', priority: '', projectId: '', status: '', dateRange: 'all' },
            invoiceFilters: { clientId: 'all', status: 'all', dateStart: oneMonthAgo.toISOString().slice(0, 10), dateEnd: now.toISOString().slice(0, 10) },
            calendarDate: now.toISOString().slice(0, 7),
            teamCalendarDate: now.toISOString().slice(0, 7),
            activeChannelId: null,
            isWikiEditing: false,
            taskDetail: { activeTab: 'activity' },
            modal: { isOpen: false, type: null, data: undefined, justOpened: false },
            reports: {
                activeTab: 'productivity',
                filters: { dateStart: oneMonthAgo.toISOString().slice(0, 10), dateEnd: now.toISOString().slice(0, 10), projectId: 'all', userId: 'all', clientId: 'all' },
            },
            settings: { activeTab: 'general' },
            dashboard: { isEditing: false },
            hr: { activeTab: 'employees' },
        },
    };
}

// The state is now initialized as a clean slate.
export const state: AppState = getInitialState();