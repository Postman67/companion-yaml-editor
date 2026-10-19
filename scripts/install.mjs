// Install the built module into a running Companion, over the same tRPC api the web UI uses.
//
//   node scripts/install.mjs [--url http://127.0.0.1:8000] [--label button_editor]
//
// This is what the "Import module package" button in Companion's Modules page does, followed by adding
// (or upgrading) a connection that uses it. Companion only accepts module imports from the local machine.
// Nothing inside Companion.app is modified, so app updates and code signing are unaffected.
//
// --label names the connection when one is created; existing connections of this module keep theirs.
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { connectCompanion, withTimeout } from './companion-client.mjs'

const root = path.resolve(import.meta.dirname, '..')
const SUPPORTED_COMPANION = /^5\.1\./

const { values: args } = parseArgs({
	options: {
		url: { type: 'string' },
		label: { type: 'string', default: 'button_editor' },
	},
})

// Read the whole package before touching Companion: a reinstall removes the installed copy first
let manifest, tarBuffer
try {
	manifest = JSON.parse(await fs.readFile(path.join(root, 'pkg/companion/manifest.json'), 'utf8'))
	tarBuffer = (await fs.readFile(path.join(root, `${manifest.id}-${manifest.version}.tgz`))).toString('base64')
} catch (e) {
	console.error(`No built package to install (${e instanceof Error ? e.message : e}). Run "npm run build" first.`)
	process.exit(1)
}
const moduleId = manifest.id
const versionId = manifest.version

const baseUrl = new URL(args.url ?? (await findLocalCompanionUrl()))

console.log(`Installing ${moduleId} v${versionId} into Companion at ${baseUrl.origin}`)

const { client, close } = connectCompanion(baseUrl)
/** Connections switched off for a same-version reinstall, to switch back on if it fails part way */
const disabledForSwap = []
let removedPreviousCopy = false

try {
	const appInfo = await withTimeout(
		client.query('appInfo.version', undefined),
		10_000,
		`Couldn't reach Companion at ${baseUrl.origin}. Is it running? (use --url to point elsewhere)`
	)
	console.log(`  Companion ${appInfo.appVersion} (${appInfo.appBuild})`)
	if (!SUPPORTED_COMPANION.test(appInfo.appVersion)) {
		console.warn(`  Warning: this editor targets Companion 5.1.x; its internal api may differ in this version`)
	}
	if (!appInfo.customModuleImportAllowed) {
		throw new Error('Companion refuses module imports from this machine. Run this script on the Companion machine.')
	}

	const modulesInit = await firstValue('instances.modules.watch')
	const installedVersions =
		modulesInit.info[`connection:${moduleId}`]?.installedVersions.map((v) => v.versionId).filter(Boolean) ?? []

	const [connectionsInit] = await firstValue('instances.connections.watch')
	const connections = Object.values(connectionsInit.info).filter((c) => c.moduleId === moduleId)

	// Reinstalling the same version (eg while developing) needs the old copy removed first. Companion refuses
	// to remove a version that an enabled connection uses, so disable those for the swap.
	if (installedVersions.includes(versionId)) {
		for (const connection of connections) {
			if (connection.enabled && connection.moduleVersionId === versionId) {
				await client.mutation('instances.connections.setEnabled', { connectionId: connection.id, enabled: false })
				disabledForSwap.push(connection)
			}
		}
		await expectOk(
			client.mutation('instances.modulesManager.uninstallModule', { moduleType: 'connection', moduleId, versionId }),
			'remove the previous copy'
		)
		removedPreviousCopy = true
	}

	await expectOk(client.mutation('instances.modulesManager.installModuleTar', { tarBuffer }), 'install the module')
	console.log(`  Module installed`)

	// Point every connection of this module at the new version (restoring its enabled state), or create one
	let label = args.label
	if (connections.length === 0) {
		await client.mutation('instances.connections.add', { module: { type: moduleId }, label, versionId })
		console.log(`  Added connection "${label}"`)
	} else {
		for (const connection of connections) {
			await expectOk(
				client.mutation('instances.connections.setModuleAndVersion', {
					connectionId: connection.id,
					moduleId,
					versionId,
				}),
				`update connection "${connection.label}"`
			)
			await client.mutation('instances.connections.setEnabled', {
				connectionId: connection.id,
				enabled: connection.enabled,
			})
			console.log(`  Updated connection "${connection.label}" to v${versionId}`)
		}
		label = connections[0].label
	}

	// Tidy up any older versions, now that nothing uses them
	for (const oldVersion of installedVersions.filter((v) => v !== versionId)) {
		await client.mutation('instances.modulesManager.uninstallModule', {
			moduleType: 'connection',
			moduleId,
			versionId: oldVersion,
		})
		console.log(`  Removed old version v${oldVersion}`)
	}

	console.log(`\nOpen the editor at: ${new URL(`/instance/${label}/`, baseUrl).href}`)
} catch (e) {
	console.error(`\nInstall failed: ${e instanceof Error ? e.message : e}`)
	process.exitCode = 1
	if (removedPreviousCopy) console.error(`  The previous copy of v${versionId} was removed: run this again once fixed`)
	for (const connection of disabledForSwap) {
		try {
			await client.mutation('instances.connections.setEnabled', { connectionId: connection.id, enabled: true })
			console.error(`  Re-enabled connection "${connection.label}"`)
		} catch {
			console.error(`  Connection "${connection.label}" is still disabled: enable it in Companion's Connections page`)
		}
	}
} finally {
	close()
}

/** The mutations used here resolve to null on success, or an error message */
async function expectOk(promise, what) {
	const result = await promise
	if (result) throw new Error(`Failed to ${what}: ${result}`)
}

/** Resolve with the first message of a subscription (the 'init' snapshot), then stop it */
function firstValue(procedurePath) {
	return new Promise((resolve, reject) => {
		const sub = client.subscription(procedurePath, undefined, {
			onData: (data) => {
				sub?.unsubscribe()
				resolve(data)
			},
			onError: reject,
		})
	})
}

/** Find the local Companion from the launcher's settings (the macOS app writes these) */
async function findLocalCompanionUrl() {
	const configPath = path.join(os.homedir(), 'Library/Application Support/companion/config.json')
	try {
		const config = JSON.parse(await fs.readFile(configPath, 'utf8'))
		const host = !config.bind_ip || config.bind_ip === '0.0.0.0' ? '127.0.0.1' : config.bind_ip
		return `http://${host}:${config.http_port ?? 8000}`
	} catch {
		return 'http://127.0.0.1:8000'
	}
}
