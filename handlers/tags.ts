// handlers/tags.ts
import { getState, setState } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import { apiPost, apiFetch } from '../services/api.ts';
import type { Tag, UIComponent } from '../types.ts';

export type TaggableEntity = 'project' | 'client' | 'task';

// A type for the join state keys
type JoinStateKey = 'projectTags' | 'clientTags' | 'taskTags';
type EntityIdKey = 'projectId' | 'clientId' | 'taskId';

export async function handleToggleTag(entityType: TaggableEntity, entityId: string, tagId: string, newTagName?: string) {
    const state = getState();
    const { activeWorkspaceId } = state;
    if (!activeWorkspaceId) return;

    let finalTagId = tagId;
    let newTag: Tag | null = null;
    
    const uiScope: UIComponent[] = state.ui.modal.isOpen ? ['modal'] : ['page', 'side-panel'];

    try {
        if (newTagName) {
            const color = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
            [newTag] = await apiPost('tags', { workspaceId: activeWorkspaceId, name: newTagName, color });
            setState(prevState => ({ tags: [...prevState.tags, newTag!] }), []);
            finalTagId = newTag!.id;
        }

        const joinTable = `${entityType}_tags`;
        const joinStateKey: JoinStateKey = `${entityType}Tags` as JoinStateKey;
        const entityIdKey: EntityIdKey = `${entityType}Id` as EntityIdKey;

        const existingLinkIndex = (state[joinStateKey] as any[]).findIndex(
            (link: any) => link[entityIdKey] === entityId && link.tagId === finalTagId
        );

        if (existingLinkIndex > -1) {
            const originalLinks = [...(state[joinStateKey] as any[])];
            setState(prevState => ({
                [joinStateKey]: (prevState[joinStateKey] as any[]).filter((_, index) => index !== existingLinkIndex)
            }), uiScope);
            
            await apiFetch(`/api?action=data&resource=${joinTable}`, {
                method: 'DELETE',
                body: JSON.stringify({ [entityIdKey]: entityId, tagId: finalTagId }),
            });
        } else {
            const newLink = { [entityIdKey]: entityId, tagId: finalTagId, workspaceId: activeWorkspaceId };
            const [savedLink] = await apiPost(joinTable, newLink);
            setState(prevState => ({
                [joinStateKey]: [...(prevState[joinStateKey] as any[]), savedLink]
            }), uiScope);
        }
    } catch (error) {
        console.error(`Failed to toggle ${entityType} tag:`, error);
        alert(`Could not update tags for ${entityType}.`);
        // A full state refresh might be needed for robust error handling here.
        // For now, the optimistic UI will be out of sync on failure.
    }
}