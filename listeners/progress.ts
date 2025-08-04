import { handleTaskProgressUpdate } from '../handlers/tasks.ts';

let isDraggingProgress = false;
let progressBarElement: HTMLElement | null = null;
let draggedTaskId: string | null = null;

function handleProgressMouseMove(e: MouseEvent) {
    if (!isDraggingProgress || !progressBarElement) return;
    const rect = progressBarElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = Math.max(0, Math.min(100, (x / rect.width) * 100));
    
    const fill = progressBarElement.querySelector<HTMLElement>('#task-progress-fill');
    const thumb = progressBarElement.querySelector<HTMLElement>('#task-progress-thumb');
    const label = document.getElementById('task-progress-label');
    if (fill) fill.style.width = `${progress}%`;
    if (thumb) thumb.style.left = `${progress}%`;
    if (label) label.textContent = `${Math.round(progress)}%`;
}

async function handleProgressMouseUp(e: MouseEvent) {
    if (!isDraggingProgress || !progressBarElement || !draggedTaskId) return;

    const rect = progressBarElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = Math.max(0, Math.min(100, (x / rect.width) * 100));
    
    await handleTaskProgressUpdate(draggedTaskId, progress);

    isDraggingProgress = false;
    progressBarElement.classList.remove('dragging');
    progressBarElement = null;
    draggedTaskId = null;
    document.removeEventListener('mousemove', handleProgressMouseMove);
    document.removeEventListener('mouseup', handleProgressMouseUp);
}

export function handleProgressMouseDown(e: MouseEvent, target: HTMLElement) {
    isDraggingProgress = true;
    progressBarElement = target;
    draggedTaskId = target.dataset.taskId!;
    
    target.classList.add('dragging');

    handleProgressMouseMove(e);
    
    document.addEventListener('mousemove', handleProgressMouseMove);
    document.addEventListener('mouseup', handleProgressMouseUp);
}