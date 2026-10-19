// Shared by the scripts that talk to a running Companion over its tRPC websocket api.
import { createTRPCUntypedClient, createWSClient, wsLink } from '@trpc/client'

/** An untyped tRPC client for the Companion at `baseUrl` (a URL) */
export function connectCompanion(baseUrl) {
	const wsClient = createWSClient({ url: `${baseUrl.protocol === 'https:' ? 'wss' : 'ws'}://${baseUrl.host}/trpc` })
	const client = createTRPCUntypedClient({ links: [wsLink({ client: wsClient })] })
	return { client, close: () => wsClient.close() }
}

/**
 * The websocket client retries forever, so give up if Companion doesn't answer in time. The timer is
 * cleared either way, so it doesn't keep the script running after it has finished.
 */
export async function withTimeout(promise, ms, message) {
	let timer
	try {
		return await Promise.race([
			promise,
			new Promise((_resolve, reject) => {
				timer = setTimeout(() => reject(new Error(message)), ms)
			}),
		])
	} finally {
		clearTimeout(timer)
	}
}
