
import { state } from '../state.ts';
import { t } from '../i18n.ts';
import type { Task, TimeOffRequest, CalendarEvent, PublicHoliday, User, TimeLog } from '../types.ts';
import { fetchPublicHolidays } from '../handlers/calendar.ts';
import { formatDate, getUserInitials, formatDuration } from '../utils.ts';

function getEventBarDetails(item: any) {
    let colorClasses = '';
    let textColorClass = 'text-white';
    let text = '';
    let handler = '';
    let title = '';

    if ('status' in item && 'projectId' in item) { // Task
        const priorityColors: Record<string, string> = {
            high: 'bg-red-500',
            medium: 'bg-yellow-500',
            low: 'bg-blue-500',
        };
        colorClasses = `cursor-pointer ${priorityColors[item.priority || 'low']}`;
        textColorClass = 'text-white';
        text = item.name;
        handler = `data-task-id="${item.id}"`;
        title = item.name;
    } else if ('userId' in item && 'type' in item && ['vacation', 'sick_leave', 'other'].includes(item.type)) { // TimeOffRequest
        const user = state.users.find(u => u.id === item.userId);
        const userName = user?.name || user?.initials || 'User';
        colorClasses = 'bg-green-500';
        textColorClass = 'text-white';
        text = `${userName}: ${t(`team_calendar.leave_type_${item.type}`)}`;
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
    const items: (Task | TimeOffRequest | CalendarEvent | PublicHoliday)[] = [];
    
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
    
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const calendarStartDate = new Date(firstDayOfMonth);
    calendarStartDate.setDate(calendarStartDate.getDate() - (firstDayOfMonth.getDay() + 6) % 7);
    const calendarEndDate = new Date(calendarStartDate);
    calendarEndDate.setDate(calendarEndDate.getDate() + 41); // 6 weeks * 7 days - 1

    const weeks: Date[][] = [];
    let currentDateIterator = new Date(calendarStartDate);
    while(currentDateIterator <= calendarEndDate) {
        const week: Date[] = [];
        for (let j = 0; j < 7; j++) {
            week.push(new Date(currentDateIterator));
            currentDateIterator.setDate(currentDateIterator.getDate() + 1);
        }
        weeks.push(week);
        if (week[6] >= monthEndDate && (week[6].getDay() + 6) % 7 === 6) break;
    }

    const allItemsRaw = [
        ...state.tasks.filter(t => t.workspaceId === state.activeWorkspaceId && (t.startDate || t.dueDate)),
        ...state.timeOffRequests.filter(to => to.workspaceId === state.activeWorkspaceId && to.status === 'approved'),
        ...state.calendarEvents.filter(e => e.workspaceId === state.activeWorkspaceId),
        ...state.publicHolidays
    ];

    const allItems = allItemsRaw.map(original => {
        let startDateStr: string, endDateStr: string;
        if ('projectId' in original) { // Task
            const task = original as Task;
            startDateStr = task.startDate || task.dueDate!;
            endDateStr = task.dueDate || task.startDate!;
        } else if ('isAllDay' in original) { // CalendarEvent
             const event = original as CalendarEvent;
             startDateStr = event.startDate;
             endDateStr = event.endDate;
        } else if ('userId' in original) { // TimeOffRequest
            const eventOrRequest = original as TimeOffRequest;
            startDateStr = eventOrRequest.startDate;
            endDateStr = eventOrRequest.endDate;
        } else { // PublicHoliday
            const holiday = original as PublicHoliday;
            startDateStr = holiday.date;
            endDateStr = holiday.date;
        }
        
        if (!startDateStr || !endDateStr) return null;
        let d1 = new Date(startDateStr + 'T12:00:00Z');
        let d2 = new Date(endDateStr + 'T12:00:00Z');
        if (d1 > d2) [d1, d2] = [d2, d1];
        
        return { item: original, startDate: d1, endDate: d2 };
    })
    .filter((e): e is { item: any; startDate: Date; endDate: Date; } => e !== null)
    .filter(e => e.startDate <= calendarEndDate && e.endDate >= calendarStartDate)
    .sort((a, b) => {
        if (a.startDate.getTime() !== b.startDate.getTime()) return a.startDate.getTime() - b.startDate.getTime();
        return (b.endDate.getTime() - b.startDate.getTime()) - (a.endDate.getTime() - a.startDate.getTime());
    });
    
    let eventBarsHtml = '';
    weeks.forEach((week, weekIndex) => {
        const weekStart = week[0];
        const weekEnd = new Date(week[6]);
        weekEnd.setHours(23, 59, 59, 999);
        
        const weekItems = allItems.filter(e => e.startDate <= weekEnd && e.endDate >= weekStart);
        
        const lanes: Date[] = [];
        weekItems.forEach(event => {
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

            const lane = (event as any).lane;
            const barHeight = 22;
            const barGap = 2;
            const topOffset = 30 + (lane * (barHeight + barGap));
            const { colorClasses, textColorClass, text, handler, title } = getEventBarDetails(event.item);
            
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

    const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

    return `
        <div class="overflow-x-auto">
            <div class="min-w-[1200px] relative">
                <div class="grid grid-cols-7 sticky top-0 bg-content z-20">
                    ${weekdays.map(day => `<div class="p-2 text-center text-xs font-semibold text-text-subtle border-b border-r border-border-color">${t(`calendar.weekdays.${day}`)}</div>`).join('')}
                </div>
                <div class="grid grid-cols-7" style="grid-template-rows: repeat(${weeks.length}, 120px)">
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
    const weekStartDate = weekDays[0];
    const weekEndDate = new Date(weekDays[6]);
    weekEndDate.setHours(23, 59, 59, 999);

    const allLeaveItemsRaw = [
        ...state.timeOffRequests.filter(to => to.workspaceId === state.activeWorkspaceId && to.status === 'approved'),
        ...state.publicHolidays
    ];

    const leaveItems = allLeaveItemsRaw.map(original => {
        const eventOrRequest = original as TimeOffRequest | PublicHoliday;
        let startDateStr: string;
        let endDateStr: string;

        if ('startDate' in eventOrRequest) { // It's a TimeOffRequest
            startDateStr = eventOrRequest.startDate;
            endDateStr = eventOrRequest.endDate;
        } else { // It's a PublicHoliday
            startDateStr = eventOrRequest.date;
            endDateStr = eventOrRequest.date;
        }
        
        let d1 = new Date(startDateStr + 'T12:00:00Z');
        let d2 = new Date(endDateStr + 'T12:00:00Z');
        if (d1 > d2) [d1, d2] = [d2, d1];
        
        return { item: original, startDate: d1, endDate: d2 };
    })
    .filter(e => e.startDate <= weekEndDate && e.endDate >= weekStartDate);

    const leaveByUser = new Map<string, any[]>();
    leaveItems.forEach(event => {
        const key = 'userId' in event.item ? event.item.userId : 'public_holidays';
        if (!leaveByUser.has(key)) leaveByUser.set(key, []);
        leaveByUser.get(key)!.push(event);
    });

    let leaveHeaderHtml = '';
    if (leaveByUser.size > 0) {
        let userRowsHtml = '';
        leaveByUser.forEach((events, userId) => {
            const user = state.users.find(u => u.id === userId);
            const userName = user?.name || user?.initials || t('team_calendar.public_holiday');
            
            let eventBars = '';
            events.forEach(event => {
                const start = event.startDate > weekStartDate ? event.startDate : weekStartDate;
                const end = event.endDate < weekEndDate ? event.endDate : weekEndDate;
                
                const startDayIndex = Math.floor((start.getTime() - weekStartDate.getTime()) / (1000 * 3600 * 24));
                const endDayIndex = Math.floor((end.getTime() - weekStartDate.getTime()) / (1000 * 3600 * 24));
                const duration = endDayIndex - startDayIndex + 1;
                
                const { colorClasses, textColorClass, text, title } = getEventBarDetails(event.item);

                eventBars += `
                    <div class="calendar-event-bar" style="grid-column: ${startDayIndex + 1} / span ${duration};" title="${title}">
                        <div class="calendar-event-content ${colorClasses} ${textColorClass} is-start is-end">
                            ${text}
                        </div>
                    </div>
                `;
            });

            userRowsHtml += `
                <div class="leave-header-row">
                    <div class="leave-header-user">${userName}</div>
                    <div class="leave-header-timeline">${eventBars}</div>
                </div>
            `;
        });

        leaveHeaderHtml = `<div class="team-calendar-leave-header">${userRowsHtml}</div>`;
    }

    let daysHtml = '';
    for (const dayDate of weekDays) {
        const dayDateString = dayDate.toISOString().slice(0, 10);
        const itemsForDay = getItemsForDay(dayDateString)
            .filter(item => 'projectId' in item || 'isAllDay' in item);

        daysHtml += `
            <div class="border-r border-border-color p-2">
                <div class="text-center mb-2">
                    <strong class="text-sm">${t(`calendar.weekdays.${dayDate.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase()}`)}</strong>
                    <p class="text-2xl font-bold">${dayDate.getDate()}</p>
                </div>
                <div class="space-y-1">
                    ${itemsForDay.map(item => {
                        const { colorClasses, textColorClass, text, handler, title } = getEventBarDetails(item);
                        return `<div class="p-1.5 text-xs font-medium rounded-md truncate ${colorClasses} ${textColorClass}" title="${title}" ${handler}>${text}</div>`
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    return `
        ${leaveHeaderHtml}
        <div class="grid grid-cols-1 sm:grid-cols-7 h-full">${daysHtml}</div>
    `;
}

function renderWorkloadView(currentDate: Date) {
    const weekDays: Date[] = [];
    const dayOfWeek = (currentDate.getDay() + 6) % 7;
    const startDate = new Date(currentDate);
    startDate.setDate(startDate.getDate() - dayOfWeek);

    for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        weekDays.push(d);
    }
    const weekStartDate = weekDays[0];
    const weekEndDate = new Date(weekDays[6]);
    weekEndDate.setHours(23, 59, 59, 999);

    const users = state.workspaceMembers
        .filter(m => m.workspaceId === state.activeWorkspaceId)
        .map(m => state.users.find(u => u.id === m.userId))
        .filter((u): u is User => !!u)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const tasksWithData = state.tasks.filter(t => t.workspaceId === state.activeWorkspaceId && t.startDate && t.dueDate && t.estimatedHours);

    const headerHtml = `
        <div class="workload-header-user"></div>
        <div class="workload-header-timeline">
            ${weekDays.map(d => `
                <div class="workload-header-date">
                    <div class="text-xs">${d.toLocaleDateString(state.settings.language, { weekday: 'short' })}</div>
                    <div class="font-bold">${d.getDate()}</div>
                </div>
            `).join('')}
        </div>
    `;
    
    const rowsHtml = users.map(user => {
        const userTasks = tasksWithData
            .filter(t => state.taskAssignees.some(a => a.taskId === t.id && a.userId === user.id))
            .sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime());

        const dayCellsHtml = weekDays.map(date => {
            const dateStr = date.toISOString().slice(0, 10);
            let dailyHours = 0;
            userTasks.forEach(task => {
                const start = new Date(task.startDate!);
                const end = new Date(task.dueDate!);
                const currentDate = new Date(dateStr);
                if (currentDate >= start && currentDate <= end) {
                    const durationDays = (end.getTime() - start.getTime()) / (1000 * 3600 * 24) + 1;
                    dailyHours += (task.estimatedHours || 0) / durationDays;
                }
            });
            
            let capacityClass = 'capacity-under';
            if (dailyHours > 8) capacityClass = 'capacity-over';
            else if (dailyHours > 6) capacityClass = 'capacity-good';
            
            return `<div class="workload-day-cell ${capacityClass}"></div>`;
        }).join('');

        const tracks: { end: Date }[][] = [];
        const taskBarsHtml = userTasks.map(task => {
            const taskStart = new Date(task.startDate!);
            const taskEnd = new Date(task.dueDate!);

            if (taskEnd < weekStartDate || taskStart > weekEndDate) return ''; // Don't render if outside view

            let laneIndex = tracks.findIndex(track => !track.some(placed => placed.end >= taskStart));

            if (laneIndex === -1) {
                laneIndex = tracks.length;
                tracks.push([]);
            }
            tracks[laneIndex].push({ end: taskEnd });

            const startDayIndex = Math.max(0, Math.floor((taskStart.getTime() - weekStartDate.getTime()) / (1000 * 3600 * 24)));
            const endDayIndex = Math.min(6, Math.floor((taskEnd.getTime() - weekStartDate.getTime()) / (1000 * 3600 * 24)));
            const durationDays = endDayIndex - startDayIndex + 1;
            
            const gridColumnStart = startDayIndex + 1;

            const priorityColors: Record<string, string> = { high: 'bg-danger', medium: 'bg-warning', low: 'bg-primary' };
            const colorClass = priorityColors[task.priority || 'low'];

            return `
                <div class="workload-task-bar ${colorClass}" 
                     style="grid-column: ${gridColumnStart} / span ${durationDays}; top: ${2 + laneIndex * 28}px;"
                     data-task-id="${task.id}"
                     title="${task.name}">
                     ${task.name}
                </div>`;
        }).join('');
        
        return `
            <div class="workload-user-cell">
                <div class="avatar-small">${getUserInitials(user)}</div>
                <span class="text-sm font-medium">${user.name || getUserInitials(user)}</span>
            </div>
            <div class="workload-user-timeline">
                 <div class="workload-day-cell-container">${dayCellsHtml}</div>
                 <div class="workload-task-bars">${taskBarsHtml}</div>
            </div>
        `;
    }).join('');

    return `
        <div class="workload-container">
            <div class="workload-grid">
                ${headerHtml}
                ${rowsHtml}
            </div>
        </div>
    `;
}

function getUserColor(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return "#" + "00000".substring(0, 6 - color.length) + color;
}

function renderTimesheetView(currentDate: Date) {
    const weekDays: Date[] = [];
    const dayOfWeek = (currentDate.getDay() + 6) % 7;
    const startDate = new Date(currentDate);
    startDate.setDate(startDate.getDate() - dayOfWeek);
    
    for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        weekDays.push(d);
    }
    const weekStartDateStr = weekDays[0].toISOString().slice(0, 10);
    const weekEndDate = new Date(weekDays[6]);
    weekEndDate.setHours(23, 59, 59, 999);
    const weekEndDateStr = weekEndDate.toISOString();
    
    let userIdsToDisplay: string[] = [];
    if (state.ui.teamCalendarSelectedUserIds.length === 0) {
        userIdsToDisplay = [state.currentUser!.id];
    } else if (state.ui.teamCalendarSelectedUserIds.includes('all')) {
        userIdsToDisplay = state.workspaceMembers
            .filter(m => m.workspaceId === state.activeWorkspaceId)
            .map(m => m.userId);
    } else {
        userIdsToDisplay = state.ui.teamCalendarSelectedUserIds;
    }

    const timeLogs = state.timeLogs.filter(log => 
        userIdsToDisplay.includes(log.userId) &&
        log.createdAt >= weekStartDateStr &&
        log.createdAt <= weekEndDateStr
    );
    
    const timeAxisHtml = Array.from({ length: 24 }, (_, i) => `<div class="time-axis">${String(i).padStart(2, '0')}:00</div>`).join('');
    
    const dayColumnsHtml = weekDays.map(day => {
        const dayStr = day.toISOString().slice(0,10);
        const entriesForDay = timeLogs.filter(log => log.createdAt.startsWith(dayStr));
        const hourRows = Array.from({ length: 24 }, () => `<div class="hour-row"></div>`).join('');

        const entriesHtml = entriesForDay.map(log => {
            const logDate = new Date(log.createdAt);
            const startMinutes = logDate.getHours() * 60 + logDate.getMinutes();
            const durationMinutes = log.trackedSeconds / 60;
            const top = (startMinutes / (24 * 60)) * 100;
            const height = (durationMinutes / (24 * 60)) * 100;
            const task = state.tasks.find(t => t.id === log.taskId);
            const project = state.projects.find(p => p.id === task?.projectId);
            const user = state.users.find(u => u.id === log.userId);

            const userColor = getUserColor(log.userId);

            return `
                <div class="timesheet-entry" 
                     style="top: ${top}%; height: ${height}%; background-color: ${userColor};"
                     title="${task?.name || 'Task'} (${formatDuration(log.trackedSeconds)})"
                     data-task-id="${task?.id}">
                    ${userIdsToDisplay.length > 1 ? `<span class="timesheet-entry-initials">${getUserInitials(user)}</span>` : ''}
                    <div class="timesheet-entry-content">
                        <strong>${task?.name || 'Task'}</strong>
                        <p>${project?.name || 'Project'}</p>
                    </div>
                </div>
            `;
        }).join('');
        
        return `
            <div class="day-column">
                ${hourRows}
                ${entriesHtml}
            </div>
        `;
    }).join('');

    return `
        <div class="timesheet-container">
            <div class="timesheet-grid">
                <div class="timesheet-header"></div>
                ${weekDays.map(day => `
                    <div class="timesheet-day-header">
                         <strong class="text-sm">${t(`calendar.weekdays.${day.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase()}`)}</strong>
                         <p class="text-2xl font-bold">${day.getDate()}</p>
                    </div>
                `).join('')}
                
                <div class="time-axis-container">${timeAxisHtml}</div>
                ${dayColumnsHtml}
            </div>
        </div>
    `;
}

function renderDayView(currentDate: Date) {
    const dayDateString = currentDate.toISOString().slice(0, 10);
    const items = getItemsForDay(dayDateString);

    if (items.length === 0) {
        return `<div class="p-8 text-center text-text-subtle">${t('misc.no_events_for_day')}</div>`;
    }

    return `
        <div class="p-4 space-y-2">
            ${items.map(item => {
                const { colorClasses, textColorClass, text, handler, title } = getEventBarDetails(item);
                return `
                    <div class="p-2 text-sm font-medium rounded-md ${colorClasses} ${textColorClass}" title="${title}" ${handler}>
                        ${text}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

export async function TeamCalendarPage() {
    const { teamCalendarDate, teamCalendarView, teamCalendarSelectedUserIds } = state.ui;
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
    let topContent = '';

    if (teamCalendarView === 'timesheet') {
        const workspaceUsers = state.workspaceMembers
            .filter(m => m.workspaceId === state.activeWorkspaceId)
            .map(m => state.users.find(u => u.id === m.userId)!)
            .filter(Boolean);
        
        let buttonText = t('team_calendar.my_time_logs');
        if (teamCalendarSelectedUserIds.includes('all')) {
            buttonText = t('team_calendar.all_users');
        } else if (teamCalendarSelectedUserIds.length > 0) {
            buttonText = `${teamCalendarSelectedUserIds.length} users selected`;
        }

        topContent = `
            <div id="timesheet-user-selector-container" class="relative w-64">
                <button data-timesheet-user-toggle class="form-control flex justify-between items-center">
                    <span>${buttonText}</span>
                    <span class="material-icons-sharp">expand_more</span>
                </button>
                <div id="timesheet-user-dropdown" class="absolute top-full left-0 w-full bg-content border border-border-color rounded-md shadow-lg z-20 mt-1 hidden">
                    <div class="p-1 max-h-60 overflow-y-auto">
                        <div class="timesheet-user-option p-2 rounded-md hover:bg-background cursor-pointer" data-timesheet-user-me="true">${t('team_calendar.my_time_logs')}</div>
                        <div class="timesheet-user-option p-2 rounded-md hover:bg-background cursor-pointer" data-timesheet-user-all="true">${t('team_calendar.all_users')}</div>
                        <div class="border-t border-border-color my-1"></div>
                        ${workspaceUsers.map(u => `
                            <label class="timesheet-user-option flex items-center gap-2 p-2 rounded-md hover:bg-background cursor-pointer">
                                <input type="checkbox" value="${u.id}" class="h-4 w-4 rounded text-primary focus:ring-primary" ${teamCalendarSelectedUserIds.includes(u.id) ? 'checked' : ''}>
                                <div class="avatar-small">${getUserInitials(u)}</div>
                                <span class="text-sm">${u.name}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    switch (teamCalendarView) {
        case 'month':
            viewTitle = currentDate.toLocaleString(state.settings.language, { month: 'long', year: 'numeric' });
            viewContent = renderMonthView(year, month);
            break;
        case 'week':
        case 'workload':
        case 'timesheet':
            const weekStart = new Date(currentDate);
            const dayOfWeek = (weekStart.getDay() + 6) % 7;
            weekStart.setDate(weekStart.getDate() - dayOfWeek);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            viewTitle = `${formatDate(weekStart.toISOString())} - ${formatDate(weekEnd.toISOString())}`;
            if (teamCalendarView === 'week') viewContent = renderWeekView(currentDate);
            if (teamCalendarView === 'workload') viewContent = renderWorkloadView(currentDate);
            if (teamCalendarView === 'timesheet') viewContent = renderTimesheetView(currentDate);
            break;
        case 'day':
            viewTitle = formatDate(currentDate.toISOString(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            viewContent = renderDayView(currentDate);
            break;
    }
    
    const navItems = [
        { id: 'month', text: t('calendar.month_view') },
        { id: 'week', text: t('calendar.week_view') },
        { id: 'day', text: t('calendar.day_view') },
        { id: 'workload', text: t('team_calendar.workload_view') },
        { id: 'timesheet', text: t('team_calendar.timesheet_view') },
    ];

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
                    ${topContent}
                    <div class="flex items-center p-1 bg-background rounded-lg">
                        ${navItems.map(item => `
                             <button class="px-3 py-1 text-sm font-medium rounded-md ${teamCalendarView === item.id ? 'bg-content shadow-sm' : 'text-text-subtle'}" data-team-calendar-view="${item.id}">${item.text}</button>
                        `).join('')}
                    </div>
                </div>
                ${viewContent}
            </div>
        </div>
    `;
}
