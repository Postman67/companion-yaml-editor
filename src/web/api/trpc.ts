import { createTRPCUntypedClient, createWSClient, wsLink } from '@trpc/client'

/**
 * Companion's web UI talks to the backend over a tRPC websocket at `/trpc`, with no data transformer.
 * This page is served by Companion itself (under `/instance/<label>/`), so it is same-origin and passes
 * Companion's websocket Origin check.
 *
 * We use the untyped client: the router type lives inside Companion and is version-specific, so the few
 * procedures we use are typed by hand in `CompanionApi.ts`, against Companion 5.1.
 */
export type ConnectionState = 'connecting' | 'open' | 'closed'

export function createCompanionClient(onStateChange: (state: ConnectionState) => void) {
	const url = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/trpc`

	onStateChange('connecting')
	const wsClient = createWSClient({
		url,
		keepAlive: { enabled: true },
		onOpen: () => onStateChange('open'),
		onClose: () => onStateChange('closed'),
	})

	return createTRPCUntypedClient({
		links: [wsLink({ client: wsClient })],
	})
}

export type CompanionClient = ReturnType<typeof createCompanionClient>

/** Subscribe to a tRPC subscription, returning a function to stop it */
export function subscribe<T>(
	client: CompanionClient,
	path: string,
	input: unknown,
	onData: (data: T) => void,
	onError: (err: Error) => void
): () => void {
	const sub = client.subscription(path, input, {
		onData: (data) => onData(data as T),
		onError: (err) => onError(err),
	})
	return () => sub.unsubscribe()
}
