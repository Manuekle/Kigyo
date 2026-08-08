'use client'

import { useCallback, useEffect, useSyncExternalStore, type ReactNode } from 'react'

/**
 * Light / dark theme.
 *
 * The resolved theme is written to `data-theme` on <html>; globals.css keys
 * its light palette off that attribute. Three states are stored:
 *
 *   'system' (default) — follow the OS, live, via matchMedia
 *   'light' / 'dark'   — pinned by the user
 *
 * `THEME_INIT_SCRIPT` below must run before first paint (see app/layout.tsx),
 * otherwise a light-mode visitor gets a dark flash while the bundle loads.
 * Because that script has already stamped the attribute, this module reads the
 * DOM as its source of truth rather than re-deriving it.
 */

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'kigyo:theme'

/**
 * Inlined into <head> and run synchronously before the first paint. Kept as a
 * string (not an imported function) so it ships as-is with no bundler wrapper
 * and no hydration round-trip. Mirrors `resolve()` below — change both.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var p=localStorage.getItem('${THEME_STORAGE_KEY}');
if(p!=='light'&&p!=='dark'){p=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}
document.documentElement.setAttribute('data-theme',p)
}catch(e){document.documentElement.setAttribute('data-theme','dark')}})()`

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

function systemTheme(): ResolvedTheme {
  return typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark'
}

function resolve(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? systemTheme() : preference
}

const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function notify(): void {
  for (const listener of listeners) listener()
}

/**
 * The <html> attribute is the store. The pre-paint script sets it before React
 * exists, so reading it here keeps the first client render in agreement with
 * the markup instead of briefly disagreeing with it.
 */
function getSnapshot(): ResolvedTheme {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
}

// The server cannot know the visitor's OS preference, so it renders the dark
// default; the pre-paint script corrects the attribute before anything shows.
const getServerSnapshot = (): ResolvedTheme => 'dark'

const preferenceListeners = new Set<() => void>()
let preferenceCache: ThemePreference | null = null

function getPreferenceSnapshot(): ThemePreference {
  preferenceCache ??= readPreference()
  return preferenceCache
}

const getServerPreferenceSnapshot = (): ThemePreference => 'system'

function subscribePreference(listener: () => void): () => void {
  preferenceListeners.add(listener)
  return () => {
    preferenceListeners.delete(listener)
  }
}

/** Writes the preference, repaints the attribute and wakes both stores. */
function apply(preference: ThemePreference): void {
  preferenceCache = preference
  try {
    if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    /* best-effort: the attribute below still applies for this session */
  }
  document.documentElement.setAttribute('data-theme', resolve(preference))
  notify()
  for (const listener of preferenceListeners) listener()
}

/** Keeps a 'system' preference tracking live OS changes. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: light)')
    const onChange = () => {
      if (getPreferenceSnapshot() === 'system') {
        document.documentElement.setAttribute('data-theme', systemTheme())
        notify()
      }
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return <>{children}</>
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const preference = useSyncExternalStore(
    subscribePreference,
    getPreferenceSnapshot,
    getServerPreferenceSnapshot,
  )

  const setPreference = useCallback((next: ThemePreference) => apply(next), [])

  /** Pins the opposite of what is on screen — the obvious action for a toggle. */
  const toggle = useCallback(() => {
    apply(getSnapshot() === 'dark' ? 'light' : 'dark')
  }, [])

  return { theme, preference, setPreference, toggle }
}
