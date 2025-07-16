

import { handleMentionInput } from './mentions.ts';

export function handleInput(e: Event) {
    const target = e.target as HTMLElement;

    // Handle mention input on designated rich text fields
    if (target.matches('#chat-message-input, #task-comment-input')) {
        handleMentionInput(target);
    }

    const employeeSearch = target.closest<HTMLInputElement>('#employee-search');
    if (employeeSearch) {
        const query = employeeSearch.value.toLowerCase();
        const rows = document.querySelectorAll<HTMLElement>('.hr-table-body .hr-table-row');
        rows.forEach(row => {
            const name = row.dataset.userName || '';
            const email = row.dataset.userEmail || '';
            const isVisible = name.includes(query) || email.includes(query);
            row.classList.toggle('hidden', !isVisible);
        });
        return;
    }
}