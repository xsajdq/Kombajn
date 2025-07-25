

import { state } from '../state.ts';
import { t } from '../i18n.ts';
import type { Task, TimeOffRequest, CalendarEvent } from '../types.ts';
import { fetchPublicHolidays } from '../handlers/calendar.ts';
import { formatDate } from '../utils.ts';

function getEventBarDetails(item: any) {
    let colorClasses = '';
    let textColorClass = 'text-white';
    let text = '';
    let handler = '';
    let title = '';

    if ('status' in item && 'projectId' in item) { // Task
        const priorityColors: Record<string, string> = {
            high: 'bg-red-500 border-red-700',
            medium: 'bg-yellow-500 border-yellow-700',
            low: 'bg-blue-500 border-blue-700',
        };
        colorClasses = `cursor-pointer ${priorityColors[item.priority || 'low']}`;
        text = item.name;
        handler = `data-task-id="${item.id}"`;
        title = item.name;
    } else if ('userId' in item && 'rejectionReason' in item) { // TimeOffRequest
        const user = state.users.find(u => u.id === item.userId);
        const userName = user?.name || user?.initials || 'User';
        colorClasses = 'bg-green-400 border-green-600';
        textColorClass = 'text-green-900';
        text = `${userName}`;
        title = `${userName}: ${t(`team_calendar.leave_type_${item.type}`)}`;
    } else if ('title' in item && 'isAllDay' in item) { // CalendarEvent
        const event = item as CalendarEvent;
        colorClasses = 'bg-indigo-400 border-indigo-600';
        text = event.title;
        title = `${t(`team_calendar.${event.type || 'event'}`)}: ${event.title}`;
    } else if ('name' in item && 'date' in item) { // PublicHoliday
        colorClasses = 'bg-teal-400 border-teal-600';
        textColorClass = 'text-teal-900';
        text = item.name;
        title = `${t('team_calendar.public_holiday')}: ${item.name}`;
    }

    return { colorClasses, textColorClass, text, handler, title };
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

    const monthStartDate = new Date(Date.UTC(year, month - 1, 1));
    const monthEndDate = new Date(Date.UTC(year, month, 0));

    // 1. Collect and normalize all items
    const allItems = [
        ...state.tasks.filter(t => t.workspaceId === state.activeWorkspaceId && (t.startDate || t.dueDate)),
        ...state.timeOffRequests.filter(to => to.workspaceId === state.activeWorkspaceId && to.status === 'approved'),
        ...state.calendarEvents.filter(e => e.workspaceId === state.activeWorkspaceId),
        ...state.publicHolidays
    ].map(original => {
        let startDateStr: string, endDateStr: string;
        if ('projectId' in original) { // Task
            const task = original as Task;
            startDateStr = task.startDate || task.dueDate!;
            endDateStr = task.dueDate || task.startDate!;
        } else if ('userId' in original) { // TimeOffRequest or CalendarEvent
            const eventOrRequest = original as TimeOffRequest | CalendarEvent;
            startDateStr = eventOrRequest.startDate;
            endDateStr = eventOrRequest.endDate;
        } else { // PublicHoliday
            const holiday = original as { date: string };
            startDateStr = holiday.date;
            endDateStr = holiday.date;
        }
        
        if (!startDateStr || !endDateStr) return null;

        let d1 = new Date(startDateStr);
        let d2 = new Date(endDateStr);
        if (d1 > d2) [d1, d2] = [d2, d1];
        
        return { item: original, startDate: d1, endDate: d2 };
    })
    .filter((e): e is { item: any; startDate: Date; endDate: Date } => e !== null)
    .filter(e => e.startDate <= monthEndDate && e.endDate >= monthStartDate)
    .sort((a, b) => {
        if (a.startDate.getTime() !== b.startDate.getTime()) {
            return a.startDate.getTime() - b.startDate.getTime();
        }
        return (b.endDate.getTime() - b.startDate.getTime()) - (a.endDate.getTime() - a.startDate.getTime());
    });
    
    // 2. Determine calendar grid boundaries
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const calendarStartDate = new Date(firstDayOfMonth);
    calendarStartDate.setDate(calendarStartDate.getDate() - (firstDayOfMonth.getDay() + 6) % 7);
    
    // 3. Assign lanes to events to prevent vertical overlap
    const lanes: { endDate: Date }[][] = [];
    allItems.forEach(event => {
        let placed = false;
        for (let i = 0; i < lanes.length; i++) {
            if (!lanes[i].some(e => e.endDate >= event.startDate)) {
                (event as any).lane = i;
                lanes[i].push({ endDate: event.endDate });
                placed = true;
                break;
            }
        }
        if (!placed) {
            (event as any).lane = lanes.length;
            lanes.push([{ endDate: event.endDate }]);
        }
    });

    // 4. Render Grid and Events
    const weeks: Date[][] = [];
    let currentDate = new Date(calendarStartDate);
    for (let i = 0; i < 6; i++) {
        const week: Date[] = [];
        for (let j = 0; j < 7; j++) {
            week.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }
        weeks.push(week);
    }
    
    const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

    let eventBarsHtml = '';
    allItems.forEach(event => {
        const lane = (event as any).lane;
        const barHeight = 20;
        const barGap = 4;
        const topOffset = 28 + (lane * (barHeight + barGap));

        weeks.forEach((week, weekIndex) => {
            const weekStart = week[0];
            const weekEnd = week[6];

            if (event.startDate > weekEnd || event.endDate < weekStart) return;

            const startDayIndex = Math.max(0, Math.floor((event.startDate.getTime() - weekStart.getTime()) / (1000 * 3600 * 24)));
            const endDayIndex = Math.min(6, Math.floor((event.endDate.getTime() - weekStart.getTime()) / (1000 * 3600 * 24)));
            const duration = endDayIndex - startDayIndex + 1;
            
            const { colorClasses, textColorClass, text, handler, title } = getEventBarDetails(event.item);

            const isStart = event.startDate >= weekStart;
            const isEnd = event.endDate <= weekEnd;
            
            eventBarsHtml += `
                <div class="calendar-event-bar" 
                     style="grid-row: ${weekIndex + 1}; grid-column: ${startDayIndex + 1} / span ${duration}; top: ${topOffset}px; height: ${barHeight}px;"
                     ${handler} title="${title}">
                    <div class="calendar-event-content ${colorClasses} ${textColorClass} ${isStart ? 'is-start' : ''} ${isEnd ? 'is-end' : ''} ${!isStart ? 'is-continued' : ''}">
                        ${isStart ? text : '&nbsp;'}
                    </div>
                </div>
            `;
        });
    });

    return `
        <div class="overflow-x-auto">
            <div class="min-w-[1200px]">
                <div class="grid grid-cols-7 sticky top-0 bg-content z-20">
                    ${weekdays.map(day => `<div class="p-2 text-center text-xs font-semibold text-text-subtle border-b border-r border-border-color">${t(`calendar.weekdays.${day}`)}</div>`).join('')}
                </div>
                <div class="grid grid-cols-7 grid-flow-row auto-rows-[minmax(120px,1fr)] relative">
                    ${weeks.flat().map(day => {
                        const isCurrentMonth = day.getMonth() === month - 1;
                        const isToday = day.getTime() === today.getTime();
                        return `<div class="border-r border-b border-border-color p-2 ${isCurrentMonth ? '' : 'bg-background/50 text-text-subtle'} ${isToday ? 'bg-primary/5' : ''}">
                                   <div class="text-sm text-right ${isToday ? 'text-primary font-bold' : ''}">${day.getDate()}</div>
                               </div>`;
                    }).join('')}
                    ${eventBarsHtml}
                </div>
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
    const year = currentDate.getUTCFullYear();
    const month = currentDate.getUTCMonth() + 1;

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
