// Development helper: load a Companion export (.companionconfig, gzipped or plain JSON) into a Companion,
// replacing its buttons, triggers, connections and variables. Uses the same upload + import api as the
// web UI's Import page.
//
//   node scripts/import-config.mjs --url http://127.0.0.1:8100 path/to/export.json
//
// This WIPES the target Companion's configuration. Only point it at a test instance.
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { createTRPCUntypedClient, createWSClient, wsLink } from '@trpc/client'

const CHUNK_SIZE = 512 * 1024

const { values: args, positionals } = parseArgs({
	options: { url: { type: 'string' } },
	allowPositionals: true,
})
if (!args.url || positionals.length !== 1) {
	console.error('Usage: node scripts/import-config.mjs --url http://127.0.0.1:8100 <export file>')
	process.exit(1)
}

const baseUrl = new URL(args.url)
const data = await fs.readFile(positionals[0])

const wsClient = createWSClient({ url: `${baseUrl.protocol === 'https:' ? 'wss' : 'ws'}://${baseUrl.host}/trpc` })
const client = createTRPCUntypedClient({ links: [wsLink({ client: wsClient })] })

try {
	// The upload and the import must happen on the same connection: the parsed file is held on it
	const sessionId = await client.mutation('importExport.prepareImport.start', {
		name: 'import.companionconfig',
		size: data.length,
	})
	if (!sessionId) throw new Error('Companion refused to start the upload (another upload in progress?)')

	for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
		await client.mutation('importExport.prepareImport.uploadChunk', {
			sessionId,
			offset,
			data: data.subarray(offset, offset + CHUNK_SIZE).toString('base64'),
		})
	}

	const [parseError, summary] = await client.mutation('importExport.prepareImport.complete', {
		sessionId,
		expectedChecksum: createHash('sha1').update(data).digest('hex'),
		userData: null,
	})
	if (parseError) throw new Error(`Companion could not read the file: ${parseError}`)
	console.log(`Parsed: ${Object.keys(summary?.instances ?? {}).length} connections`)

	const { runId } = await client.mutation('importExport.importFull', {
		config: {
			buttons: 'reset-and-import',
			surfaces: { known: 'reset', instances: 'reset', remote: 'reset' },
			triggers: 'reset-and-import',
			customVariables: 'reset-and-import',
			expressionVariables: 'reset-and-import',
			connections: 'reset',
			userconfig: 'unchanged',
			imageLibrary: 'reset-and-import',
		},
	})

	await new Promise((resolve, reject) => {
		const sub = client.subscription('importExport.importExportTaskStatus', undefined, {
			onData: (task) => {
				// { type, runId, status: 'running' | 'completed', error: string | null }
				if (task?.runId === runId && task.status === 'completed') {
					sub.unsubscribe()
					if (task.error) reject(new Error(task.error))
					else resolve()
				}
			},
			onError: reject,
		})
	})
	console.log('Import complete')
} catch (e) {
	console.error(`Import failed: ${e instanceof Error ? e.message : e}`)
	process.exitCode = 1
} finally {
	wsClient.close()
}
