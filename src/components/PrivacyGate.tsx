import { useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { PRIVACY_NOTICE_VERSION, privacyAcceptedCurrent } from '../shared/privacyNotice'
import { PrivacyNotice } from './PrivacyNotice'

/** Blocks the app until the logged-in user accepts the current privacy notice. */
export function PrivacyGate() {
  const { user, refresh } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!user) return null
  const needsAccept = !privacyAcceptedCurrent(user.privacyAcceptedVersion)
  if (!needsAccept) return null

  async function accept() {
    setBusy(true)
    setError('')
    try {
      await api('/api/me/privacy-accept', {
        method: 'POST',
        json: { version: PRIVACY_NOTICE_VERSION },
      })
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tallennus epäonnistui')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PrivacyNotice open mode="required" busy={busy} error={error} onAccept={accept} />
  )
}
