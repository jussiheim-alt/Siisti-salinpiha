/**
 * Keep the logged-in shell matched to the live layout viewport.
 * Pair with CSS `min-height: -webkit-fill-available` so iOS standalone
 * does not leave a letterbox gap under the tab bar.
 */
export function startViewportShell() {
  const apply = () => {
    const root = document.getElementById('root')
    if (!root?.querySelector('.app-shell-bottom-nav')) return

    const vv = window.visualViewport
    const candidates = [window.innerHeight, document.documentElement.clientHeight]
    if (vv) candidates.push(Math.ceil(vv.height + vv.offsetTop))
    const height = Math.max(0, ...candidates.filter((n) => Number.isFinite(n) && n > 0))
    document.documentElement.style.setProperty('--app-height', `${height}px`)
    root.style.height = `${height}px`
    root.style.minHeight = '-webkit-fill-available'
    root.style.top = '0'
    root.style.bottom = 'auto'
  }

  apply()
  window.addEventListener('resize', apply)
  window.addEventListener('orientationchange', apply)
  window.visualViewport?.addEventListener('resize', apply)
  window.visualViewport?.addEventListener('scroll', apply)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') apply()
  })

  return () => {
    window.removeEventListener('resize', apply)
    window.removeEventListener('orientationchange', apply)
    window.visualViewport?.removeEventListener('resize', apply)
    window.visualViewport?.removeEventListener('scroll', apply)
  }
}
