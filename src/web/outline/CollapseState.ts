import { useSyncExternalStore } from 'react'

/**
 * Which rows of a button are open for editing, and which child groups are folded away.
 * Kept per button in localStorage, so it survives reloads (like Companion's own editor, which uses
 * localStorage for its collapse state too). Rows start closed; child groups start unfolded.
 */
export class CollapseState {
	readonly #key: string
	#state: { open: string[]; folded: string[] }
	readonly #listeners = new Set<() => void>()

	constructor(controlId: string) {
		this.#key = `button-editor:collapse:${controlId}`
		this.#state = { open: [], folded: [] }
		try {
			const saved = JSON.parse(localStorage.getItem(this.#key) ?? 'null')
			if (saved && Array.isArray(saved.open) && Array.isArray(saved.folded)) this.#state = saved
		} catch {
			// unavailable or corrupt storage: start fresh
		}
	}

	isOpen = (entityId: string) => this.#state.open.includes(entityId)
	isFolded = (groupKey: string) => this.#state.folded.includes(groupKey)

	setOpen(entityId: string, open: boolean): void {
		this.#set('open', entityId, open)
	}
	setFolded(groupKey: string, folded: boolean): void {
		this.#set('folded', groupKey, folded)
	}

	#set(list: 'open' | 'folded', id: string, included: boolean): void {
		const without = this.#state[list].filter((x) => x !== id)
		this.#state = { ...this.#state, [list]: included ? [...without, id] : without }
		try {
			localStorage.setItem(this.#key, JSON.stringify(this.#state))
		} catch {
			// not persisted, but still applied for this session
		}
		for (const listener of this.#listeners) listener()
	}

	subscribe = (listener: () => void) => {
		this.#listeners.add(listener)
		return () => this.#listeners.delete(listener)
	}
	snapshot = () => this.#state
}

/** Re-render when the collapse state changes */
export function useCollapseState(collapse: CollapseState): CollapseState {
	useSyncExternalStore(collapse.subscribe, collapse.snapshot)
	return collapse
}
