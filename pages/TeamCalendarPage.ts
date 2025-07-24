

import { state } from '../state.ts';
import { t } from '../i18n.ts';
import type { Task, TimeOffRequest, CalendarEvent } from '../types.ts';
import { fetchPublicHolidays } from '../handlers/calendar.ts';
import { formatDate } from '../utils.ts';

function getUserColorClass(userId: string): string {
    const colors = [
        'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
        'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
        'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
        'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
        'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
        'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    ];
    const colorIndex = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[colorIndex];
}

function getEventBarDetails(item: any) {
    let colorClasses = '';
    let text = '';
    let handler = '';
    let title = '';

    if ('status' in item && 'projectId' in item) { // Task
        const priorityColors: Record<string, string> = {
            high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
            medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
            low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        };
        colorClasses = `cursor-pointer ${priorityColors[item.priority || 'low']}`;
        text = item.name;
        handler = `data-task-id="${item.id}"`;
        title = item.name;
    } else if ('userId' in item && 'rejectionReason' in item) { // TimeOffRequest
        const user = state.users.find(u => u.id === item.userId);
        const userName = user?.name || user?.initials || 'User';
        colorClasses = `${getUserColorClass(item.userId)}`;
        text = `${userName}`;
        title = `${userName}: ${t(`team_calendar.leave_type_${item.type}`)}`;
    } else if ('title' in item && 'isAllDay' in item) { // CalendarEvent
        const event = item as CalendarEvent;
        colorClasses = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
        text = event.title;
        title = `${t(`team_calendar.${event.type || 'event'}`)}: ${event.title}`;
    } else if ('name' in item && 'date' in item) { // PublicHoliday
        colorClasses = 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        text = item.name;
        title = `${t('team_calendar.public_holiday')}: ${item.name}`;
    }

    return { colorClasses, text, handler, title };
}

function getItemsForDay(dayDateString: string) {
    const dayDate = new Date(dayDateString + 'T12:00:00Z');
    const items: (Task | TimeOffRequest | CalendarEvent | {date: string, name: string})[] = [];
    
    items.push(...state.tasks.filter(t => t.workspaceId === state.activeWorkspaceId && t.dueDate === dayDateString));
    items.push(...state.timeOffRequests.filter(to => {
        if (to.workspaceId !== state.activeWorkspaceId || to.status !== 'approved') return false;
        const start = new Date(to.startDate + 'T00:00:00Z');
        const end = new Date(to.endDate + 'T23:59:59Z');
        return dayDate >= start && dayDate <= end;
    }));
    items.push(...state.calendarEvents.filter(e => {
        if (e.workspaceId !== state.activeWorkspaceId) return false;
        const start = new Date(e.startDate + 'T00:00:00Z');
        const end = new Date(e.endDate + 'T23:59:59Z');
        return dayDate >= start && dayDate <= end;
    }));
    items.push(...state.publicHolidays.filter(h => h.date === dayDateString));
    
    return items;
}

function renderMonthView(year: number, month: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const monthStartDate = new Date(year, month - 1, 1);
    const monthEndDate = new Date(year, month, 0);

    const allItems = [
        ...state.tasks.filter(t => t.workspaceId === state.activeWorkspaceId && (t.startDate || t.dueDate)),
        ...state.timeOffRequests.filter(to => to.workspaceId === state.activeWorkspaceId && to.status === 'approved'),
        ...state.calendarEvents.filter(e => e.workspaceId === state.activeWorkspaceId),
        ...state.publicHolidays
    ].map(original => {
        let startDateStr: string, endDateStr: string;
        let id: string;
        if ('projectId' in original) { // Task
            const task = original as Task;
            id = task.id;
            startDateStr = task.startDate || task.dueDate!;
            endDateStr = task.dueDate!;
        } else if ('id' in original) { // TimeOffRequest or CalendarEvent
            const eventOrRequest = original as TimeOffRequest | CalendarEvent;
            id = eventOrRequest.id;
            startDateStr = eventOrRequest.startDate;
            endDateStr = eventOrRequest.endDate;
        } else { // PublicHoliday
            const holiday = original as {date: string, name: string};
            id = holiday.date;
            startDateStr = holiday.date;
            endDateStr = holiday.date;
        }
        return { 
            id,
            item: original, 
            startDate: new Date(startDateStr + 'T12:00:00Z'), 
            endDate: new Date(endDateStr + 'T12:00:00Z')
        };
    }).filter(e => e.startDate <= monthEndDate && e.endDate >= monthStartDate);
    
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const calendarStartDate = new Date(firstDayOfMonth);
    calendarStartDate.setDate(calendarStartDate.getDate() - (firstDayOfMonth.getDay() + 6) % 7);

    let dayCellsHtml = '';
    let eventBarsHtml = '';
    const dateIterator = new Date(calendarStartDate);

    for (let week = 0; week < 6; week++) {
        const weekStartDate = new Date(calendarStartDate);
        weekStartDate.setDate(weekStartDate.getDate() + week * 7);
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekEndDate.getDate() + 6);

        const itemsInWeek = allItems
            .filter(item => item.startDate <= weekEndDate && item.endDate >= weekStartDate)
            .sort((a, b) => a.startDate.getTime() - b.startDate.getTime() || (b.endDate.getTime() - a.endDate.getTime()));

        const weekLayout: (string | null)[][] = Array.from({ length: 7 }, () => []);

        for (const { id, item, startDate, endDate } of itemsInWeek) {
            const startDayOfWeek = startDate < weekStartDate ? 0 : (startDate.getDay() + 6) % 7;
            const endDayOfWeek = endDate > weekEndDate ? 6 : (endDate.getDay() + 6) % 7;
            
            let laneIndex = 0;
            while (true) {
                let isFree = true;
                for (let d = startDayOfWeek; d <= endDayOfWeek; d++) {
                    if (weekLayout[d][laneIndex] !== undefined) { isFree = false; break; }
                }
                if (isFree) break;
                laneIndex++;
            }
            
            for (let d = startDayOfWeek; d <= endDayOfWeek; d++) { weekLayout[d][laneIndex] = id; }
            
            const span = endDayOfWeek - startDayOfWeek + 1;
            const isStart = startDate >= weekStartDate;
            const isEnd = endDate <= weekEndDate;

            const { colorClasses, text, handler, title } = getEventBarDetails(item);
            let finalClasses = `calendar-event-content ${colorClasses}`;
            if (isStart) finalClasses += ' is-start';
            if (isEnd) finalClasses += ' is-end';
            if (!isStart) finalClasses += ' is-continued';
            
            eventBarsHtml += `
                <div class="calendar-event-bar" style="grid-row: ${week + 2}; grid-column: ${startDayOfWeek + 1} / span ${span}; top: ${2 + laneIndex * 26}px;" ${handler} title="${title}">
                    <div class="${finalClasses}">${text}</div>
                </div>`;
        }
    }
    
    for (let i = 0; i < 42; i++) {
        const isCurrentMonth = dateIterator.getMonth() === month - 1;
        const isToday = dateIterator.getTime() === today.getTime();
        dayCellsHtml += `<div class="border-r border-b border-border-color p-2 min-h-[120px] ${isCurrentMonth ? '' : 'bg-background/50 text-text-subtle'} ${isToday ? 'bg-primary/5' : ''}"><div class="text-sm text-right ${isToday ? 'text-primary font-bold' : ''}">${dateIterator.getDate()}</div></div>`;
        dateIterator.setDate(dateIterator.getDate() + 1);
    }
    
    const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    return `
        <div class="overflow-x-auto">
            <div class="relative grid grid-cols-7 min-w-[900px]" style="grid-template-rows: auto repeat(6, minmax(120px, auto));">
                ${weekdays.map(day => `<div class="p-2 text-center text-xs font-semibold text-text-subtle border-r border-b border-border-color">${t(`calendar.weekdays.${day}`)}</div>`).join('')}
                ${dayCellsHtml}
                ${eventBarsHtml}
            </div>
        </div>
    `;
}

function renderWeekView(currentDate: Date) {
    const weekDays: Date[] = [];
    const dayOfWeek = (currentDate.getDay() + 6) % 7;
    const startDate = new Date(currentDate);
    startDate.setDate(startDate.getDate() - dayOfWeek);
    
    for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        weekDays.push(d);
    }

    let daysHtml = '';
    for (const dayDate of weekDays) {
        const dayDateString = dayDate.toISOString().slice(0, 10);
        const itemsForDay = getItemsForDay(dayDateString);
        daysHtml += `
            <div class="border-r border-border-color p-2">
                <div class="text-center mb-2">
                    <strong class="text-sm">${t(`calendar.weekdays.${dayDate.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase()}`)}</strong>
                    <p class="text-2xl font-bold">${dayDate.getDate()}</p>
                </div>
                <div class="space-y-1">
                    ${itemsForDay.map(item => {
                        const { colorClasses, text, handler, title } = getEventBarDetails(item);
                        return `<div class="p-1.5 text-xs font-medium rounded-md truncate ${colorClasses}" title="${title}" ${handler}>${text}</div>`
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    return `<div class="grid grid-cols-1 sm:grid-cols-7 h-full">${daysHtml}</div>`;
}

function renderDayView(currentDate: Date) {
    const dayDateString = currentDate.toISOString().slice(0, 10);
    const itemsForDay = getItemsForDay(dayDateString);
    
    return `
        <div class="p-4 space-y-2">
            ${itemsForDay.length > 0
                ? itemsForDay.map(item => {
                    const { colorClasses, text, handler, title } = getEventBarDetails(item);
                    return `<div class="p-1.5 text-xs font-medium rounded-md truncate ${colorClasses}" title="${title}" ${handler}>${text}</div>`
                }).join('')
                : `<div class="flex items-center justify-center py-8 text-text-subtle">${t('misc.no_events_for_day')}</div>`
            }
        </div>
    `;
}

export async function TeamCalendarPage() {
    const { teamCalendarDate, teamCalendarView } = state.ui;
    const currentDate = new Date(teamCalendarDate + 'T12:00:00Z');
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;

    await Promise.all([
        fetchPublicHolidays(year - 1),
        fetchPublicHolidays(year),
        fetchPublicHolidays(year + 1)
    ]);
    
    let viewTitle = '';
    let viewContent = '';

    switch (teamCalendarView) {
        case 'month':
            viewTitle = currentDate.toLocaleString(state.settings.language, { month: 'long', year: 'numeric' });
            viewContent = renderMonthView(year, month);
            break;
        case 'week':
            const weekStart = new Date(currentDate);
            const dayOfWeek = (weekStart.getDay() + 6) % 7;
            weekStart.setDate(weekStart.getDate() - dayOfWeek);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            viewTitle = `${formatDate(weekStart.toISOString())} - ${formatDate(weekEnd.toISOString())}`;
            viewContent = renderWeekView(currentDate);
            break;
        case 'day':
            viewTitle = formatDate(currentDate.toISOString(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            viewContent = renderDayView(currentDate);
            break;
    }
    
    return `
        <div class="space-y-6">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 class="text-2xl font-bold">${t('team_calendar.title')}</h2>
                <div class="flex items-center gap-2">
                     <button class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-content border border-border-color hover:bg-background" data-modal-target="addTimeOffRequest">
                        <span class="material-icons-sharp text-base">flight_takeoff</span>
                        ${t('team_calendar.add_leave')}
                    </button>
                    <button class="px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-md bg-primary text-white hover:bg-primary-hover" data-modal-target="addCalendarEvent">
                        <span class="material-icons-sharp text-base">add</span> ${t('team_calendar.add_event')}
                    </button>
                </div>
            </div>
            <div class="bg-content rounded-lg shadow-sm">
                <div class="flex flex-col sm:flex-row justify-between items-center p-4 border-b border-border-color gap-4">
                    <div class="flex items-center gap-2">
                        <button class="p-1.5 rounded-full hover:bg-background text-text-subtle" data-calendar-nav="prev" data-target-calendar="team" aria-label="${t('calendar.prev_month')}"><span class="material-icons-sharp">chevron_left</span></button>
                        <button class="p-1.5 rounded-full hover:bg-background text-text-subtle" data-calendar-nav="next" data-target-calendar="team" aria-label="${t('calendar.next_month')}"><span class="material-icons-sharp">chevron_right</span></button>
                         <h4 class="text-lg font-semibold">${viewTitle}</h4>
                    </div>
                    <div class="flex items-center p-1 bg-background rounded-lg">
                        <button class="px-3 py-1 text-sm font-medium rounded-md ${teamCalendarView === 'month' ? 'bg-content shadow-sm' : 'text-text-subtle'}" data-team-calendar-view="month">${t('calendar.month_view')}</button>
                        <button class="px-3 py-1 text-sm font-medium rounded-md ${teamCalendarView === 'week' ? 'bg-content shadow-sm' : 'text-text-subtle'}" data-team-calendar-view="week">${t('calendar.week_view')}</button>
                        <button class="px-3 py-1 text-sm font-medium rounded-md ${teamCalendarView === 'day' ? 'bg-content shadow-sm' : 'text-text-subtle'}" data-team-calendar-view="day">${t('calendar.day_view')}</button>
                    </div>
                </div>
                ${viewContent}
            </div>
        </div>
    `;
}
