
import { state } from '../state.ts';
import { t } from '../i18n.ts';
import type { Task, TimeOffRequest, CalendarEvent } from '../types.ts';
import { fetchPublicHolidays } from '../handlers/calendar.ts';
import { formatDate } from '../utils.ts';

function getUserColorClass(userId: string): string {
    const colorIndex = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 8; // 8 available colors
    return `user-color-${colorIndex}`;
}

function renderCalendarItem(item: Task | TimeOffRequest | CalendarEvent | { date: string, name: string }) {
    let className = 'team-calendar-item';
    let text = '';
    let handler = '';
    let title = '';

    if ('status' in item && 'projectId' in item) { // Task
        className += ` type-task clickable priority-${item.priority || 'low'}`;
        text = item.name;
        handler = `data-task-id="${item.id}"`;
        title = item.name;
    } else if ('userId' in item && 'rejectionReason' in item) { // TimeOffRequest
        const user = state.users.find(u => u.id === item.userId);
        const userName = user?.name || user?.initials || 'User';
        className += ` type-timeoff ${getUserColorClass(item.userId)}`;
        text = `${userName}`;
        title = `${userName}: ${t(`team_calendar.leave_type_${item.type}`)}`;
        handler = `title="${title}"`;
    } else if ('title' in item && 'isAllDay' in item) { // CalendarEvent
        const event = item as CalendarEvent;
        className += ` type-${event.type || 'event'}`;
        text = event.title;
        title = `${t(`team_calendar.${event.type || 'event'}`)}: ${event.title}`;
        handler = `title="${title}"`;
    } else if ('name' in item && 'date' in item) { // PublicHoliday
        className += ' type-public-holiday';
        text = item.name;
        title = `${t('team_calendar.public_holiday')}: ${item.name}`;
        handler = `title="${title}"`;
    }

    return `<div class="${className}" ${handler}>${text}</div>`;
}

// New helper to get all items for a given date string (YYYY-MM-DD)
function getItemsForDay(dayDateString: string) {
    const dayDate = new Date(dayDateString + 'T12:00:00Z');
    const items: (Task | TimeOffRequest | CalendarEvent | {date: string, name: string})[] = [];
    
    // Tasks with due date
    items.push(...state.tasks.filter(t => t.workspaceId === state.activeWorkspaceId && t.dueDate === dayDateString));
    
    // Time off requests spanning this day
    items.push(...state.timeOffRequests.filter(to => {
        if (to.workspaceId !== state.activeWorkspaceId || to.status !== 'approved') return false;
        const start = new Date(to.startDate + 'T00:00:00Z');
        const end = new Date(to.endDate + 'T23:59:59Z');
        return dayDate >= start && dayDate <= end;
    }));
    
    // Calendar events spanning this day
    items.push(...state.calendarEvents.filter(e => {
        if (e.workspaceId !== state.activeWorkspaceId) return false;
        const start = new Date(e.startDate + 'T00:00:00Z');
        const end = new Date(e.endDate + 'T23:59:59Z');
        return dayDate >= start && dayDate <= end;
    }));
    
    // Public holidays
    items.push(...state.publicHolidays.filter(h => h.date === dayDateString));
    
    return items;
}


// --- MONTH VIEW ---
function renderMonthView(year: number, month: number) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayOfMonth = new Date(year, month - 1, 1);
    // Sunday is 0, so we adjust to make Monday 0
    const firstDayIndex = (firstDayOfMonth.getDay() + 6) % 7; 
    const today = new Date();

    let daysHtml = '';
    for (let i = 0; i < firstDayIndex; i++) {
        daysHtml += `<div class="calendar-day other-month"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dayDateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = today.getFullYear() === year && today.getMonth() === month - 1 && today.getDate() === day;
        const itemsForDay = getItemsForDay(dayDateString);

        daysHtml += `
            <div class="calendar-day ${isToday ? 'today' : ''}">
                <div class="day-number">${day}</div>
                <div class="calendar-items">
                    ${itemsForDay.map(renderCalendarItem).join('')}
                </div>
            </div>
        `;
    }

    const totalCells = firstDayIndex + daysInMonth;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let i = 0; i < remainingCells; i++) {
        daysHtml += `<div class="calendar-day other-month"></div>`;
    }

    return `
        <div class="calendar-grid-month">
            <div class="calendar-weekday">${t('calendar.weekdays.mon')}</div>
            <div class="calendar-weekday">${t('calendar.weekdays.tue')}</div>
            <div class="calendar-weekday">${t('calendar.weekdays.wed')}</div>
            <div class="calendar-weekday">${t('calendar.weekdays.thu')}</div>
            <div class="calendar-weekday">${t('calendar.weekdays.fri')}</div>
            <div class="calendar-weekday">${t('calendar.weekdays.sat')}</div>
            <div class="calendar-weekday">${t('calendar.weekdays.sun')}</div>
            ${daysHtml}
        </div>
    `;
}

// --- WEEK VIEW ---
function renderWeekView(currentDate: Date) {
    const weekDays: Date[] = [];
    const dayOfWeek = (currentDate.getDay() + 6) % 7; // Monday = 0
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
            <div class="week-view-day-column">
                <div class="week-view-day-header">
                    <strong>${t(`calendar.weekdays.${dayDate.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase()}`)}</strong>
                    <span>${dayDate.getDate()}</span>
                </div>
                <div class="calendar-items">
                    ${itemsForDay.map(renderCalendarItem).join('')}
                </div>
            </div>
        `;
    }
    
    return `<div class="calendar-grid-week">${daysHtml}</div>`;
}

// --- DAY VIEW ---
function renderDayView(currentDate: Date) {
    const dayDateString = currentDate.toISOString().slice(0, 10);
    const itemsForDay = getItemsForDay(dayDateString);
    
    return `
        <div class="day-view-list">
            ${itemsForDay.length > 0
                ? itemsForDay.map(renderCalendarItem).join('')
                : `<div class="empty-state" style="padding: 2rem; border: none;"><p>${t('misc.no_events_for_day')}</p></div>`
            }
        </div>
    `;
}

export async function TeamCalendarPage() {
    const { teamCalendarDate, teamCalendarView } = state.ui;
    const currentDate = new Date(teamCalendarDate + 'T12:00:00Z');
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;

    // Fetch holidays for current, previous and next year to handle navigation
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
        <div>
            <div class="kanban-header">
                <h2>${t('team_calendar.title')}</h2>
                <div>
                     <button class="btn btn-secondary" data-modal-target="addTimeOffRequest">
                        <span class="material-icons-sharp">flight_takeoff</span>
                        ${t('team_calendar.add_leave')}
                    </button>
                    <button class="btn btn-primary" data-modal-target="addCalendarEvent">
                        <span class="material-icons-sharp">add</span> ${t('team_calendar.add_event')}
                    </button>
                </div>
            </div>
            <div class="card">
                <div class="calendar-header">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <button class="btn-icon" data-calendar-nav="prev" data-target-calendar="team" aria-label="${t('calendar.prev_month')}"><span class="material-icons-sharp">chevron_left</span></button>
                        <button class="btn-icon" data-calendar-nav="next" data-target-calendar="team" aria-label="${t('calendar.next_month')}"><span class="material-icons-sharp">chevron_right</span></button>
                         <h4 class="calendar-title">${viewTitle}</h4>
                    </div>
                    <div class="view-switcher">
                        <button class="btn btn-secondary" data-team-calendar-view="month" ${teamCalendarView === 'month' ? 'disabled' : ''}>${t('calendar.month_view')}</button>
                        <button class="btn btn-secondary" data-team-calendar-view="week" ${teamCalendarView === 'week' ? 'disabled' : ''}>${t('calendar.week_view')}</button>
                        <button class="btn btn-secondary" data-team-calendar-view="day" ${teamCalendarView === 'day' ? 'disabled' : ''}>${t('calendar.day_view')}</button>
                    </div>
                </div>
                ${viewContent}
            </div>
        </div>
    `;
}
