import { createContext, useContext } from 'react'
import type { ControlLocation } from '../api/CompanionApi.js'
import type { EntityApi } from '../api/EntityApi.js'
import type { CollapseState } from './CollapseState.js'

/** What every row of one button's outline needs */
export interface OutlineContextValue {
	controlId: string
	/** Where the button is in the grid, for "this page" style options */
	location: ControlLocation
	api: EntityApi
	collapse: CollapseState
}

export const OutlineContext = createContext<OutlineContextValue | null>(null)

export function useOutline(): OutlineContextValue {
	const value = useContext(OutlineContext)
	if (!value) throw new Error('useOutline used outside of OutlineContext')
	return value
}
