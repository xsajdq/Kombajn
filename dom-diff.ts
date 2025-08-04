// dom-diff.ts

function isFormElement(node: Node): node is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
    return node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement;
}

function updateAttributes(oldElement: Element, newElement: Element) {
    const oldAttrs = new Map<string, string>();
    for (const attr of oldElement.attributes) {
        oldAttrs.set(attr.name, attr.value);
    }

    const newAttrs = new Map<string, string>();
    for (const attr of newElement.attributes) {
        newAttrs.set(attr.name, attr.value);
    }

    // Remove attributes that are no longer present
    for (const [name] of oldAttrs) {
        if (!newAttrs.has(name)) {
            oldElement.removeAttribute(name);
        }
    }

    // Add or update attributes
    for (const [name, value] of newAttrs) {
        if (!oldAttrs.has(name) || oldAttrs.get(name) !== value) {
            oldElement.setAttribute(name, value);
        }
    }
}

export function diff(oldNode: Node, newNode: Node) {
    // If the new node is essentially empty but the old one isn't, clear the old node.
    if (!newNode.firstChild && oldNode.firstChild) {
        while (oldNode.firstChild) {
            oldNode.removeChild(oldNode.firstChild);
        }
        return;
    }

    // If nodes are identical, do nothing.
    if (oldNode.isEqualNode(newNode)) {
        return;
    }

    // Handle different node types or different tag names for elements
    if (oldNode.nodeType !== newNode.nodeType || (oldNode.nodeType === Node.ELEMENT_NODE && (oldNode as Element).tagName !== (newNode as Element).tagName)) {
        oldNode.parentNode?.replaceChild(newNode.cloneNode(true), oldNode);
        return;
    }

    // Handle text nodes
    if (oldNode.nodeType === Node.TEXT_NODE) {
        if (oldNode.textContent !== newNode.textContent) {
            oldNode.textContent = newNode.textContent;
        }
        return;
    }

    // We now know we have two element nodes of the same type
    const oldElement = oldNode as Element;
    const newElement = newNode as Element;

    // Preserve state of form elements and contenteditables if they are the active element
    if (document.activeElement === oldElement) {
        if (isFormElement(oldElement)) {
            const tempValue = (oldElement as HTMLInputElement).value;
            const tempChecked = (oldElement as HTMLInputElement).checked;
            const selectionStart = (oldElement as HTMLInputElement).selectionStart;
            const selectionEnd = (oldElement as HTMLInputElement).selectionEnd;
            
            updateAttributes(oldElement, newElement);
            
            (oldElement as HTMLInputElement).value = tempValue;
            (oldElement as HTMLInputElement).checked = tempChecked;
            if (selectionStart !== null && selectionEnd !== null) {
                 (oldElement as HTMLInputElement).setSelectionRange(selectionStart, selectionEnd);
            }
        } else if ((oldElement as HTMLElement).isContentEditable) {
            updateAttributes(oldElement, newElement);
            return; // Skip child diffing to preserve user input and cursor position
        }
    } else {
        updateAttributes(oldElement, newElement);
    }

    // Diff children
    const oldChildren = Array.from(oldNode.childNodes);
    const newChildren = Array.from(newNode.childNodes);
    const maxLength = Math.max(oldChildren.length, newChildren.length);

    for (let i = 0; i < maxLength; i++) {
        const oldChild = oldChildren[i];
        const newChild = newChildren[i];

        if (!oldChild && newChild) {
            oldNode.appendChild(newChild.cloneNode(true));
        } else if (oldChild && !newChild) {
            oldNode.removeChild(oldChild);
        } else if (oldChild && newChild) {
            diff(oldChild, newChild);
        }
    }
}
