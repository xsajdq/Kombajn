// listeners/scroll.ts
import { getState } from '../state.ts';
import { loadMoreTasks } from '../handlers/tasks.ts';

export function handleScroll(e: Event) {
    const mainContent = e.target as HTMLElement;
    // Ensure we are only acting on the main scrollable area
    if (mainContent.tagName !== 'MAIN') {
        return;
    }

    const state = getState();
    if (state.currentPage !== 'tasks') {
        return;
    }

    const { isLoading, isLoadingMore, hasMore } = state.ui.tasks;

    if (isLoading || isLoadingMore || !hasMore) {
        return;
    }

    // Check if the user has scrolled to the bottom of the main content area
    const scrollThreshold = 100; // pixels from the bottom
    const isAtBottom = mainContent.scrollHeight - mainContent.scrollTop <= mainContent.clientHeight + scrollThreshold;

    if (isAtBottom) {
        loadMoreTasks();
    }
}
