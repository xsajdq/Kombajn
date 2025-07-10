import { state } from '../state.ts';

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
        const existingDates = new Set(state.publicHolidays.map(h => h.date));
        const newHolidays = formattedHolidays.filter(h => !existingDates.has(h.date));
        state.publicHolidays.push(...newHolidays);

        // No need to re-render here, the caller will do it.
    } catch (error) {
        console.error("Error fetching public holidays:", error);
        // Silently fail, the calendar will just not show holidays.
    }
}
