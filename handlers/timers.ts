

import { state } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import { showModal, closeModal } from './ui.ts';
import type { TimeLog } from '../types.ts';
import { parseDurationStringToSeconds } from '../utils.ts';
import { apiPost, apiPut } from '../services/api.ts';

export function startTimer(taskId: string) {
    if (!state.activeTimers[taskId]) {
        state.activeTimers[taskId] = Date.now();
        updateUI(['page']);
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

export async function handleSaveTimeLogAndComment(taskId: string, trackedSeconds: number, comment?: string) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || !state.currentUser) return;

    const timeLogPayload = {
        workspaceId: task.workspaceId,
        taskId,
        userId: state.currentUser.id,
        trackedSeconds: Math.floor(trackedSeconds),
        createdAt: new Date().toISOString(),
        ...(comment && { comment }),
    };

    try {
        const [savedLog] = await apiPost('time_logs', timeLogPayload);
        state.timeLogs.push(savedLog);
        
        task.lastActivityAt = new Date().toISOString();
        await apiPut('tasks', { id: taskId, lastActivityAt: task.lastActivityAt });

        closeModal(false);
        updateUI(['modal', 'page', 'side-panel']);
    } catch(error) {
        console.error("Failed to save time log:", error);
        alert("Could not save time log. Please try again.");
    }
}

export async function handleSaveManualTimeLog(taskId: string, trackedSeconds: number, createdAt: string, comment?: string) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || !state.currentUser) {
        throw new Error("Task or user not found.");
    }

    if (trackedSeconds <= 0) {
        throw new Error("Invalid time amount.");
    }

    const timeLogPayload = {
        workspaceId: task.workspaceId,
        taskId,
        userId: state.currentUser.id,
        trackedSeconds: Math.floor(trackedSeconds),
        createdAt: createdAt,
        ...(comment && { comment }),
    };

    const [savedLog] = await apiPost('time_logs', timeLogPayload);
    state.timeLogs.push(savedLog);
    closeModal();
    updateUI(['page', 'side-panel']);
}

export function startGlobalTimer() {
    if (!state.ui.globalTimer.isRunning) {
        state.ui.globalTimer.isRunning = true;
        state.ui.globalTimer.startTime = Date.now();
        updateUI(['header']);
    }
}

export function stopGlobalTimer() {
    const { isRunning, startTime } = state.ui.globalTimer;
    if (isRunning && startTime) {
        const trackedSeconds = (Date.now() - startTime) / 1000;
        state.ui.globalTimer.isRunning = false;
        state.ui.globalTimer.startTime = null;
        showModal('assignGlobalTime', { trackedSeconds });
    }
}
