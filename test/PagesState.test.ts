import { describe, expect, test } from 'vitest'
import {
	applyPageChanges,
	formatLocationHash,
	getControlIdAt,
	parseLocationHash,
	type PagesState,
} from '../src/web/PagesState.js'

const initState = (): PagesState =>
	applyPageChanges(null, {
		type: 'init',
		order: ['p1', 'p2'],
		pages: {
			p1: { id: 'p1', name: 'One', controls: { 0: { 0: 'bank:a', 1: 'bank:b' } } },
			p2: { id: 'p2', name: 'Two', controls: {} },
			gone: undefined,
		},
	})

describe('applyPageChanges', () => {
	test('init', () => {
		const state = initState()
		expect(state.order).toEqual(['p1', 'p2'])
		expect(Object.keys(state.pages)).toEqual(['p1', 'p2'])
		expect(getControlIdAt(state, { pageNumber: 1, row: 0, column: 1 })).toBe('bank:b')
		expect(getControlIdAt(state, { pageNumber: 2, row: 0, column: 1 })).toBeNull()
		expect(getControlIdAt(state, { pageNumber: 3, row: 0, column: 0 })).toBeNull()
	})

	test('control added, replaced and removed', () => {
		const before = initState()
		const state = applyPageChanges(before, {
			type: 'update',
			updatedOrder: null,
			added: [],
			changes: [
				{
					id: 'p1',
					name: null,
					controls: [
						{ row: 0, column: 0, controlId: null },
						{ row: 0, column: 1, controlId: 'bank:c' },
						{ row: 2, column: 3, controlId: 'bank:d' },
					],
				},
			],
		})

		expect(getControlIdAt(state, { pageNumber: 1, row: 0, column: 0 })).toBeNull()
		expect(getControlIdAt(state, { pageNumber: 1, row: 0, column: 1 })).toBe('bank:c')
		expect(getControlIdAt(state, { pageNumber: 1, row: 2, column: 3 })).toBe('bank:d')
		expect(state.pages.p1?.name).toBe('One')
		// the previous state is untouched
		expect(getControlIdAt(before, { pageNumber: 1, row: 0, column: 0 })).toBe('bank:a')
	})

	test('page added, renamed and reordered', () => {
		const state = applyPageChanges(initState(), {
			type: 'update',
			updatedOrder: ['p3', 'p1', 'p2'],
			added: [{ id: 'p3', name: 'Three', controls: { 1: { 1: 'bank:e' } } }],
			changes: [{ id: 'p2', name: 'Renamed', controls: [] }],
		})

		expect(state.order).toEqual(['p3', 'p1', 'p2'])
		expect(getControlIdAt(state, { pageNumber: 1, row: 1, column: 1 })).toBe('bank:e')
		expect(state.pages.p2?.name).toBe('Renamed')
	})
})

describe('location hash', () => {
	test('round-trips', () => {
		const location = { pageNumber: 3, row: 1, column: -1 }
		expect(parseLocationHash(formatLocationHash(location))).toEqual(location)
	})

	test('rejects garbage', () => {
		expect(parseLocationHash('')).toBeNull()
		expect(parseLocationHash('#/1/2')).toBeNull()
		expect(parseLocationHash('#/a/1/2')).toBeNull()
	})
})
