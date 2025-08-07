

import type { AppState, UIComponent } from './types.ts';

export const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

function saveSettingsToLocalStorage(state: AppState) {
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

    const savedSettings = JSON.parse(localStorage.getItem('kombajn-settings') || '{}');
    const theme: 'light' | 'dark' | 'minimal' = savedSettings.theme || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    
    return {
        currentPage: 'dashboard',
        currentUser: null,
        activeWorkspaceId: null,
        error: null,
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
        projectTags: [],
        clientTags: [],
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
        dealActivities: [],
        workspaceJoinRequests: [],
        publicHolidays: [],
        integrations: [],
        filterViews: [],
        reviews: [],
        inventoryItems: [],
        inventoryAssignments: [],
        userTaskSortOrders: [],
        budgets: [],
        pipelineStages: [],
        kanbanStages: [],
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
            slashCommand: { query: null, target: null, activeIndex: 0, rect: null },
            textSelectionPopover: { isOpen: false, top: 0, left: 0, selectedText: '', context: null },
            tasks: {
                viewMode: 'board',
                ganttViewMode: 'Week',
                isFilterOpen: false,
                filters: { text: '', assigneeId: '', priority: '', projectId: '', status: '', dateRange: 'all', tagIds: [], isArchived: false },
                activeFilterViewId: null,
                isLoading: false,
                loadedWorkspaceId: null,
                sortBy: 'manual',
            },
            invoiceFilters: { clientId: 'all', status: 'all', dateStart: oneMonthAgo.toISOString().slice(0, 10), dateEnd: now.toISOString().slice(0, 10) },
            calendarDate: now.toISOString().slice(0, 7),
            teamCalendar: {
                view: 'month',
                date: now.toISOString().slice(0, 10),
                selectedUserIds: [],
                isLoading: false,
                loadedWorkspaceId: null,
            },
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
            dashboard: { isEditing: false, isLoading: false, loadedWorkspaceId: null, activeTab: 'my_day' },
            hr: { activeTab: 'employees', filters: { text: '' } },
            goals: { filters: { text: '', status: 'all', ownerId: 'all' }, isLoading: false, loadedWorkspaceId: null },
            inventory: { filters: { text: '' }, isLoading: false, loadedWorkspaceId: null },
            budget: { isLoading: false, loadedWorkspaceId: null },
            onboarding: { isActive: false, step: 0 },
            sales: { isLoading: false, loadedWorkspaceId: null },
            clients: { 
                isLoading: false, 
                loadedWorkspaceId: null,
                filters: { text: '', status: 'all', tagIds: [] },
            },
            invoices: { 
                isLoading: false, 
                loadedWorkspaceId: null,
            },
            projects: { 
                isLoading: false, 
                loadedWorkspaceId: null, 
                viewMode: 'grid',
                filters: { text: '', tagIds: [], status: 'all' },
                sortBy: 'name',
            },
            globalTimer: {
                isRunning: false,
                startTime: null,
            },
            gKeyPressed: false,
        },
    };
}

let state: AppState = getInitialState();

// --- Subscription system ---
type Subscriber = (componentsToUpdate: UIComponent[]) => void;
const subscribers: Subscriber[] = [];

export function subscribe(callback: Subscriber) {
    subscribers.push(callback);
    // Return an unsubscribe function
    return () => {
        const index = subscribers.indexOf(callback);
        if (index > -1) {
            subscribers.splice(index, 1);
        }
    };
}
// --- End subscription system ---

function isObject(item: any): item is Record<string, any> {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

function deepAssign(target: any, source: any) {
    if (!isObject(target) || !isObject(source)) return;

    Object.keys(source).forEach(key => {
        const targetValue = target[key];
        const sourceValue = source[key];

        if (isObject(sourceValue) && isObject(targetValue)) {
            deepAssign(targetValue, sourceValue);
        } else {
            target[key] = sourceValue;
        }
    });
}

// The only way to get the state
export function getState(): Readonly<AppState> {
    return state;
}

// The only way to update the state
export function setState(newStateSlice: Partial<AppState> | ((prevState: AppState) => Partial<AppState>), componentsToUpdate: UIComponent[]) {
    const slice = typeof newStateSlice === 'function' ? newStateSlice(state) : newStateSlice;

    // Deeply assign the properties from the slice to the existing state object to mutate it.
    deepAssign(state, slice);

    // If settings were changed, persist them to localStorage
    if (slice.settings) {
        saveSettingsToLocalStorage(state);
    }

    // Notify subscribers about the UI update
    for (const subscriber of subscribers) {
        subscriber(componentsToUpdate);
    }
}

// Function to reset the state, e.g., on logout
export function resetState() {
    const initialState = getInitialState();
    // Clear all keys from the current state object
    Object.keys(state).forEach(key => {
        delete (state as any)[key];
    });
    // Assign all properties from the initial state to the now-empty state object
    Object.assign(state, initialState);
}
