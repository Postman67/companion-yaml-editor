import {
	InstanceBase,
	InstanceStatus,
	runEntrypoint,
	type CompanionHTTPRequest,
	type CompanionHTTPResponse,
	type SomeCompanionConfigField,
} from '@companion-module/base'
import webAssets from 'virtual:web-assets'

type ModuleConfig = Record<string, never>

/**
 * A connection module whose only job is to serve the editor page at `/instance/<label>/`.
 * All of the editing happens in the browser, which talks to Companion's own tRPC api directly.
 */
class YamlEditorInstance extends InstanceBase<ModuleConfig> {
	async init(_config: ModuleConfig): Promise<void> {
		this.#showUrl()
	}

	async destroy(): Promise<void> {}

	/** Also called when the connection is renamed, which moves the page to the new label */
	async configUpdated(_config: ModuleConfig): Promise<void> {
		this.#showUrl()
	}

	#showUrl(): void {
		this.updateStatus(InstanceStatus.Ok, `Open /instance/${this.label}/`)
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return [
			{
				id: 'info',
				type: 'static-text',
				label: 'Button editor',
				value: `Open the editor at <a href="/instance/${this.label}/" target="_blank">/instance/${this.label}/</a>`,
				width: 12,
			},
		]
	}

	handleHttpRequest(request: CompanionHTTPRequest): CompanionHTTPResponse {
		if (request.method !== 'GET' && request.method !== 'HEAD') {
			return { status: 405, body: 'Method not allowed' }
		}

		// Relative asset urls only resolve correctly with a trailing slash on the page url
		const [urlPath, query] = request.originalUrl.split('?', 2)
		if (request.path === '/' && !urlPath?.endsWith('/')) {
			return { status: 302, headers: { Location: `${urlPath}/${query ? `?${query}` : ''}` } }
		}

		const asset = webAssets[request.path === '/' ? '/index.html' : request.path]
		if (!asset) return { status: 404, body: 'Not found' }

		return {
			status: 200,
			headers: { 'Content-Type': asset.contentType, 'Cache-Control': 'no-cache' },
			body: asset.body,
		}
	}
}

runEntrypoint(YamlEditorInstance, [])
