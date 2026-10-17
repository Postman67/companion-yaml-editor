import { useSyncExternalStore } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'button-editor:theme'
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

let preference: ThemePreference = readPreference()

function readPreference(): ThemePreference {
	try {
		const saved = localStorage.getItem(STORAGE_KEY)
		if (saved === 'light' || saved === 'dark') return saved
	} catch {
		// storage unavailable: follow the system
	}
	return 'system'
}

function isDark(): boolean {
	return preference === 'dark' || (preference === 'system' && darkQuery.matches)
}

/** Put the resolved theme on <html data-theme>, which the stylesheet keys off */
function apply(): void {
	document.documentElement.dataset.theme = isDark() ? 'dark' : 'light'
	for (const listener of listeners) listener()
}

darkQuery.addEventListener('change', apply)
apply()

export function setThemePreference(value: ThemePreference): void {
	preference = value
	try {
		if (value === 'system') localStorage.removeItem(STORAGE_KEY)
		else localStorage.setItem(STORAGE_KEY, value)
	} catch {
		// not remembered, but still applied
	}
	apply()
}

const subscribe = (listener: () => void) => {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

export function useThemePreference(): ThemePreference {
	return useSyncExternalStore(subscribe, () => preference)
}

/** Whether the dark theme is showing, whichever way it was chosen */
export function useIsDark(): boolean {
	return useSyncExternalStore(subscribe, isDark)
}
