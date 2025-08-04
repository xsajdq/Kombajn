
import { state } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
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
        updateUI(['page']);
    } catch (error) {
        console.error("Failed to create project section:", error);
        alert("Could not create the project section.");
    }
}

export async function handleRenameProjectSection(id: string, newName: string) {
    const section = state.projectSections.find(ps => ps.id === id);
    if (!section || !newName.trim()) return;

    const originalName = section.name;
    section.name = newName.trim();
    updateUI(['page']);

    try {
        await apiPut('project_sections', { id, name: newName.trim() });
    } catch (error) {
        console.error("Failed to update project section:", error);
        alert("Could not update the project section.");
        section.name = originalName;
        updateUI(['page']);
    }
}
