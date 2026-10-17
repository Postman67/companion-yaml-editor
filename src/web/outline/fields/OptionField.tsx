import type { ExpressionOrValue, JsonValue, OptionField as OptionFieldDefinition } from '../../api/CompanionApi.js'
import { CommitTextInput } from './CommitTextInput.js'
import { OptionControl } from './OptionControl.js'

/**
 * One option: its label, the value control, and the value/expression toggle.
 * Follows Companion's `OptionsInputField` + `FieldOrExpression` (webui/src/Controls, Components).
 */
export function OptionField({
	field,
	value,
	supportsExpressions,
	allowInternalFields,
	onChange,
}: {
	field: OptionFieldDefinition
	value: ExpressionOrValue<JsonValue | undefined> | undefined
	/** The definition allows expressions and this field doesn't opt out */
	supportsExpressions: boolean
	allowInternalFields: boolean
	onChange: (value: ExpressionOrValue<JsonValue | undefined>) => void
}) {
	if (field.type === 'static-text') {
		return field.value ? <p className="static-text">{stripMarkdown(field.value)}</p> : null
	}

	const canToggle = supportsExpressions && field.type !== 'expression'
	const isExpression = value?.isExpression === true

	const description = isExpression ? (field.expressionDescription ?? field.description) : field.description

	return (
		<div className="option-row">
			<span className="option-label" title={field.tooltip}>
				{field.label}
			</span>
			<div className="option-control">
				{isExpression ? (
					<CommitTextInput
						value={String(value.value)}
						multiline
						monospace
						onCommit={(text) => onChange({ isExpression: true, value: text })}
					/>
				) : (
					<OptionControl
						field={field}
						value={value?.value}
						allowInternalFields={allowInternalFields}
						onChange={(raw) =>
							// Expression-type fields are always stored as expressions
							onChange(
								field.type === 'expression'
									? { isExpression: true, value: String(raw ?? '') }
									: { isExpression: false, value: raw }
							)
						}
					/>
				)}
				{description ? <span className="option-description">{description}</span> : null}
			</div>
			{canToggle ? (
				<button
					type="button"
					className={`expression-toggle${isExpression ? ' active' : ''}`}
					title={isExpression ? 'Use a fixed value' : 'Use an expression'}
					onClick={() =>
						onChange(
							isExpression
								? // No re-typing back to a value, matching Companion
									{ isExpression: false, value: value?.value }
								: { isExpression: true, value: stringifyValue(value?.value) }
						)
					}
				>
					ƒ
				</button>
			) : null}
		</div>
	)
}

/** Companion's `stringifyVariableValue`, used when switching a value to an expression */
function stringifyValue(value: JsonValue | undefined): string {
	if (value === undefined || value === null) return ''
	if (typeof value === 'string') return value
	if (typeof value === 'number' || typeof value === 'boolean') return value.toString()
	return JSON.stringify(value)
}

function stripMarkdown(text: string): string {
	return text.replace(/[*_`#>]/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
}
