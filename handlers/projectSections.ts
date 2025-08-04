
import { getState, setState } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import { apiPost, apiPut, apiFetch } from '../services/api.ts';
import type { ProjectSection } from '../types.ts';
import { closeModal } from './ui.ts';
import { handleOptimisticDelete } from './generic.ts';

export async function handleCreateProjectSection(projectId: string, name: string) {
    const state = getState();
    if (!state.activeWorkspaceId || !name.trim() || !projectId) return;

    const payload: Omit<ProjectSection, 'id'> = {
        workspaceId: state.activeWorkspaceId,
        projectId: projectId,
        name: name.trim(),
    };

    try {
        const [newSection] = await apiPost('project_sections', payload);
        setState(prevState => ({ projectSections: [...prevState.projectSections, newSection] }), ['page']);
        closeModal();
    } catch (error) {
        console.error("Failed to create project section:", error);
        alert("Could not create the project section.");
    }
}

export async function handleRenameProjectSection(id: string, newName: string) {
    const state = getState();
    const section = state.projectSections.find(ps => ps.id === id);
    if (!section || !newName.trim()) return;

    const originalName = section.name;
    setState(prevState => ({
        projectSections: prevState.projectSections.map(ps => ps.id === id ? { ...ps, name: newName.trim() } : ps)
    }), ['page']);

    try {
        await apiPut('project_sections', { id, name: newName.trim() });
    } catch (error) {
        console.error("Failed to update project section:", error);
        alert("Could not update the project section.");
        setState(prevState => ({
            projectSections: prevState.projectSections.map(ps => ps.id === id ? { ...ps, name: originalName } : ps)
        }), ['page']);
    }
}

export function handleDeleteProjectSection(id: string) {
    handleOptimisticDelete('project_sections', id, 'Are you sure you want to delete this section? Tasks in this section will not be deleted.');
}
