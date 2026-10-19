import { createContext, useContext } from 'react'
import type { EntityApi } from '../api/EntityApi.js'
import type { Store } from '../stores/Store.js'
import type { CollapseState } from './CollapseState.js'
import type { DragSource } from './DragDrop.js'

/** What every row of one button's outline needs */
export interface OutlineContextValue {
	controlId: string
	api: EntityApi
	collapse: CollapseState
	/** The entity being dragged, if any (shared by every list, so entities can move between them) */
	drag: Store<DragSource | null>
}

export const OutlineContext = createContext<OutlineContextValue | null>(null)

export function useOutline(): OutlineContextValue {
	const value = useContext(OutlineContext)
	if (!value) throw new Error('useOutline used outside of OutlineContext')
	return value
}

/** Tell the user when Companion rejects an edit (the outline then still shows Companion's state) */
export function reportRefusal(promise: Promise<unknown>, what = 'change'): void {
	promise.catch((e) => window.alert(`Companion refused the ${what}: ${e}`))
}
