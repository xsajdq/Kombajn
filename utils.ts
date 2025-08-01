
import { state } from './state.ts';
import { t } from './i18n.ts';
import type { Task, PlanId, User, TimeOffRequest, PublicHoliday } from './types.ts';

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

export function parseDurationStringToHours(durationStr: string): number | null {
    if (!durationStr) return null;

    // Check if it's just a number, assume hours
    if (!isNaN(parseFloat(durationStr)) && isFinite(durationStr as any)) {
        return parseFloat(durationStr);
    }

    const totalSeconds = parseDurationStringToSeconds(durationStr);

    if (totalSeconds === 0 && !durationStr.includes('0')) return null;

    return totalSeconds / 3600;
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

export function formatCurrency(amount: number | null | undefined, currency = 'PLN'): string {
    if (amount == null) return t('misc.not_applicable');
    const locale = state.settings.language === 'pl' ? 'pl-PL' : 'en-US';
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
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

export function calculateBusinessDays(startDateStr: string, endDateStr: string, holidays: { date: string }[]): number {
    let count = 0;
    const startDate = new Date(startDateStr + 'T00:00:00Z');
    const endDate = new Date(endDateStr + 'T00:00:00Z');
    const holidaySet = new Set(holidays.map(h => h.date));

    let currentDate = startDate;
    while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getUTCDay();
        const dateString = currentDate.toISOString().slice(0, 10);
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateString)) {
            count++;
        }
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    return count;
}


export function getVacationInfo(user: User, timeOffRequests: TimeOffRequest[], holidays: PublicHoliday[]) {
    const poolHours = user.vacationAllowanceHours ?? 200; // Default to 200 hours (25 days * 8h)
    
    const usedHours = timeOffRequests
        .filter(req => req.userId === user.id && req.status === 'approved' && req.type === 'vacation')
        .reduce((total, req) => {
            const businessDays = calculateBusinessDays(req.startDate, req.endDate, holidays);
            return total + (businessDays * 8); // Assume 8-hour workdays
        }, 0);
        
    const remainingHours = poolHours - usedHours;
    
    return {
        pool: { hours: poolHours, days: poolHours / 8 },
        used: { hours: usedHours, days: usedHours / 8 },
        remaining: { hours: remainingHours, days: remainingHours / 8 }
    };
}

export function getUserInitials(user: User | null | undefined): string {
    if (!user) return '??';
    if (user.initials && user.initials.trim().length > 0) return user.initials.toUpperCase();
    if (user.name && user.name.trim().length > 0) {
        return user.name
            .trim()
            .split(' ')
            .filter(Boolean)
            .map(n => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    }
    if (user.email && user.email.trim().length > 0) {
        return user.email.substring(0, 2).toUpperCase();
    }
    return '??';
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