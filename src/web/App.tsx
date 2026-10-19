import { useEffect, useState } from 'react'
import { LockScreen, useAdminLock } from './AdminLock.js'
import type { ControlConfig, ControlLocation } from './api/CompanionApi.js'
import { ButtonOutline } from './outline/ButtonOutline.js'
import { RawView } from './raw/RawView.js'
import { Sidebar } from './Sidebar.js'
import { useControlConfig, useStores } from './stores/CompanionStores.js'
import { formatLocationHash, getControlIdAt, getPage, parseLocationHash } from './stores/PagesState.js'
import { useStore } from './stores/Store.js'
import { setThemePreference, useThemePreference, type ThemePreference } from './Theme.js'

const STATUS_TEXT = { connecting: 'Connecting…', open: 'Connected', closed: 'Disconnected' } as const

type Tab = 'outline' | 'raw'

export function App() {
	const stores = useStores()
	const connectionState = useStore(stores.connectionState)
	const pages = useStore(stores.pages)

	const location = useHashLocation()
	const [tab, setTab] = useState<Tab>('outline')
	const adminLock = useAdminLock()

	const controlId = pages ? getControlIdAt(pages, location) : null
	const config = useControlConfig(adminLock.state === 'unlocked' ? controlId : null)
	const pageName = pages ? getPage(pages, location.pageNumber)?.name : undefined

	return (
		<div className="button-editor">
			<header className="topbar">
				<h1>Button editor</h1>
				<span className="selection">
					Page {location.pageNumber}
					{pageName ? ` (${pageName})` : ''} · row {location.row} · column {location.column}
				</span>
				<ThemePicker />
				{adminLock.lock ? (
					<button type="button" className="lock-button" title="Lock the editor" onClick={adminLock.lock}>
						Lock
					</button>
				) : null}
				<span className="status" data-state={connectionState}>
					{STATUS_TEXT[connectionState]}
				</span>
			</header>

			{adminLock.state === 'loading' ? (
				<p className="lock-screen empty">Connecting to Companion…</p>
			) : adminLock.state === 'locked' ? (
				<LockScreen onUnlock={adminLock.unlock} />
			) : (
				<>
					<Sidebar location={location} onSelect={(l) => (window.location.hash = formatLocationHash(l))} />
					<Content tab={tab} setTab={setTab} controlId={controlId} config={config} />
				</>
			)}
		</div>
	)
}

function Content({
	tab,
	setTab,
	controlId,
	config,
}: {
	tab: Tab
	setTab: (tab: Tab) => void
	controlId: string | null
	config: ControlConfig | null
}) {
	return (
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
					<ButtonOutline controlId={controlId} config={config} />
				) : (
					<RawView config={config} />
				)}
			</div>
		</main>
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

function ThemePicker() {
	const preference = useThemePreference()
	return (
		<label className="theme-picker">
			<span>Theme</span>
			<select value={preference} onChange={(e) => setThemePreference(e.target.value as ThemePreference)}>
				<option value="system">System</option>
				<option value="light">Light</option>
				<option value="dark">Dark</option>
			</select>
		</label>
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
