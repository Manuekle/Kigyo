import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'

/**
 * Channels: the team conversation, read through RLS.
 *
 * The screen used to be four hardcoded channels, eight invented colleagues and
 * three fake projects held in `useState` — nothing survived a reload and the
 * `channels` / `channel_members` / `channel_messages` tables it was meant to
 * drive went unused. Everything below is the real org's data.
 */

export interface CanalSummary {
  id: string
  slug: string
  name: string
  kind: 'grupo' | 'directo'
  memberCount: number
  /** ISO timestamp of the newest message, or null for an empty channel. */
  lastMessageAt: string | null
}

export interface CanalProject {
  id: string
  code: string | null
  name: string
  client: string
  location: string
  status: string
  budgetCents: number
}

export interface CanalMessage {
  id: string
  body: string
  createdAt: string
  authorId: string | null
  /** Falls back to a neutral label when the author was removed from the roster. */
  authorName: string
  authorPosition: string
  project: CanalProject | null
}

export interface CanalMember {
  employeeId: string
  fullName: string
  position: string
  isSelf: boolean
}

/** The roster this member can add to a channel: everyone on the directory. */
export interface CanalCandidate {
  employeeId: string
  fullName: string
  position: string
}

/** A window onto a conversation, oldest-first — the order it is read in. */
export interface ChannelMessagePage {
  messages: CanalMessage[]
  /** Whether the conversation continues before the first message returned. */
  hasOlder: boolean
}

export interface CanalesData {
  channels: CanalSummary[]
  /** Messages of `activeId` only; the client asks for the rest on demand. */
  activeId: string | null
  messages: CanalMessage[]
  /** Whether `messages` is the tail of a longer conversation. */
  hasOlderMessages: boolean
  /** Empty when the caller cannot read `proyectos`, which hides the picker. */
  projects: CanalProject[]
  /** Empty when the caller cannot read `empleados`, which hides the invite UI. */
  roster: CanalCandidate[]
  me: { employeeId: string | null; fullName: string }
  canWrite: boolean
}

const AUTHOR_FALLBACK = 'Alguien que ya no está en la organización'

/** Shape of the embedded project row, identical in both queries below. */
const PROJECT_COLUMNS = 'id, code, name, client, location, status, budget_cents'

interface ProjectRow {
  id: string
  code: string | null
  name: string
  client: string
  location: string
  status: string
  budget_cents: number
}

function toProject(row: ProjectRow | null): CanalProject | null {
  if (!row) return null
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    client: row.client,
    location: row.location,
    status: row.status,
    budgetCents: row.budget_cents,
  }
}

/** How many messages one window of a conversation holds. */
export const MESSAGE_PAGE_SIZE = 100

/**
 * A window of one channel's messages, oldest first.
 *
 * `channelId` is not trusted: the `.eq` is scoped by RLS, so a channel from
 * another organization returns nothing rather than someone else's
 * conversation.
 *
 * The window is anchored at the *end* of the conversation. It used to be
 * anchored at the start — `order(created_at asc).limit(300)` — which meant a
 * channel past its three-hundredth message opened on the day it was created
 * and never showed anything recent. Reading the newest slice and letting the
 * client ask backwards is both the fix and the pagination.
 */
export async function getChannelMessages(
  channelId: string,
  options: {
    /**
     * ISO timestamp of the newest message the caller already has.
     *
     * Polling for new messages used to be impossible: the only read returned
     * a fixed slice of the channel every time, so a five-second poll re-sent
     * the whole conversation. With `since` the poll costs one row per new
     * message and usually zero.
     */
    since?: string | null
    /** ISO timestamp of the oldest message held, to read further back. */
    before?: string | null
  } = {},
): Promise<ChannelMessagePage> {
  await requirePermission('canales:read')
  const supabase = await createClient()

  let query = supabase
    .from('channel_messages')
    .select(
      `id, body, created_at, author_id,
       author:employees!channel_messages_author_id_fkey ( full_name, position ),
       project:projects ( ${PROJECT_COLUMNS} )`,
    )
    .eq('channel_id', channelId)
    .is('deleted_at', null)
    .limit(MESSAGE_PAGE_SIZE)

  const polling = Boolean(options.since)

  if (polling) {
    // Strictly greater than, so the message that produced the cursor is not
    // returned again and appended as a duplicate.
    query = query.gt('created_at', options.since!).order('created_at', { ascending: true })
  } else {
    if (options.before) query = query.lt('created_at', options.before)
    query = query.order('created_at', { ascending: false })
  }

  const { data, error } = await query

  if (error) {
    console.error('[canales] getChannelMessages', error)
    return { messages: [], hasOlder: false }
  }

  const rows = data ?? []
  const messages = (polling ? rows : [...rows].reverse()).map((row) => {
    const author = row.author as unknown as { full_name: string; position: string } | null
    return {
      id: row.id,
      body: row.body,
      createdAt: row.created_at,
      authorId: row.author_id,
      authorName: author?.full_name || AUTHOR_FALLBACK,
      authorPosition: author?.position ?? '',
      project: toProject(row.project as unknown as ProjectRow | null),
    }
  })

  // A poll says nothing about how far back the conversation goes, and the
  // client already knows: it is holding the earlier window.
  return { messages, hasOlder: !polling && rows.length === MESSAGE_PAGE_SIZE }
}

/**
 * Who is in a channel.
 *
 * `channel_members` has existed since the schema was written and the screen
 * counted its rows without ever showing them — the header said "8 miembros"
 * and there was no way to find out which eight, or to become one of them.
 */
export async function getChannelMembers(channelId: string): Promise<CanalMember[]> {
  const member = await requirePermission('canales:read')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('channel_members')
    .select('employee_id, employees!inner ( full_name, position, user_id )')
    .eq('channel_id', channelId)

  if (error) {
    console.error('[canales] getChannelMembers', error)
    return []
  }

  return (data ?? [])
    .map((row) => {
      const employee = row.employees as unknown as {
        full_name: string
        position: string
        user_id: string | null
      }
      return {
        employeeId: row.employee_id,
        fullName: employee.full_name,
        position: employee.position,
        isSelf: employee.user_id === member.userId,
      }
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'))
}

export async function getCanalesData(): Promise<CanalesData> {
  const member = await requirePermission('canales:read')
  const supabase = await createClient()

  const canReadProjects = can(member.permissions, 'proyectos:read')
  const canReadRoster = can(member.permissions, 'empleados:read')

  const [channelsResult, activityResult, meResult, projectsResult, rosterResult] = await Promise.all([
    supabase
      .from('channels')
      .select('id, slug, name, kind, channel_members(count)')
      .eq('org_id', member.orgId)
      .order('name', { ascending: true }),
    // One pass over recent messages is cheaper than a per-channel aggregate,
    // and the list only needs the newest timestamp per channel.
    supabase
      .from('channel_messages')
      .select('channel_id, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase
      .from('employees')
      .select('id, full_name')
      .eq('org_id', member.orgId)
      .eq('user_id', member.userId)
      .is('deleted_at', null)
      .maybeSingle(),
    canReadProjects
      ? supabase
          .from('projects')
          .select(PROJECT_COLUMNS)
          .eq('org_id', member.orgId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [], error: null }),
    canReadRoster
      ? supabase
          .from('employees')
          .select('id, full_name, position')
          .eq('org_id', member.orgId)
          .is('deleted_at', null)
          .neq('status', 'Salida')
          .order('full_name', { ascending: true })
          .limit(200)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (channelsResult.error) {
    console.error('[canales] getCanalesData', channelsResult.error)
  }

  const lastByChannel = new Map<string, string>()
  for (const row of activityResult.data ?? []) {
    if (!lastByChannel.has(row.channel_id)) lastByChannel.set(row.channel_id, row.created_at)
  }

  const channels: CanalSummary[] = (channelsResult.data ?? []).map((row) => {
    // PostgREST returns an aggregate embed as a one-element array.
    const countRow = row.channel_members as unknown as Array<{ count: number }> | null
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      kind: row.kind as 'grupo' | 'directo',
      memberCount: countRow?.[0]?.count ?? 0,
      lastMessageAt: lastByChannel.get(row.id) ?? null,
    }
  })

  // Busiest first, so the channel the team is actually using opens by default;
  // silent channels keep their alphabetical order underneath.
  channels.sort((a, b) => {
    if (a.lastMessageAt && b.lastMessageAt) return b.lastMessageAt.localeCompare(a.lastMessageAt)
    if (a.lastMessageAt) return -1
    if (b.lastMessageAt) return 1
    return a.name.localeCompare(b.name, 'es')
  })

  const activeId = channels[0]?.id ?? null
  const opening = activeId
    ? await getChannelMessages(activeId)
    : { messages: [], hasOlder: false }

  return {
    channels,
    activeId,
    messages: opening.messages,
    hasOlderMessages: opening.hasOlder,
    projects: ((projectsResult.data ?? []) as ProjectRow[]).map(
      (row) => toProject(row) as CanalProject,
    ),
    roster: ((rosterResult.data ?? []) as Array<{ id: string; full_name: string; position: string }>)
      .map((row) => ({
        employeeId: row.id,
        fullName: row.full_name,
        position: row.position,
      })),
    me: {
      employeeId: meResult.data?.id ?? null,
      fullName: meResult.data?.full_name || member.fullName,
    },
    canWrite: can(member.permissions, 'canales:write'),
  }
}
