
export function handleMouseDown(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();

    // If the target is an editable element, let the default browser behavior happen.
    // This prevents the element from losing focus.
    if (tagName === 'input' || tagName === 'textarea' || target.isContentEditable) {
        return;
    }

    const mentionItem = target.closest('.mention-item');
    if (mentionItem) {
        e.preventDefault();
        return;
    }

    const multiSelectDropdown = target.closest('.multiselect-dropdown');
    if (multiSelectDropdown) {
        // For other interactive elements inside a dropdown (like list items),
        // prevent default to keep the original input focused.
        e.preventDefault();
    }
}
