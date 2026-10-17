import { useEffect, useState } from 'react'
import type { ControlLocation } from './api/CompanionApi.js'
import { ButtonOutline } from './outline/ButtonOutline.js'
import { RawView } from './raw/RawView.js'
import { Sidebar } from './Sidebar.js'
import { useControlConfig, useStores } from './stores/CompanionStores.js'
import { formatLocationHash, getControlIdAt, getPage, parseLocationHash } from './stores/PagesState.js'
import { useStore } from './stores/Store.js'

const STATUS_TEXT = { connecting: 'Connecting…', open: 'Connected', closed: 'Disconnected' } as const

type Tab = 'outline' | 'raw'

export function App() {
	const stores = useStores()
	const connectionState = useStore(stores.connectionState)
	const pages = useStore(stores.pages)

	const location = useHashLocation()
	const [tab, setTab] = useState<Tab>('outline')

	const controlId = pages ? getControlIdAt(pages, location) : null
	const config = useControlConfig(controlId)
	const pageName = pages ? getPage(pages, location.pageNumber)?.name : undefined

	return (
		<div className="button-editor">
			<header className="topbar">
				<h1>Button editor</h1>
				<span className="selection">
					Page {location.pageNumber}
					{pageName ? ` (${pageName})` : ''} · row {location.row} · column {location.column}
				</span>
				<span className="status" data-state={connectionState}>
					{STATUS_TEXT[connectionState]}
				</span>
			</header>

			<Sidebar location={location} onSelect={(l) => (window.location.hash = formatLocationHash(l))} />

			<main className="content">
				<div className="tabs" role="tablist">
					<TabButton tab="outline" current={tab} onSelect={setTab}>
						Outline
					</TabButton>
					<TabButton tab="raw" current={tab} onSelect={setTab}>
						Raw
					</TabButton>
					<span className="control-id">{controlId ?? 'Empty location'}</span>
				</div>
				<div className="tab-body">
					{!controlId ? (
						<p className="empty">Pick a button on the left.</p>
					) : !config ? (
						<p className="empty">Loading…</p>
					) : tab === 'outline' ? (
						<ButtonOutline controlId={controlId} config={config} location={location} />
					) : (
						<RawView config={config} />
					)}
				</div>
			</main>
		</div>
	)
}

function TabButton({
	tab,
	current,
	onSelect,
	children,
}: {
	tab: Tab
	current: Tab
	onSelect: (tab: Tab) => void
	children: React.ReactNode
}) {
	return (
		<button type="button" role="tab" aria-selected={tab === current} onClick={() => onSelect(tab)}>
			{children}
		</button>
	)
}

function useHashLocation(): ControlLocation {
	const read = () => parseLocationHash(window.location.hash) ?? { pageNumber: 1, row: 0, column: 0 }
	const [location, setLocation] = useState(read)
	useEffect(() => {
		const onChange = () => setLocation(read())
		window.addEventListener('hashchange', onChange)
		return () => window.removeEventListener('hashchange', onChange)
	}, [])
	return location
}
