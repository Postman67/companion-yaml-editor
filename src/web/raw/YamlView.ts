import { yaml } from '@codemirror/lang-yaml'
import { Compartment, EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'
import { basicSetup } from 'codemirror'

const themeFor = (dark: boolean) => (dark ? oneDark : [])

/** A read-only CodeMirror view of a YAML document */
export class YamlView {
	readonly #view: EditorView
	readonly #theme = new Compartment()

	constructor(parent: HTMLElement, dark: boolean) {
		this.#view = new EditorView({
			parent,
			state: EditorState.create({
				doc: '',
				extensions: [basicSetup, yaml(), EditorState.readOnly.of(true), this.#theme.of(themeFor(dark))],
			}),
		})
	}

	setDark(dark: boolean): void {
		this.#view.dispatch({ effects: this.#theme.reconfigure(themeFor(dark)) })
	}

	destroy(): void {
		this.#view.destroy()
	}

	get text(): string {
		return this.#view.state.doc.toString()
	}

	/**
	 * Replace the document. When `keepPosition` is set (the same control was updated) the scroll position
	 * and cursor are kept, so live updates don't throw the reader back to the top.
	 */
	setText(text: string, keepPosition: boolean): void {
		if (text === this.text) return

		const scrollTop = this.#view.scrollDOM.scrollTop
		const cursor = Math.min(this.#view.state.selection.main.head, text.length)

		this.#view.dispatch({
			changes: { from: 0, to: this.#view.state.doc.length, insert: text },
			selection: { anchor: keepPosition ? cursor : 0 },
		})

		this.#view.scrollDOM.scrollTop = keepPosition ? scrollTop : 0
	}
}
