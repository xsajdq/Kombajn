
import { state } from './state.ts';
import type { Task, PlanId } from './types.ts';

export const PLANS: Record<PlanId, { projects: number; users: number; invoices: number; workspaces: number; }> = {
    free: {
        projects: 3,
        users: 1,
        invoices: 5, // per month
        workspaces: 1,
    },
    starter: {
        projects: 10,
        users: 5,
        invoices: 20,
        workspaces: 1,
    },
    pro: {
        projects: 25,
        users: 15,
        invoices: Infinity,
        workspaces: 3,
    },
    business: {
        projects: 50,
        users: 50,
        invoices: Infinity,
        workspaces: 10,
    },
    enterprise: {
        projects: Infinity,
        users: Infinity,
        invoices: Infinity,
        workspaces: Infinity,
    },
};


export function formatDuration(seconds: number): string {
    const totalSeconds = Math.floor(seconds);
    if (totalSeconds < 0) return '0s';
    if (totalSeconds === 0) return '0s';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return [
        h > 0 ? `${h}h` : '',
        m > 0 ? `${m}m` : '',
        s > 0 ? `${s}s` : '',
    ].filter(Boolean).join(' ') || '0s';
}

export function parseDurationStringToSeconds(durationStr: string): number {
    if (!durationStr) return 0;
    
    let totalSeconds = 0;
    // Regex to find numbers (including decimals) followed by h, m, or s.
    const durationRegex = /(\d+(?:\.\d+)?)\s*(h|m|s)\b/gi;
    let match;
    let foundMatch = false;

    while ((match = durationRegex.exec(durationStr)) !== null) {
        foundMatch = true;
        const value = parseFloat(match[1]);
        const unit = match[2].toLowerCase();

        if (unit === 'h') {
            totalSeconds += value * 3600;
        } else if (unit === 'm') {
            totalSeconds += value * 60;
        } else if (unit === 's') {
            totalSeconds += value;
        }
    }

    if (!foundMatch) {
        return 0; // Return 0 if no valid format is found
    }
    
    return totalSeconds;
}

export function getTaskTotalTrackedSeconds(taskId: string): number {
    return state.timeLogs
        .filter(log => log.taskId === taskId)
        .reduce((sum, log) => sum + log.trackedSeconds, 0);
}

export function getTaskCurrentTrackedSeconds(task: Task): number {
    const totalLoggedSeconds = getTaskTotalTrackedSeconds(task.id);
    if (state.activeTimers[task.id]) {
        const startTime = state.activeTimers[task.id];
        const elapsedSeconds = (Date.now() - startTime) / 1000;
        return totalLoggedSeconds + elapsedSeconds;
    }
    return totalLoggedSeconds;
}

export function formatDate(dateString: string, options: Intl.DateTimeFormatOptions = {}): string {
    const locale = state.settings.language === 'pl' ? 'pl-PL' : 'en-GB';
    if (!dateString) return '';
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...options,
    };
    
    return new Date(dateString).toLocaleDateString(locale, defaultOptions);
}

export function getUsage(workspaceId: string) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const projects = state.projects.filter(p => p.workspaceId === workspaceId).length;
    const users = state.workspaceMembers.filter(m => m.workspaceId === workspaceId).length;
    const invoicesThisMonth = state.invoices.filter(i => {
        if (i.workspaceId !== workspaceId) return false;
        const issueDate = new Date(i.issueDate);
        return issueDate.getMonth() === currentMonth && issueDate.getFullYear() === currentYear;
    }).length;

    return { projects, users, invoicesThisMonth };
}

export function snakeToCamel(str: string): string {
    return str.replace(/_(\w)/g, (_, letter) => letter.toUpperCase());
}

export function camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function convertKeys(obj: any, converter: (key: string) => string): any {
    if (Array.isArray(obj)) {
        return obj.map(v => convertKeys(v, converter));
    } else if (obj !== null && typeof obj === 'object' && obj.constructor === Object) {
        return Object.keys(obj).reduce((acc, key) => {
            acc[converter(key)] = convertKeys(obj[key], converter);
            return acc;
        }, {} as any);
    }
    return obj;
}

export const keysToCamel = (obj: any) => convertKeys(obj, snakeToCamel);