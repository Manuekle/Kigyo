'use client'

import {
  Component,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { MetalFx, type MetalFxPreset } from 'metal-fx'
import { useTheme } from '@/lib/context/ThemeContext'

/**
 * MetalFx wrapper that can never cost us the control it decorates.
 *
 * Two failure modes make bare `<MetalFx>` unsafe around a primary CTA:
 *   - it holds its host at `opacity: 0; visibility: hidden` until the first
 *     shader frame is copied, so anything that stalls the RAF loop leaves the
 *     button invisible and unclickable;
 *   - `createInstance` throws `metal-fx: WebGL not supported` outright when no
 *     GL context can be created, which would take the whole page down.
 *
 * All three guards below degrade to rendering `children` bare — an ordinary,
 * working button. A metallic ring is worth having; it is not worth a login
 * button that might not be there.
 */

/** How long to let the shader produce its first frame before giving up. */
const REVEAL_TIMEOUT_MS = 1500

let cached: boolean | null = null

function detect(): boolean {
  if (cached === null) {
    try {
      const canvas = document.createElement('canvas')
      cached = Boolean(
        canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl'),
      )
    } catch {
      cached = false
    }
  }
  return cached
}

// GL support does not change over a session, so there is nothing to subscribe
// to. The server snapshot is `false` on purpose: the HTML ships the plain
// button, and the effect is layered on after hydration.
const subscribe = () => () => {}
const getServerSnapshot = () => false

/** Renders `children` bare if anything inside MetalFx throws. */
class MetalBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export default function MetalButton({
  children,
  preset = 'silver',
}: {
  children: ReactNode
  preset?: MetalFxPreset
}) {
  const supported = useSyncExternalStore(subscribe, detect, getServerSnapshot)
  const { theme } = useTheme()
  const [stalled, setStalled] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  /**
   * Watchdog for the reveal. MetalFx flips its root to `visibility: visible`
   * on the first copied frame; if that has not happened while the page was
   * actually on screen, the shader is not coming and the button has to stop
   * waiting for it.
   *
   * Armed only while the document is visible — `requestAnimationFrame` is
   * paused in a background tab, so a hidden page has not failed at anything
   * yet and gets its timer when the user comes back to it.
   */
  useEffect(() => {
    if (!supported || stalled) return

    let timer: ReturnType<typeof setTimeout> | undefined

    const check = () => {
      const root = rootRef.current
      // setState here is asynchronous (timer / event callback), not a
      // cascading render out of the effect body.
      if (root && getComputedStyle(root).visibility === 'hidden') setStalled(true)
    }

    const arm = () => {
      clearTimeout(timer)
      if (document.visibilityState === 'visible') timer = setTimeout(check, REVEAL_TIMEOUT_MS)
    }

    arm()
    document.addEventListener('visibilitychange', arm)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', arm)
    }
  }, [supported, stalled])

  if (!supported || stalled) return <>{children}</>

  return (
    <MetalBoundary fallback={children}>
      {/* Passed explicitly rather than left on `auto`, which resolves against
          the OS and would disagree once the user pins a theme. */}
      <MetalFx ref={rootRef} variant="button" preset={preset} theme={theme}>
        {children}
      </MetalFx>
    </MetalBoundary>
  )
}
