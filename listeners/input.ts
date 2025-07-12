
import { handleMentionInput } from './mentions.ts';

export function handleInput(e: Event) {
    const target = e.target as HTMLElement;

    // Handle mention input on designated rich text fields
    if (target.matches('#chat-message-input, #task-comment-input')) {
        handleMentionInput(target);
    }
}
