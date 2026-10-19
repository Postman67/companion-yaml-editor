import { useMemo, useState } from 'react'
import { canAddEntityToFeedbackList } from '../companion/Entity.js'
import { useStores } from '../stores/CompanionStores.js'
import { useStore } from '../stores/Store.js'
import type { EntityListProps } from './EntityList.js'
import { reportRefusal, useOutline } from './OutlineContext.js'

const MAX_RESULTS = 40

interface Candidate {
	connectionId: string
	definitionId: string
	connectionLabel: string
	label: string
	search: string
}

/** "+ Add action" for a list: search every definition this list accepts, by connection and name */
export function AddEntity({ location, ownerId, entityType, feedbackListType, addLabel }: EntityListProps) {
	const stores = useStores()
	const { api, collapse } = useOutline()
	const definitions = useStore(entityType === 'action' ? stores.actionDefinitions : stores.feedbackDefinitions)
	// Only read through stores.connectionLabel, but the labels must refresh when connections change
	const connections = useStore(stores.connections)
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState('')

	// Only built while the picker is open: every list on the page has one of these
	const candidates = useMemo(() => {
		if (!open) return []
		const result: Candidate[] = []
		for (const [connectionId, connectionDefinitions] of Object.entries(definitions)) {
			const connectionLabel = stores.connectionLabel(connectionId)
			for (const [definitionId, definition] of Object.entries(connectionDefinitions ?? {})) {
				if (!definition) continue
				if (entityType === 'feedback' && !canAddEntityToFeedbackList(feedbackListType, definition)) continue
				const label = definition.label || definitionId
				result.push({
					connectionId,
					definitionId,
					connectionLabel,
					label,
					search: `${connectionLabel} ${label}`.toLowerCase(),
				})
			}
		}
		return result.sort((a, b) => a.connectionLabel.localeCompare(b.connectionLabel) || a.label.localeCompare(b.label))
	}, [open, definitions, connections, stores, entityType, feedbackListType])

	if (!open) {
		return (
			<button type="button" className="add-entity" onClick={() => setOpen(true)}>
				+ Add {addLabel}
			</button>
		)
	}

	const words = query.toLowerCase().split(/\s+/).filter(Boolean)
	const matches = candidates.filter((c) => words.every((w) => c.search.includes(w))).slice(0, MAX_RESULTS)

	const add = (candidate: Candidate) => {
		setOpen(false)
		setQuery('')
		reportRefusal(
			api.add(location, ownerId, candidate.connectionId, entityType, candidate.definitionId).then((newId) => {
				if (newId) collapse.setOpen(newId, true)
			})
		)
	}

	return (
		<div className="add-entity-picker">
			<input
				type="search"
				autoFocus
				placeholder={`Search ${addLabel}s, e.g. "atem cut"`}
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === 'Escape') setOpen(false)
					if (e.key === 'Enter' && matches[0]) add(matches[0])
				}}
			/>
			<ul>
				{matches.map((c) => (
					<li key={`${c.connectionId}:${c.definitionId}`}>
						<button type="button" onClick={() => add(c)}>
							<span className="connection-chip">{c.connectionLabel}</span>
							{c.label}
						</button>
					</li>
				))}
				{matches.length === 0 ? <li className="muted">No matches</li> : null}
			</ul>
			<button type="button" className="link-button" onClick={() => setOpen(false)}>
				Cancel
			</button>
		</div>
	)
}
