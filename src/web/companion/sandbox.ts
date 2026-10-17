/**
 * Runs a module-supplied `isVisible` function with a limited scope.
 * Ported from Bitfocus Companion v5.1.0 (MIT licence): webui/src/Resources/sandbox.ts
 */

const freezePrototypes = () => {
	if (Object.isFrozen(console)) return

	// freeze global objects that can be used within the sandbox
	Object.freeze(console)
	Object.freeze(Array.prototype)
	Object.freeze(Number.prototype)
	Object.freeze(Object.prototype)
	Object.freeze(RegExp.prototype)
	Object.freeze(String.prototype)
	Object.freeze(Symbol.prototype)

	// prevent constructors of async/generator functions to bypass sandbox
	Object.freeze(Object.getPrototypeOf(async function () {}))
	Object.freeze(Object.getPrototypeOf(async function* () {}))
	Object.freeze(Object.getPrototypeOf(function* () {}))
	Object.freeze(Object.getPrototypeOf(function* () {}).prototype)
	Object.freeze(Object.getPrototypeOf(async function* () {}).prototype)
}

export function sandbox(serializedFn: string): (...args: unknown[]) => unknown {
	const proxyHandler: ProxyHandler<Record<string, unknown>> = {
		has: () => true,
		get: (obj, prop) => Reflect.get(obj, prop),
	}

	// global objects that will be allowed within the sandbox
	const allowList = { __proto__: null, console, Array, Math, Number, Object, RegExp, String, Symbol }

	// limit scope and prevent `window` leak
	const src = `
		with (catchAllProxy) {
			with (configProxy) {
				return (() => {
					"use strict"
					const fn = ${serializedFn}
					return fn(arg0, arg1)
				})()
			}
		}
	`

	freezePrototypes()

	try {
		const scopedFn = new Function('catchAllProxy', src)

		return (arg0, arg1) => {
			const configProxy = new Proxy({ ...allowList, arg0, arg1 }, proxyHandler)
			const catchAllProxy = new Proxy({ __proto__: null, configProxy }, proxyHandler)
			return scopedFn(catchAllProxy)
		}
	} catch (error) {
		console.log(`Sandbox: ${error}`)
		return () => true
	}
}
