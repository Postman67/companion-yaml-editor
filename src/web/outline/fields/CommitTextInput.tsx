import { useEffect, useState } from 'react'

/**
 * A text box that only sends its value when you finish editing (blur, or Enter on a single line), so
 * typing doesn't fire a change at Companion for every keystroke. Escape reverts.
 */
export function CommitTextInput({
	value,
	onCommit,
	multiline = false,
	monospace = false,
	placeholder,
	list,
}: {
	value: string
	onCommit: (value: string) => void
	multiline?: boolean
	monospace?: boolean
	placeholder?: string
	/** id of a <datalist> of suggestions (single line only) */
	list?: string
}) {
	const [draft, setDraft] = useState(value)
	const [editing, setEditing] = useState(false)

	// Follow live changes from Companion, unless the user is mid-edit
	useEffect(() => {
		if (!editing) setDraft(value)
	}, [value, editing])

	const commit = () => {
		setEditing(false)
		if (draft !== value) onCommit(draft)
	}

	const common = {
		className: monospace ? 'monospace' : undefined,
		value: draft,
		placeholder,
		onFocus: () => setEditing(true),
		onBlur: commit,
		onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
		onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			if (e.key === 'Escape') {
				setDraft(value)
				setEditing(false)
				e.currentTarget.blur()
			} else if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) {
				e.preventDefault()
				e.currentTarget.blur()
			}
		},
	}

	if (multiline) {
		const rows = Math.min(12, Math.max(2, draft.split('\n').length))
		return <textarea {...common} rows={rows} />
	}
	return <input type="text" list={list} {...common} />
}
