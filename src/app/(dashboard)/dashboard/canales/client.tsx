'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Send, Users, Plus, X, CheckCircle, MapPin, Briefcase, MessageSquare,
  Search, PenLine, UserPlus, UserMinus,
} from '@/lib/icons'
import { useApp } from '@/lib/context/AppContext'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import { cop } from '@/lib/utils'
import { activatable } from '@/lib/a11y'
import { DROPDOWN_CLOSE_MS, dropdownClass, useExitTransition } from '@/lib/hooks/use-exit-transition'
import type { CanalesData, CanalMember, CanalMessage, CanalSummary } from '@/server/queries/canales'
import {
  createChannel,
  fetchChannelMembers,
  fetchChannelMessages,
  fetchOlderMessages,
  joinChannel,
  leaveChannel,
  renameChannel,
  sendChannelMessage,
} from '@/server/mutations/canales'

/** How often an open channel asks for messages newer than the ones it holds. */
const POLL_MS = 8000

/* ------------------------------------------------------------------ */
/*  Formatting                                                         */
/* ------------------------------------------------------------------ */
const TIME = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' })
const DAY = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long' })
const DAY_WITH_YEAR = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** "10:32" / "ayer" / "15 jun" — what the channel list needs at a glance. */
function lastActivity(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000)
  if (days === 0) return TIME.format(date)
  if (days === 1) return 'ayer'
  return DAY.format(date).replace(/ de /, ' ').slice(0, 6)
}

function daySeparator(iso: string): string {
  const date = new Date(iso)
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000)
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (date.getFullYear() === new Date().getFullYear()) return DAY.format(date)
  return DAY_WITH_YEAR.format(date)
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function CanalesPage({ data }: { data: CanalesData }) {
  const { addToast } = useApp()
  const router = useRouter()

  const [channels, setChannels] = useState<CanalSummary[]>(data.channels)
  const [currentId, setCurrentId] = useState<string | null>(data.activeId)
  // Messages are cached per channel, so returning to a conversation is instant
  // and does not re-fetch what has not changed.
  const [byChannel, setByChannel] = useState<Record<string, CanalMessage[]>>(
    data.activeId ? { [data.activeId]: data.messages } : {},
  )
  // Whether each cached conversation continues further back. A channel absent
  // from this map has not been opened yet.
  const [hasOlder, setHasOlder] = useState<Record<string, boolean>>(
    data.activeId ? { [data.activeId]: data.hasOlderMessages } : {},
  )
  const [loadingChannel, setLoadingChannel] = useState(false)
  const [loadingOlder, startLoadingOlder] = useTransition()

  const [input, setInput] = useState('')
  const [sending, startSending] = useTransition()
  const [showNewChan, setShowNewChan] = useState(false)
  const [newChanName, setNewChanName] = useState('')
  const [creating, startCreating] = useTransition()
  const [selProy, setSelProy] = useState<string | null>(null)
  const [showProyPicker, setShowProyPicker] = useState(false)
  // Grows out of the composer and shrinks back into it, rather than blinking.
  const picker = useExitTransition(showProyPicker, DROPDOWN_CLOSE_MS)
  const bottomRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  /* ---- channel list filter ---- */
  const [filter, setFilter] = useState('')

  /* ---- members panel ---- */
  const [showMembers, setShowMembers] = useState(false)
  const [members, setMembers] = useState<CanalMember[] | null>(null)
  const [membersBusy, startMembers] = useTransition()
  const [addQuery, setAddQuery] = useState('')

  /* ---- rename ---- */
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renamePending, startRenaming] = useTransition()

  const current = channels.find((c) => c.id === currentId) ?? null
  const messages = currentId ? byChannel[currentId] : undefined
  const selProjData = selProy ? data.projects.find((p) => p.id === selProy) ?? null : null

  // Accent- and case-insensitive: typing "obra norte" should find "Obra Norté"
  // and "OBRA NORTE" alike, which `includes` on the raw strings does not.
  const norm = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const visibleChannels = useMemo(() => {
    const q = norm(filter.trim())
    if (!q) return channels
    return channels.filter((c) => norm(c.name).includes(q))
  }, [channels, filter])

  const inChannel = members?.some((m) => m.isSelf) ?? false
  const memberIds = useMemo(() => new Set((members ?? []).map((m) => m.employeeId)), [members])
  const addCandidates = useMemo(() => {
    const q = norm(addQuery.trim())
    return data.roster
      .filter((p) => !memberIds.has(p.employeeId))
      .filter((p) => !q || norm(p.fullName).includes(q))
      .slice(0, 8)
  }, [data.roster, memberIds, addQuery])

  // Opening a channel should land at the bottom, not animate down to it; only
  // a message arriving in the channel you are already reading is worth a
  // smooth scroll. `block: 'nearest'` keeps the scroll inside .ch-msgs instead
  // of walking up and moving the page.
  //
  // Loading older messages is the one change to `messages` that must not move
  // the view: the reader asked to look backwards, and yanking them to the
  // newest message is the opposite of what they pressed.
  const landed = useRef<string | null>(null)
  const keepScroll = useRef(false)
  useEffect(() => {
    if (!currentId) return
    if (keepScroll.current) { keepScroll.current = false; return }
    const jump = landed.current !== currentId
    landed.current = currentId
    bottomRef.current?.scrollIntoView({ behavior: jump ? 'auto' : 'smooth', block: 'nearest' })
  }, [messages, currentId])

  /**
   * Merge newly-fetched messages into a channel's cache.
   *
   * The poll asks only for messages newer than the newest one held, but the
   * message you just sent yourself arrives twice anyway — once from the send
   * and once from the poll that was already in flight. Keyed by id so it lands
   * once either way.
   */
  const mergeMessages = useCallback((id: string, incoming: CanalMessage[]) => {
    if (incoming.length === 0) return
    setByChannel((prev) => {
      const existing = prev[id] ?? []
      const seen = new Set(existing.map((m) => m.id))
      const fresh = incoming.filter((m) => !seen.has(m.id))
      if (fresh.length === 0) return prev
      return { ...prev, [id]: [...existing, ...fresh] }
    })
    setChannels((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, lastMessageAt: incoming[incoming.length - 1].createdAt } : c,
      ),
    )
  }, [])

  /* ---- channel switch ---- */
  function openChannel(id: string) {
    setCurrentId(id)
    setSelProy(null)
    setShowProyPicker(false)
    setShowMembers(false)
    setMembers(null)
    setRenaming(false)
    if (byChannel[id]) return

    setLoadingChannel(true)
    void fetchChannelMessages(id).then((result) => {
      setLoadingChannel(false)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setByChannel((prev) => ({ ...prev, [id]: result.data.messages }))
      setHasOlder((prev) => ({ ...prev, [id]: result.data.hasOlder }))
    })
  }

  /** The window before the one on screen, prepended to the cache. */
  function loadOlder() {
    const id = currentId
    const held = id ? byChannel[id] : undefined
    if (!id || !held || held.length === 0) return

    keepScroll.current = true
    startLoadingOlder(async () => {
      const result = await fetchOlderMessages(id, held[0].createdAt)
      if (!result.ok) {
        keepScroll.current = false
        addToast(result.error, 'err')
        return
      }
      setByChannel((prev) => {
        const existing = prev[id] ?? []
        const seen = new Set(existing.map((m) => m.id))
        const older = result.data.messages.filter((m) => !seen.has(m.id))
        return older.length === 0 ? prev : { ...prev, [id]: [...older, ...existing] }
      })
      setHasOlder((prev) => ({ ...prev, [id]: result.data.hasOlder }))
    })
  }

  /**
   * Keep the open channel current.
   *
   * Messages were cached per channel and never refreshed, so a colleague's
   * reply only appeared if you switched away and back. Polling rather than
   * Realtime because this needs no publication or channel-subscription setup
   * to be correct, and `since` makes the usual response an empty array.
   *
   * Paused while the tab is hidden: a backgrounded tab polling every eight
   * seconds all afternoon is the kind of thing that shows up on a bill.
   */
  // The poll reads the cache through a ref so it does not tear down and
  // re-arm its interval every time a message lands, which `byChannel` in the
  // dependency array would force. Synced in an effect rather than during
  // render: the interval only ever reads it after a commit.
  const byChannelRef = useRef(byChannel)
  useEffect(() => { byChannelRef.current = byChannel }, [byChannel])

  useEffect(() => {
    if (!currentId) return
    let cancelled = false

    const tick = () => {
      if (document.hidden || cancelled) return
      const held = byChannelRef.current[currentId] ?? []
      const since = held.length > 0 ? held[held.length - 1].createdAt : null
      void fetchChannelMessages(currentId, since).then((result) => {
        if (cancelled || !result.ok) return
        mergeMessages(currentId, result.data.messages)
      })
    }

    const timer = setInterval(tick, POLL_MS)
    // A tab coming back to the foreground should not wait out the interval it
    // slept through.
    document.addEventListener('visibilitychange', tick)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [currentId, mergeMessages])

  /* ---- send ---- */
  function sendMsg() {
    if (!currentId || sending) return
    const body = input.trim()
    if (!body && !selProy) return

    startSending(async () => {
      const result = await sendChannelMessage({ channelId: currentId, body, projectId: selProy })
      if (!result.ok) { addToast(result.error, 'err'); return }

      mergeMessages(currentId, [result.data])
      setInput('')
      setSelProy(null)
      if (taRef.current) taRef.current.style.height = 'auto'
    })
  }

  /** Grows with the message up to a ceiling, like the assistant's composer. */
  function autoResize() {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
  }

  /* ---- members ---- */
  function openMembers() {
    const next = !showMembers
    setShowMembers(next)
    if (!next || !currentId || members) return
    startMembers(async () => {
      const result = await fetchChannelMembers(currentId)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setMembers(result.data)
    })
  }

  /** Reflects the new roster size on the channel list without a round trip. */
  function applyMembers(next: CanalMember[]) {
    setMembers(next)
    setChannels((prev) =>
      prev.map((c) => (c.id === currentId ? { ...c, memberCount: next.length } : c)),
    )
  }

  function toggleSelf() {
    if (!currentId) return
    const leaving = inChannel
    startMembers(async () => {
      const result = leaving
        ? await leaveChannel({ channelId: currentId })
        : await joinChannel({ channelId: currentId })
      if (!result.ok) { addToast(result.error, 'err'); return }
      applyMembers(result.data)
      addToast(leaving ? 'Saliste del canal' : 'Te uniste al canal', 'ok')
    })
  }

  function addMember(employeeId: string, fullName: string) {
    if (!currentId) return
    startMembers(async () => {
      const result = await joinChannel({ channelId: currentId, employeeId })
      if (!result.ok) { addToast(result.error, 'err'); return }
      applyMembers(result.data)
      setAddQuery('')
      addToast(`${fullName} agregado al canal`, 'ok')
    })
  }

  function removeMember(employeeId: string, fullName: string) {
    if (!currentId) return
    startMembers(async () => {
      const result = await leaveChannel({ channelId: currentId, employeeId })
      if (!result.ok) { addToast(result.error, 'err'); return }
      applyMembers(result.data)
      addToast(`${fullName} salió del canal`, 'info')
    })
  }

  /* ---- rename ---- */
  function startRename() {
    if (!current) return
    setRenameValue(current.name)
    setRenaming(true)
  }

  function commitRename() {
    const name = renameValue.trim()
    if (!currentId || !name || name === current?.name) { setRenaming(false); return }
    startRenaming(async () => {
      const result = await renameChannel({ channelId: currentId, name })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setChannels((prev) => prev.map((c) => (c.id === currentId ? { ...c, name: result.data.name } : c)))
      setRenaming(false)
      addToast('Canal renombrado', 'ok')
    })
  }

  /* ---- create channel ---- */
  function addCanal() {
    const name = newChanName.trim()
    if (!name || creating) return

    startCreating(async () => {
      const result = await createChannel({ name })
      if (!result.ok) { addToast(result.error, 'err'); return }

      setChannels((prev) => [result.data, ...prev])
      setByChannel((prev) => ({ ...prev, [result.data.id]: [] }))
      setCurrentId(result.data.id)
      setNewChanName('')
      setShowNewChan(false)
      addToast(`Canal ${result.data.name} creado`, 'ok')
    })
  }

  /* ---- day separators, computed once per message list ---- */
  const rows = useMemo(() => {
    const out: Array<{ kind: 'day'; label: string } | { kind: 'msg'; message: CanalMessage }> = []
    let lastDay = ''
    for (const message of messages ?? []) {
      const label = daySeparator(message.createdAt)
      if (label !== lastDay) { out.push({ kind: 'day', label }); lastDay = label }
      out.push({ kind: 'msg', message })
    }
    return out
  }, [messages])

  return (
    <div className="ch-page">
      {/* ---- Sidebar ---- */}
      <div className="ch-side">
        <div className="ch-side-head">
          <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--ink2)' }}>Canales</span>
          {data.canWrite && (
            <button
              className="ibtn tip-down"
              style={{ width: 28, height: 28 }}
              onClick={() => setShowNewChan(true)}
              data-tip="Crear canal"
              aria-label="Crear canal"
            >
              <Plus size={14} />
            </button>
          )}
        </div>

        {showNewChan && (
          <div className="ch-new">
            <input
              className="field"
              style={{ flex: 1 }}
              placeholder="Nombre del canal"
              value={newChanName}
              onChange={(e) => setNewChanName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addCanal()
                if (e.key === 'Escape') { setShowNewChan(false); setNewChanName('') }
              }}
              disabled={creating}
              autoFocus
            />
            <button
              className="ibtn"
              style={{ width: 28, height: 28 }}
              onClick={addCanal}
              disabled={creating || !newChanName.trim()}
              aria-label="Confirmar"
            >
              <CheckCircle size={13} />
            </button>
            <button
              className="ibtn"
              style={{ width: 28, height: 28 }}
              onClick={() => { setShowNewChan(false); setNewChanName('') }}
              aria-label="Cancelar"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* The filter only earns its row once the list is long enough to need
            it; at four channels it is furniture. */}
        {channels.length > 6 && (
          <div className="ch-filter">
            <div className="search" style={{ width: '100%', height: 30 }}>
              <Search size={13} aria-hidden="true" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filtrar canales"
                aria-label="Filtrar canales por nombre"
              />
            </div>
          </div>
        )}

        <div className="ch-side-list">
          {visibleChannels.map((c) => (
            <button
              key={c.id}
              className={`ch-item${c.id === currentId ? ' on' : ''}`}
              onClick={() => openChannel(c.id)}
              aria-current={c.id === currentId ? 'true' : undefined}
            >
              <span className="ch-item-hash">#</span>
              <span className="ch-item-name">{c.name}</span>
              <span className="ch-item-time">{lastActivity(c.lastMessageAt)}</span>
            </button>
          ))}
          {channels.length === 0 && (
            <p className="ch-side-empty">
              {data.canWrite
                ? 'Todavía no hay canales. Crea el primero para empezar a conversar.'
                : 'Todavía no hay canales en tu organización.'}
            </p>
          )}
          {channels.length > 0 && visibleChannels.length === 0 && (
            <p className="ch-side-empty">Ningún canal coincide con «{filter.trim()}».</p>
          )}
        </div>

        <div className="ch-side-foot">
          <Users size={12} />
          <span>{current ? `${current.memberCount} en este canal` : `${channels.length} canales`}</span>
        </div>
      </div>

      {/* ---- Main area ---- */}
      <div className="ch-main">
        {current ? (
          <>
            <div className="ch-head">
              <span className="ch-head-hash">#</span>
              {renaming ? (
                <input
                  className="field"
                  style={{ maxWidth: 280, height: 30 }}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename()
                    if (e.key === 'Escape') setRenaming(false)
                  }}
                  onBlur={commitRename}
                  disabled={renamePending}
                  aria-label="Nuevo nombre del canal"
                  autoFocus
                />
              ) : (
                <span className="ch-head-name">{current.name}</span>
              )}

              {data.canWrite && !renaming && (
                <button
                  className="ibtn tip-down"
                  style={{ width: 26, height: 26 }}
                  onClick={startRename}
                  data-tip="Renombrar canal"
                  aria-label={`Renombrar el canal ${current.name}`}
                >
                  <PenLine size={12} />
                </button>
              )}

              {/* The count was a dead label: it said how many people were in
                  the channel and gave no way to find out who, or to become one
                  of them, even though `channel_members` has always been there. */}
              <button
                className={`ch-head-members${showMembers ? ' on' : ''}`}
                onClick={openMembers}
                aria-expanded={showMembers}
                aria-label={`Ver los miembros del canal ${current.name}`}
              >
                <Users size={12} aria-hidden="true" />
                {current.memberCount === 1 ? '1 miembro' : `${current.memberCount} miembros`}
              </button>
            </div>

            {showMembers && (
              <div className="ch-members">
                {membersBusy && !members && <p className="ch-members-note">Cargando el equipo…</p>}

                {members && (
                  <>
                    <div className="ch-members-head">
                      <span>En este canal</span>
                      {data.canWrite && (
                        <button
                          className="ch-members-self"
                          onClick={toggleSelf}
                          disabled={membersBusy}
                        >
                          {inChannel ? <UserMinus size={12} /> : <UserPlus size={12} />}
                          {inChannel ? 'Salir del canal' : 'Unirme'}
                        </button>
                      )}
                    </div>

                    <div className="ch-members-list">
                      {members.map((m) => (
                        <div className="ch-member" key={m.employeeId}>
                          <Avatar name={m.fullName} size={24} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="ch-member-name">
                              {m.fullName}
                              {m.isSelf && <span className="ch-member-you"> · tú</span>}
                            </div>
                            {m.position && <div className="ch-member-role">{m.position}</div>}
                          </div>
                          {data.canWrite && !m.isSelf && (
                            <button
                              className="ibtn"
                              style={{ width: 24, height: 24 }}
                              onClick={() => removeMember(m.employeeId, m.fullName)}
                              disabled={membersBusy}
                              aria-label={`Quitar a ${m.fullName} del canal`}
                            >
                              <X size={11} />
                            </button>
                          )}
                        </div>
                      ))}
                      {members.length === 0 && (
                        <p className="ch-members-note">
                          Nadie está en este canal todavía.
                        </p>
                      )}
                    </div>

                    {/* Adding people needs the directory. Without
                        `empleados:read` the roster arrives empty and there is
                        nothing to offer, so the control does not appear. */}
                    {data.canWrite && data.roster.length > 0 && (
                      <div className="ch-members-add">
                        <div className="search" style={{ width: '100%', height: 30 }}>
                          <Search size={13} aria-hidden="true" />
                          <input
                            value={addQuery}
                            onChange={(e) => setAddQuery(e.target.value)}
                            placeholder="Agregar a alguien del equipo"
                            aria-label="Buscar una persona para agregar al canal"
                          />
                        </div>
                        {addQuery.trim() && (
                          <div className="ch-members-results">
                            {addCandidates.map((p) => (
                              <button
                                key={p.employeeId}
                                className="ch-member-add"
                                onClick={() => addMember(p.employeeId, p.fullName)}
                                disabled={membersBusy}
                              >
                                <Avatar name={p.fullName} size={22} />
                                <span className="ch-member-name">{p.fullName}</span>
                                <UserPlus size={12} style={{ marginLeft: 'auto', opacity: .6 }} />
                              </button>
                            ))}
                            {addCandidates.length === 0 && (
                              <p className="ch-members-note">
                                Nadie más coincide con «{addQuery.trim()}».
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="ch-msgs">
              {loadingChannel && <p className="ch-empty">Cargando la conversación…</p>}

              {!loadingChannel && currentId && hasOlder[currentId] && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 10px' }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={loadOlder}
                    disabled={loadingOlder}
                    aria-busy={loadingOlder}
                  >
                    {loadingOlder ? 'Cargando…' : 'Ver mensajes anteriores'}
                  </button>
                </div>
              )}

              {!loadingChannel && rows.length === 0 && (
                <div className="ch-empty-block">
                  <MessageSquare size={22} aria-hidden="true" />
                  <p className="ch-empty-title">Aún no hay mensajes en #{current.name}</p>
                  <p className="ch-empty-body">
                    {data.canWrite
                      ? 'Escribe el primero: comparte un avance, adjunta un proyecto o abre una decisión al equipo.'
                      : 'Cuando alguien escriba, lo verás aquí.'}
                  </p>
                </div>
              )}

              {rows.map((row, i) =>
                row.kind === 'day' ? (
                  <div className="ch-day" key={`d${i}`}>
                    <span>{row.label}</span>
                  </div>
                ) : (
                  <div className="ch-msg" key={row.message.id}>
                    <div className="ch-msg-ava">
                      <Avatar name={row.message.authorName} size={32} />
                    </div>
                    <div className="ch-msg-body">
                      <div className="ch-msg-meta">
                        <span className="ch-msg-name">{row.message.authorName}</span>
                        <span className="ch-msg-time">
                          {TIME.format(new Date(row.message.createdAt))}
                        </span>
                        {row.message.authorPosition && (
                          <span className="ch-msg-role">{row.message.authorPosition}</span>
                        )}
                      </div>
                      {row.message.body && <div className="ch-msg-text">{row.message.body}</div>}

                      {row.message.project && (
                        <div
                          className="ch-proj"
                          {...activatable(
                            () => router.push('/dashboard/proyectos'),
                            `Abrir proyecto ${row.message.project.name}`,
                          )}
                        >
                          <div className="ch-proj-head">
                            <Briefcase size={14} style={{ color: 'var(--ink2)' }} />
                            <span className="ch-proj-id">{row.message.project.code ?? 'Proyecto'}</span>
                            <Badge st={row.message.project.status} />
                          </div>
                          <div className="ch-proj-name">{row.message.project.name}</div>
                          <div className="ch-proj-meta">
                            {row.message.project.location && (
                              <span><MapPin size={11} />{row.message.project.location}</span>
                            )}
                            <span style={{ fontWeight: 400, color: 'var(--ink2)' }}>
                              {cop(row.message.project.budgetCents / 100)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ),
              )}
              <div ref={bottomRef} />
            </div>

            {/* Composer */}
            {data.canWrite ? (
              <div className="ch-composer">
                {picker.render && data.projects.length > 0 && (
                  <div className={`ch-picker ${dropdownClass(picker.shown, picker.closing)}`}>
                    <div className="ch-picker-title">Compartir proyecto</div>
                    {data.projects.map((p) => (
                      <button
                        key={p.id}
                        className={`ch-pick-item${selProy === p.id ? ' on' : ''}`}
                        onClick={() => { setSelProy(p.id); setShowProyPicker(false) }}
                      >
                        <Briefcase size={14} style={{ flexShrink: 0, opacity: .6 }} />
                        <div style={{ minWidth: 0 }}>
                          <div className="ch-pick-item-name">{p.name}</div>
                          <div className="ch-pick-item-sub">
                            {cop(p.budgetCents / 100)} · {p.status}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <div className="ch-input-row">
                  {/* The picker only exists when there is something to pick;
                      an attach button that opens an empty list is a dead end. */}
                  {data.projects.length > 0 && (
                    <button
                      className="ibtn tip-down"
                      style={{ width: 30, height: 30 }}
                      onClick={() => setShowProyPicker((v) => !v)}
                      data-tip="Adjuntar proyecto"
                      aria-label="Adjuntar proyecto"
                      aria-expanded={showProyPicker}
                    >
                      <Briefcase size={14} />
                    </button>
                  )}

                  <div className="ia-box" style={{ flex: 1 }}>
                    {selProjData && (
                      <span className="ch-input-tag">
                        {selProjData.code ?? selProjData.name}
                        <button onClick={() => setSelProy(null)} aria-label="Quitar el proyecto adjunto">
                          <X size={11} />
                        </button>
                      </span>
                    )}
                    {/* A textarea, not an input. The key handler has always
                        said "Enter sends unless Shift is held", but an <input>
                        cannot hold a newline, so Shift+Enter did nothing at
                        all — the escape hatch the shortcut promised did not
                        exist. */}
                    <textarea
                      ref={taRef}
                      rows={1}
                      className="ia-text"
                      placeholder={`Mensaje en #${current.name}`}
                      value={input}
                      onChange={(e) => { setInput(e.target.value); autoResize() }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() }
                      }}
                      disabled={sending}
                      aria-label={`Mensaje en ${current.name}`}
                    />
                  </div>

                  <button
                    className="ia-go"
                    onClick={sendMsg}
                    disabled={sending || (!input.trim() && !selProy)}
                    aria-label="Enviar mensaje"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="ch-composer">
                <p className="ch-readonly">
                  Tu rol puede leer los canales pero no escribir en ellos.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="ch-empty-block ch-empty-page">
            <MessageSquare size={22} aria-hidden="true" />
            <p className="ch-empty-title">Sin canales todavía</p>
            <p className="ch-empty-body">
              Los canales son las conversaciones del equipo por tema, obra o área. Cada mensaje
              puede llevar adjunto un proyecto para que el contexto viaje con la conversación.
            </p>
            {data.canWrite && (
              <button className="btn dark" onClick={() => setShowNewChan(true)}>
                <Plus size={14} />Crear el primer canal
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
