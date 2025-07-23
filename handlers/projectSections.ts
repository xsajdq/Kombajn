
import { state } from '../state.ts';
import { renderApp } from '../app-renderer.ts';
import { apiPost, apiPut, apiFetch } from '../services/api.ts';
import type { ProjectSection } from '../types.ts';

export async function handleCreateProjectSection(projectId: string, name: string) {
    if (!state.activeWorkspaceId || !name.trim() || !projectId) return;

    const payload: Omit<ProjectSection, 'id'> = {
        workspaceId: state.activeWorkspaceId,
        projectId: projectId,
        name: name.trim(),
    };

    try {
        const [newSection] = await apiPost('project_sections', payload);
        state.projectSections.push(newSection);
        renderApp();
    } catch (error) {
        console.error("Failed to create project section:", error);
        alert("Could not create the project section.");
    }
}

export async function handleRenameProjectSection(id: string, newName: string) {
    const section = state.projectSections.find(ps => ps.id === id);
    if (!section || !newName.trim()) return;

    const originalName = section.name;
    section.name = newName.trim(); // Optimistic update
    renderApp();

    try {
        await apiPut('project_sections', { id, name: newName.trim() });
    } catch (error) {
        console.error("Failed to update project section:", error);
        alert("Could not update the project section.");
        section.name = originalName; // Revert
        renderApp();
    }
}

export async function handleDeleteProjectSection(id: string) {
    if (!confirm("Are you sure you want to delete this section? Tasks in this section will not be deleted.")) {
        return;
    }

    const sectionIndex = state.projectSections.findIndex(ps => ps.id === id);
    if (sectionIndex === -1) return;

    const [removedSection] = state.projectSections.splice(sectionIndex, 1);
    // Optimistically update tasks that were in this section
    state.tasks.forEach(task => {
        if (task.projectSectionId === id) {
            task.projectSectionId = null;
        }
    });
    renderApp();

    try {
        await apiFetch('/api?action=data&resource=project_sections', {
            method: 'DELETE',
            body: JSON.stringify({ id }),
        });
    } catch (error) {
        console.error("Failed to delete project section:", error);
        alert("Could not delete the project section.");
        // Revert
        state.projectSections.splice(sectionIndex, 0, removedSection);
        // This is complex to revert, so a refresh might be better
        renderApp();
    }
}