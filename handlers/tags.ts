// handlers/tags.ts
import { state } from '../state.ts';
import { updateUI } from '../app-renderer.ts';
import { apiPost, apiFetch } from '../services/api.ts';
import type { Tag } from '../types.ts';

type TaggableEntity = 'project' | 'client' | 'task';

// A more specific type for the join state keys
type JoinStateKey = 'projectTags' | 'clientTags' | 'taskTags';
type EntityIdKey = 'projectId' | 'clientId' | 'taskId';

export async function handleToggleTag(entityType: TaggableEntity, entityId: string, tagId: string, newTagName?: string) {
    const { activeWorkspaceId } = state;
    if (!activeWorkspaceId) return;

    let finalTagId = tagId;
    let newTag: Tag | null = null;

    try {
        if (newTagName) {
            const color = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
            [newTag] = await apiPost('tags', { workspaceId: activeWorkspaceId, name: newTagName, color });
            state.tags.push(newTag!);
            finalTagId = newTag!.id;
        }

        const joinTable = `${entityType}_tags`;
        const joinStateKey: JoinStateKey = `${entityType}Tags` as JoinStateKey;
        const entityIdKey: EntityIdKey = `${entityType}Id` as EntityIdKey;

        const existingLinkIndex = (state[joinStateKey] as any[]).findIndex(
            (link: any) => link[entityIdKey] === entityId && link.tagId === finalTagId
        );

        if (existingLinkIndex > -1) {
            const [removedLink] = (state[joinStateKey] as any[]).splice(existingLinkIndex, 1);
            updateUI(state.ui.modal.isOpen ? ['modal'] : ['side-panel', 'page']);
            await apiFetch(`/api?action=data&resource=${joinTable}`, {
                method: 'DELETE',
                body: JSON.stringify({ [entityIdKey]: entityId, tagId: finalTagId }),
            });
        } else {
            const newLink = { [entityIdKey]: entityId, tagId: finalTagId, workspaceId: activeWorkspaceId };
            const [savedLink] = await apiPost(joinTable, newLink);
            (state[joinStateKey] as any[]).push(savedLink);
            updateUI(state.ui.modal.isOpen ? ['modal'] : ['side-panel', 'page']);
        }
    } catch (error) {
        console.error(`Failed to toggle ${entityType} tag:`, error);
        alert(`Could not update tags for ${entityType}.`);
        // A full state refresh might be needed for robust error handling here.
        // For now, the optimistic UI will be out of sync on failure.
    }
}