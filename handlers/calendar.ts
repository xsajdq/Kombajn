

import { getState, setState } from '../state.ts';
import { apiFetch } from '../services/api.ts';

interface NagerHoliday {
    date: string; // "2024-01-01"
    localName: string;
    name: string;
    countryCode: string;
    fixed: boolean;
    global: boolean;
    counties: string[] | null;
    launchYear: number | null;
    types: string[];
}


export async function fetchPublicHolidays(year: number) {
    const state = getState();
    // Check if we already have holidays for this year to avoid re-fetching
    const yearPrefix = year.toString();
    const alreadyFetched = state.publicHolidays.some(h => h.date.startsWith(yearPrefix));
    if (alreadyFetched) {
        return;
    }

    try {
        const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/PL`);
        if (!response.ok) {
            throw new Error(`Failed to fetch holidays for year ${year}`);
        }
        const holidays: NagerHoliday[] = await response.json();
        const formattedHolidays = holidays.map(h => ({
            date: h.date,
            name: h.localName
        }));
        
        // Add to state, preventing duplicates
        setState(prevState => {
            const existingDates = new Set(prevState.publicHolidays.map(h => h.date));
            const newHolidays = formattedHolidays.filter(h => !existingDates.has(h.date));
            return {
                publicHolidays: [...prevState.publicHolidays, ...newHolidays]
            };
        }, []);
    } catch (error) {
        console.error("Error fetching public holidays:", error);
        // Silently fail, the calendar will just not show holidays.
    }
}

export async function fetchTeamCalendarDataForWorkspace(workspaceId: string) {
    console.log(`Fetching team calendar data for workspace ${workspaceId}...`);
    try {
        const data = await apiFetch(`/api?action=dashboard-data&workspaceId=${workspaceId}&teamCalendarOnly=true`);
        if (!data) throw new Error("Team Calendar data fetch returned null.");

        setState(prevState => ({
            tasks: [...prevState.tasks.filter(i => i.workspaceId !== workspaceId), ...(data.tasks || [])],
            calendarEvents: [...prevState.calendarEvents.filter(i => i.workspaceId !== workspaceId), ...(data.calendarEvents || [])],
            timeLogs: [...prevState.timeLogs.filter(i => i.workspaceId !== workspaceId), ...(data.timeLogs || [])],
            ui: {
                ...prevState.ui,
                teamCalendar: { ...prevState.ui.teamCalendar, isLoading: false },
            }
        }), ['page']);
        console.log(`Successfully fetched team calendar data for workspace ${workspaceId}.`);
    } catch (error) {
        console.error("Failed to fetch team calendar data:", error);
        setState(prevState => ({
            ui: {
                ...prevState.ui,
                teamCalendar: { ...prevState.ui.teamCalendar, isLoading: false, loadedWorkspaceId: null }
            }
        }), ['page']);
    }
}