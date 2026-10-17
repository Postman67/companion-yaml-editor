import { useId } from 'react'
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
	const selected = new Set((Array.isArray(value) ? value : []).map(String))
	const choices = field.choices ?? []
	return (
		<div className="multi-choices">
			{choices.map((c) => (
				<label key={String(c.id)}>
					<input
						type="checkbox"
						checked={selected.has(String(c.id))}
						onChange={(e) => {
							const next = choices
								.filter((x) => (String(x.id) === String(c.id) ? e.target.checked : selected.has(String(x.id))))
								.map((x) => x.id)
							onChange(next)
						}}
					/>
					{c.label}
				</label>
			))}
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
	const isHex = /^#[0-9a-f]{6}$/i.test(hex)
	return (
		<span className="color-control">
			<input
				type="color"
				value={isHex ? hex : '#000000'}
				onChange={(e) => {
					const rgb = parseInt(e.target.value.slice(1), 16)
					if (field.returnType === 'string') {
						const alpha = typeof value === 'string' ? (/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/.exec(value)?.[1] ?? '1') : '1'
						onChange(`rgba(${(rgb >> 16) & 255}, ${(rgb >> 8) & 255}, ${rgb & 255}, ${alpha})`)
					} else {
						const alphaPart = typeof value === 'number' ? Math.floor(value / 0x1000000) * 0x1000000 : 0
						onChange(alphaPart + rgb)
					}
				}}
			/>
			<span className="muted">{hex}</span>
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
		const selected = new Set(Array.isArray(value) ? value.map(String) : [])
		return (
			<div className="multi-choices">
				{options.map((o) => (
					<label key={o.id}>
						<input
							type="checkbox"
							checked={selected.has(o.id)}
							onChange={(e) =>
								onChange(options.filter((x) => (x.id === o.id ? e.target.checked : selected.has(x.id))).map((x) => x.id))
							}
						/>
						{o.label}
					</label>
				))}
			</div>
		)
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
