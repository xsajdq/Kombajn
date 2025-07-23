

import { state } from '../state.ts';
import { apiPost, apiFetch } from '../services/api.ts';
import { closeModal, openProjectPanel, closeSidePanels } from './ui.ts';
import type { Project, Task, ProjectMember, AiSuggestedTask } from '../types.ts';
import { renderApp } from '../app-renderer.ts';

export async function handlePlanProjectWithAi(name: string, clientId: string, goal: string) {
    const saveButton = document.getElementById('modal-save-btn');
    if (saveButton) {
        saveButton.textContent = 'Planning...';
        saveButton.setAttribute('disabled', 'true');
    }
    
    try {
        const suggestedTasks = await apiFetch('/api?action=plan-project', {
            method: 'POST',
            body: JSON.stringify({ goal }),
        });

        const projectData = {
            workspaceId: state.activeWorkspaceId,
            name: name,
            clientId: clientId,
            wikiContent: `Project Goal:\n\n> ${goal}`,
            privacy: 'private'
        };
        const [newProject] = await apiPost('projects', projectData);
        state.projects.push(newProject);

        const creatorMember: Omit<ProjectMember, 'id'> = {
            projectId: newProject.id,
            userId: state.currentUser!.id,
            role: 'admin'
        };
        const [savedCreatorMember] = await apiPost('project_members', creatorMember);
        state.projectMembers.push(savedCreatorMember);

        if (suggestedTasks && suggestedTasks.length > 0) {
            const taskPayloads = suggestedTasks.map((task: AiSuggestedTask) => ({
                workspaceId: state.activeWorkspaceId,
                projectId: newProject.id,
                name: task.name,
                description: task.description,
                status: 'backlog',
            }));
            const newTasks = await apiPost('tasks', taskPayloads);
            state.tasks.push(...newTasks);
        }

        closeModal(false);
        openProjectPanel(newProject.id);
        
    } catch (error) {
        console.error("Failed to plan project with AI:", error);
        alert(`Could not plan project: ${(error as Error).message}`);
        if (saveButton) {
            saveButton.textContent = 'Create Project';
            saveButton.removeAttribute('disabled');
        }
    }
}

export async function handleDeleteProject(projectId: string) {
    const projectIndex = state.projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) return;

    // --- Create snapshots for potential revert ---
    const [removedProject] = state.projects.splice(projectIndex, 1);
    const originalTasks = [...state.tasks];
    const originalProjectMembers = [...state.projectMembers];
    
    // --- Optimistic update ---
    state.tasks = state.tasks.filter(t => t.projectId !== projectId);
    state.projectMembers = state.projectMembers.filter(pm => pm.projectId !== projectId);
    closeSidePanels(); // This will trigger a re-render

    try {
        await apiFetch(`/api?action=data&resource=projects`, {
            method: 'DELETE',
            body: JSON.stringify({ id: projectId }),
        });
        // Backend's cascading delete will handle related items in the DB.
    } catch (error) {
        console.error("Failed to delete project:", error);
        alert("Could not delete the project from the server. Reverting changes.");
        // --- Revert state on failure ---
        state.projects.splice(projectIndex, 0, removedProject);
        state.tasks = originalTasks;
        state.projectMembers = originalProjectMembers;
        renderApp();
    }
}