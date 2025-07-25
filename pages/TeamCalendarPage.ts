
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
            high: 'bg-danger',
            medium: 'bg-warning',
            low: 'bg-primary',
        };
        colorClasses = `cursor-pointer ${priorityColors[item.priority || 'low']}`;
        text = item.name;
        handler = `data-task-id="${item.id}"`;
        title = item.name;
    } else if ('userId' in item && 'rejectionReason' in item) { // TimeOffRequest
        const user = state.users.find(u => u.id === item.userId);
        const userName = user?.name || user?.initials || 'User';
        colorClasses = 'bg-success';
        textColorClass = 'text-white';
        text = `${userName}`;
        title = `${userName}: ${t(`team_calendar.leave_type_${item.type}`)}`;
    } else if ('title' in item && 'isAllDay' in item) { // CalendarEvent
        const event = item as CalendarEvent;
        colorClasses = 'bg-indigo-500';
        text = event.title;
        title = `${t(`team_calendar.${event.type || 'event'}`)}: ${event.title}`;
    } else if ('name' in item && 'date' in item) { // PublicHoliday
        colorClasses = 'bg-teal-500';
        textColorClass = 'text-white';
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

    const monthStartDate = new Date(year, month - 1, 1);
    const monthEndDate = new Date(year, month, 0);

    const allItems = [
        ...state.tasks.filter(t => t.workspaceId === state.activeWorkspaceId && (t.startDate || t.dueDate)),
        ...state.timeOffRequests.filter(to => to.workspaceId === state.activeWorkspaceId && to.status === 'approved'),
        ...state.calendarEvents.filter(e => e.workspaceId === state.activeWorkspaceId),
        ...state.publicHolidays
    ].map(original => {
        let startDateStr: string, endDateStr: string;
        if ('projectId' in original) {
            const task = original as Task;
            startDateStr = task.startDate || task.dueDate!;
            endDateStr = task.dueDate || task.startDate!;
        } else if ('userId' in original) {
            const eventOrRequest = original as TimeOffRequest | CalendarEvent;
            startDateStr = eventOrRequest.startDate;
            endDateStr = eventOrRequest.endDate;
        } else {
            const holiday = original as { date: string };
            startDateStr = holiday.date;
            endDateStr = holiday.date;
        }
        
        if (!startDateStr || !endDateStr) return null;

        let d1 = new Date(startDateStr + 'T12:00:00Z');
        let d2 = new Date(endDateStr + 'T12:00:00Z');
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
    
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const calendarStartDate = new Date(firstDayOfMonth);
    calendarStartDate.setDate(calendarStartDate.getDate() - (firstDayOfMonth.getDay() + 6) % 7);

    const lanes: Date[] = [];
    allItems.forEach(event => {
        let assignedLane = -1;
        for (let i = 0; i < lanes.length; i++) {
            if (lanes[i] < event.startDate) {
                lanes[i] = event.endDate;
                assignedLane = i;
                break;
            }
        }
        if (assignedLane === -1) {
            assignedLane = lanes.length;
            lanes.push(event.endDate);
        }
        (event as any).lane = assignedLane;
    });

    const weeks: Date[][] = [];
    let currentDateIterator = new Date(calendarStartDate);
    const lastDayOfMonth = new Date(year, month, 0);
    let weeksToRender = 5;
    if ( (firstDayOfMonth.getDay() === 0 && lastDayOfMonth.getDate() > 29) || (firstDayOfMonth.getDay() === 6 && lastDayOfMonth.getDate() > 30) ) {
        weeksToRender = 6;
    } else if (firstDayOfMonth.getDay() === 1 && lastDayOfMonth.getDate() === 28) {
        weeksToRender = 4;
    }


    for (let i = 0; i < weeksToRender; i++) {
        const week: Date[] = [];
        for (let j = 0; j < 7; j++) {
            week.push(new Date(currentDateIterator));
            currentDateIterator.setDate(currentDateIterator.getDate() + 1);
        }
        weeks.push(week);
    }
    
    const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

    let eventBarsHtml = '';
    allItems.forEach(event => {
        const lane = (event as any).lane;
        const barHeight = 20;
        const barGap = 2;
        const topOffset = 30 + (lane * (barHeight + barGap));
        const { colorClasses, textColorClass, text, handler, title } = getEventBarDetails(event.item);

        weeks.forEach((week, weekIndex) => {
            const weekStart = week[0];
            const weekEnd = new Date(week[6]);
            weekEnd.setHours(23, 59, 59, 999);

            if (event.startDate > weekEnd || event.endDate < weekStart) return;

            const startDayIndex = event.startDate > weekStart ? (event.startDate.getUTCDay() + 6) % 7 : 0;
            const endDayIndex = event.endDate < weekEnd ? (event.endDate.getUTCDay() + 6) % 7 : 6;
            const duration = endDayIndex - startDayIndex + 1;
            
            const isStartOfEvent = event.startDate >= weekStart;

            eventBarsHtml += `
                <div class="calendar-event-bar" 
                     style="top: ${weekIndex * 120 + topOffset}px; left: ${startDayIndex * 100 / 7}%; width: ${duration * 100 / 7}%; height: ${barHeight}px;"
                     ${handler} title="${title}">
                    <div class="calendar-event-content ${colorClasses} ${textColorClass} ${isStartOfEvent ? 'is-start' : ''} ${event.endDate <= weekEnd ? 'is-end' : ''}">
                        ${isStartOfEvent ? text : ''}
                    </div>
                </div>
            `;
        });
    });

    return `
        <div class="overflow-x-auto">
            <div class="min-w-[1200px] relative">
                <div class="grid grid-cols-7 sticky top-0 bg-content z-20">
                    ${weekdays.map(day => `<div class="p-2 text-center text-xs font-semibold text-text-subtle border-b border-r border-border-color">${t(`calendar.weekdays.${day}`)}</div>`).join('')}
                </div>
                <div class="grid grid-cols-7 auto-rows-[120px]">
                    ${weeks.flat().map(day => {
                        const isCurrentMonth = day.getMonth() === month - 1;
                        const isToday = day.getTime() === today.getTime();
                        return `<div class="border-r border-b border-border-color p-2 ${isCurrentMonth ? '' : 'bg-background/50 text-text-subtle'} ${isToday ? 'bg-primary/5' : ''}">
                                   <div class="text-sm text-right ${isToday ? 'text-primary font-bold' : ''}">${day.getDate()}</div>
                               </div>`;
                    }).join('')}
                </div>
                <div class="absolute top-[37px] left-0 w-full h-full pointer-events-none z-10">
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