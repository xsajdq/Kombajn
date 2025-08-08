import { getState, setState } from '../state.ts';
import { apiPost, apiFetch } from '../services/api.ts';
import { closeModal, openProjectPanel, closeSidePanels } from './ui.ts';
import { updateUI } from '../app-renderer.ts';
import type { Project, Task, ProjectMember, AiSuggestedTask, ProjectBaseline, BaselineTask } from '../types.ts';

export async function fetchTasksForProject(projectId: string) {
    const state = getState();
    const { activeWorkspaceId, ui } = state;
    if (!activeWorkspaceId) return;

    // If all tasks for the workspace are already loaded, we don't need to fetch.
    if (ui.tasks.loadedWorkspaceId === activeWorkspaceId) {
        console.log('All tasks already loaded, skipping project-specific fetch.');
        return;
    }

    console.log(`Fetching tasks for project ${projectId}...`);
    try {
        const data = await apiFetch(`/api?action=dashboard-data&workspaceId=${activeWorkspaceId}&tasksOnly=true&projectId=${projectId}`);
        if (!data || !data.tasks) return;

        // Merge new data into the existing state without removing other data
        setState(prevState => {
            const mergeById = (oldData: any[], newData: any[], idKey = 'id') => {
                if (!newData) return oldData;
                const dataMap = new Map(oldData.map(item => [item[idKey], item]));
                newData.forEach((item: any) => dataMap.set(item[idKey], item));
                return Array.from(dataMap.values());
            };
            
            return {
                tasks: mergeById(prevState.tasks, data.tasks),
                taskAssignees: mergeById(prevState.taskAssignees, data.taskAssignees),
                taskTags: mergeById(prevState.taskTags, data.taskTags),
            };
        }, []); // No re-render needed here, the tab switch will handle it.
        console.log(`Successfully fetched tasks for project ${projectId}.`);

    } catch (error) {
        console.error(`Failed to fetch tasks for project ${projectId}:`, error);
        // Maybe show an error to the user? For now, just log it.
    }
}


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

export async function handleSetProjectBaseline(projectId: string) {
    const state = getState();
    if (!state.currentUser) return;

    const baselineName = prompt("Enter a name for this baseline (e.g., 'Initial Plan'):");
    if (!baselineName) return;

    try {
        const baselinePayload: Omit<ProjectBaseline, 'id' | 'createdAt'> = {
            projectId,
            name: baselineName,
            createdBy: state.currentUser.id,
        };
        const [savedBaseline] = await apiPost('project_baselines', baselinePayload);

        const projectTasks = state.tasks.filter(t => t.projectId === projectId);
        const baselineTasksPayload: Omit<BaselineTask, 'id'>[] = projectTasks.map(task => ({
            baselineId: savedBaseline.id,
            taskId: task.id,
            originalStartDate: task.startDate,
            originalDueDate: task.dueDate,
        }));
        
        const savedBaselineTasks = await apiPost('baseline_tasks', baselineTasksPayload);

        setState(prevState => ({
            projectBaselines: [...prevState.projectBaselines, savedBaseline],
            baselineTasks: [...prevState.baselineTasks, ...savedBaselineTasks],
        }), ['page']);

        alert(`Baseline "${baselineName}" created successfully!`);
    } catch (error) {
        console.error("Failed to set project baseline:", error);
        alert("Could not create baseline.");
    }
}
