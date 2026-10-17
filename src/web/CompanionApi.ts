/**
 * Hand-written types for the parts of Companion's tRPC api that this editor uses.
 * Mirrors `shared-lib/lib/Model/*` as of Companion 5.0.0 (d5ae3b4085). Companion's internal api is not
 * versioned, so check these against the target version when upgrading.
 */
import type { Operation } from 'fast-json-patch'

export interface ControlLocation {
	pageNumber: number
	row: number
	column: number
}

/** `pages.watch` */
export interface PageModel {
	id: string
	name: string
	/** row -> column -> controlId */
	controls: Record<number, Record<number, string>>
}
export type PageModelChanges =
	| { type: 'init'; order: string[]; pages: Record<string, PageModel | undefined> }
	| {
			type: 'update'
			updatedOrder: string[] | null
			added: PageModel[]
			changes: Array<{
				id: string
				name: string | null
				controls: Array<{ row: number; column: number; controlId: string | null }>
			}>
	  }

/** `controls.watchControl` */
export type ControlConfig = Record<string, unknown> & { type: string }
export type UIControlUpdate =
	| { type: 'init'; config: ControlConfig; runtime: Record<string, unknown> }
	| { type: 'config'; patch: Operation[] }
	| { type: 'runtime'; patch: Operation[] }
	| { type: 'destroy' }

/** `userConfig.watchConfig` (only the fields we read) */
export interface UserConfigGridSize {
	minColumn: number
	maxColumn: number
	minRow: number
	maxRow: number
}
export type UserConfigUpdate =
	| { type: 'init'; config: { gridSize: UserConfigGridSize } & Record<string, unknown> }
	| { type: 'key'; key: string; value: unknown }

/** `instances.connections.watch` (only the fields we read) */
export interface ClientConnectionConfig {
	id: string
	label: string
	moduleId: string
}
export type ClientConnectionsUpdate =
	| { type: 'init'; info: Record<string, ClientConnectionConfig> }
	| { type: 'update'; id: string; info: ClientConnectionConfig }
	| { type: 'remove'; id: string }

/** `preview.graphics.location` */
export interface WrappedImage {
	image: string | null
	isUsed: boolean
}
