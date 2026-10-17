import fastJsonPatch from 'fast-json-patch'
import type {
	ClientConnectionsUpdate,
	ControlConfig,
	ControlLocation,
	PageModelChanges,
	UIControlUpdate,
	UserConfigGridSize,
	UserConfigUpdate,
	WrappedImage,
} from './CompanionApi.js'
import { controlToYaml } from './ControlYaml.js'
import {
	applyPageChanges,
	formatLocationHash,
	getControlIdAt,
	getPage,
	parseLocationHash,
	type PagesState,
} from './PagesState.js'
import { createCompanionClient, subscribe, type ConnectionState } from './trpc.js'
import { YamlView } from './YamlView.js'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

const rootEl = document.querySelector<HTMLElement>('.yaml-editor')!
const statusEl = $<HTMLSpanElement>('status')
const selectionEl = $<HTMLSpanElement>('selection')
const pageSelectEl = $<HTMLSelectElement>('page-select')
const gridEl = $<HTMLDivElement>('grid')
const controlInfoEl = $<HTMLSpanElement>('control-info')
const copyButtonEl = $<HTMLButtonElement>('copy-button')

const STATUS_TEXT: Record<ConnectionState, string> = {
	connecting: 'Connecting…',
	open: 'Connected',
	closed: 'Disconnected',
}

const client = createCompanionClient((state) => {
	statusEl.dataset.state = state
	statusEl.textContent = STATUS_TEXT[state]
})
const yamlView = new YamlView($('editor'))

const reportError = (what: string) => (err: Error) => console.error(`${what} failed`, err)

// ---- State ----

let pagesState: PagesState | null = null
let gridSize: UserConfigGridSize = { minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 }
const connectionLabels = new Map<string, string>()

let selectedLocation: ControlLocation = parseLocationHash(window.location.hash) ?? {
	pageNumber: 1,
	row: 0,
	column: 0,
}

interface WatchedControl {
	controlId: string
	config: ControlConfig | null
	stop: () => void
}
/** The control currently shown in the editor */
let watched: WatchedControl | null = null

// ---- Companion subscriptions ----

subscribe<PageModelChanges>(
	client,
	'pages.watch',
	undefined,
	(change) => {
		pagesState = applyPageChanges(pagesState, change)
		renderPageSelect()
		renderGrid()
		syncWatchedControl()
	},
	reportError('pages.watch')
)

subscribe<UserConfigUpdate>(
	client,
	'userConfig.watchConfig',
	undefined,
	(update) => {
		if (update.type === 'init') gridSize = update.config.gridSize
		else if (update.key === 'gridSize') gridSize = update.value as UserConfigGridSize
		else return
		renderGrid()
	},
	reportError('userConfig.watchConfig')
)

subscribe<ClientConnectionsUpdate[] | ClientConnectionsUpdate>(
	client,
	'instances.connections.watch',
	undefined,
	(updates) => {
		for (const update of Array.isArray(updates) ? updates : [updates]) {
			if (update.type === 'init') {
				connectionLabels.clear()
				for (const info of Object.values(update.info)) connectionLabels.set(info.id, info.label)
			} else if (update.type === 'update') {
				connectionLabels.set(update.id, update.info.label)
			} else {
				connectionLabels.delete(update.id)
			}
		}
		renderYaml(true)
	},
	reportError('instances.connections.watch')
)

// ---- Selection ----

window.addEventListener('hashchange', () => {
	const location = parseLocationHash(window.location.hash)
	if (!location) return
	selectedLocation = location
	renderPageSelect()
	renderGrid()
	syncWatchedControl()
})

pageSelectEl.addEventListener('change', () => {
	selectLocation({ ...selectedLocation, pageNumber: Number(pageSelectEl.value) })
})

copyButtonEl.addEventListener('click', () => {
	navigator.clipboard.writeText(yamlView.text).catch(reportError('copy'))
})

function selectLocation(location: ControlLocation): void {
	window.location.hash = formatLocationHash(location)
}

/** Make sure the editor is watching whatever control is at the selected location */
function syncWatchedControl(): void {
	const controlId = pagesState ? getControlIdAt(pagesState, selectedLocation) : null
	if (watched?.controlId === controlId) return

	watched?.stop()
	watched = null

	if (controlId) {
		const current: WatchedControl = {
			controlId,
			config: null,
			stop: subscribe<UIControlUpdate>(
				client,
				'controls.watchControl',
				{ controlId },
				(update) => {
					if (watched !== current) return
					if (update.type === 'init') {
						current.config = update.config
						renderYaml(false)
					} else if (update.type === 'config' && current.config) {
						current.config = fastJsonPatch.applyPatch(structuredClone(current.config), update.patch).newDocument
						renderYaml(true)
					} else if (update.type === 'destroy') {
						current.config = null
						renderYaml(false)
					}
				},
				reportError('controls.watchControl')
			),
		}
		watched = current
	}

	renderYaml(false)
}

// ---- Rendering ----

function renderYaml(keepPosition: boolean): void {
	const { pageNumber, row, column } = selectedLocation
	const pageName = pagesState ? getPage(pagesState, pageNumber)?.name : undefined
	selectionEl.textContent = `Page ${pageNumber}${pageName ? ` (${pageName})` : ''} · row ${row} · column ${column}`

	const config = watched?.config ?? null
	rootEl.dataset.hasControl = String(!!config)
	copyButtonEl.disabled = !config
	controlInfoEl.textContent = watched ? `${watched.controlId}${config ? ` · ${config.type}` : ''}` : 'Empty location'

	if (config) yamlView.setText(controlToYaml(config, connectionLabels), keepPosition)
}

function renderPageSelect(): void {
	if (!pagesState) return

	const options = pagesState.order.map((id, index) => {
		const option = document.createElement('option')
		option.value = String(index + 1)
		option.textContent = `${index + 1}: ${pagesState?.pages[id]?.name || 'PAGE'}`
		return option
	})
	pageSelectEl.replaceChildren(...options)
	pageSelectEl.value = String(selectedLocation.pageNumber)
}

let previewStops: Array<() => void> = []
let renderedGridKey = ''

function renderGrid(): void {
	if (!pagesState) return

	const { pageNumber } = selectedLocation
	const gridKey = JSON.stringify([pageNumber, gridSize])

	// Only rebuild (and resubscribe the previews) when the page or grid size changes
	if (gridKey !== renderedGridKey) {
		renderedGridKey = gridKey
		for (const stop of previewStops) stop()
		previewStops = []

		gridEl.style.gridTemplateColumns = `repeat(${gridSize.maxColumn - gridSize.minColumn + 1}, auto)`

		const cells: HTMLElement[] = []
		for (let row = gridSize.minRow; row <= gridSize.maxRow; row++) {
			for (let column = gridSize.minColumn; column <= gridSize.maxColumn; column++) {
				const location = { pageNumber, row, column }

				const cell = document.createElement('button')
				cell.type = 'button'
				cell.className = 'cell unused'
				cell.title = `Row ${row}, column ${column}`
				cell.dataset.row = String(row)
				cell.dataset.column = String(column)
				cell.addEventListener('click', () => selectLocation(location))

				const img = document.createElement('img')
				img.alt = ''
				cell.append(img)
				cells.push(cell)

				previewStops.push(
					subscribe<WrappedImage>(
						client,
						'preview.graphics.location',
						{ location },
						(image) => {
							if (image.image) img.src = image.image
							cell.classList.toggle('unused', !image.isUsed)
						},
						reportError('preview.graphics.location')
					)
				)
			}
		}
		gridEl.replaceChildren(...cells)
	}

	for (const cell of gridEl.querySelectorAll<HTMLElement>('.cell')) {
		cell.classList.toggle(
			'selected',
			Number(cell.dataset.row) === selectedLocation.row && Number(cell.dataset.column) === selectedLocation.column
		)
	}
}
