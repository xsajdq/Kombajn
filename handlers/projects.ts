
import { getState, setState } from '../state.ts';
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
            workspaceId: getState().activeWorkspaceId,
            name: name,
            clientId: clientId,
            wikiContent: `Project Goal:\n\n> ${goal}`,
            privacy: 'private'
        };
        const [newProject] = await apiPost('projects', projectData);

        const creatorMember: Omit<ProjectMember, 'id'> = {
            projectId: newProject.id,
            userId: getState().currentUser!.id,
            role: 'admin'
        };
        const [savedCreatorMember] = await apiPost('project_members', creatorMember);
        
        let newTasks: Task[] = [];
        if (suggestedTasks && suggestedTasks.length > 0) {
            const taskPayloads = suggestedTasks.map((task: AiSuggestedTask) => ({
                workspaceId: getState().activeWorkspaceId,
                projectId: newProject.id,
                name: task.name,
                description: task.description,
                status: 'backlog',
            }));
            newTasks = await apiPost('tasks', taskPayloads);
        }

        setState(prevState => ({
            projects: [...prevState.projects, newProject],
            projectMembers: [...prevState.projectMembers, savedCreatorMember],
            tasks: [...prevState.tasks, ...newTasks]
        }), []);

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

export async function handleSyncProjectMembers(projectId: string, newMemberIds: Set<string>) {
    const state = getState();
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

    const originalProjectMembers = [...state.projectMembers];
    setState(prevState => ({
        projectMembers: prevState.projectMembers.filter(pm => !membersToRemove.some(m => m.id === pm.id))
    }), ['side-panel']);

    try {
        const [addResults] = await Promise.all([
            Promise.all(addPromises),
            Promise.all(removePromises),
        ]);
        
        if (addResults && addResults.length > 0) {
            const newMembers = addResults.flat().filter(Boolean);
            setState(prevState => ({
                projectMembers: [...prevState.projectMembers, ...newMembers]
            }), []);
        }
    } catch (error) {
        console.error("Failed to sync project members:", error);
        alert("Could not update project members. Please refresh the page.");
        setState({ projectMembers: originalProjectMembers }, []);
    } finally {
        updateUI(['side-panel']);
    }
}

export async function handleSyncProjectTags(projectId: string, newTagIds: Set<string>) {
    const state = getState();
    const { activeWorkspaceId } = state;
    if (!activeWorkspaceId) return;

    const existingTagLinks = state.projectTags.filter(pt => pt.projectId === projectId);
    const existingTagIds = new Set(existingTagLinks.map(pt => pt.tagId));

    const tagsToAdd = Array.from(newTagIds).filter(id => !existingTagIds.has(id));
    const tagsToRemove = Array.from(existingTagIds).filter(id => !newTagIds.has(id));

    if (tagsToAdd.length === 0 && tagsToRemove.length === 0) {
        return; // No changes needed
    }
    
    const originalProjectTags = [...state.projectTags];

    // Optimistic UI update
    const optimisticallyAdded = tagsToAdd.map(tagId => ({
        projectId,
        tagId,
        workspaceId: activeWorkspaceId,
        id: `temp_${Date.now()}` // Temporary ID for local state
    }));

    setState(prevState => ({
        projectTags: [
            ...prevState.projectTags.filter(pt => !(pt.projectId === projectId && tagsToRemove.includes(pt.tagId))),
            ...optimisticallyAdded
        ]
    }), ['page', 'side-panel']);

    try {
        const addPromises = tagsToAdd.map(tagId => apiPost('project_tags', { workspaceId: activeWorkspaceId, projectId, tagId }));
        const removePromises = tagsToRemove.map(tagId => apiFetch('/api?action=data&resource=project_tags', { method: 'DELETE', body: JSON.stringify({ projectId, tagId }) }));
        
        const [addResults] = await Promise.all([
            Promise.all(addPromises),
            Promise.all(removePromises),
        ]);

        // Replace temporary items with real ones from the server
        setState(prevState => ({
            projectTags: [
                ...prevState.projectTags.filter(pt => !pt.id.startsWith('temp_')),
                ...addResults.flat().filter(Boolean)
            ]
        }), []);
    } catch (error) {
        console.error("Failed to sync project tags:", error);
        alert("Could not update project tags. The data may be out of sync, please refresh.");
        setState({ projectTags: originalProjectTags }, ['page', 'side-panel']);
    }
}