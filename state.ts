

import type { AppState, Workspace, User, WorkspaceMember, Role, Client, Project, Task, Invoice, TimeLog, Comment, Notification, Attachment, TaskDependency, CustomFieldDefinition, CustomFieldValue, Automation, DashboardWidget, ProjectMember, Channel, ProjectTemplate, WikiHistory, ChatMessage, Objective, KeyResult, TimeOffRequest, CalendarEvent, Expense, Deal } from './types.ts';

export function generateId(): string {
    // A more robust ID generator
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export function saveState() {
    try {
        const serializedState = JSON.stringify(state);
        localStorage.setItem('appState', serializedState);
    } catch (err) {
        console.error("Error saving state to localStorage:", err);
    }
}

function getInitialState(): AppState {
    const now = new Date();
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

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
        ai: { loading: false, error: null, suggestedTasks: null },
        settings: {
            darkMode: window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
            language: 'en',
            defaultKanbanWorkflow: 'simple',
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


function createInitialData(): AppState {
    const userId1 = 'u1';
    const workspaceId1 = 'ws1';
    const clientId1 = 'c1';
    const projectId1 = 'p1';
    const channelId1 = 'ch1';

    const initialUser: User = { id: userId1, name: 'Demo User', email: 'demo@user.com', initials: 'DU' };
    const initialWorkspace: Workspace = { id: workspaceId1, name: 'My Workspace', subscription: { planId: 'pro', status: 'active' }, planHistory: [{ planId: 'pro', date: new Date().toISOString() }], companyName: "Kombajn Inc.", companyAddress: "123 Main St, Anytown", companyVatId: "PL1234567890", companyBankName: "The Best Bank", companyBankAccount: "PL 12 3456 7890 1234 5678 9012", companyEmail: "billing@kombajn.dev" };
    const initialMembership: WorkspaceMember = { id: 'wm1', workspaceId: workspaceId1, userId: userId1, role: 'owner' };
    const initialClient: Client = { id: clientId1, workspaceId: workspaceId1, name: 'ACME Corp', contactPerson: 'Wile E. Coyote', email: 'coyote@acme.com' };
    const initialProject: Project = { id: projectId1, workspaceId: workspaceId1, name: 'Project Phoenix', clientId: clientId1, wikiContent: '# Project Phoenix\n\nThis is the main wiki page for our project.', hourlyRate: 120, privacy: 'public' };
    const initialChannel: Channel = { id: channelId1, workspaceId: workspaceId1, name: 'General' };
    const projectChannel: Channel = { id: 'pch1', workspaceId: workspaceId1, projectId: projectId1, name: 'Project Phoenix' };
    
    const initialTasks: Task[] = [
        { id: 't1', workspaceId: workspaceId1, name: 'Design new logo', projectId: projectId1, status: 'todo', description: 'Create a modern and fresh logo.', assigneeId: userId1, dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), priority: 'high' },
        { id: 't2', workspaceId: workspaceId1, name: 'Develop landing page', projectId: projectId1, status: 'inprogress', description: 'Code the main landing page in React.', assigneeId: userId1, dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), priority: 'high' },
        { id: 't3', workspaceId: workspaceId1, name: 'Setup database', projectId: projectId1, status: 'done', description: 'Initialize and configure the PostgreSQL database.' },
        { id: 't4', workspaceId: workspaceId1, name: 'Write documentation', projectId: projectId1, status: 'backlog', description: 'Document the API endpoints.', priority: 'low' }
    ];
     const initialTimeLogs: TimeLog[] = [
        {id: 'tl1', workspaceId: workspaceId1, taskId: 't2', userId: userId1, trackedSeconds: 3660, createdAt: new Date().toISOString(), comment: 'Worked on the header component.'}
    ];

    const initialDeals: Deal[] = [
        { id: 'd1', workspaceId: workspaceId1, name: 'ACME - New Website', clientId: clientId1, stage: 'lead', value: 50000, ownerId: userId1, createdAt: new Date().toISOString(), expectedCloseDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) },
        { id: 'd2', workspaceId: workspaceId1, name: 'Stark Industries - CRM Integration', clientId: clientId1, stage: 'proposal', value: 120000, ownerId: userId1, createdAt: new Date().toISOString() },
        { id: 'd3', workspaceId: workspaceId1, name: 'Wayne Enterprises - Security Audit', clientId: clientId1, stage: 'won', value: 75000, ownerId: userId1, createdAt: new Date().toISOString() },
    ];

    const initialWidgets: DashboardWidget[] = [
        { id: 'dw1', type: 'myTasks', x: 0, y: 0, w: 4, h: 6, config: {} },
        { id: 'dw2', type: 'projectStatus', x: 4, y: 0, w: 4, h: 6, config: { projectId: projectId1 } },
        { id: 'dw3', type: 'teamWorkload', x: 8, y: 0, w: 4, h: 6, config: {} },
    ];
    
    const initialState = getInitialState();
    
    return {
        ...initialState,
        currentUser: initialUser,
        activeWorkspaceId: workspaceId1,
        workspaces: [initialWorkspace],
        workspaceMembers: [initialMembership],
        users: [initialUser],
        clients: [initialClient],
        projects: [initialProject],
        tasks: initialTasks,
        timeLogs: initialTimeLogs,
        deals: initialDeals,
        dashboardWidgets: initialWidgets,
        channels: [initialChannel, projectChannel],
        ui: {
            ...initialState.ui,
            activeChannelId: channelId1,
        }
    };
}


function loadState(): AppState {
    try {
        const serializedState = localStorage.getItem('appState');
        if (serializedState === null) {
            return createInitialData();
        }
        
        const loadedState: AppState = JSON.parse(serializedState);
        const defaultState = getInitialState();

        // Data migration / sanitization logic.
        // This ensures that if we add new properties to the state, old clients don't break.
        if (loadedState.tasks) {
          loadedState.tasks = loadedState.tasks.filter(t => t && t.id);
        } else {
            loadedState.tasks = [];
        }

        // Sanitize comments and timeLogs to prevent errors with corrupted data from localStorage.
        if (loadedState.comments) {
            loadedState.comments = loadedState.comments.filter(c => c && c.id);
        } else {
            loadedState.comments = [];
        }
        if (loadedState.timeLogs) {
            loadedState.timeLogs = loadedState.timeLogs.filter(tl => tl && tl.id);
        } else {
            loadedState.timeLogs = [];
        }

        // Migrate invoices to include emailStatus
        if (loadedState.invoices) {
            loadedState.invoices.forEach(inv => {
                if (!inv.emailStatus) {
                    inv.emailStatus = 'not_sent';
                }
            });
        }
        // Migrate workspaces to include companyEmail
        if (loadedState.workspaces) {
            loadedState.workspaces.forEach(ws => {
                if (ws.companyEmail === undefined) {
                    ws.companyEmail = '';
                }
            });
        }


        // Example: Migrate attachments from task to project level (if we ever did this)
        let attachmentMigrationNeeded = false;
        const tasks: any[] = loadedState.tasks;
        tasks.forEach((task: Task & { attachments?: any[] }) => {
            if (task && task.attachments && Array.isArray(task.attachments)) {
                // ... migration logic would go here ...
                attachmentMigrationNeeded = true;
                delete task.attachments;
            }
        });
        if (attachmentMigrationNeeded) console.log("Attachments migration check complete.");

        // Deep merge UI state to prevent new UI properties from being lost on load
        loadedState.ui = { ...defaultState.ui, ...loadedState.ui };
        loadedState.ui.reports = { ...defaultState.ui.reports, ...(loadedState.ui.reports || {}) };
        loadedState.ui.reports.filters = { ...defaultState.ui.reports.filters, ...(loadedState.ui.reports?.filters || {}) };
        loadedState.ui.settings = { ...defaultState.ui.settings, ...(loadedState.ui.settings || {}) };
        loadedState.ui.dashboard = { ...defaultState.ui.dashboard, ...(loadedState.ui.dashboard || {}) };
        loadedState.ui.hr = { ...defaultState.ui.hr, ...(loadedState.ui.hr || {}) };
        loadedState.ui.taskDetail = { ...defaultState.ui.taskDetail, ...(loadedState.ui.taskDetail || {}) };
        
        // Ensure all top-level array properties exist to avoid runtime errors
        for (const key in defaultState) {
            if (Array.isArray((defaultState as any)[key]) && !loadedState.hasOwnProperty(key)) {
                (loadedState as any)[key] = (defaultState as any)[key];
            }
        }
        
        // Reset transient UI state on every application load
        loadedState.ui.modal = { isOpen: false, type: null, data: undefined, justOpened: false };
        loadedState.ui.isNotificationsOpen = false;
        loadedState.ui.isCommandPaletteOpen = false;
        loadedState.ai = { loading: false, error: null, suggestedTasks: null };

        return loadedState;

    } catch (err) {
        console.error("Error loading state from localStorage, resetting to default:", err);
        return createInitialData();
    }
}


export const state: AppState = loadState();

// Initialize current user if it's somehow null after loading (e.g., corrupted state)
if (!state.currentUser && state.users.length > 0) {
    state.currentUser = state.users[0];
}
if (!state.activeWorkspaceId && state.workspaces.length > 0) {
    state.activeWorkspaceId = state.workspaces[0].id;
}
if (!state.ui.activeChannelId && state.channels.length > 0) {
    // Prefer the 'General' channel as the default
    const generalChannel = state.channels.find(c => !c.projectId);
    state.ui.activeChannelId = generalChannel ? generalChannel.id : state.channels[0].id;
}

saveState();