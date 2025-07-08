
import { state, saveState } from './state.ts';
import { setupEventListeners } from './eventListeners.ts';
import { renderApp } from './app-renderer.ts';
import { getTaskCurrentTrackedSeconds, formatDuration } from './utils.ts';
import { closeSidePanels, closeModal } from './handlers/ui.ts';

// --- Real-time collaboration simulation ---
window.addEventListener('storage', (event) => {
  if (event.key === 'appState' && event.newValue) {
    // Another tab updated the state. We'll parse the new state and merge it 
    // into our current in-memory state. This provides a "real-time" update feel.
    try {
        const newState = JSON.parse(event.newValue);
        Object.assign(state, newState); // Shallow merge is sufficient here
        renderApp();
    } catch (e) {
        console.error("Failed to parse state from storage event, reloading.", e);
        // As a fallback, reload the page to ensure consistency
        window.location.reload();
    }
  }
});


// --- INITIALIZATION ---
function init() {
    setupEventListeners();
    renderApp();

    window.addEventListener('hashchange', () => { 
        closeSidePanels(false); // don't re-render here, renderApp below will do it
        closeModal(false); // don't re-render here
        renderApp(); 
    });
    window.addEventListener('popstate', () => { 
        closeSidePanels(false); // don't re-render here
        closeModal(false); // don't re-render here
        renderApp(); 
    });

    // Timer update interval
    setInterval(() => {
        if (Object.keys(state.activeTimers).length === 0 && !state.ui.openedProjectId && state.currentPage !== 'dashboard') return;

        Object.keys(state.activeTimers).forEach(taskId => {
            const task = state.tasks.find(t => t.id === taskId);
            if (task) {
                const currentSeconds = getTaskCurrentTrackedSeconds(task);
                const formattedTime = formatDuration(currentSeconds);
                 document.querySelectorAll(`[data-timer-task-id="${taskId}"] .task-tracked-time, [data-task-id="${taskId}"] .task-tracked-time`).forEach(el => {
                    if (el.textContent !== formattedTime) {
                       el.textContent = formattedTime;
                    }
                });
            }
        });

        if (state.ui.openedProjectId) {
            const projectTotalTimeEl = document.querySelector<HTMLElement>('.project-total-time');
            if (projectTotalTimeEl) {
                const projectTasks = state.tasks.filter(t => t.projectId === state.ui.openedProjectId);
                const totalSeconds = projectTasks.reduce((sum, task) => sum + getTaskCurrentTrackedSeconds(task), 0);
                const formattedTotalTime = formatDuration(totalSeconds);
                if (projectTotalTimeEl.textContent !== formattedTotalTime) {
                    projectTotalTimeEl.textContent = formattedTotalTime;
                }
            }
        }
    }, 1000);
}

init();