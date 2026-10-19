// Build the module package:
//   1. bundle the editor page (src/web) for the browser
//   2. bundle the module (src/module) for node, with the page embedded as `virtual:web-assets`
//   3. lay it out as a self-contained module in pkg/, and pack that as a .tgz Companion can import
import fs from 'node:fs/promises'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import * as esbuild from 'esbuild'
import * as tar from 'tar-stream'

const root = path.resolve(import.meta.dirname, '..')
const pkgDir = path.join(root, 'pkg')

const packageJson = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'))
const baseJson = JSON.parse(
	await fs.readFile(path.join(root, 'node_modules/@companion-module/base/package.json'), 'utf8')
)

// 1. The web page
const webBuild = await esbuild.build({
	entryPoints: [path.join(root, 'src/web/main.tsx')],
	bundle: true,
	platform: 'browser',
	format: 'esm',
	target: 'es2022',
	minify: true,
	jsx: 'automatic',
	define: { 'process.env.NODE_ENV': '"production"' },
	write: false,
	outfile: 'app.js',
	logLevel: 'warning',
})
const webAssets = {
	'/index.html': {
		contentType: 'text/html; charset=utf-8',
		body: await fs.readFile(path.join(root, 'src/web/index.html'), 'utf8'),
	},
	'/style.css': {
		contentType: 'text/css; charset=utf-8',
		body: await fs.readFile(path.join(root, 'src/web/style.css'), 'utf8'),
	},
	'/app.js': {
		contentType: 'text/javascript; charset=utf-8',
		body: webBuild.outputFiles[0].text,
	},
}

// 2. The module
await fs.rm(pkgDir, { recursive: true, force: true })
await esbuild.build({
	entryPoints: [path.join(root, 'src/module/main.ts')],
	bundle: true,
	platform: 'node',
	format: 'cjs',
	target: 'node22',
	outfile: path.join(pkgDir, 'main.js'),
	logLevel: 'warning',
	plugins: [
		{
			name: 'web-assets',
			setup(build) {
				build.onResolve({ filter: /^virtual:web-assets$/ }, (args) => ({ path: args.path, namespace: 'web-assets' }))
				build.onLoad({ filter: /.*/, namespace: 'web-assets' }, () => ({
					contents: JSON.stringify(webAssets),
					loader: 'json',
				}))
			},
		},
	],
})

// 3. The package layout. No dependency on @companion-module/base is declared, which tells Companion this
// is a packaged build and that it can trust the manifest's apiVersion.
const manifest = JSON.parse(await fs.readFile(path.join(root, 'companion/manifest.json'), 'utf8'))
delete manifest.$schema
manifest.version = packageJson.version
manifest.runtime.apiVersion = baseJson.version

await fs.mkdir(path.join(pkgDir, 'companion'), { recursive: true })
await fs.writeFile(path.join(pkgDir, 'companion/manifest.json'), JSON.stringify(manifest, null, '\t'))
await fs.copyFile(path.join(root, 'companion/HELP.md'), path.join(pkgDir, 'companion/HELP.md'))
await fs.copyFile(path.join(root, 'LICENSE'), path.join(pkgDir, 'LICENSE'))
await fs.writeFile(
	path.join(pkgDir, 'package.json'),
	JSON.stringify({ name: packageJson.name, version: packageJson.version, type: 'commonjs', main: 'main.js' }, null, '\t')
)

// Companion's importer expects the first tar entry to be the root directory, which it strips off
const tgzPath = path.join(root, `${manifest.id}-${manifest.version}.tgz`)
await fs.writeFile(tgzPath, gzipSync(await packDir(pkgDir, 'pkg')))

console.log(`Built ${manifest.id} v${manifest.version} (module api ${manifest.runtime.apiVersion})`)
console.log(`  ${path.relative(root, tgzPath)}`)

/** Pack a directory into an (uncompressed) tar buffer, with everything under `rootName/` */
async function packDir(dir, rootName) {
	const pack = tar.pack()
	const chunks = []
	pack.on('data', (chunk) => chunks.push(chunk))
	const finished = new Promise((resolve, reject) => {
		pack.on('end', resolve)
		pack.on('error', reject)
	})

	const addEntry = (header, content) =>
		new Promise((resolve, reject) => pack.entry(header, content, (err) => (err ? reject(err) : resolve())))

	await addEntry({ name: `${rootName}/`, type: 'directory' })
	for (const entry of await listEntries(dir)) {
		if (entry.isDirectory) {
			await addEntry({ name: `${rootName}/${entry.path}/`, type: 'directory' })
		} else {
			const content = await fs.readFile(path.join(dir, entry.path))
			await addEntry({ name: `${rootName}/${entry.path}`, size: content.length }, content)
		}
	}
	pack.finalize()
	await finished

	return Buffer.concat(chunks)
}

/** List everything under `dir` depth-first, each directory before its contents */
async function listEntries(dir, prefix = '') {
	const result = []
	const entries = await fs.readdir(path.join(dir, prefix), { withFileTypes: true })
	entries.sort((a, b) => a.name.localeCompare(b.name))
	for (const entry of entries) {
		const rel = prefix ? `${prefix}/${entry.name}` : entry.name
		if (entry.isDirectory()) {
			result.push({ path: rel, isDirectory: true }, ...(await listEntries(dir, rel)))
		} else {
			result.push({ path: rel, isDirectory: false })
		}
	}
	return result
}
