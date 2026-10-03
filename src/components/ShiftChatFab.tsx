import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { api, type ShiftMessage } from '../api'
import { useAuth } from '../auth'
import { formatDateTimeFi, formatWeekRangeFi } from '../shared/datetime'
import { onServiceWorkerPush, startLiveRefresh } from '../shared/liveRefresh'

type CurrentChat = {
  pihavuoroId: string
  weekStart: string
  weekEnd: string
  messageCount: number
  lastMessageAt?: string | null
  myRole?: string | null
}

function IconChat() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H12l-3.8 3.2c-.5.4-1.2.1-1.2-.5V16H7.5A2.5 2.5 0 0 1 5 13.5v-7Z" />
      <path d="M9 9.2h6M9 12h4" />
    </svg>
  )
}

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 7l10 10M17 7 7 17" />
    </svg>
  )
}

function IconSend() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h12M13 6l6 6-6 6" />
    </svg>
  )
}

export function ShiftChatFab() {
  const { user } = useAuth()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [chat, setChat] = useState<CurrentChat | null>(null)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ShiftMessage[]>([])
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const seenKey = chat ? `siisti-chat-seen:${chat.pihavuoroId}` : ''
  const [seenCount, setSeenCount] = useState(0)

  useEffect(() => {
    if (!seenKey) {
      setSeenCount(0)
      return
    }
    setSeenCount(Number(localStorage.getItem(seenKey) || 0))
  }, [seenKey])

  async function refreshChatMeta() {
    if (!user) {
      setChat(null)
      return
    }
    try {
      const data = await api<{ chat: CurrentChat | null }>('/api/chat/current')
      setChat(data.chat)
      if (!data.chat) setOpen(false)
    } catch {
      setChat(null)
    }
  }

  async function loadMessages(pihavuoroId: string) {
    setLoadingMsgs(true)
    try {
      const data = await api<{ messages: ShiftMessage[] }>(
        `/api/pihavuorot/${pihavuoroId}/messages`,
      )
      setMessages(data.messages)
      const count = data.messages.length
      setSeenCount(count)
      localStorage.setItem(`siisti-chat-seen:${pihavuoroId}`, String(count))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Viestejä ei voitu ladata')
    } finally {
      setLoadingMsgs(false)
    }
  }

  useEffect(() => {
    if (!user) return
    const stopRefresh = startLiveRefresh(() => void refreshChatMeta(), 12_000)
    const stopPush = onServiceWorkerPush((data) => {
      if (!data.kind || data.kind === 'chat') void refreshChatMeta()
    })
    return () => {
      stopRefresh()
      stopPush()
    }
  }, [user?.id, location.pathname])

  useEffect(() => {
    if (searchParams.get('chat') === '1' && chat) {
      setOpen(true)
      const next = new URLSearchParams(searchParams)
      next.delete('chat')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, chat, setSearchParams])

  useEffect(() => {
    if (!open || !chat) return
    void loadMessages(chat.pihavuoroId)
    const id = window.setInterval(() => void loadMessages(chat.pihavuoroId), 8_000)
    return () => window.clearInterval(id)
  }, [open, chat?.pihavuoroId])

  useEffect(() => {
    if (!open) return
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, open])

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!chat || !body.trim()) return
    setSending(true)
    setError('')
    try {
      const data = await api<{ message: ShiftMessage }>(
        `/api/pihavuorot/${chat.pihavuoroId}/messages`,
        { method: 'POST', json: { body: body.trim() } },
      )
      setMessages((prev) => [...prev, data.message])
      setBody('')
      setSeenCount((c) => {
        const next = c + 1
        localStorage.setItem(`siisti-chat-seen:${chat.pihavuoroId}`, String(next))
        return next
      })
      void refreshChatMeta()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lähetys epäonnistui')
    } finally {
      setSending(false)
    }
  }

  if (!user || !chat) return null

  const unread = Math.max(0, chat.messageCount - seenCount)
  const roleLabel =
    chat.myRole === 'lead' ? 'Vastuuveli' : chat.myRole === 'helper' ? 'Avustaja' : null

  return (
    <>
      {open && (
        <button
          type="button"
          className="chat-backdrop"
          aria-label="Sulje keskustelu"
          onClick={() => setOpen(false)}
        />
      )}

      <button
        type="button"
        className={`chat-fab${open ? ' is-open' : ''}`}
        aria-label={open ? 'Sulje vuorokeskustelu' : 'Avaa vuorokeskustelu'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <IconClose /> : <IconChat />}
        {!open && unread > 0 && <span className="chat-fab-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="chat-sheet chat-sheet-modern" role="dialog" aria-label="Vuorokeskustelu">
          <header className="chat-sheet-head">
            <div>
              <p className="chat-sheet-kicker">Vuoron chat</p>
              <strong>
                {formatWeekRangeFi(chat.weekStart, chat.weekEnd)}
              </strong>
              <p className="muted">
                Yksityinen viikkokeskustelu
                {roleLabel ? ` · ${roleLabel}` : ''}
              </p>
            </div>
            <button
              type="button"
              className="chat-icon-btn"
              aria-label="Sulje"
              onClick={() => setOpen(false)}
            >
              <IconClose />
            </button>
          </header>

          <div className="chat-sheet-list" ref={listRef}>
            {loadingMsgs && messages.length === 0 && <p className="muted">Ladataan…</p>}
            {!loadingMsgs && messages.length === 0 && (
              <div className="chat-empty">
                <p>Ei viestejä vielä</p>
                <span>Sovi lumityöt, aikataulut ja apu tässä ketjussa.</span>
              </div>
            )}
            {messages.map((m) => {
              const mine = m.authorUserId === user.id
              return (
                <div key={m.id} className={`chat-row${mine ? ' mine' : ''}`}>
                  {!mine && <span className="chat-avatar">{m.authorName.slice(0, 1)}</span>}
                  <div className={`chat-bubble${mine ? ' mine' : ''}`}>
                    {!mine && <strong className="chat-name">{m.authorName}</strong>}
                    <p>{m.body}</p>
                    <time dateTime={m.createdAt}>{formatDateTimeFi(m.createdAt)}</time>
                  </div>
                </div>
              )
            })}
          </div>

          <form className="chat-sheet-compose chat-compose-modern" onSubmit={(e) => void send(e)}>
            {error && <p className="error">{error}</p>}
            <div className="chat-input-row">
              <textarea
                rows={1}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Viesti vuorolle…"
                maxLength={2000}
                required
              />
              <button
                className="chat-send-btn"
                type="submit"
                disabled={sending || !body.trim()}
                aria-label="Lähetä"
              >
                <IconSend />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
