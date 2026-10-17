import { describe, expect, test } from 'vitest'
import type { EntityDefinition, EntityDefinitions } from '../src/web/api/CompanionApi.js'
import { applyDefinitionUpdate } from '../src/web/stores/Definitions.js'

const def = (label: string): EntityDefinition => ({
	entityType: 'action',
	label,
	sortKey: null,
	description: undefined,
	options: [],
	feedbackType: null,
	hasLearn: false,
	showInvert: false,
	optionsSupportExpressions: false,
	supportsChildGroups: [],
	showButtonPreview: false,
})

describe('applyDefinitionUpdate', () => {
	const initial: EntityDefinitions = { conn1: { cut: def('Cut'), auto: def('Auto') } }

	test('init replaces everything', () => {
		expect(applyDefinitionUpdate({ old: {} }, { type: 'init', definitions: initial })).toBe(initial)
	})

	test('add and forget a connection', () => {
		const added = applyDefinitionUpdate(initial, { type: 'add-connection', connectionId: 'conn2', entities: { x: def('X') } })
		expect(Object.keys(added)).toEqual(['conn1', 'conn2'])
		const forgotten = applyDefinitionUpdate(added, { type: 'forget-connection', connectionId: 'conn1' })
		expect(Object.keys(forgotten)).toEqual(['conn2'])
	})

	test('update a connection: remove, patch and add', () => {
		const next = applyDefinitionUpdate(initial, {
			type: 'update-connection',
			connectionId: 'conn1',
			removed: ['auto'],
			changed: { cut: [{ op: 'replace', path: '/label', value: 'Cut (renamed)' }] },
			added: { mix: def('Mix') },
		})
		expect(Object.keys(next.conn1 ?? {}).sort()).toEqual(['cut', 'mix'])
		expect(next.conn1?.cut?.label).toBe('Cut (renamed)')
		// the input is not modified
		expect(initial.conn1?.cut?.label).toBe('Cut')
		expect(initial.conn1?.auto).toBeDefined()
	})
})
