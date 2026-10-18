import { useState } from 'react'
import { useStore } from '../stores/Store.js'
import { resolveDrop, type DropTarget } from './DragDrop.js'
import { useOutline } from './OutlineContext.js'

/** Where the drop line is drawn: above or below a row, or highlighting a whole zone */
export type DropIndicator = 'before' | 'after' | 'inside'

/**
 * Make an element accept dragged entities. `getTarget` says where in which list a drop at this pointer
 * position would go; the zone only lights up (and the drop only happens) when that move is allowed.
 */
export function useDropZone(
	getTarget: (e: React.DragEvent<HTMLElement>) => { target: DropTarget; indicator: DropIndicator } | null
) {
	const { drag, api } = useOutline()
	const source = useStore(drag)
	const [indicator, setIndicator] = useState<DropIndicator | null>(null)

	const resolve = (e: React.DragEvent<HTMLElement>) => {
		const current = drag.get()
		if (!current) return null
		const found = getTarget(e)
		const move = found ? resolveDrop(current, found.target) : null
		return found && move ? { source: current, move, indicator: found.indicator } : null
	}

	const handlers = {
		onDragOver: (e: React.DragEvent<HTMLElement>) => {
			const result = resolve(e)
			if (!result) {
				setIndicator(null)
				return
			}
			// Accepting the drop
			e.preventDefault()
			e.stopPropagation()
			e.dataTransfer.dropEffect = 'move'
			setIndicator(result.indicator)
		},
		onDragLeave: (e: React.DragEvent<HTMLElement>) => {
			if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIndicator(null)
		},
		onDrop: (e: React.DragEvent<HTMLElement>) => {
			setIndicator(null)
			const result = resolve(e)
			if (!result) return
			e.preventDefault()
			e.stopPropagation()
			drag.set(null)
			const { source: moved, move } = result
			api
				.move(moved.location, moved.entityId, move.newOwnerId, move.newLocation, move.newIndex)
				.catch((err) => window.alert(`Companion refused the move: ${err}`))
		},
	}

	// A drag that ended anywhere clears every indicator
	return { indicator: source ? indicator : null, handlers }
}
