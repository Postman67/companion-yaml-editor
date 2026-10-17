import { Document, isScalar, visit } from 'yaml'

/**
 * Render a control's config (as sent by `controls.watchControl`) as YAML.
 *
 * The structure is kept exactly as Companion stores it, so that the write path can later diff the edited
 * document back against the original. Readability comes from annotations only: each `connectionId` gets
 * the connection's label as a trailing comment.
 */
export function controlToYaml(config: unknown, connectionLabels: ReadonlyMap<string, string>): string {
	const doc = new Document(config)

	visit(doc, {
		Pair(_key, pair) {
			if (!isScalar(pair.key) || pair.key.value !== 'connectionId') return
			if (!isScalar(pair.value) || typeof pair.value.value !== 'string') return

			const label = connectionLabels.get(pair.value.value)
			if (label && label !== pair.value.value) pair.value.comment = ` ${label}`
		},
	})

	// lineWidth 0: never fold long strings (expressions, base64 images) onto multiple lines
	return doc.toString({ lineWidth: 0 })
}
