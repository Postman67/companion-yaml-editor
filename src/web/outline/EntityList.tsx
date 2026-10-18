import type { EntityLocation, EntityModel, EntityOwner, EntityType, FeedbackListType } from '../api/CompanionApi.js'
import { AddEntity } from './AddEntity.js'
import { EntityRow } from './EntityRow.js'
import { useDropZone } from './useDropZone.js'

export interface EntityListProps {
	/** The top-level list this belongs to (also for nested lists) */
	location: EntityLocation
	/** The parent entity and child group, or null at the top level */
	ownerId: EntityOwner | null
	entities: EntityModel[]
	entityType: EntityType
	/** For feedback lists: which kinds of feedback may be added */
	feedbackListType: FeedbackListType | null
	/** What to call the thing being added, e.g. "action" or "condition" */
	addLabel: string
}

export function EntityList(props: EntityListProps) {
	const { entities, location, ownerId, entityType, feedbackListType } = props

	// Dropping on the "+ Add" row puts the entity at the end (and is the only target in an empty list)
	const end = useDropZone(() => ({
		target: { location, ownerId, entityType, feedbackListType, index: entities.length },
		indicator: 'inside',
	}))

	return (
		<div className="entity-list">
			{entities.map((entity, index) => (
				<EntityRow
					key={entity.id}
					entity={entity}
					index={index}
					count={entities.length}
					location={location}
					ownerId={ownerId}
					feedbackListType={feedbackListType}
				/>
			))}
			<div className={`list-end${end.indicator ? ' drop-inside' : ''}`} {...end.handlers}>
				<AddEntity {...props} />
			</div>
		</div>
	)
}
