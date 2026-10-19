import { useMemo, useRef } from 'react'
import type {
	EntityChildGroupDefinition,
	EntityDefinition,
	EntityLocation,
	EntityModel,
	EntityOwner,
	FeedbackListType,
} from '../api/CompanionApi.js'
import { computeOptionsVisibility } from '../companion/IsVisible.js'
import { useStores } from '../stores/CompanionStores.js'
import { getPage } from '../stores/PagesState.js'
import { useStore } from '../stores/Store.js'
import { useCollapseState } from './CollapseState.js'
import { createDragSource, DRAG_DATA_TYPE } from './DragDrop.js'
import { EntityEditor } from './EntityEditor.js'
import { EntityList } from './EntityList.js'
import { reportRefusal, useOutline } from './OutlineContext.js'
import { entityTitle, summariseEntity, type SummaryContext } from './Summarise.js'
import { SummaryView } from './SummaryView.js'
import { useDropZone } from './useDropZone.js'

export function useEntityDefinition(entity: EntityModel): EntityDefinition | undefined {
	const stores = useStores()
	const definitions = useStore(entity.type === 'action' ? stores.actionDefinitions : stores.feedbackDefinitions)
	return definitions[entity.connectionId]?.[entity.definitionId]
}

/** One action or feedback: a single summary line, its editor when open, and any child groups below it */
export function EntityRow({
	entity,
	index,
	count,
	location,
	ownerId,
	feedbackListType,
}: {
	entity: EntityModel
	index: number
	count: number
	location: EntityLocation
	ownerId: EntityOwner | null
	/** The type of the list this row is in */
	feedbackListType: FeedbackListType | null
}) {
	const stores = useStores()
	const { api, collapse, drag } = useOutline()
	const dragging = useStore(drag)?.entityId === entity.id
	const lineRef = useRef<HTMLDivElement>(null)
	useCollapseState(collapse)
	const definition = useEntityDefinition(entity)
	useStore(stores.connections)
	const pages = useStore(stores.pages)

	const visibility = useMemo(
		() =>
			definition
				? computeOptionsVisibility(definition.options, definition.optionsSupportExpressions, entity.options)
				: new Map<string, boolean>(),
		[definition, entity.options]
	)
	const summaryContext: SummaryContext = {
		connectionLabel: (id) => stores.connectionLabel(id),
		pageName: (n) => (pages ? getPage(pages, n)?.name : undefined),
	}
	const summary = summariseEntity(entity, definition, visibility, summaryContext)

	const isOpen = collapse.isOpen(entity.id)
	const enabled = !entity.disabled
	const inverted = entity.isInverted?.isExpression ? null : entity.isInverted?.value === true
	const childGroups = entity.connectionId === 'internal' ? (definition?.supportsChildGroups ?? []) : []

	// Dropping on this line goes before or after this entity. With its child groups showing below, "after"
	// would land past all of them, so the whole line means "before"; drop into a group via its rows or label.
	const showsChildren = childGroups.some((group) => !collapse.isFolded(`${entity.id}:${group.groupId}`))
	const lineDrop = useDropZone((e) => {
		const rect = e.currentTarget.getBoundingClientRect()
		const before = showsChildren || e.clientY < rect.top + rect.height / 2
		return {
			target: { location, ownerId, entityType: entity.type, feedbackListType, index: before ? index : index + 1 },
			indicator: before ? 'before' : 'after',
		}
	})

	const lineClass = ['entity-line', lineDrop.indicator ? `drop-${lineDrop.indicator}` : ''].join(' ')
	const rowClass = ['entity', enabled ? '' : 'disabled', isOpen ? 'open' : '', dragging ? 'dragging' : ''].join(' ')

	return (
		<div className={rowClass}>
			<div className={lineClass} ref={lineRef} {...lineDrop.handlers}>
				<span
					className="drag-handle"
					draggable
					title="Drag to move"
					onDragStart={(e) => {
						e.dataTransfer.effectAllowed = 'move'
						e.dataTransfer.setData(DRAG_DATA_TYPE, entity.id)
						if (lineRef.current) e.dataTransfer.setDragImage(lineRef.current, 12, 12)
						drag.set(createDragSource(entity, location, ownerId, index, definition))
					}}
					onDragEnd={() => drag.set(null)}
				>
					⠿
				</span>
				<input
					type="checkbox"
					className="entity-enabled"
					checked={enabled}
					title={enabled ? 'Enabled' : 'Disabled'}
					onChange={(e) => reportRefusal(api.setEnabled(location, entity.id, e.target.checked))}
				/>
				<button
					type="button"
					className="entity-title"
					aria-expanded={isOpen}
					onClick={() => collapse.setOpen(entity.id, !isOpen)}
				>
					<span className="connection-chip">{stores.connectionLabel(entity.connectionId)}</span>
					{inverted ? <span className="not-chip">not</span> : null}
					<span className="title-text">{entityTitle(entity, definition)}</span>
				</button>
				<SummaryView parts={summary} />
				{!definition ? <span className="warning-chip" title="Module not loaded or disabled">no definition</span> : null}
				<span className="entity-actions">
					<button
						type="button"
						title="Move up"
						disabled={index === 0}
						onClick={() => reportRefusal(api.move(location, entity.id, ownerId, location, index - 1))}
					>
						↑
					</button>
					<button
						type="button"
						title="Move down"
						disabled={index === count - 1}
						onClick={() => reportRefusal(api.move(location, entity.id, ownerId, location, index + 1))}
					>
						↓
					</button>
					<button type="button" title="Duplicate" onClick={() => reportRefusal(api.duplicate(location, entity.id))}>
						⧉
					</button>
					<button
						type="button"
						title="Delete"
						onClick={() => {
							if (window.confirm(`Delete "${entityTitle(entity, definition)}"?`)) {
								reportRefusal(api.remove(location, entity.id))
							}
						}}
					>
						✕
					</button>
				</span>
			</div>

			{isOpen ? <EntityEditor entity={entity} definition={definition} location={location} visibility={visibility} /> : null}

			{childGroups.map((group) => (
				<ChildGroup key={group.groupId} entity={entity} group={group} location={location} />
			))}
		</div>
	)
}

/** One child group (e.g. an if's "When true", "Then" or "Else"): a foldable label and its list */
function ChildGroup({
	entity,
	group,
	location,
}: {
	entity: EntityModel
	group: EntityChildGroupDefinition
	location: EntityLocation
}) {
	const { collapse } = useOutline()
	const groupKey = `${entity.id}:${group.groupId}`
	const folded = collapse.isFolded(groupKey)
	const children = entity.children?.[group.groupId] ?? []
	const ownerId = { parentId: entity.id, childGroup: group.groupId }
	const feedbackListType = group.feedbackListType ?? null

	// Dropping on the label adds to the end of the group, even while it's folded
	const labelDrop = useDropZone(() => ({
		target: { location, ownerId, entityType: group.type, feedbackListType, index: children.length },
		indicator: 'inside',
	}))

	return (
		<div className="child-group">
			<button
				type="button"
				className={`child-group-label${labelDrop.indicator ? ' drop-inside' : ''}`}
				aria-expanded={!folded}
				onClick={() => collapse.setFolded(groupKey, !folded)}
				{...labelDrop.handlers}
			>
				<span className="chevron">{folded ? '▸' : '▾'}</span>
				{group.label || group.entityTypeLabel}
				{folded ? <span className="muted"> · {children.length}</span> : null}
			</button>
			{folded ? null : (
				<EntityList
					location={location}
					ownerId={ownerId}
					entities={children}
					entityType={group.type}
					feedbackListType={feedbackListType}
					addLabel={group.entityTypeLabel}
				/>
			)}
		</div>
	)
}
