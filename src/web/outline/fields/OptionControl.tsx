import { useEffect, useId, useRef, useState } from 'react'
import type { JsonValue, OptionField } from '../../api/CompanionApi.js'
import { useStores } from '../../stores/CompanionStores.js'
import { useStore } from '../../stores/Store.js'
import { formatColor } from '../Summarise.js'
import { CommitTextInput } from './CommitTextInput.js'

/**
 * The control for one option's (non-expression) value, by field type.
 * Follows Companion's `OptionsInputControl` and `InternalModuleField` (webui/src/Controls) for what each
 * type stores. Types without a dedicated control fall back to editing the raw JSON value.
 */
export function OptionControl({
	field,
	value,
	allowInternalFields,
	onChange,
}: {
	field: OptionField
	value: JsonValue | undefined
	allowInternalFields: boolean
	onChange: (value: JsonValue | undefined) => void
}) {
	switch (field.type) {
		case 'textinput':
			return (
				<CommitTextInput
					value={value === undefined || value === null ? '' : String(value)}
					multiline={field.multiline}
					placeholder={field.placeholder}
					onCommit={onChange}
				/>
			)
		case 'expression':
			return <CommitTextInput value={value == null ? '' : String(value)} multiline monospace onCommit={onChange} />
		case 'number':
			return <NumberControl field={field} value={value} onChange={onChange} />
		case 'checkbox':
			return <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
		case 'dropdown':
			return <DropdownControl field={field} value={value} onChange={onChange} />
		case 'multidropdown':
			return <MultiDropdownControl field={field} value={value} onChange={onChange} />
		case 'colorpicker':
			return <ColorControl field={field} value={value} onChange={onChange} />
	}

	if (allowInternalFields) {
		switch (field.type) {
			case 'internal:connection_id':
				return <ConnectionControl field={field} value={value} onChange={onChange} />
			case 'internal:page':
				return <PageControl field={field} value={value} onChange={onChange} />
			case 'internal:custom_variable':
				return <CustomVariableControl field={field} value={value} onChange={onChange} />
		}
	}

	return <RawJsonControl value={value} onChange={onChange} />
}

type ControlProps = { field: OptionField; value: JsonValue | undefined; onChange: (value: JsonValue | undefined) => void }

function NumberControl({ field, value, onChange }: ControlProps) {
	return (
		<CommitTextInput
			value={value === undefined || value === null ? '' : String(value)}
			placeholder={field.allowNull ? 'auto' : undefined}
			onCommit={(text) => {
				if (text.trim() === '') return onChange(field.allowNull ? null : (field.default ?? 0))
				const number = Number(text)
				if (!Number.isFinite(number)) return
				const clamped = Math.min(field.max ?? Infinity, Math.max(field.min ?? -Infinity, number))
				onChange(clamped)
			}}
		/>
	)
}

function DropdownControl({ field, value, onChange }: ControlProps) {
	const listId = useId()
	const choices = field.choices ?? []
	// Choice ids can be numbers or strings; send back the choice's own id
	const choiceFor = (text: string) => choices.find((c) => String(c.id) === text)

	if (field.allowCustom) {
		return (
			<>
				<CommitTextInput
					value={value == null ? '' : String(value)}
					list={listId}
					onCommit={(text) => onChange(choiceFor(text)?.id ?? text)}
				/>
				<datalist id={listId}>
					{choices.map((c) => (
						<option key={String(c.id)} value={String(c.id)}>
							{c.label}
						</option>
					))}
				</datalist>
			</>
		)
	}

	const known = choiceFor(String(value))
	return (
		<select value={String(value)} onChange={(e) => onChange(choiceFor(e.target.value)?.id ?? e.target.value)}>
			{!known ? <option value={String(value)}>{value == null ? '(none)' : `${String(value)} (unknown)`}</option> : null}
			{choices.map((c) => (
				<option key={String(c.id)} value={String(c.id)}>
					{c.label}
				</option>
			))}
		</select>
	)
}

function MultiDropdownControl({ field, value, onChange }: ControlProps) {
	return (
		<MultiChoiceControl
			choices={field.choices ?? []}
			value={value}
			minSelection={field.minSelection}
			maxSelection={field.maxSelection}
			onChange={onChange}
		/>
	)
}

/**
 * Checkboxes for a list value. Ticking or unticking one only adds or removes that id: stored ids that
 * aren't among the choices (yet, e.g. a module that lists them once it reaches its device) are kept,
 * and shown so they can still be removed.
 */
function MultiChoiceControl({
	choices,
	value,
	minSelection,
	maxSelection,
	onChange,
}: {
	choices: Array<{ id: string | number; label: string }>
	value: JsonValue | undefined
	minSelection?: number
	maxSelection?: number
	onChange: (value: JsonValue[]) => void
}) {
	const current = Array.isArray(value) ? value : []
	const known = new Set(choices.map((c) => String(c.id)))
	const items: Array<{ id: JsonValue; label: string }> = [
		...choices,
		...current.filter((id) => !known.has(String(id))).map((id) => ({ id, label: `${String(id)} (unknown)` })),
	]
	const selected = new Set(current.map(String))

	return (
		<div className="multi-choices">
			{items.map((item) => {
				const key = String(item.id)
				const checked = selected.has(key)
				const disabled = checked
					? current.length <= (minSelection ?? 0)
					: current.length >= (maxSelection ?? Infinity)
				return (
					<label key={key}>
						<input
							type="checkbox"
							checked={checked}
							disabled={disabled}
							onChange={(e) => {
								const without = current.filter((id) => String(id) !== key)
								onChange(e.target.checked ? [...without, item.id] : without)
							}}
						/>
						{item.label}
					</label>
				)
			})}
		</div>
	)
}

/**
 * Colours are `0xRRGGBB` numbers, with alpha stored above as `0x1000000 * round(255 * (1 - a))`
 * (Companion's `ColorInputField`), or `rgba(r, g, b, a)` strings when `returnType` is 'string'.
 * The native picker has no alpha, so any existing alpha is kept.
 */
function ColorControl({ field, value, onChange }: ControlProps) {
	const hex = value == null ? '#000000' : formatColor(value)
	const pickerValue = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#000000'

	// React's onChange fires for every movement while the picker is open, so that only previews the colour;
	// the native `change` event (the picker closed on a colour) is what gets sent to Companion
	const [draft, setDraft] = useState<string | null>(null)
	useEffect(() => setDraft(null), [value])

	const inputRef = useRef<HTMLInputElement>(null)
	const latest = useRef({ field, value, pickerValue, onChange })
	latest.current = { field, value, pickerValue, onChange }

	useEffect(() => {
		const input = inputRef.current
		if (!input) return
		const commit = () => {
			const { field, value, pickerValue, onChange } = latest.current
			if (input.value === pickerValue) return setDraft(null)
			const rgb = parseInt(input.value.slice(1), 16)
			if (field.returnType === 'string') {
				const alpha = typeof value === 'string' ? (/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/.exec(value)?.[1] ?? '1') : '1'
				onChange(`rgba(${(rgb >> 16) & 255}, ${(rgb >> 8) & 255}, ${rgb & 255}, ${alpha})`)
			} else {
				const alphaPart = typeof value === 'number' ? Math.floor(value / 0x1000000) * 0x1000000 : 0
				onChange(alphaPart + rgb)
			}
		}
		input.addEventListener('change', commit)
		return () => input.removeEventListener('change', commit)
	}, [])

	return (
		<span className="color-control">
			<input ref={inputRef} type="color" value={draft ?? pickerValue} onChange={(e) => setDraft(e.target.value)} />
			<span className="muted">{draft ?? hex}</span>
		</span>
	)
}

function ConnectionControl({ field, value, onChange }: ControlProps) {
	const stores = useStores()
	const connections = [...useStore(stores.connections).values()].sort((a, b) => a.sortOrder - b.sortOrder)
	const options = [
		...(field.includeAll ? [{ id: 'all', label: 'All connections' }] : []),
		{ id: 'internal', label: 'internal' },
		...connections.map((c) => ({ id: c.id, label: c.label })),
	]

	if (field.multiple) {
		return <MultiChoiceControl choices={options} value={value} onChange={onChange} />
	}

	return (
		<select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
			{options.map((o) => (
				<option key={o.id} value={o.id}>
					{o.label}
				</option>
			))}
		</select>
	)
}

function PageControl({ field, value, onChange }: ControlProps) {
	const stores = useStores()
	const pages = useStore(stores.pages)
	const options: Array<{ id: string | number; label: string }> = [{ id: 0, label: 'This page' }]
	if (field.includeStartup) options.push({ id: 'startup', label: 'Startup page' })
	if (field.includeDirection) options.push({ id: 'back', label: 'Back' }, { id: 'forward', label: 'Forward' })
	pages?.order.forEach((id, index) =>
		options.push({ id: index + 1, label: `${index + 1}: ${pages.pages[id]?.name || 'PAGE'}` })
	)

	return (
		<select
			value={String(value ?? 0)}
			onChange={(e) => onChange(options.find((o) => String(o.id) === e.target.value)?.id ?? e.target.value)}
		>
			{options.map((o) => (
				<option key={String(o.id)} value={String(o.id)}>
					{o.label}
				</option>
			))}
		</select>
	)
}

function CustomVariableControl({ field, value, onChange }: ControlProps) {
	const stores = useStores()
	const names = Object.keys(useStore(stores.customVariables)).sort()
	const current = String(value ?? '')
	return (
		<select value={current} onChange={(e) => onChange(e.target.value)}>
			{field.includeNone || current === '' ? <option value="">None</option> : null}
			{current && !names.includes(current) ? <option value={current}>{current} (unknown)</option> : null}
			{names.map((name) => (
				<option key={name} value={name}>
					{name}
				</option>
			))}
		</select>
	)
}

/** Fallback: edit the stored value as JSON */
function RawJsonControl({ value, onChange }: Omit<ControlProps, 'field'>) {
	return (
		<CommitTextInput
			value={value === undefined ? '' : JSON.stringify(value)}
			monospace
			onCommit={(text) => {
				if (text.trim() === '') return onChange(undefined)
				try {
					onChange(JSON.parse(text))
				} catch {
					onChange(text)
				}
			}}
		/>
	)
}
