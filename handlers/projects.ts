
import { state } from '../state.ts';
import { apiPost, apiFetch } from '../services/api.ts';
import { closeModal, openProjectPanel, closeSidePanels } from './ui.ts';
import { updateUI } from '../app-renderer.ts';
import type { Project, Task, ProjectMember, AiSuggestedTask } from '../types.ts';

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

    const [removedProject] = state.projects.splice(projectIndex, 1);
    const originalTasks = [...state.tasks];
    const originalProjectMembers = [...state.projectMembers];
    
    state.tasks = state.tasks.filter(t => t.projectId !== projectId);
    state.projectMembers = state.projectMembers.filter(pm => pm.projectId !== projectId);
    closeSidePanels();

    try {
        await apiFetch(`/api?action=data&resource=projects`, {
            method: 'DELETE',
            body: JSON.stringify({ id: projectId }),
        });
    } catch (error) {
        console.error("Failed to delete project:", error);
        alert("Could not delete the project from the server. Reverting changes.");
        state.projects.splice(projectIndex, 0, removedProject);
        state.tasks = originalTasks;
        state.projectMembers = originalProjectMembers;
        updateUI(['page']);
    }
}

export async function handleSyncProjectMembers(projectId: string, newMemberIds: Set<string>) {
    const existingMembers = state.projectMembers.filter(pm => pm.projectId === projectId);
    const existingMemberIds = new Set(existingMembers.map(pm => pm.userId));

    const membersToAdd = Array.from(newMemberIds).filter(id => !existingMemberIds.has(id));
    const membersToRemove = existingMembers.filter(pm => !newMemberIds.has(pm.userId));

    if (membersToAdd.length === 0 && membersToRemove.length === 0) {
        return;
    }

    const addPromises: Promise<any>[] = [];
    if (membersToAdd.length > 0) {
        const addPayloads = membersToAdd.map(userId => ({
            projectId,
            userId,
            role: 'editor' as const
        }));
        addPromises.push(apiPost('project_members', addPayloads));
    }

    const removePromises: Promise<any>[] = [];
    for (const member of membersToRemove) {
        removePromises.push(apiFetch('/api?action=data&resource=project_members', {
            method: 'DELETE',
            body: JSON.stringify({ id: member.id })
        }));
    }

    const removedMembersForRevert = state.projectMembers.filter(pm => membersToRemove.some(m => m.id === pm.id));
    state.projectMembers = state.projectMembers.filter(pm => !membersToRemove.some(m => m.id === pm.id));
    
    updateUI(['side-panel']);

    try {
        const [addResults] = await Promise.all([
            Promise.all(addPromises),
            Promise.all(removePromises),
        ]);
        
        if (addResults && addResults.length > 0) {
            const newMembers = addResults.flat().filter(Boolean);
            state.projectMembers.push(...newMembers);
        }
        
    } catch (error) {
        console.error("Failed to sync project members:", error);
        alert("Could not update project members. Please refresh the page.");
        state.projectMembers.push(...removedMembersForRevert);
    } finally {
        updateUI(['side-panel']);
    }
}

export async function handleSyncProjectTags(projectId: string, newTagIds: Set<string>) {
    const { activeWorkspaceId } = state;
    if (!activeWorkspaceId) return;

    const existingTagLinks = state.projectTags.filter(pt => pt.projectId === projectId);
    const existingTagIds = new Set(existingTagLinks.map(pt => pt.tagId));

    const tagsToAdd = Array.from(newTagIds).filter(id => !existingTagIds.has(id));
    const tagsToRemove = Array.from(existingTagIds).filter(id => !newTagIds.has(id));

    if (tagsToAdd.length === 0 && tagsToRemove.length === 0) {
        return; // No changes needed
    }

    const addPromises: Promise<any>[] = [];
    if (tagsToAdd.length > 0) {
        const addPayloads = tagsToAdd.map(tagId => ({
            workspaceId: activeWorkspaceId,
            projectId,
            tagId,
        }));
        addPromises.push(apiPost('project_tags', addPayloads));
    }

    const removePromises: Promise<any>[] = [];
    for (const tagId of tagsToRemove) {
        removePromises.push(
            apiFetch('/api?action=data&resource=project_tags', {
                method: 'DELETE',
                body: JSON.stringify({ projectId, tagId }),
            })
        );
    }

    try {
        const [addResults] = await Promise.all([
            Promise.all(addPromises),
            Promise.all(removePromises),
        ]);

        // Update state after successful API calls
        state.projectTags = state.projectTags.filter(pt => !(pt.projectId === projectId && tagsToRemove.includes(pt.tagId)));
        if (addResults && addResults.length > 0) {
            const newLinks = addResults.flat().filter(Boolean);
            state.projectTags.push(...newLinks);
        }
    } catch (error) {
        console.error("Failed to sync project tags:", error);
        alert("Could not update project tags. The data may be out of sync, please refresh.");
    }
}
