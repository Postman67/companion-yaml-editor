import fastJsonPatch from 'fast-json-patch'
import type { EntityDefinition, EntityDefinitions, EntityDefinitionUpdate } from '../api/CompanionApi.js'

/**
 * Apply an `instances.definitions.actions|feedbacks` message, returning new state (the input is not modified).
 * Mirrors Companion's `ApplyDiffToMap`: removed, then changed (json patch), then added.
 */
export function applyDefinitionUpdate(state: EntityDefinitions, update: EntityDefinitionUpdate): EntityDefinitions {
	switch (update.type) {
		case 'init':
			return update.definitions
		case 'add-connection':
			return { ...state, [update.connectionId]: update.entities }
		case 'forget-connection': {
			const next = { ...state }
			delete next[update.connectionId]
			return next
		}
		case 'update-connection': {
			const connection: Record<string, EntityDefinition | undefined> = { ...state[update.connectionId] }
			for (const id of update.removed) delete connection[id]
			for (const [id, patch] of Object.entries(update.changed)) {
				const existing = connection[id]
				if (existing) connection[id] = fastJsonPatch.applyPatch(structuredClone(existing), patch).newDocument
			}
			Object.assign(connection, update.added)
			return { ...state, [update.connectionId]: connection }
		}
		default:
			return state
	}
}
