import { describe, expect, test } from 'vitest'
import type { EntityDefinition, EntityModel } from '../src/web/api/CompanionApi.js'
import { createDragSource, resolveDrop, type DropTarget } from '../src/web/outline/DragDrop.js'

const press = { stepId: '0', setId: 'down' as const }
const release = { stepId: '0', setId: 'up' as const }

function action(id: string, children?: EntityModel['children']): EntityModel {
	return { type: 'action', id, definitionId: 'x', connectionId: 'internal', options: {}, upgradeIndex: undefined, children }
}

function feedbackDefinition(feedbackType: EntityDefinition['feedbackType']): EntityDefinition {
	return {
		entityType: 'feedback',
		label: 'f',
		sortKey: null,
		description: undefined,
		options: [],
		feedbackType,
		hasLearn: false,
		showInvert: true,
		optionsSupportExpressions: false,
		supportsChildGroups: [],
		showButtonPreview: false,
	}
}

const target = (overrides: Partial<DropTarget>): DropTarget => ({
	location: press,
	ownerId: null,
	entityType: 'action',
	feedbackListType: null,
	index: 0,
	...overrides,
})

describe('resolveDrop', () => {
	// press list: [a, ifBlock, c]; ifBlock has then: [b1, b2]
	const ifBlock = action('if1', { actions: [action('b1'), action('b2', { actions: [action('deep')] })], else_actions: [] })
	const a = createDragSource(action('a'), press, null, 0, undefined)

	test('reorder within a list uses the final index', () => {
		// a (index 0) dropped before c (index 2) ends up at index 1
		expect(resolveDrop(a, target({ index: 2 }))).toEqual({ newLocation: press, newOwnerId: null, newIndex: 1 })
		// dropped at the end of the 3-item list
		expect(resolveDrop(a, target({ index: 3 }))).toEqual({ newLocation: press, newOwnerId: null, newIndex: 2 })
		const c = createDragSource(action('c'), press, null, 2, undefined)
		expect(resolveDrop(c, target({ index: 0 }))).toEqual({ newLocation: press, newOwnerId: null, newIndex: 0 })
	})

	test('dropping where it already is does nothing', () => {
		expect(resolveDrop(a, target({ index: 0 }))).toBeNull()
		expect(resolveDrop(a, target({ index: 1 }))).toBeNull()
	})

	test('moves into a group', () => {
		const owner = { parentId: 'if1', childGroup: 'actions' }
		expect(resolveDrop(a, target({ ownerId: owner, index: 1 }))).toEqual({ newLocation: press, newOwnerId: owner, newIndex: 1 })
		// into an empty else
		const elseOwner = { parentId: 'if1', childGroup: 'else_actions' }
		expect(resolveDrop(a, target({ ownerId: elseOwner, index: 0 }))).toEqual({
			newLocation: press,
			newOwnerId: elseOwner,
			newIndex: 0,
		})
	})

	test('moves out of a group, and across lists', () => {
		const b1 = createDragSource(action('b1'), press, { parentId: 'if1', childGroup: 'actions' }, 0, undefined)
		expect(resolveDrop(b1, target({ index: 2 }))).toEqual({ newLocation: press, newOwnerId: null, newIndex: 2 })
		expect(resolveDrop(a, target({ location: release, index: 0 }))).toEqual({
			newLocation: release,
			newOwnerId: null,
			newIndex: 0,
		})
	})

	test('never into itself or its own children', () => {
		const source = createDragSource(ifBlock, press, null, 1, undefined)
		expect(resolveDrop(source, target({ ownerId: { parentId: 'if1', childGroup: 'actions' } }))).toBeNull()
		expect(resolveDrop(source, target({ ownerId: { parentId: 'b2', childGroup: 'actions' } }))).toBeNull()
	})

	test('actions and feedbacks stay apart', () => {
		expect(resolveDrop(a, target({ location: 'feedbacks', entityType: 'feedback' }))).toBeNull()
	})

	test('condition lists only take boolean feedbacks', () => {
		const condition = { parentId: 'op1', childGroup: 'default' }
		const fbTarget = target({ location: 'feedbacks', entityType: 'feedback', ownerId: condition, feedbackListType: 'boolean' })
		const advanced = createDragSource(
			{ ...action('adv'), type: 'feedback' },
			'feedbacks',
			null,
			0,
			feedbackDefinition('advanced')
		)
		const boolean = createDragSource(
			{ ...action('bool'), type: 'feedback' },
			'feedbacks',
			null,
			0,
			feedbackDefinition('boolean')
		)
		expect(resolveDrop(advanced, fbTarget)).toBeNull()
		expect(resolveDrop(boolean, fbTarget)).not.toBeNull()
	})
})
