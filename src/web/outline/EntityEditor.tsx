import type { EntityDefinition, EntityLocation, EntityModel } from '../api/CompanionApi.js'
import { useStores } from '../stores/CompanionStores.js'
import { useStore } from '../stores/Store.js'
import { CommitTextInput } from './fields/CommitTextInput.js'
import { OptionField } from './fields/OptionField.js'
import { useOutline } from './OutlineContext.js'

/** The expanded editor under a row: name, connection, invert and every visible option */
export function EntityEditor({
	entity,
	definition,
	location,
	visibility,
}: {
	entity: EntityModel
	definition: EntityDefinition | undefined
	location: EntityLocation
	visibility: ReadonlyMap<string, boolean>
}) {
	const stores = useStores()
	const connections = useStore(stores.connections)
	const { api } = useOutline()
	const run = (promise: Promise<unknown>) => promise.catch((e) => window.alert(`Companion refused the change: ${e}`))

	// Only connections of the same module can take over an entity (as in Companion's EntityChangeConnection)
	const currentConnection = connections.get(entity.connectionId)
	const siblingConnections = currentConnection
		? [...connections.values()].filter((c) => c.moduleId === currentConnection.moduleId)
		: []

	const canInvert =
		entity.type === 'feedback' && definition?.feedbackType === 'boolean' && definition.showInvert !== false

	return (
		<div className="entity-editor">
			{definition?.description ? <p className="description">{definition.description}</p> : null}

			<label className="option-row">
				<span className="option-label">Name</span>
				<CommitTextInput
					value={entity.headline ?? ''}
					placeholder={definition?.label ?? entity.definitionId}
					onCommit={(headline) => run(api.setHeadline(location, entity.id, headline))}
				/>
			</label>

			{siblingConnections.length > 1 ? (
				<label className="option-row">
					<span className="option-label">Connection</span>
					<select
						value={entity.connectionId}
						onChange={(e) => run(api.setConnection(location, entity.id, e.target.value))}
					>
						{siblingConnections.map((c) => (
							<option key={c.id} value={c.id}>
								{c.label}
							</option>
						))}
					</select>
				</label>
			) : null}

			{canInvert ? (
				<label className="option-row">
					<span className="option-label">Invert</span>
					<input
						type="checkbox"
						checked={entity.isInverted?.value === true}
						disabled={entity.isInverted?.isExpression === true}
						onChange={(e) => run(api.setInverted(location, entity.id, { isExpression: false, value: e.target.checked }))}
					/>
				</label>
			) : null}

			{definition ? (
				definition.options.map((field) =>
					visibility.get(field.id) === false ? null : (
						<OptionField
							key={field.id}
							field={field}
							value={entity.options[field.id]}
							supportsExpressions={definition.optionsSupportExpressions && !field.disableAutoExpression}
							allowInternalFields={entity.connectionId === 'internal'}
							onChange={(value) => run(api.setOption(location, entity.id, field.id, value))}
						/>
					)
				)
			) : (
				<p className="muted">
					This {entity.type}'s module isn't loaded (the connection may be disabled), so its options can't be edited
					here.
				</p>
			)}
		</div>
	)
}
