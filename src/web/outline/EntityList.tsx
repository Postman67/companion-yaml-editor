import type { EntityLocation, EntityModel, EntityOwner, EntityType, FeedbackListType } from '../api/CompanionApi.js'
import { AddEntity } from './AddEntity.js'
import { EntityRow } from './EntityRow.js'

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
	const { entities } = props
	return (
		<div className="entity-list">
			{entities.map((entity, index) => (
				<EntityRow
					key={entity.id}
					entity={entity}
					index={index}
					count={entities.length}
					location={props.location}
					ownerId={props.ownerId}
				/>
			))}
			<AddEntity {...props} />
		</div>
	)
}
