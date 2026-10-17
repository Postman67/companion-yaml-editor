import type { ControlLocation, PageModel, PageModelChanges } from '../api/CompanionApi.js'

export interface PagesState {
	/** Page ids, in page-number order (page 1 first) */
	order: string[]
	pages: Record<string, PageModel>
}

/** Apply a `pages.watch` message, returning the new state (the input is not modified) */
export function applyPageChanges(state: PagesState | null, change: PageModelChanges): PagesState {
	if (change.type === 'init') {
		const pages: Record<string, PageModel> = {}
		for (const [id, page] of Object.entries(change.pages)) {
			if (page) pages[id] = page
		}
		return { order: [...change.order], pages }
	}

	const pages = { ...state?.pages }
	for (const page of change.added) {
		pages[page.id] = page
	}
	for (const item of change.changes) {
		const existing = pages[item.id]
		if (!existing) continue

		const controls: PageModel['controls'] = {}
		for (const [row, cols] of Object.entries(existing.controls)) controls[Number(row)] = { ...cols }
		for (const { row, column, controlId } of item.controls) {
			const rowControls = (controls[row] ??= {})
			if (controlId) rowControls[column] = controlId
			else delete rowControls[column]
		}

		pages[item.id] = { ...existing, name: item.name ?? existing.name, controls }
	}

	return { order: change.updatedOrder ? [...change.updatedOrder] : (state?.order ?? []), pages }
}

export function getPage(state: PagesState, pageNumber: number): PageModel | undefined {
	const id = state.order[pageNumber - 1]
	return id ? state.pages[id] : undefined
}

export function getControlIdAt(state: PagesState, location: ControlLocation): string | null {
	return getPage(state, location.pageNumber)?.controls[location.row]?.[location.column] ?? null
}

/** The url hash for a location: `#/<page>/<row>/<column>` */
export function formatLocationHash(location: ControlLocation): string {
	return `#/${location.pageNumber}/${location.row}/${location.column}`
}

export function parseLocationHash(hash: string): ControlLocation | null {
	const match = /^#\/(\d+)\/(-?\d+)\/(-?\d+)$/.exec(hash)
	if (!match) return null
	return { pageNumber: Number(match[1]), row: Number(match[2]), column: Number(match[3]) }
}
