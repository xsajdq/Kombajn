
import type { AppState, Workspace, User, WorkspaceMember, Role, Client, Project, Task, Invoice, TimeLog, Comment, Notification, Attachment, TaskDependency, CustomFieldDefinition, CustomFieldValue, Automation, DashboardWidget, ProjectMember, Channel, ProjectTemplate, WikiHistory, ChatMessage, Objective, KeyResult, TimeOffRequest, CalendarEvent, Expense, Deal, WorkspaceJoinRequest, TaskAssignee, Tag, TaskTag, Integration, ClientContact } from './types.ts';

export function generateId(): string {
    // A more robust ID generator
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// saveState is no longer needed as the server is the source of truth.
export function saveState() {
    // This function can be used to save settings to localStorage
    const settingsToSave = {
        theme: state.settings.theme,
        language: state.settings.language,
        defaultKanbanWorkflow: state.settings.defaultKanbanWorkflow,
    };
    localStorage.setItem('kombajn-settings', JSON.stringify(settingsToSave));
}

function getInitialState(): AppState {
    const now = new Date();
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    // Load settings from localStorage
    const savedSettings = JSON.parse(localStorage.getItem('kombajn-settings') || '{}');
    const legacyDarkMode = localStorage.getItem('darkMode');

    let theme: 'light' | 'dark' | 'minimal' = savedSettings.theme;
    if (!theme) {
        if (legacyDarkMode === 'true') {
            theme = 'dark';
        } else {
            theme = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        // Migrate old setting
        localStorage.removeItem('darkMode');
    }
    
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
        clientContacts: [],
        projects: [],
        tasks: [],
        taskAssignees: [],
        tags: [],
        taskTags: [],
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
        dealNotes: [],
        workspaceJoinRequests: [],
        publicHolidays: [],
        integrations: [],
        ai: { loading: false, error: null, suggestedTasks: null },
        settings: {
            theme,
            language: savedSettings.language || 'en',
            defaultKanbanWorkflow: savedSettings.defaultKanbanWorkflow || 'simple',
        },
        activeTimers: {},
        ui: {
            openedClientId: null,
            openedProjectId: null,
            openedDealId: null,
            openedProjectTab: 'tasks',
            isNotificationsOpen: false,
            notifications: { activeTab: 'new' },
            isCommandPaletteOpen: false,
            commandPaletteQuery: '',
            commandPaletteActiveIndex: 0,
            mention: { query: null, target: null, activeIndex: 0 },
            tasksViewMode: 'board',
            tasksKanbanMode: 'simple',
            isTaskFilterOpen: false,
            taskFilters: { text: '', assigneeId: '', priority: '', projectId: '', status: '', dateRange: 'all', tagIds: [] },
            invoiceFilters: { clientId: 'all', status: 'all', dateStart: oneMonthAgo.toISOString().slice(0, 10), dateEnd: now.toISOString().slice(0, 10) },
            calendarDate: now.toISOString().slice(0, 7),
            teamCalendarView: 'month',
            teamCalendarDate: now.toISOString().slice(0, 10),
            activeChannelId: null,
            isWikiEditing: false,
            taskDetail: { activeTab: 'activity' },
            dealDetail: { activeTab: 'activity' },
            modal: { isOpen: false, type: null, data: undefined, justOpened: false },
            reports: {
                activeTab: 'productivity',
                filters: { dateStart: oneMonthAgo.toISOString().slice(0, 10), dateEnd: now.toISOString().slice(0, 10), projectId: 'all', userId: 'all', clientId: 'all' },
            },
            settings: { activeTab: 'general' },
            dashboard: { isEditing: false },
            hr: { activeTab: 'employees' },
            onboarding: { isActive: false, step: 0 },
        },
    };
}

// The state is now initialized as a clean slate.
export const state: AppState = getInitialState();
