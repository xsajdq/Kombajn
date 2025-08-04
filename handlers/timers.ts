



import { getState, setState } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import { showModal, closeModal } from './ui.ts';
import type { TimeLog } from '../types.ts';
import { parseDurationStringToSeconds } from '../utils.ts';
import { apiPost, apiPut } from '../services/api.ts';
import { t } from '../i18n.ts';

export function startTimer(taskId: string) {
    const state = getState();
    if (!state.activeTimers[taskId]) {
        setState({ activeTimers: { ...state.activeTimers, [taskId]: Date.now() } }, ['page']);
    }
}

export function stopTimer(taskId: string) {
    const state = getState();
    if (state.activeTimers[taskId]) {
        const startTime = state.activeTimers[taskId];
        const trackedSeconds = (Date.now() - startTime) / 1000;
        const newActiveTimers = { ...state.activeTimers };
        delete newActiveTimers[taskId];
        setState({ activeTimers: newActiveTimers }, []);
        showModal('addCommentToTimeLog', { taskId, trackedSeconds });
    }
}

export async function handleSaveTimeLogAndComment(taskId: string, trackedSeconds: number, comment?: string) {
    const state = getState();
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
        
        const updatedTask = { ...task, lastActivityAt: new Date().toISOString() };
        setState(prevState => ({
            timeLogs: [...prevState.timeLogs, savedLog],
            tasks: prevState.tasks.map(t => t.id === taskId ? updatedTask : t)
        }), []);
        
        await apiPut('tasks', { id: taskId, lastActivityAt: updatedTask.lastActivityAt });

        closeModal(false);
        updateUI(['modal', 'page', 'side-panel']);
    } catch(error) {
        console.error("Failed to save time log:", error);
        alert(t('errors.time_log_save_failed'));
    }
}

export async function handleSaveManualTimeLog(taskId: string, trackedSeconds: number, createdAt: string, comment?: string) {
    const state = getState();
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || !state.currentUser) {
        throw new Error(t('errors.task_or_user_not_found'));
    }

    if (trackedSeconds <= 0) {
        throw new Error(t('errors.invalid_time_amount'));
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
    setState(prevState => ({ timeLogs: [...prevState.timeLogs, savedLog] }), []);
    closeModal();
    updateUI(['page', 'side-panel']);
}

export function startGlobalTimer() {
    const state = getState();
    if (!state.ui.globalTimer.isRunning) {
        setState(prevState => ({
            ui: {
                ...prevState.ui,
                globalTimer: { isRunning: true, startTime: Date.now() }
            }
        }), ['header']);
    }
}

export function stopGlobalTimer() {
    const state = getState();
    const { isRunning, startTime } = state.ui.globalTimer;
    if (isRunning && startTime) {
        const trackedSeconds = (Date.now() - startTime) / 1000;
        setState(prevState => ({
            ui: {
                ...prevState.ui,
                globalTimer: { isRunning: false, startTime: null }
            }
        }), []);
        showModal('assignGlobalTime', { trackedSeconds });
    }
}