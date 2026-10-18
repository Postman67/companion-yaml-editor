import type {
	EntityDefinition,
	EntityLocation,
	EntityModel,
	EntityOwner,
	EntityType,
	FeedbackListType,
} from '../api/CompanionApi.js'
import { canAddEntityToFeedbackList } from '../companion/Entity.js'

/** The entity being dragged, and where it currently is */
export interface DragSource {
	entityId: string
	entityType: EntityType
	location: EntityLocation
	ownerId: EntityOwner | null
	index: number
	/** Every entity nested inside it: it can't be dropped into its own children */
	descendantIds: ReadonlySet<string>
	definition: EntityDefinition | undefined
}

/** A place in a list to drop into: before the entity currently at `index` (or at the end) */
export interface DropTarget {
	location: EntityLocation
	ownerId: EntityOwner | null
	entityType: EntityType
	feedbackListType: FeedbackListType | null
	index: number
}

/** The arguments for `controls.entities.move` */
export interface ResolvedMove {
	newLocation: EntityLocation
	newOwnerId: EntityOwner | null
	newIndex: number
}

export function createDragSource(
	entity: EntityModel,
	location: EntityLocation,
	ownerId: EntityOwner | null,
	index: number,
	definition: EntityDefinition | undefined
): DragSource {
	return {
		entityId: entity.id,
		entityType: entity.type,
		location,
		ownerId,
		index,
		descendantIds: collectDescendantIds(entity),
		definition,
	}
}

function collectDescendantIds(entity: EntityModel, into = new Set<string>()): Set<string> {
	for (const children of Object.values(entity.children ?? {})) {
		for (const child of children ?? []) {
			into.add(child.id)
			collectDescendantIds(child, into)
		}
	}
	return into
}

function isSameList(
	a: { location: EntityLocation; ownerId: EntityOwner | null },
	b: { location: EntityLocation; ownerId: EntityOwner | null }
): boolean {
	return JSON.stringify([a.location, a.ownerId]) === JSON.stringify([b.location, b.ownerId])
}

/**
 * Turn a drop into the move Companion should make, or null if it isn't allowed or wouldn't change anything.
 * Companion re-checks everything (`EntityListPoolEditingMixin.moveEntity`); this only decides what to offer.
 */
export function resolveDrop(source: DragSource, target: DropTarget): ResolvedMove | null {
	// Actions only go in action lists, feedbacks in feedback lists
	if (source.entityType !== target.entityType) return null

	// Not into itself or anything inside it
	if (target.ownerId) {
		const parentId = target.ownerId.parentId
		if (parentId === source.entityId || source.descendantIds.has(parentId)) return null
	}

	// A condition list only takes boolean feedbacks, and so on
	if (source.entityType === 'feedback' && source.definition && target.feedbackListType) {
		if (!canAddEntityToFeedbackList(target.feedbackListType, source.definition)) return null
	}

	if (isSameList(source, target)) {
		// Within a list Companion takes the final index; dropping below itself shifts everything up by one
		const newIndex = target.index > source.index ? target.index - 1 : target.index
		if (newIndex === source.index) return null
		return { newLocation: target.location, newOwnerId: target.ownerId, newIndex }
	}

	return { newLocation: target.location, newOwnerId: target.ownerId, newIndex: target.index }
}
