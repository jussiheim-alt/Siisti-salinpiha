import { registerSW } from 'virtual:pwa-register'

/**
 * PWA-päivitykset kotivalikon sovellukselle:
 * - registerType autoUpdate + skipWaiting → uusi build aktivoituu
 * - tarkista päivitykset heti, fokuksessa, sivun paluussa ja 5 min välein
 * Käyttäjän ei tarvitse poistaa sovellusta kotivalikosta.
 */
registerSW({
  immediate: true,
  onNeedRefresh() {
    // Uusi service worker valmis — lataa uusi JS/CSS heti (ei jää vanhaan UI:hin)
    window.location.reload()
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return

    const checkForUpdate = () => {
      void registration.update().catch(() => {
        /* verkko offline — ohita */
      })
    }

    checkForUpdate()

    const intervalMs = 5 * 60 * 1000
    window.setInterval(checkForUpdate, intervalMs)

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate()
    })
    window.addEventListener('focus', checkForUpdate)
    window.addEventListener('pageshow', () => {
      checkForUpdate()
    })
  },
  onOfflineReady() {
    // Ensimmäinen asennus valmis — ei UI:ta tarvita
  },
})
