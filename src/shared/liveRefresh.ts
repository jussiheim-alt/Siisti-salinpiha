/** Call `refresh` on an interval while the tab is visible, and immediately on focus/visibility. */
export function startLiveRefresh(refresh: () => void, intervalMs: number) {
  let timer: number | null = null

  const clear = () => {
    if (timer != null) {
      window.clearInterval(timer)
      timer = null
    }
  }

  const arm = () => {
    clear()
    if (document.visibilityState === 'visible') {
      timer = window.setInterval(refresh, intervalMs)
    }
  }

  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      refresh()
      arm()
    } else {
      clear()
    }
  }

  const onFocus = () => refresh()

  refresh()
  arm()
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', onFocus)

  return () => {
    clear()
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('focus', onFocus)
  }
}

/** Listen for push events forwarded from the service worker. */
export function onServiceWorkerPush(handler: (data: { kind?: string; url?: string }) => void) {
  if (!('serviceWorker' in navigator)) return () => undefined
  const onMessage = (event: MessageEvent) => {
    if (event.data?.type === 'siisti-push') handler(event.data)
  }
  navigator.serviceWorker.addEventListener('message', onMessage)
  return () => navigator.serviceWorker.removeEventListener('message', onMessage)
}
