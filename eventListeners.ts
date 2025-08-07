

import { handleMouseDown } from './listeners/focus.ts';
import { handleKeydown } from './listeners/keydown.ts';
import { handleInput } from './listeners/input.ts';
import { handleSubmit } from './listeners/submit.ts';
import { handleClick } from './listeners/click.ts';
import { handleChange } from './listeners/change.ts';
import { handleDragStart, handleDragEnd, handleDragOver, handleDrop } from './handlers/dnd.ts';
import { handleMouseUp } from './listeners/selection.ts';
import { handleProgressMouseDown } from './listeners/progress.ts';
import { handleScroll } from './listeners/scroll.ts';

export function setupEventListeners() {
    // By attaching to document, we can catch events on dynamically created elements
    // like modals and context menus which are appended to the body.
    document.addEventListener('mousedown', (e) => {
        const target = e.target as HTMLElement;
        const progressBar = target.closest<HTMLElement>('#task-progress-bar');
        if (progressBar) {
            handleProgressMouseDown(e, progressBar);
        } else {
            handleMouseDown(e as MouseEvent)
        }
    });
    document.addEventListener('click', (e) => handleClick(e as MouseEvent));
    document.addEventListener('mouseup', handleMouseUp);
    
    // Keydown should be global anyway.
    window.addEventListener('keydown', (e) => handleKeydown(e as KeyboardEvent));

    // These can stay on #app as they are mostly for form elements within the main container.
    const app = document.getElementById('app')!;
    app.addEventListener('input', (e) => handleInput(e as Event));
    app.addEventListener('submit', (e) => handleSubmit(e as SubmitEvent));
    app.addEventListener('change', (e) => handleChange(e as Event));

    // Drag and Drop for Kanban board & Dashboard widgets
    app.addEventListener('dragstart', handleDragStart);
    app.addEventListener('dragend', handleDragEnd);
    app.addEventListener('dragover', handleDragOver);
    app.addEventListener('drop', handleDrop);
    
    // Add scroll listener in capture mode to detect scroll on the <main> element
    app.addEventListener('scroll', handleScroll, true);
}