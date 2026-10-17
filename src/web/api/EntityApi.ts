import type { EntityLocation, EntityOwner, EntityType, ExpressionOrValue, JsonValue } from './CompanionApi.js'
import type { CompanionClient } from './trpc.js'

/**
 * The edit calls Companion's own button editor makes for actions and feedbacks (`controls.entities.*`,
 * as used by `ControlEntitiesService.ts` in Companion 5.1). Each is one immediate change to the live button.
 *
 * `location` is always the top-level list; nested entities are found by id within it.
 */
export function createEntityApi(client: CompanionClient, controlId: string) {
	const mutate = (path: string, input: Record<string, unknown>) =>
		client.mutation(`controls.entities.${path}`, { controlId, ...input })

	return {
		setOption: (
			entityLocation: EntityLocation,
			entityId: string,
			key: string,
			value: ExpressionOrValue<JsonValue | undefined>
		) => mutate('setOption', { entityLocation, entityId, key, value }),

		setEnabled: (entityLocation: EntityLocation, entityId: string, enabled: boolean) =>
			mutate('setEnabled', { entityLocation, entityId, enabled }),

		setHeadline: (entityLocation: EntityLocation, entityId: string, headline: string) =>
			mutate('setHeadline', { entityLocation, entityId, headline }),

		setInverted: (entityLocation: EntityLocation, entityId: string, isInverted: ExpressionOrValue<boolean>) =>
			mutate('setInverted', { entityLocation, entityId, isInverted }),

		setConnection: (entityLocation: EntityLocation, entityId: string, connectionId: string) =>
			mutate('setConnection', { entityLocation, entityId, connectionId }),

		remove: (entityLocation: EntityLocation, entityId: string) => mutate('remove', { entityLocation, entityId }),

		duplicate: (entityLocation: EntityLocation, entityId: string) => mutate('duplicate', { entityLocation, entityId }),

		move: (
			moveEntityLocation: EntityLocation,
			moveEntityId: string,
			newOwnerId: EntityOwner | null,
			newEntityLocation: EntityLocation,
			newIndex: number
		) => mutate('move', { moveEntityLocation, moveEntityId, newOwnerId, newEntityLocation, newIndex }),

		/** Resolves with the new entity's id, or null if Companion refused */
		add: (
			entityLocation: EntityLocation,
			ownerId: EntityOwner | null,
			connectionId: string,
			entityType: EntityType,
			entityDefinition: string
		) =>
			mutate('add', { entityLocation, ownerId, connectionId, entityType, entityDefinition }) as Promise<string | null>,
	}
}

export type EntityApi = ReturnType<typeof createEntityApi>
