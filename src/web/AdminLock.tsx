import { useCallback, useEffect, useState } from 'react'
import { useStores } from './stores/CompanionStores.js'
import { useStore } from './stores/Store.js'

export type AdminLockState = 'loading' | 'locked' | 'unlocked'

/**
 * Companion's admin lockout (Settings → Admin UI Password), applied to this page the way Companion's own
 * web UI applies it (`webui/src/App.tsx` in v5.1): locked until the password is entered, and locked again
 * after the configured idle time.
 *
 * Like Companion's, this keeps people from changing buttons by accident. It is not a security boundary:
 * Companion sends the password to every browser, and its api has no authentication.
 */
export function useAdminLock(): {
	state: AdminLockState
	/** Returns whether the password was right */
	unlock: (password: string) => boolean
	/** Lock now, when locking is enabled */
	lock: (() => void) | null
} {
	const stores = useStores()
	const config = useStore(stores.adminLock)
	const [unlocked, setUnlocked] = useState(false)
	const lock = useCallback(() => setUnlocked(false), [])

	const enabled = config?.admin_lockout === true
	useIdleTimeout(enabled && unlocked ? (config?.admin_timeout ?? 0) : 0, lock)

	return {
		state: !config ? 'loading' : enabled && !unlocked ? 'locked' : 'unlocked',
		unlock: (password) => {
			const ok = password === config?.admin_password
			if (ok) setUnlocked(true)
			return ok
		},
		lock: enabled && unlocked ? lock : null,
	}
}

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const

/** Call `onIdle` after `minutes` without any input on the page (0 = never) */
function useIdleTimeout(minutes: number, onIdle: () => void): void {
	useEffect(() => {
		if (!(minutes > 0)) return
		let timer: number | undefined
		const restart = () => {
			window.clearTimeout(timer)
			timer = window.setTimeout(onIdle, minutes * 60_000)
		}
		for (const event of ACTIVITY_EVENTS) window.addEventListener(event, restart, { passive: true })
		restart()
		return () => {
			window.clearTimeout(timer)
			for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, restart)
		}
	}, [minutes, onIdle])
}

/** Shown instead of the editor while Companion is locked */
export function LockScreen({ onUnlock }: { onUnlock: (password: string) => boolean }) {
	const [password, setPassword] = useState('')
	const [wrong, setWrong] = useState(false)

	return (
		<form
			className="lock-screen"
			onSubmit={(e) => {
				e.preventDefault()
				if (!onUnlock(password)) setWrong(true)
			}}
		>
			<h2>Companion is locked</h2>
			<p className="muted">Enter Companion's admin password to edit buttons.</p>
			<div className="lock-row">
				<input
					type="password"
					autoFocus
					aria-label="Admin password"
					aria-invalid={wrong}
					value={password}
					onChange={(e) => {
						setPassword(e.target.value)
						setWrong(false)
					}}
				/>
				<button type="submit">Unlock</button>
			</div>
			{wrong ? <p className="lock-error">Wrong password</p> : null}
		</form>
	)
}
