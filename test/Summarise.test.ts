import { describe, expect, test } from 'vitest'
import type { EntityDefinition, EntityModel, OptionField } from '../src/web/api/CompanionApi.js'
import { entityTitle, formatColor, summariseEntity, type SummaryContext } from '../src/web/outline/Summarise.js'

const ctx: SummaryContext = {
	connectionLabel: (id) => ({ conn_hd8: 'HD8', conn_atem: 'ATEM' })[id] ?? id,
	pageName: (n) => (n === 4 ? 'PP7' : undefined),
}

function definition(options: OptionField[], extra: Partial<EntityDefinition> = {}): EntityDefinition {
	return {
		entityType: 'action',
		label: 'Some action',
		sortKey: null,
		description: undefined,
		options,
		feedbackType: null,
		hasLearn: false,
		showInvert: false,
		optionsSupportExpressions: true,
		supportsChildGroups: [],
		showButtonPreview: false,
		...extra,
	}
}

function entity(options: EntityModel['options'], extra: Partial<EntityModel> = {}): EntityModel {
	return {
		type: 'action',
		id: 'e1',
		definitionId: 'some_action',
		connectionId: 'conn_hd8',
		options,
		upgradeIndex: undefined,
		...extra,
	}
}

const v = <T,>(value: T) => ({ value, isExpression: false as const })
const expr = (value: string) => ({ value, isExpression: true as const })

describe('entityTitle', () => {
	test('prefers the headline', () => {
		expect(entityTitle(entity({}, { headline: 'Turn off HD8 DSK1' }), definition([]))).toBe('Turn off HD8 DSK1')
	})
	test('falls back to the definition label, then the id', () => {
		expect(entityTitle(entity({}), definition([]))).toBe('Some action')
		expect(entityTitle(entity({}), undefined)).toBe('some_action')
	})
})

describe('summariseEntity', () => {
	const dskDefinition = definition([
		{ id: 'key', type: 'number', label: 'Key' },
		{
			id: 'onair',
			type: 'dropdown',
			label: 'On air',
			choices: [
				{ id: 'true', label: 'On' },
				{ id: 'false', label: 'Off' },
				{ id: 'toggle', label: 'Toggle' },
			],
		},
		{ id: 'help', type: 'static-text', label: 'Help', value: 'Some help' },
	])

	test('labels values and maps choice ids to labels', () => {
		const parts = summariseEntity(entity({ key: v(1), onair: v('false') }), dskDefinition, new Map(), ctx)
		expect(parts).toEqual([
			{ kind: 'text', label: 'Key', text: '1' },
			{ kind: 'text', label: 'On air', text: 'Off' },
		])
	})

	test('matches numeric choice ids against string values', () => {
		const def = definition([{ id: 'input', type: 'dropdown', label: 'Input', choices: [{ id: 6, label: 'Camera 6' }] }])
		expect(summariseEntity(entity({ input: v('6') }), def, new Map(), ctx)).toEqual([
			{ kind: 'text', label: null, text: 'Camera 6' },
		])
	})

	test('skips hidden fields', () => {
		const parts = summariseEntity(
			entity({ key: v(1), onair: v('false') }),
			dskDefinition,
			new Map([['onair', false]]),
			ctx
		)
		// Only one field is left visible, so it loses its label
		expect(parts).toEqual([{ kind: 'text', label: null, text: '1' }])
	})

	test('a single visible field has no label', () => {
		const waitDefinition = definition([{ id: 'time', type: 'expression', label: 'Time expression (ms)' }])
		expect(summariseEntity(entity({ time: expr('200') }), waitDefinition, new Map(), ctx)).toEqual([
			{ kind: 'expression', label: null, text: '200' },
		])
	})

	test('recognises button locations', () => {
		const def = definition([
			{ id: 'location', type: 'textinput', label: 'Location' },
			{ id: 'force', type: 'checkbox', label: 'Force' },
		])
		expect(summariseEntity(entity({ location: v('4/1/5'), force: v(false) }), def, new Map(), ctx)).toEqual([
			{ kind: 'location', label: 'Location', location: '4/1/5' },
		])
		expect(
			summariseEntity(entity({ location: v('$(this:page)/$(this:row)/$(this:column)') }), def, new Map(), ctx)[0]
		).toEqual({ kind: 'text', label: 'Location', text: '$(this:page)/$(this:row)/$(this:column)' })
	})

	test('only names ticked checkboxes', () => {
		const def = definition([
			{ id: 'a', type: 'checkbox', label: 'Alpha' },
			{ id: 'b', type: 'checkbox', label: 'Beta' },
		])
		expect(summariseEntity(entity({ a: v(true), b: v(false) }), def, new Map(), ctx)).toEqual([
			{ kind: 'text', label: null, text: 'Alpha' },
		])
	})

	test('resolves connections, pages and custom variables', () => {
		const def = definition([
			{ id: 'conn', type: 'internal:connection_id', label: 'Connection' },
			{ id: 'page', type: 'internal:page', label: 'Page' },
			{ id: 'page2', type: 'internal:page', label: 'Other page' },
			{ id: 'name', type: 'internal:custom_variable', label: 'Variable' },
		])
		expect(
			summariseEntity(entity({ conn: v('conn_atem'), page: v(4), page2: v(0), name: v('hd8_preview_store') }), def, new Map(), ctx)
		).toEqual([
			{ kind: 'text', label: 'Connection', text: 'ATEM' },
			{ kind: 'text', label: 'Page', text: 'page 4 (PP7)' },
			{ kind: 'text', label: 'Other page', text: 'this page' },
			{ kind: 'text', label: 'Variable', text: '$(custom:hd8_preview_store)' },
		])
	})

	test('colours', () => {
		const def = definition([{ id: 'color', type: 'colorpicker', label: 'Colour' }])
		expect(summariseEntity(entity({ color: v(39168) }), def, new Map(), ctx)).toEqual([
			{ kind: 'color', label: null, color: '#009900' },
		])
		expect(formatColor(0xff0000)).toBe('#ff0000')
	})

	test('flattens and truncates long text', () => {
		const def = definition([{ id: 'expression', type: 'expression', label: 'Expression' }])
		const long = `concat(\n  ${'x'.repeat(100)}\n)`
		const [part] = summariseEntity(entity({ expression: v(long) }), def, new Map(), ctx)
		expect(part).toMatchObject({ kind: 'expression' })
		expect(part && 'text' in part && part.text.length).toBe(60)
		expect(part && 'text' in part && part.text.includes('\n')).toBe(false)
	})

	test('shows raw values when the definition is unknown', () => {
		expect(summariseEntity(entity({ key: v(1), empty: v(''), e: expr('$(a:b)') }), undefined, new Map(), ctx)).toEqual([
			{ kind: 'text', label: 'key', text: '1' },
			{ kind: 'expression', label: 'e', text: '$(a:b)' },
		])
	})
})
