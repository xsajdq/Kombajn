
import { handleMouseDown } from './listeners/focus.ts';
import { handleKeydown } from './listeners/keydown.ts';
import { handleInput } from './listeners/input.ts';
import { handleSubmit } from './listeners/submit.ts';
import { handleClick } from './listeners/click.ts';
import { handleChange } from './listeners/change.ts';
import { handleDragStart, handleDragEnd, handleDragOver, handleDrop } from './listeners/dnd.ts';

export function setupEventListeners() {
    const app = document.getElementById('app')!;

    app.addEventListener('mousedown', (e) => handleMouseDown(e as MouseEvent));
    window.addEventListener('keydown', (e) => handleKeydown(e as KeyboardEvent));
    app.addEventListener('input', (e) => handleInput(e as Event));
    app.addEventListener('submit', (e) => handleSubmit(e as SubmitEvent));
    app.addEventListener('click', (e) => handleClick(e as MouseEvent));
    app.addEventListener('change', (e) => handleChange(e as Event));

    // Drag and Drop for Kanban board & Dashboard widgets
    app.addEventListener('dragstart', handleDragStart);
    app.addEventListener('dragend', handleDragEnd);
    app.addEventListener('dragover', handleDragOver);
    app.addEventListener('drop', handleDrop);
}