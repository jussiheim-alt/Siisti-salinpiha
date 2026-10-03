import { useCallback, useEffect, useState } from 'react'
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushStatus,
} from '../push'

type Mode = 'loading' | 'unsupported' | 'on' | 'off' | 'blocked'

function detectMode(status: {
  supported: boolean
  permission: NotificationPermission
  subscribed: boolean
}): Mode {
  if (!status.supported) return 'unsupported'
  if (status.permission === 'denied') return 'blocked'
  if (status.permission === 'granted' && status.subscribed) return 'on'
  return 'off'
}

export function PushToggle() {
  const [mode, setMode] = useState<Mode>('loading')
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState('')
  const [showBlockedHelp, setShowBlockedHelp] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const status = await getPushStatus()
      setMode(detectMode(status))
    } catch {
      setMode('unsupported')
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
    if (busy || mode === 'loading' || mode === 'unsupported') return
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
        setHint('Ilmoitukset päällä')
      } else {
        await disablePushNotifications()
        setHint('Ilmoitukset pois päältä')
      }
      await refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ilmoitusasetus epäonnistui'
      if (msg === 'DENIED' || /evättiin|denied/i.test(msg)) {
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

  const isOn = mode === 'on'
  const isBlocked = mode === 'blocked'

  return (
    <div
      className={`surface-card push-toggle-card${isOn ? ' is-on' : ''}${isBlocked ? ' is-blocked' : ''}`}
      style={{ animationDelay: '0.03s' }}
    >
      <section className="push-toggle" aria-label="Push-ilmoitukset">
        <div className="push-toggle-row">
          <div className="push-toggle-copy">
            <p className="kicker">Ilmoitukset</p>
            <strong>
              {isBlocked ? 'Estetty asetuksissa' : isOn ? 'Päällä' : 'Pois päältä'}
            </strong>
            <p>
              {isBlocked
                ? 'Salli ilmoitukset puhelimen asetuksissa, jotta voit kytkeä ne taas päälle.'
                : isOn
                  ? 'Saat tiedon apukutsuista ja tärkeistä päivityksistä.'
                  : 'Kytke päälle tai pois — valinta säilyy tällä laitteella.'}
            </p>
          </div>

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
        </div>

        {hint && <p className={`push-toggle-hint${isBlocked ? ' is-warn' : ''}`}>{hint}</p>}

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
