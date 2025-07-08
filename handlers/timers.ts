
import { state, saveState, generateId } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import { showModal, closeModal } from './ui.ts';
import type { TimeLog } from '../types.ts';
import { parseDurationStringToSeconds } from '../utils.ts';

export function startTimer(taskId: string) {
    if (!state.activeTimers[taskId]) {
        state.activeTimers[taskId] = Date.now();
        renderApp();
    }
}

export function stopTimer(taskId: string) {
    if (state.activeTimers[taskId]) {
        const startTime = state.activeTimers[taskId];
        const trackedSeconds = (Date.now() - startTime) / 1000;
        delete state.activeTimers[taskId];
        showModal('addCommentToTimeLog', { taskId, trackedSeconds });
    }
}

export function handleSaveTimeLogAndComment(taskId: string, trackedSeconds: number, comment?: string) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || !state.currentUser) return;

    const newTimeLog: TimeLog = {
        id: generateId(),
        workspaceId: task.workspaceId,
        taskId,
        userId: state.currentUser.id,
        trackedSeconds,
        createdAt: new Date().toISOString(),
        ...(comment && { comment }),
    };
    state.timeLogs.push(newTimeLog);
    closeModal();
}

export function handleSaveManualTimeLog(taskId: string, timeString: string, dateString: string, comment?: string) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || !state.currentUser) return;

    const trackedSeconds = parseDurationStringToSeconds(timeString);
    if (trackedSeconds <= 0) {
        alert("Invalid time format or amount. Please use a format like '2h 30m'.");
        return;
    }

    const newTimeLog: TimeLog = {
        id: generateId(),
        workspaceId: task.workspaceId,
        taskId,
        userId: state.currentUser.id,
        trackedSeconds,
        createdAt: new Date(dateString).toISOString(),
        ...(comment && { comment }),
    };
    state.timeLogs.push(newTimeLog);
    // The calling function `handleFormSubmit` will close the modal.
}
