
import { state } from '../state.ts';
import { t } from '../i18n.ts';
import type { Task, TimeOffRequest, CalendarEvent } from '../types.ts';

// Local helper function to render a single item in the calendar
function renderCalendarItem(item: Task | TimeOffRequest | CalendarEvent | { date: string, name: string }) {
    let className = 'team-calendar-item';
    let text = '';
    let handler = '';
    
    // Task
    if ('status' in item && 'projectId' in item) { 
        className += ` type-task clickable`;
        text = item.name;
        handler = `data-task-id="${item.id}"`;
    // Time Off Request
    } else if ('userId' in item && 'rejectionReason' in item) {
        const user = state.users.find(u => u.id === item.userId);
        const userName = user?.name || user?.initials || 'User';
        // Simple hash to get a consistent color for a user
        const colorIndex = item.userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 8;
        className += ` type-timeoff color-${colorIndex}`;
        text = `${userName}`;
        handler = `title="${userName}: ${t(`team_calendar.leave_type_${item.type}`)}"`;
    // Calendar Event
    } else if ('title' in item && 'isAllDay' in item) { 
        const event = item as CalendarEvent;
        if (event.type === 'on-call') {
            className += ' type-on-call';
            text = `${t('team_calendar.on_call')}: ${event.title}`;
        } else {
            className += ' type-event';
            text = event.title;
        }
    // Public Holiday
    } else if ('name' in item && 'date' in item) { 
        className += ' type-public-holiday';
        text = item.name;
    }

    return `<div class="${className}" ${handler}>${text}</div>`;
}

const POLISH_PUBLIC_HOLIDAYS_2024 = [
    { date: '2024-01-01', name: 'Nowy Rok' },
    { date: '2024-01-06', name: 'Święto Trzech Króli' },
    { date: '2024-03-31', name: 'Wielkanoc' },
    { date: '2024-04-01', name: 'Poniedziałek Wielkanocny' },
    { date: '2024-05-01', name: 'Święto Pracy' },
    { date: '2024-05-03', name: 'Święto Konstytucji 3 Maja' },
    { date: '2024-05-19', name: 'Zesłanie Ducha Świętego' },
    { date: '2024-05-30', name: 'Boże Ciało' },
    { date: '2024-08-15', name: 'Wniebowzięcie Najświętszej Maryi Panny' },
    { date: '2024-11-01', name: 'Wszystkich Świętych' },
    { date: '2024-11-11', name: 'Narodowe Święto Niepodległości' },
    { date: '2024-12-25', name: 'Boże Narodzenie' },
    { date: '2024-12-26', name: 'Drugi dzień Świąt Bożego Narodzenia' }
];

export function TeamCalendarPage() {
    const [year, month] = state.ui.teamCalendarDate.split('-').map(Number);
    const currentDate = new Date(year, month - 1, 1);
    const monthName = currentDate.toLocaleString(state.settings.language, { month: 'long', year: 'numeric' });
    const today = new Date();
    
    // 1. Aggregate all data for the workspace
    const tasks = state.tasks.filter(t => t.workspaceId === state.activeWorkspaceId && t.dueDate);
    const timeOffs = state.timeOffRequests.filter(to => to.workspaceId === state.activeWorkspaceId && to.status === 'approved');
    const events = state.calendarEvents.filter(e => e.workspaceId === state.activeWorkspaceId);
    const holidays = POLISH_PUBLIC_HOLIDAYS_2024;

    // 2. Build calendar grid structure
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayIndex = new Date(year, month - 1, 1).getDay(); // Sunday - 0
    let daysHtml = '';

    for (let i = 0; i < firstDayIndex; i++) {
        daysHtml += `<div class="calendar-day other-month"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dayDate = new Date(year, month - 1, day);
        const dayDateString = dayDate.toISOString().slice(0, 10);
        
        const isToday = today.getFullYear() === year && today.getMonth() === month - 1 && today.getDate() === day;
        
        const itemsForDay: (Task | TimeOffRequest | CalendarEvent | {date: string, name: string})[] = [];
        
        itemsForDay.push(...tasks.filter(t => t.dueDate === dayDateString));
        itemsForDay.push(...timeOffs.filter(to => {
            const start = new Date(to.startDate + 'T00:00:00');
            const end = new Date(to.endDate + 'T23:59:59');
            return dayDate >= start && dayDate <= end;
        }));
        itemsForDay.push(...events.filter(e => {
            const start = new Date(e.startDate + 'T00:00:00');
            const end = new Date(e.endDate + 'T23:59:59');
            return dayDate >= start && dayDate <= end;
        }));
        itemsForDay.push(...holidays.filter(h => h.date === dayDateString));

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

    // 3. Final page render
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
                    <button class="btn-icon" data-calendar-nav="prev" data-target-calendar="team" aria-label="${t('calendar.prev_month')}"><span class="material-icons-sharp">chevron_left</span></button>
                    <h4 class="calendar-title">${monthName}</h4>
                    <button class="btn-icon" data-calendar-nav="next" data-target-calendar="team" aria-label="${t('calendar.next_month')}"><span class="material-icons-sharp">chevron_right</span></button>
                </div>
                <div class="calendar-grid">
                    <div class="calendar-weekday">${t('calendar.weekdays.sun')}</div>
                    <div class="calendar-weekday">${t('calendar.weekdays.mon')}</div>
                    <div class="calendar-weekday">${t('calendar.weekdays.tue')}</div>
                    <div class="calendar-weekday">${t('calendar.weekdays.wed')}</div>
                    <div class="calendar-weekday">${t('calendar.weekdays.thu')}</div>
                    <div class="calendar-weekday">${t('calendar.weekdays.fri')}</div>
                    <div class="calendar-weekday">${t('calendar.weekdays.sat')}</div>
                    ${daysHtml}
                </div>
            </div>
        </div>
    `;
}
