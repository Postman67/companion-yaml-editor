import { describe, expect, test } from 'vitest'
import { parse } from 'yaml'
import { controlToYaml } from '../src/web/ControlYaml.js'

const sampleControl = {
	type: 'button-layered',
	options: { rotaryActions: false, stepProgression: 'auto' },
	steps: {
		'0': {
			action_sets: {
				down: [
					{
						id: 'act1',
						type: 'action',
						definitionId: 'set_source',
						connectionId: 'conn_abc',
						options: { source: 3, expression: 'concat(\n  $(internal:time_hms),\n  " live"\n)' },
					},
				],
				up: [],
			},
		},
	},
	feedbacks: [{ id: 'fb1', type: 'feedback', definitionId: 'variable_value', connectionId: 'internal', options: {} }],
}

describe('controlToYaml', () => {
	test('round-trips to the same data', () => {
		const yaml = controlToYaml(sampleControl, new Map())
		expect(parse(yaml)).toEqual(sampleControl)
	})

	test('annotates connectionId with the connection label', () => {
		const yaml = controlToYaml(sampleControl, new Map([['conn_abc', 'atem']]))
		expect(yaml).toContain('connectionId: conn_abc # atem')
		expect(parse(yaml)).toEqual(sampleControl)
	})

	test('does not annotate when the label equals the id', () => {
		const yaml = controlToYaml(sampleControl, new Map([['internal', 'internal']]))
		expect(yaml).toContain('connectionId: internal\n')
	})

	test('renders multi-line strings as block scalars', () => {
		const yaml = controlToYaml(sampleControl, new Map())
		expect(yaml).toMatch(/expression: \|-?\n\s+concat\(/)
	})

	test('does not fold long strings', () => {
		const long = 'x'.repeat(500)
		const yaml = controlToYaml({ type: 'button-layered', style: { png64: long } }, new Map())
		expect(yaml).toContain(`png64: ${long}\n`)
	})
})
