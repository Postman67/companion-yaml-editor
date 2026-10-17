import { createContext, useContext, useEffect, useState } from 'react'
import fastJsonPatch from 'fast-json-patch'
import type {
	ClientConnectionConfig,
	ClientConnectionsUpdate,
	ControlConfig,
	ControlLocation,
	CustomVariableInfo,
	CustomVariablesUpdate,
	EntityDefinitions,
	EntityDefinitionUpdate,
	PageModelChanges,
	UIControlUpdate,
	UserConfigGridSize,
	UserConfigUpdate,
	WrappedImage,
} from '../api/CompanionApi.js'
import { subscribe, type CompanionClient, type ConnectionState } from '../api/trpc.js'
import { applyDefinitionUpdate } from './Definitions.js'
import { applyPageChanges, type PagesState } from './PagesState.js'
import { Store } from './Store.js'

const reportError = (what: string) => (err: Error) => console.error(`${what} failed`, err)

/** The Companion-wide state the editor needs, kept live from Companion's subscriptions */
export class CompanionStores {
	readonly client: CompanionClient
	readonly connectionState: Store<ConnectionState>

	readonly pages = new Store<PagesState | null>(null)
	readonly gridSize = new Store<UserConfigGridSize>({ minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 })
	readonly connections = new Store<ReadonlyMap<string, ClientConnectionConfig>>(new Map())
	readonly actionDefinitions = new Store<EntityDefinitions>({})
	readonly feedbackDefinitions = new Store<EntityDefinitions>({})
	readonly customVariables = new Store<Readonly<Record<string, CustomVariableInfo>>>({})

	constructor(client: CompanionClient, connectionState: Store<ConnectionState>) {
		this.client = client
		this.connectionState = connectionState

		subscribe<PageModelChanges>(
			client,
			'pages.watch',
			undefined,
			(change) => this.pages.update((state) => applyPageChanges(state, change)),
			reportError('pages.watch')
		)

		subscribe<UserConfigUpdate>(
			client,
			'userConfig.watchConfig',
			undefined,
			(update) => {
				if (update.type === 'init') this.gridSize.set(update.config.gridSize)
				else if (update.key === 'gridSize') this.gridSize.set(update.value as UserConfigGridSize)
			},
			reportError('userConfig.watchConfig')
		)

		subscribe<ClientConnectionsUpdate[]>(
			client,
			'instances.connections.watch',
			undefined,
			(updates) =>
				this.connections.update((current) => {
					const next = new Map(current)
					for (const update of updates) {
						if (update.type === 'init') {
							next.clear()
							for (const info of Object.values(update.info)) next.set(info.id, info)
						} else if (update.type === 'update') {
							next.set(update.id, update.info)
						} else {
							next.delete(update.id)
						}
					}
					return next
				}),
			reportError('instances.connections.watch')
		)

		for (const [path, store] of [
			['instances.definitions.actions', this.actionDefinitions],
			['instances.definitions.feedbacks', this.feedbackDefinitions],
		] as const) {
			subscribe<EntityDefinitionUpdate>(
				client,
				path,
				undefined,
				(update) => store.update((state) => applyDefinitionUpdate(state, update)),
				reportError(path)
			)
		}

		subscribe<CustomVariablesUpdate[]>(
			client,
			'customVariables.watch',
			undefined,
			(updates) =>
				this.customVariables.update((current) => {
					const next = { ...current }
					for (const update of updates) {
						if (update.type === 'init') {
							for (const key of Object.keys(next)) delete next[key]
							Object.assign(next, update.info)
						} else if (update.type === 'update') {
							next[update.itemId] = update.info
						} else {
							delete next[update.itemId]
						}
					}
					return next
				}),
			reportError('customVariables.watch')
		)
	}

	connectionLabel(connectionId: string): string {
		if (connectionId === 'internal') return 'internal'
		return this.connections.get().get(connectionId)?.label ?? connectionId
	}
}

export const StoresContext = createContext<CompanionStores | null>(null)

export function useStores(): CompanionStores {
	const stores = useContext(StoresContext)
	if (!stores) throw new Error('useStores used outside of StoresContext')
	return stores
}

/** The live config of a control, or null while loading / once it is deleted */
export function useControlConfig(controlId: string | null): ControlConfig | null {
	const { client } = useStores()
	const [config, setConfig] = useState<ControlConfig | null>(null)

	useEffect(() => {
		setConfig(null)
		if (!controlId) return

		let current: ControlConfig | null = null
		return subscribe<UIControlUpdate>(
			client,
			'controls.watchControl',
			{ controlId },
			(update) => {
				if (update.type === 'init') {
					current = update.config
				} else if (update.type === 'config' && current) {
					current = fastJsonPatch.applyPatch(structuredClone(current), update.patch).newDocument
				} else if (update.type === 'destroy') {
					current = null
				} else {
					return
				}
				setConfig(current)
			},
			reportError('controls.watchControl')
		)
	}, [client, controlId])

	return config
}

/** The rendered image of the button at a location */
export function useLocationPreview(location: ControlLocation | null): WrappedImage | null {
	const { client } = useStores()
	const [image, setImage] = useState<WrappedImage | null>(null)
	const key = location ? `${location.pageNumber}/${location.row}/${location.column}` : null

	useEffect(() => {
		setImage(null)
		if (!location) return
		return subscribe<WrappedImage>(
			client,
			'preview.graphics.location',
			{ location },
			setImage,
			reportError('preview.graphics.location')
		)
		// eslint-disable-next-line react-hooks/exhaustive-deps -- `key` identifies the location
	}, [client, key])

	return image
}
