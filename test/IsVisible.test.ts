import { describe, expect, test } from 'vitest'
import type { OptionField } from '../src/web/api/CompanionApi.js'
import { computeOptionsVisibility, convertExpressionOptionsWithoutParsing } from '../src/web/companion/IsVisible.js'

const v = <T,>(value: T) => ({ value, isExpression: false as const })

describe('computeOptionsVisibility', () => {
	test('expression visibility against plain options', () => {
		const fields: OptionField[] = [
			{ id: 'mode', type: 'dropdown', label: 'Mode' },
			{ id: 'detail', type: 'textinput', label: 'Detail', isVisibleUi: { type: 'expression', fn: "$(options:mode) == 'custom'" } },
		]
		expect(computeOptionsVisibility(fields, false, { mode: v('custom') }).get('detail')).toBe(true)
		expect(computeOptionsVisibility(fields, false, { mode: v('preset') }).get('detail')).toBe(false)
	})

	test('$(data:x) reads the definition data', () => {
		const fields: OptionField[] = [
			{ id: 'mode', type: 'dropdown', label: 'Mode' },
			{
				id: 'detail',
				type: 'textinput',
				label: 'Detail',
				isVisibleUi: { type: 'expression', fn: '$(options:mode) == $(data:wanted)', data: { wanted: 'b' } },
			},
		]
		expect(computeOptionsVisibility(fields, false, { mode: v('b') }).get('detail')).toBe(true)
		expect(computeOptionsVisibility(fields, false, { mode: v('a') }).get('detail')).toBe(false)
	})

	test('function visibility runs in the sandbox', () => {
		const fields: OptionField[] = [
			{ id: 'mode', type: 'dropdown', label: 'Mode' },
			{ id: 'detail', type: 'textinput', label: 'Detail', isVisibleUi: { type: 'function', fn: "(o) => o.mode === 'a'" } },
		]
		expect(computeOptionsVisibility(fields, false, { mode: v('a') }).get('detail')).toBe(true)
		expect(computeOptionsVisibility(fields, false, { mode: v('b') }).get('detail')).toBe(false)
	})

	test('with expression support, only fields that cannot be expressions may be referenced', () => {
		const fields: OptionField[] = [
			{ id: 'locked', type: 'dropdown', label: 'Locked', disableAutoExpression: true },
			{ id: 'free', type: 'dropdown', label: 'Free' },
			{ id: 'a', type: 'textinput', label: 'A', isVisibleUi: { type: 'expression', fn: "$(options:locked) == 'x'" } },
			{ id: 'b', type: 'textinput', label: 'B', isVisibleUi: { type: 'expression', fn: "$(options:free) == 'x'" } },
		]
		const visibility = computeOptionsVisibility(fields, true, { locked: v('y'), free: v('y') })
		expect(visibility.get('a')).toBe(false)
		// Referencing an expression-capable field fails open, as in Companion
		expect(visibility.get('b')).toBe(true)
	})

	test('fields without isVisible are left out (visible)', () => {
		const fields: OptionField[] = [{ id: 'mode', type: 'dropdown', label: 'Mode' }]
		expect(computeOptionsVisibility(fields, false, {}).has('mode')).toBe(false)
	})
})

test('convertExpressionOptionsWithoutParsing unwraps values', () => {
	expect(
		convertExpressionOptionsWithoutParsing({ a: v(1), b: { value: '$(x:y)', isExpression: true }, c: undefined })
	).toEqual({ a: 1, b: '$(x:y)', c: undefined })
})
