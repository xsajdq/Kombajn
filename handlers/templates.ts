// handlers/templates.ts
import { getState, setState } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import { apiPost, apiPut } from '../services/api.ts';
import type { ChecklistTemplate, ChecklistTemplateItem } from '../types.ts';

export async function handleSaveChecklistTemplate(templateId?: string) {
    const state = getState();
    const { activeWorkspaceId } = state;
    if (!activeWorkspaceId) return;

    const form = document.getElementById('checklist-template-form') as HTMLFormElement;
    const name = (form.querySelector('#template-name') as HTMLInputElement).value.trim();
    if (!name) return;

    const items: ChecklistTemplateItem[] = [];
    form.querySelectorAll('.template-item-row').forEach(row => {
        const text = (row.querySelector('input') as HTMLInputElement).value.trim();
        if (text) {
            items.push({ text });
        }
    });

    const payload = {
        workspaceId: activeWorkspaceId,
        name,
        items,
    };

    try {
        if (templateId) {
            const [updatedTemplate] = await apiPut('checklist_templates', { ...payload, id: templateId });
            setState(prevState => ({
                checklistTemplates: prevState.checklistTemplates.map(t => t.id === templateId ? updatedTemplate : t)
            }), ['page']);
        } else {
            const [newTemplate] = await apiPost('checklist_templates', payload);
            setState(prevState => ({
                checklistTemplates: [...prevState.checklistTemplates, newTemplate]
            }), ['page']);
        }

        // Reset the form view after saving
        const container = document.getElementById('checklist-template-edit-container');
        if (container) {
            container.innerHTML = '';
        }

    } catch (error) {
        console.error("Failed to save checklist template:", error);
        alert("Could not save the template.");
    }
}