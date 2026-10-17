import { useMemo } from 'react'
import type { EntityDefinition, EntityLocation, EntityModel, EntityOwner } from '../api/CompanionApi.js'
import { computeOptionsVisibility } from '../companion/IsVisible.js'
import { useStores } from '../stores/CompanionStores.js'
import { getPage } from '../stores/PagesState.js'
import { useStore } from '../stores/Store.js'
import { useCollapseState } from './CollapseState.js'
import { EntityEditor } from './EntityEditor.js'
import { EntityList } from './EntityList.js'
import { useOutline } from './OutlineContext.js'
import { entityTitle, summariseEntity, type SummaryContext } from './Summarise.js'
import { SummaryView } from './SummaryView.js'

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
}: {
	entity: EntityModel
	index: number
	count: number
	location: EntityLocation
	ownerId: EntityOwner | null
}) {
	const stores = useStores()
	const { api, collapse } = useOutline()
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

	const run = (promise: Promise<unknown>) => promise.catch((e) => window.alert(`Companion refused the change: ${e}`))

	return (
		<div className={`entity${enabled ? '' : ' disabled'}${isOpen ? ' open' : ''}`}>
			<div className="entity-line">
				<input
					type="checkbox"
					className="entity-enabled"
					checked={enabled}
					title={enabled ? 'Enabled' : 'Disabled'}
					onChange={(e) => run(api.setEnabled(location, entity.id, e.target.checked))}
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
						onClick={() => run(api.move(location, entity.id, ownerId, location, index - 1))}
					>
						↑
					</button>
					<button
						type="button"
						title="Move down"
						disabled={index === count - 1}
						onClick={() => run(api.move(location, entity.id, ownerId, location, index + 1))}
					>
						↓
					</button>
					<button type="button" title="Duplicate" onClick={() => run(api.duplicate(location, entity.id))}>
						⧉
					</button>
					<button
						type="button"
						title="Delete"
						onClick={() => {
							if (window.confirm(`Delete "${entityTitle(entity, definition)}"?`)) run(api.remove(location, entity.id))
						}}
					>
						✕
					</button>
				</span>
			</div>

			{isOpen ? <EntityEditor entity={entity} definition={definition} location={location} visibility={visibility} /> : null}

			{childGroups.map((group) => {
				const groupKey = `${entity.id}:${group.groupId}`
				const folded = collapse.isFolded(groupKey)
				const children = entity.children?.[group.groupId] ?? []
				return (
					<div key={group.groupId} className="child-group">
						<button
							type="button"
							className="child-group-label"
							aria-expanded={!folded}
							onClick={() => collapse.setFolded(groupKey, !folded)}
						>
							<span className="chevron">{folded ? '▸' : '▾'}</span>
							{group.label || group.entityTypeLabel}
							{folded ? <span className="muted"> · {children.length}</span> : null}
						</button>
						{folded ? null : (
							<EntityList
								location={location}
								ownerId={{ parentId: entity.id, childGroup: group.groupId }}
								entities={children}
								entityType={group.type}
								feedbackListType={group.feedbackListType ?? null}
								addLabel={group.entityTypeLabel}
							/>
						)}
					</div>
				)
			})}
		</div>
	)
}
