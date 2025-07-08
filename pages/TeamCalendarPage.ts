



import { state } from '../state.ts';
import { t } from '../i18n.ts';
import type { Task, TimeOffRequest, CalendarEvent } from '../types.ts';

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

function renderCalendarEvent(item: Task | TimeOffRequest | CalendarEvent | { date: string, name: string }) {
    let className = 'team-calendar-event';
    let text = '';
    let handler = '';
    
    if ('status' in item && 'projectId' in item) { // Task
        className += ` type-task priority-${item.priority || 'low'}`;
        text = item.name;
        handler = `data-task-id="${item.id}"`;
    } else if ('userId' in item) { // TimeOffRequest
        const user = state.users.find(u => u.id === item.userId);
        const userName = user?.name || user?.initials || 'User';
        className += ` type-timeoff user-${item.userId}`;
        text = `${userName} - ${t(`team_calendar.leave_type_${item.type}`)}`;
    } else if ('title' in item) { // CalendarEvent
        const event = item as CalendarEvent;
        if (event.type === 'on-call') {
            className += ' type-on-call';
            text = `${t('team_calendar.on_call')}: ${event.title}`;
        } else {
            className += ' type-event';
            text = event.title;
        }
    } else { // Public Holiday
        className += ' type-public-holiday';
        text = item.name;
    }

    return `<div class="${className}" ${handler} title="${text}">${text}</div>`;
}

export function TeamCalendarPage() {
    const [year, month] = state.ui.teamCalendarDate.split('-').map(Number);
    const currentDate = new Date(year, month - 1, 1);
    const monthName = currentDate.toLocaleString(state.settings.language, { month: 'long', year: 'numeric' });

    // Aggregate all events for the current month view
    const tasks = state.tasks.filter(t => t.dueDate?.startsWith(state.ui.teamCalendarDate));
    const timeOffs = state.timeOffRequests.filter(to => to.startDate.startsWith(state.ui.teamCalendarDate) && to.status === 'approved'); // Only show approved
    const events = state.calendarEvents.filter(e => e.startDate.startsWith(state.ui.teamCalendarDate));
    const holidays = POLISH_PUBLIC_HOLIDAYS_2024.filter(h => h.date.startsWith(state.ui.teamCalendarDate));
    
    const allItems: (Task | TimeOffRequest | CalendarEvent | {date: string, name: string})[] = [...tasks, ...timeOffs, ...events, ...holidays];

    const itemsByDay: Record<number, (Task | TimeOffRequest | CalendarEvent | {date: string, name: string})[]> = {};
    allItems.forEach(item => {
        const dateStr = 'date' in item ? item.date : ('dueDate' in item && item.dueDate ? item.dueDate : item.startDate);
        if (dateStr) {
            const day = parseInt(dateStr.slice(8, 10), 10);
            if (!itemsByDay[day]) {
                itemsByDay[day] = [];
            }
            itemsByDay[day].push(item);
        }
    });

    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayIndex = new Date(year, month - 1, 1).getDay(); // Sunday - 0, Monday - 1
    let daysHtml = '';

    for (let i = 0; i < firstDayIndex; i++) {
        daysHtml += `<div class="calendar-day other-month"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const itemsForDay = itemsByDay[day] || [];
        daysHtml += `
            <div class="calendar-day">
                <div class="day-number">${day}</div>
                <div class="calendar-tasks">
                    ${itemsForDay.map(renderCalendarEvent).join('')}
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
                <div class="calendar-grid team-calendar-grid">
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