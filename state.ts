import type { AppState } from './types.ts';

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
    };
    localStorage.setItem('kombajn-settings', JSON.stringify(settingsToSave));
}

export function getInitialState(): AppState {
    const now = new Date();
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    // Load settings from localStorage
    let savedSettings: any = {};
    try {
        savedSettings = JSON.parse(localStorage.getItem('kombajn-settings') || '{}');
    } catch (error) {
        console.error("Failed to parse settings from localStorage:", error);
        // Settings will remain as an empty object, allowing the app to start with defaults.
    }

    const theme: 'light' | 'dark' | 'minimal' = savedSettings.theme || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    
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
        projectSections: [],
        taskViews: [],
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
        filterViews: [],
        ai: { loading: false, error: null, suggestedTasks: null },
        settings: {
            theme: theme,
            language: savedSettings.language || 'en',
        },
        activeTimers: {},
        ui: {
            openedClientId: null,
            openedProjectId: null,
            openedDealId: null,
            openedProjectTab: 'overview',
            isNotificationsOpen: false,
            notifications: { activeTab: 'new' },
            isCommandPaletteOpen: false,
            commandPaletteQuery: '',
            commandPaletteActiveIndex: 0,
            mention: { query: null, target: null, activeIndex: 0, rect: null },
            tasks: {
                viewMode: 'board',
                isFilterOpen: false,
                filters: { text: '', assigneeId: '', priority: '', projectId: '', status: '', dateRange: 'all', tagIds: [], isArchived: false },
                activeFilterViewId: null,
                isLoading: false,
                loadedWorkspaceId: null,
            },
            invoiceFilters: { clientId: 'all', status: 'all', dateStart: oneMonthAgo.toISOString().slice(0, 10), dateEnd: now.toISOString().slice(0, 10) },
            clientFilters: { text: '', status: 'all' },
            calendarDate: now.toISOString().slice(0, 7),
            teamCalendarView: 'month',
            teamCalendarDate: now.toISOString().slice(0, 10),
            activeChannelId: null,
            activeTaskViewId: null,
            isWikiEditing: false,
            taskDetail: { activeTab: 'activity', isEditing: false },
            dealDetail: { activeTab: 'activity' },
            modal: { isOpen: false, type: null, data: undefined, justOpened: false },
            reports: {
                activeTab: 'productivity',
                filters: { dateStart: oneMonthAgo.toISOString().slice(0, 10), dateEnd: now.toISOString().slice(0, 10), projectId: 'all', userId: 'all', clientId: 'all' },
            },
            settings: { activeTab: 'general' },
            dashboard: { isEditing: false, isLoading: false, loadedWorkspaceId: null, activeTab: 'overview' },
            hr: { activeTab: 'employees' },
            onboarding: { isActive: false, step: 0 },
            sales: { isLoading: false, loadedWorkspaceId: null },
            clients: { 
                isLoading: false, 
                loadedWorkspaceId: null,
                filters: { text: '', status: 'all' },
            },
            invoices: { isLoading: false, loadedWorkspaceId: null },
            projects: { isLoading: false, loadedWorkspaceId: null },
            globalTimer: {
                isRunning: false,
                startTime: null,
            },
        },
    };
}

// The state is now initialized as a clean slate.
export const state: AppState = getInitialState();
