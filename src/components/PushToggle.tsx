import { useCallback, useEffect, useState } from 'react'
import {
  disablePushNotifications,
  enablePushNotifications,
  ensurePushSubscription,
  getPushStatus,
  isInstalledPwa,
  isIosDevice,
} from '../push'

type Mode = 'loading' | 'unsupported' | 'on' | 'off' | 'blocked' | 'need-install'

function detectMode(status: {
  supported: boolean
  permission: NotificationPermission
  subscribed: boolean
  installed?: boolean
  ios?: boolean
}): Mode {
  if (!status.supported) {
    // iOS Safari-välilehdellä PushManager puuttuu → ohjaa kotivalikkoon
    if (status.ios && !status.installed) return 'need-install'
    return 'unsupported'
  }
  if (status.ios && !status.installed) return 'need-install'
  if (status.permission === 'denied') return 'blocked'
  if (status.permission === 'granted' && status.subscribed) return 'on'
  return 'off'
}

type Props = {
  /** Etusivulla: piilota kortti kun ilmoitukset ovat jo päällä (asetus Ilmo-välilehdellä). */
  hideWhenEnabled?: boolean
}

export function PushToggle({ hideWhenEnabled = false }: Props) {
  const [mode, setMode] = useState<Mode>('loading')
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState('')
  const [showBlockedHelp, setShowBlockedHelp] = useState(false)
  const [showInstallHelp, setShowInstallHelp] = useState(false)

  const refresh = useCallback(async () => {
    try {
      // Korjaa vanhentunut / kadonnut tilaus ennen statusta
      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted' &&
        (!isIosDevice() || isInstalledPwa())
      ) {
        await ensurePushSubscription()
      }
      const status = await getPushStatus()
      setMode(detectMode(status))
    } catch {
      setMode(isIosDevice() && !isInstalledPwa() ? 'need-install' : 'unsupported')
    }
  }, [])

  useEffect(() => {
    void refresh()
    const onFocus = () => void refresh()
    const onPageShow = () => void refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('pageshow', onPageShow)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  async function setEnabled(wantOn: boolean) {
    if (busy || mode === 'loading' || mode === 'unsupported' || mode === 'need-install') return
    setHint('')

    if (mode === 'blocked') {
      setShowBlockedHelp(true)
      setHint('Ilmoitukset on estetty laitteen asetuksissa — katso ohje alta.')
      return
    }

    setBusy(true)
    try {
      if (wantOn) {
        await enablePushNotifications()
        setHint('Ilmoitukset päällä — lukitusnäyttö saa viestit, kun sovellus on taustalla.')
      } else {
        await disablePushNotifications()
        setHint('Ilmoitukset pois päältä')
      }
      await refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ilmoitusasetus epäonnistui'
      if (msg === 'IOS_NOT_INSTALLED') {
        setMode('need-install')
        setShowInstallHelp(true)
        setHint('iPhonella ilmoitukset toimivat vain kotivalikkoon asennetussa sovelluksessa.')
      } else if (msg === 'DENIED' || /evättiin|denied/i.test(msg)) {
        setMode('blocked')
        setShowBlockedHelp(true)
        setHint('Ilmoitukset on estetty laitteen asetuksissa.')
      } else {
        setHint(msg)
      }
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'loading') return null
  if (mode === 'unsupported') return null
  if (hideWhenEnabled && mode === 'on') return null

  const isOn = mode === 'on'
  const isBlocked = mode === 'blocked'
  const needInstall = mode === 'need-install'

  return (
    <div
      className={`surface-card push-toggle-card${isOn ? ' is-on' : ''}${isBlocked || needInstall ? ' is-blocked' : ''}`}
      style={{ animationDelay: '0.03s' }}
    >
      <section className="push-toggle" aria-label="Push-ilmoitukset">
        <div className="push-toggle-row">
          <div className="push-toggle-copy">
            <p className="kicker">Ilmoitukset</p>
            <strong>
              {needInstall
                ? 'Asenna kotivalikkoon'
                : isBlocked
                  ? 'Estetty asetuksissa'
                  : isOn
                    ? 'Päällä'
                    : 'Pois päältä'}
            </strong>
            <p>
              {needInstall
                ? 'iPhonella lukitusnäytön ilmoitukset toimivat vain, kun Siisti salin piha on lisätty kotivalikkoon.'
                : isBlocked
                  ? 'Salli ilmoitukset puhelimen asetuksissa, jotta voit kytkeä ne taas päälle.'
                  : isOn
                    ? 'Saat chat-viestit, apukutsut ja tärkeät päivitykset lukitusnäytölle.'
                    : 'Kytke päälle, jotta ilmoitukset näkyvät lukitusnäytöllä kun sovellus on taustalla.'}
            </p>
          </div>

          {!needInstall && (
            <button
              type="button"
              className={`push-switch${isOn ? ' is-on' : ''}`}
              role="switch"
              aria-checked={isOn}
              aria-label={isOn ? 'Ilmoitukset päällä' : 'Ilmoitukset pois päältä'}
              disabled={busy}
              onClick={() => void setEnabled(!isOn)}
            >
              <span className="push-switch-knob" />
            </button>
          )}
        </div>

        {hint && (
          <p className={`push-toggle-hint${isBlocked || needInstall ? ' is-warn' : ''}`}>{hint}</p>
        )}

        {needInstall && (
          <div className="push-blocked-help">
            {!showInstallHelp ? (
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setShowInstallHelp(true)}
              >
                Näytä asennusohje
              </button>
            ) : (
              <ol>
                <li>
                  Avaa tämä sivu <strong>Safarissa</strong>
                </li>
                <li>
                  Napauta <strong>Jaa</strong> (neliö + nuoli)
                </li>
                <li>
                  Valitse <strong>Lisää Koti-valikkoon</strong>
                </li>
                <li>Avaa sovellus kotivalikosta ja kytke ilmoitukset päälle</li>
              </ol>
            )}
          </div>
        )}

        {isBlocked && (
          <div className="push-blocked-help">
            {!showBlockedHelp ? (
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setShowBlockedHelp(true)}
              >
                Näytä ohje
              </button>
            ) : (
              <ol>
                <li>
                  Avaa iPhonen <strong>Asetukset → Ilmoitukset</strong>
                </li>
                <li>
                  Valitse <strong>Siisti salin piha</strong> (tai Safari, jos käytät selaimessa)
                </li>
                <li>
                  Kytke <strong>Salli ilmoitukset</strong> päälle
                </li>
                <li>Palaa sovellukseen ja kytke ilmoitukset tästä uudelleen päälle</li>
              </ol>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
