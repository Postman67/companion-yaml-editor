import type { EntityDefinition, EntityModel, JsonValue, OptionField } from '../api/CompanionApi.js'

/** One piece of an entity's one-line summary */
export type SummaryPart =
	| { kind: 'text'; label: string | null; text: string }
	| { kind: 'expression'; label: string | null; text: string }
	| { kind: 'color'; label: string | null; color: string }
	/** A button location, e.g. `4/1/5`; rendered with a thumbnail of that button */
	| { kind: 'location'; label: string | null; location: string }

export interface SummaryContext {
	connectionLabel: (connectionId: string) => string
	pageName: (pageNumber: number) => string | undefined
}

const LOCATION_PATTERN = /^\d+\/-?\d+\/-?\d+$/
const MAX_TEXT = 60

/** The row's title: the user's headline, else the definition's label */
export function entityTitle(entity: EntityModel, definition: EntityDefinition | undefined): string {
	return entity.headline || definition?.label || entity.definitionId
}

/**
 * Summarise an entity's option values for its collapsed row, in definition order, skipping hidden and
 * empty fields. Choice ids become their labels; expressions stay as written.
 */
export function summariseEntity(
	entity: EntityModel,
	definition: EntityDefinition | undefined,
	visibility: ReadonlyMap<string, boolean>,
	ctx: SummaryContext
): SummaryPart[] {
	if (!definition) {
		// Unknown definition (module missing or disabled): show the raw values
		return Object.entries(entity.options).flatMap(([key, entry]) => {
			if (!entry || entry.value === undefined || entry.value === '') return []
			const kind = entry.isExpression ? 'expression' : 'text'
			return [{ kind, label: key, text: truncate(formatRaw(entry.value)) }]
		})
	}

	const visibleFields = definition.options.filter(
		(field) => field.type !== 'static-text' && visibility.get(field.id) !== false
	)
	// A single field needs no label: "wait 200" reads better than "Time expression (ms): 200"
	const withLabels = visibleFields.length > 1

	const parts: SummaryPart[] = []
	for (const field of visibleFields) {
		const entry = entity.options[field.id]
		if (!entry) continue
		const label = withLabels ? field.label : null

		if (entry.isExpression) {
			if (entry.value === '') continue
			if (field.id === 'location' && LOCATION_PATTERN.test(entry.value)) {
				parts.push({ kind: 'location', label, location: entry.value })
			} else {
				parts.push({ kind: 'expression', label, text: truncate(entry.value) })
			}
			continue
		}

		const part = summariseValue(field, entry.value, label, ctx)
		if (part) parts.push(part)
	}
	return parts
}

function summariseValue(
	field: OptionField,
	value: JsonValue | undefined,
	label: string | null,
	ctx: SummaryContext
): SummaryPart | null {
	if (value === undefined || value === null || value === '') return null

	switch (field.type) {
		case 'dropdown':
			return { kind: 'text', label, text: truncate(choiceLabel(field, value)) }
		case 'multidropdown': {
			if (!Array.isArray(value) || value.length === 0) return null
			return { kind: 'text', label, text: truncate(value.map((v) => choiceLabel(field, v)).join(', ')) }
		}
		case 'checkbox':
			// Only mention ticked boxes, by name
			return value === true ? { kind: 'text', label: null, text: field.label } : null
		case 'colorpicker':
			return { kind: 'color', label, color: formatColor(value) }
		case 'internal:connection_id': {
			const ids = Array.isArray(value) ? value : [value]
			const text = ids.map((id) => (id === 'all' ? 'all' : ctx.connectionLabel(String(id)))).join(', ')
			return { kind: 'text', label, text: truncate(text) }
		}
		case 'internal:page':
			return { kind: 'text', label, text: formatPage(value, ctx) }
		case 'internal:custom_variable':
			return { kind: 'text', label, text: `$(custom:${value})` }
		case 'textinput':
		case 'expression': {
			const text = formatRaw(value)
			if (field.id === 'location' && LOCATION_PATTERN.test(text)) return { kind: 'location', label, location: text }
			return { kind: field.type === 'expression' ? 'expression' : 'text', label, text: truncate(text) }
		}
		default:
			return { kind: 'text', label, text: truncate(formatRaw(value)) }
	}
}

function choiceLabel(field: OptionField, value: JsonValue): string {
	// Loose comparison: choice ids may be numbers while stored values are strings, or vice versa
	const choice = field.choices?.find((c) => String(c.id) === String(value))
	return choice?.label ?? formatRaw(value)
}

function formatPage(value: JsonValue, ctx: SummaryContext): string {
	if (value === 0 || value === '0') return 'this page'
	if (value === 'startup' || value === 'back' || value === 'forward') return value
	const pageNumber = Number(value)
	const name = Number.isFinite(pageNumber) ? ctx.pageName(pageNumber) : undefined
	return name ? `page ${pageNumber} (${name})` : `page ${formatRaw(value)}`
}

/** Companion colours are 0xRRGGBB numbers (with alpha above), or css strings */
export function formatColor(value: JsonValue): string {
	if (typeof value === 'number') return `#${(value & 0xffffff).toString(16).padStart(6, '0')}`
	return formatRaw(value)
}

function formatRaw(value: JsonValue): string {
	return typeof value === 'string' ? value : JSON.stringify(value)
}

function truncate(text: string): string {
	const singleLine = text.replace(/\s*\n\s*/g, ' ')
	return singleLine.length > MAX_TEXT ? `${singleLine.slice(0, MAX_TEXT - 1)}…` : singleLine
}
