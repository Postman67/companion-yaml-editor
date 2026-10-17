/**
 * Option visibility, ported from Bitfocus Companion v5.1.0 (MIT licence):
 *   shared-lib/lib/IsVisible.ts, shared-lib/lib/Expressions.ts and webui/src/Hooks/useOptionsAndIsVisible.ts
 *
 * Kept as close to the original as possible so a field shows and hides exactly as it does in Companion.
 */
import { ParseExpression, ResolveExpression } from '@companion-app/expressions'
import type { ExpressionableOptions, IsVisibleUiFn, JsonValue, OptionField } from '../api/CompanionApi.js'
import { sandbox } from './sandbox.js'

const VARIABLE_UNKNOWN_VALUE = '$NA'

type IsVisibleFn = (
	options: Record<string, JsonValue | undefined>,
	getOptionValue?: (id: string) => JsonValue | undefined
) => boolean

type CompiledIsVisibleExpressionFn = (
	getOptionValue: (name: string) => JsonValue | undefined,
	data: unknown
) => boolean

const compiledCache = new WeakMap<IsVisibleUiFn, CompiledIsVisibleExpressionFn>()

function getCompiledIsVisibleExpressionFn(isVisibleUi: IsVisibleUiFn): CompiledIsVisibleExpressionFn | null {
	if (isVisibleUi.type !== 'expression') return null

	const cached = compiledCache.get(isVisibleUi)
	if (cached) return cached

	const expression = ParseExpression(isVisibleUi.fn)

	const fn: CompiledIsVisibleExpressionFn = (getOptionValue, data) => {
		try {
			const getVariable = (label: string, name: string): JsonValue | undefined => {
				if (label === 'this' || label === 'options') return getOptionValue(name)
				if (label === 'data' && data && typeof data === 'object') return (data as Record<string, JsonValue>)[name]
				throw new Error(`Unknown variable "${label}:${name}"`)
			}

			const val = ResolveExpression(expression, {
				// Config-match expressions should be trivial - keep the budget tight
				maxOperations: 1000,
				maxCallDepth: 16,
				getVariableValue: (variableIdOrLabel, nameOrUndefined) => {
					if (nameOrUndefined !== undefined) return getVariable(variableIdOrLabel, nameOrUndefined)
					const splitIndex = variableIdOrLabel.indexOf(':')
					if (splitIndex === -1) throw new Error(`"${variableIdOrLabel}" is not a valid variable id`)
					return getVariable(variableIdOrLabel.slice(0, splitIndex), variableIdOrLabel.slice(splitIndex + 1))
				},
				parseVariables: null,
				unknownVariableValue: VARIABLE_UNKNOWN_VALUE,
				processTemplateEscapes: false,
				stringConcatenation: false,
			} as Parameters<typeof ResolveExpression>[1])
			return !!val && val !== 'false' && val !== '0'
		} catch {
			// Fail open: if visibility can't be determined, treat the field as visible
			return true
		}
	}

	compiledCache.set(isVisibleUi, fn)
	return fn
}

function parseIsVisibleFn(option: OptionField): IsVisibleFn | null {
	try {
		if (!option.isVisibleUi) return null

		switch (option.isVisibleUi.type) {
			case 'function': {
				const fn = sandbox(option.isVisibleUi.fn)
				const userData = structuredClone(option.isVisibleUi.data)
				return (options) => !!fn(options, userData)
			}
			case 'expression': {
				const compiled = getCompiledIsVisibleExpressionFn(option.isVisibleUi)
				if (!compiled) return null
				const userData = option.isVisibleUi.data
				return (options, getOptionValue) => compiled(getOptionValue ?? ((name) => options[name]), userData)
			}
			default:
				return null
		}
	} catch (e) {
		console.error('Failed to process isVisibleFn', e)
		return null
	}
}

const isVisibleFnCache = new WeakMap<OptionField[], { fns: Map<string, IsVisibleFn>; allowed: Set<string> }>()

/** Unwrap `{ value, isExpression }` option values, without evaluating any expressions */
export function convertExpressionOptionsWithoutParsing(
	options: ExpressionableOptions
): Record<string, JsonValue | undefined> {
	const result: Record<string, JsonValue | undefined> = {}
	for (const [key, entry] of Object.entries(options)) result[key] = entry?.value
	return result
}

/**
 * Which options are visible, given the current values. A field missing from the result is visible.
 * Mirrors `useOptionsVisibility` in Companion's webui.
 */
export function computeOptionsVisibility(
	fields: OptionField[],
	optionsSupportExpressions: boolean,
	optionValues: ExpressionableOptions
): ReadonlyMap<string, boolean> {
	let parsed = isVisibleFnCache.get(fields)
	if (!parsed) {
		parsed = { fns: new Map(), allowed: new Set() }
		for (const option of fields) {
			const fn = parseIsVisibleFn(option)
			if (fn) parsed.fns.set(option.id, fn)
			if (option.disableAutoExpression) parsed.allowed.add(option.id)
		}
		isVisibleFnCache.set(fields, parsed)
	}

	const visibility = new Map<string, boolean>()
	for (const [id, fn] of parsed.fns) {
		try {
			if (optionsSupportExpressions) {
				// Only fields that can't be expressions may be referenced
				const allowed = parsed.allowed
				const restrictedGetOptionValue = (optionId: string): JsonValue | undefined => {
					if (!allowed.has(optionId)) {
						throw new Error(`Access to option "${optionId}" not allowed, as it is either unknown or can be an expression.`)
					}
					return optionValues[optionId]?.value
				}
				visibility.set(id, fn({}, restrictedGetOptionValue))
			} else {
				visibility.set(id, fn(convertExpressionOptionsWithoutParsing(structuredClone(optionValues))))
			}
		} catch (e) {
			console.error('Failed to check visibility', e)
		}
	}
	return visibility
}
