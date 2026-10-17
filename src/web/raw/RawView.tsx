import { useEffect, useRef } from 'react'
import type { ControlConfig } from '../api/CompanionApi.js'
import { useStores } from '../stores/CompanionStores.js'
import { useStore } from '../stores/Store.js'
import { useIsDark } from '../Theme.js'
import { controlToYaml } from './ControlYaml.js'
import { YamlView } from './YamlView.js'

/** The control's full config as read-only YAML, for checking exactly what Companion stores */
export function RawView({ config }: { config: ControlConfig }) {
	const stores = useStores()
	const connections = useStore(stores.connections)
	const parentRef = useRef<HTMLDivElement>(null)
	const viewRef = useRef<YamlView | null>(null)

	const dark = useIsDark()

	useEffect(() => {
		if (!parentRef.current) return
		// The theme is applied by the effect below, which runs straight after this one
		viewRef.current = new YamlView(parentRef.current, false)
		return () => {
			viewRef.current?.destroy()
			viewRef.current = null
		}
	}, [])

	useEffect(() => {
		viewRef.current?.setDark(dark)
	}, [dark])

	useEffect(() => {
		const labels = new Map([...connections.values()].map((c) => [c.id, c.label]))
		viewRef.current?.setText(controlToYaml(config, labels), true)
	}, [config, connections])

	return <div className="raw-view" ref={parentRef} />
}
