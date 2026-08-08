'use client'

import { useCallback, useEffect, useSyncExternalStore, type ReactNode } from 'react'
import {
  bind,
  play as playCue,
  setEnabled as setEngineEnabled,
  setVolume,
  type SoundName,
} from 'cuelume'

/**
 * Interaction sounds, synthesized live by cuelume (Web Audio, no audio files).
 *
 * Two ways in:
 *   - declarative — put `data-cuelume-press="tick"` (or -hover / -release /
 *     -toggle) on any element; `bind()` delegates from the document, so
 *     elements mounted later are covered without rebinding.
 *   - imperative — `useSound().cue('success')` for moments that aren't a
 *     single DOM event, like a toast appearing or a stream finishing.
 *
 * Off by default. Sound that starts without being asked for is intrusive, and
 * browsers suspend the AudioContext until a user gesture anyway — so the
 * preference lives behind the Topbar toggle and persists in localStorage.
 *
 * The preference is held in a module-level store rather than React state: the
 * audio engine is an external system with its own `setEnabled`, and a store
 * lets `useSyncExternalStore` give SSR a definite `false` snapshot instead of
 * hydrating one value and immediately setting another.
 */

const STORAGE_KEY = 'kigyo:sound'

// cuelume's engine ships enabled. Silence it at import time so nothing can
// fire in the gap between `bind()` wiring its delegated listeners and
// `SoundProvider` reading the stored preference.
setEngineEnabled(false)
setVolume(0.35)

let enabled = false
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = () => enabled
// Nothing is audible until the client has read the preference, so the server
// and the first client render agree on "off".
const getServerSnapshot = () => false

/** Points the engine, the store and (optionally) localStorage at `next`. */
function apply(next: boolean, persist: boolean): void {
  enabled = next
  setEngineEnabled(next)
  if (persist) {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off')
    } catch {
      /* best-effort: the in-memory preference still holds for this session */
    }
  }
  for (const listener of listeners) listener()
}

/** localStorage throws in Safari private mode and when storage is blocked. */
function readPref(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

/**
 * Wires the delegated `data-cuelume-*` listeners and restores the stored
 * preference. Mount once, above anything that calls `useSound()`.
 */
export function SoundProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    bind()
    apply(readPref(), false)
  }, [])

  return <>{children}</>
}

export function useSound() {
  const isEnabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const toggle = useCallback(() => {
    const next = !enabled
    apply(next, true)
    // Turning sound on is the one interaction whose audible feedback the user
    // just explicitly asked for.
    if (next) playCue('toggle')
  }, [])

  /** Plays a sound now. A no-op while sound is off. */
  const cue = useCallback((sound: SoundName) => playCue(sound), [])

  return { enabled: isEnabled, toggle, cue }
}
