import { useMemo } from 'react'
import { isLayeredButton, type ControlConfig, type LayeredButtonModel, type StepModel } from '../api/CompanionApi.js'
import { createEntityApi } from '../api/EntityApi.js'
import { useStores } from '../stores/CompanionStores.js'
import { Store } from '../stores/Store.js'
import { CollapseState } from './CollapseState.js'
import type { DragSource } from './DragDrop.js'
import { EntityList } from './EntityList.js'
import { OutlineContext, type OutlineContextValue } from './OutlineContext.js'

/** The whole button as a compact outline: each step's action sets, then feedbacks and local variables */
export function ButtonOutline({ controlId, config }: { controlId: string; config: ControlConfig }) {
	const { client } = useStores()
	const context = useMemo<OutlineContextValue>(
		() => ({
			controlId,
			api: createEntityApi(client, controlId),
			collapse: new CollapseState(controlId),
			drag: new Store<DragSource | null>(null),
		}),
		[client, controlId]
	)

	if (!isLayeredButton(config)) {
		return <p className="empty">This is a {config.type} button, which has no actions to edit.</p>
	}

	const stepIds = Object.keys(config.steps).sort((a, b) => Number(a) - Number(b))

	return (
		<OutlineContext.Provider value={context}>
			<div className="outline">
				{stepIds.map((stepId, index) => (
					<StepOutline
						key={stepId}
						config={config}
						stepId={stepId}
						step={config.steps[stepId]!}
						title={stepIds.length > 1 ? `Step ${index + 1}` : null}
					/>
				))}

				<section className="outline-section">
					<h2>Feedbacks</h2>
					<EntityList
						location="feedbacks"
						ownerId={null}
						entities={config.feedbacks}
						entityType="feedback"
						feedbackListType="style-override"
						addLabel="feedback"
					/>
				</section>

				<section className="outline-section">
					<h2>Local variables</h2>
					<EntityList
						location="local-variables"
						ownerId={null}
						entities={config.localVariables}
						entityType="feedback"
						feedbackListType="value"
						addLabel="local variable"
					/>
				</section>
			</div>
		</OutlineContext.Provider>
	)
}

function StepOutline({
	config,
	stepId,
	step,
	title,
}: {
	config: LayeredButtonModel
	stepId: string
	step: StepModel
	title: string | null
}) {
	// Duration groups have numeric ids, serialised as string keys
	const durationSetIds = Object.keys(step.action_sets)
		.map(Number)
		.filter((id) => Number.isFinite(id))
		.sort((a, b) => a - b)

	const sets: Array<{ setId: 'down' | 'up' | 'rotate_left' | 'rotate_right' | number; title: string }> = []
	if (config.options.rotaryActions) {
		sets.push({ setId: 'rotate_left', title: 'Rotate left' }, { setId: 'rotate_right', title: 'Rotate right' })
	}
	sets.push({ setId: 'down', title: 'Press' })
	sets.push({ setId: 'up', title: durationSetIds.length > 0 ? 'Short release' : 'Release' })
	for (const setId of durationSetIds) {
		const held = step.options.runWhileHeld.includes(setId)
		sets.push({ setId, title: held ? `Held for ${setId}ms` : `Release after ${setId}ms` })
	}

	return (
		<div className="outline-step">
			{title ? <h2 className="step-title">{step.options.name || title}</h2> : null}
			{sets.map(({ setId, title }) => {
				const entities = step.action_sets[String(setId)] ?? []
				return (
					<section key={String(setId)} className="outline-section">
						<h3>{title}</h3>
						<EntityList
							location={{ stepId, setId }}
							ownerId={null}
							entities={entities}
							entityType="action"
							feedbackListType={null}
							addLabel="action"
						/>
					</section>
				)
			})}
		</div>
	)
}
