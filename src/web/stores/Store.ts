import { useSyncExternalStore } from 'react'

/** A minimal observable value for React, read with `useStore` */
export class Store<T> {
	#value: T
	readonly #listeners = new Set<() => void>()

	constructor(initial: T) {
		this.#value = initial
	}

	get = (): T => this.#value

	set(value: T): void {
		if (value === this.#value) return
		this.#value = value
		for (const listener of this.#listeners) listener()
	}

	update(fn: (value: T) => T): void {
		this.set(fn(this.#value))
	}

	subscribe = (listener: () => void): (() => void) => {
		this.#listeners.add(listener)
		return () => this.#listeners.delete(listener)
	}
}

export function useStore<T>(store: Store<T>): T {
	return useSyncExternalStore(store.subscribe, store.get)
}
