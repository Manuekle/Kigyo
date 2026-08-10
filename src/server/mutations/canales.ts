'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import {
  getChannelMembers,
  getChannelMessages,
  type CanalMember,
  type CanalMessage,
  type CanalSummary,
  type ChannelMessagePage,
} from '@/server/queries/canales'

/**
 * Server Functions for the canales screen.
 *
 * Every one re-checks the caller's permission. A Server Function is a public
 * HTTP endpoint — being reachable only from a control the UI hides is not
 * access control.
 */

export type CanalResult<T> = { ok: true; data: T } | { ok: false; error: string }

const NO_EMPLOYEE =
  'Tu cuenta no está vinculada a una persona del equipo. Pide a administración que te agregue al directorio de empleados.'

/** The employee row behind the signed-in user, which is what messages hang off. */
async function currentEmployeeId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('employees')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()
  return data?.id ?? null
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

const uuidSchema = z.uuid()

const createSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'El nombre del canal necesita al menos 2 caracteres.')
    .max(60, 'El nombre del canal es demasiado largo.'),
})

export async function createChannel(
  input: z.input<typeof createSchema>,
): Promise<CanalResult<CanalSummary>> {
  try {
    const member = await requirePermission('canales:write')
    const parsed = createSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    }

    const base = slugify(parsed.data.name)
    if (!base) {
      return { ok: false, error: 'Usa al menos una letra o un número en el nombre.' }
    }

    const supabase = await createClient()

    // `(org_id, slug)` is unique, so two channels named "Obra Norte" and
    // "obra norte" collide. Rather than rejecting the second one, number it.
    let created: { id: string; slug: string; name: string; kind: string } | null = null
    let lastError: string | null = null
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      const slug = attempt === 0 ? base : `${base}-${attempt + 1}`
      const { data, error } = await supabase
        .from('channels')
        .insert({ org_id: member.orgId, slug, name: parsed.data.name, kind: 'grupo' })
        .select('id, slug, name, kind')
        .single()

      if (!error && data) {
        created = data
        break
      }
      // 23505 = unique_violation; anything else is not worth retrying.
      if (error && error.code !== '23505') {
        console.error('[canales] createChannel', error)
        lastError = 'No se pudo crear el canal.'
        break
      }
    }

    if (!created) {
      return { ok: false, error: lastError ?? 'Ya existe un canal con un nombre muy parecido.' }
    }

    // The creator joins their own channel; otherwise it opens with 0 members
    // and reads as someone else's room.
    const employeeId = await currentEmployeeId(supabase, member.orgId, member.userId)
    if (employeeId) {
      await supabase
        .from('channel_members')
        .insert({ channel_id: created.id, employee_id: employeeId })
    }

    revalidatePath('/dashboard/canales')
    return {
      ok: true,
      data: {
        id: created.id,
        slug: created.slug,
        name: created.name,
        kind: created.kind as 'grupo' | 'directo',
        memberCount: employeeId ? 1 : 0,
        lastMessageAt: null,
      },
    }
  } catch {
    return { ok: false, error: 'No tienes permiso para crear canales.' }
  }
}

const sendSchema = z.object({
  channelId: z.uuid(),
  body: z.string().trim().max(4000, 'El mensaje es demasiado largo.'),
  projectId: z.uuid().nullable().optional(),
})

export async function sendChannelMessage(
  input: z.input<typeof sendSchema>,
): Promise<CanalResult<CanalMessage>> {
  try {
    const member = await requirePermission('canales:write')
    const parsed = sendSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    }

    const { channelId, body, projectId } = parsed.data
    // A message with neither text nor a project card carries nothing.
    if (!body && !projectId) {
      return { ok: false, error: 'Escribe un mensaje o adjunta un proyecto.' }
    }

    const supabase = await createClient()
    const employeeId = await currentEmployeeId(supabase, member.orgId, member.userId)
    if (!employeeId) return { ok: false, error: NO_EMPLOYEE }

    const { data, error } = await supabase
      .from('channel_messages')
      .insert({
        channel_id: channelId,
        author_id: employeeId,
        body: body || 'Compartió un proyecto',
        project_id: projectId ?? null,
      })
      .select(
        `id, body, created_at, author_id,
         author:employees!channel_messages_author_id_fkey ( full_name, position ),
         project:projects ( id, code, name, client, location, status, budget_cents )`,
      )
      .single()

    if (error || !data) {
      console.error('[canales] sendChannelMessage', error)
      return { ok: false, error: 'No se pudo enviar el mensaje.' }
    }

    const author = data.author as unknown as { full_name: string; position: string } | null
    const project = data.project as unknown as {
      id: string
      code: string | null
      name: string
      client: string
      location: string
      status: string
      budget_cents: number
    } | null

    revalidatePath('/dashboard/canales')
    return {
      ok: true,
      data: {
        id: data.id,
        body: data.body,
        createdAt: data.created_at,
        authorId: data.author_id,
        authorName: author?.full_name || member.fullName,
        authorPosition: author?.position ?? '',
        project: project && {
          id: project.id,
          code: project.code,
          name: project.name,
          client: project.client,
          location: project.location,
          status: project.status,
          budgetCents: project.budget_cents,
        },
      },
    }
  } catch {
    return { ok: false, error: 'No tienes permiso para escribir en canales.' }
  }
}

/**
 * Read exposed to the client so switching channels does not reload the route.
 *
 * `since` also serves the poll that keeps an open channel current. Without it
 * a message sent by a colleague never appeared until you switched channels and
 * back, because the client caches each conversation and had no way to ask for
 * "only what is newer than what I have".
 */
export async function fetchChannelMessages(
  channelId: string,
  since?: string | null,
): Promise<CanalResult<ChannelMessagePage>> {
  try {
    if (!uuidSchema.safeParse(channelId).success) {
      return { ok: false, error: 'Canal desconocido.' }
    }
    const cursor = since && !Number.isNaN(Date.parse(since)) ? since : null
    return { ok: true, data: await getChannelMessages(channelId, { since: cursor }) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver este canal.' }
  }
}

/**
 * The window of messages before the one on screen.
 *
 * `before` is the timestamp of the oldest message the client holds. It is not
 * trusted for access: `getChannelMessages` re-checks `canales:read` and RLS
 * scopes the rows, so a forged cursor only moves the window inside a
 * conversation the caller could already read.
 */
export async function fetchOlderMessages(
  channelId: string,
  before: string,
): Promise<CanalResult<ChannelMessagePage>> {
  try {
    if (!uuidSchema.safeParse(channelId).success) {
      return { ok: false, error: 'Canal desconocido.' }
    }
    if (Number.isNaN(Date.parse(before))) {
      return { ok: false, error: 'No se pudo cargar el historial.' }
    }
    return { ok: true, data: await getChannelMessages(channelId, { before }) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver este canal.' }
  }
}

/** The channel roster, loaded when the members panel is opened. */
export async function fetchChannelMembers(
  channelId: string,
): Promise<CanalResult<CanalMember[]>> {
  try {
    if (!uuidSchema.safeParse(channelId).success) {
      return { ok: false, error: 'Canal desconocido.' }
    }
    return { ok: true, data: await getChannelMembers(channelId) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver este canal.' }
  }
}

const renameSchema = z.object({
  channelId: z.uuid(),
  name: z
    .string()
    .trim()
    .min(2, 'El nombre del canal necesita al menos 2 caracteres.')
    .max(60, 'El nombre del canal es demasiado largo.'),
})

/**
 * Rename a channel.
 *
 * The slug is deliberately left alone. It is what `(org_id, slug)` is unique
 * on and what any saved link points at; renaming "Obra Norte" to "Obra Norte —
 * fase 2" should not break a link someone pasted in a ticket last month.
 */
export async function renameChannel(
  input: z.input<typeof renameSchema>,
): Promise<CanalResult<{ id: string; name: string }>> {
  try {
    await requirePermission('canales:write')
    const parsed = renameSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('channels')
      .update({ name: parsed.data.name })
      .eq('id', parsed.data.channelId)
      .select('id, name')
      .single()

    if (error || !data) {
      console.error('[canales] renameChannel', error)
      return { ok: false, error: 'No se pudo renombrar el canal.' }
    }

    revalidatePath('/dashboard/canales')
    return { ok: true, data }
  } catch {
    return { ok: false, error: 'No tienes permiso para renombrar canales.' }
  }
}

const membershipSchema = z.object({
  channelId: z.uuid(),
  /** Omitted means "me" — the join/leave button on your own membership. */
  employeeId: z.uuid().nullable().optional(),
})

export async function joinChannel(
  input: z.input<typeof membershipSchema>,
): Promise<CanalResult<CanalMember[]>> {
  try {
    const member = await requirePermission('canales:write')
    const parsed = membershipSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: 'Datos inválidos.' }

    const supabase = await createClient()
    const employeeId =
      parsed.data.employeeId ?? (await currentEmployeeId(supabase, member.orgId, member.userId))
    if (!employeeId) return { ok: false, error: NO_EMPLOYEE }

    // Idempotent: `(channel_id, employee_id)` is unique, and adding someone
    // who is already in the channel is not an error worth showing a person.
    const { error } = await supabase
      .from('channel_members')
      .upsert(
        { channel_id: parsed.data.channelId, employee_id: employeeId },
        { onConflict: 'channel_id,employee_id', ignoreDuplicates: true },
      )

    if (error) {
      console.error('[canales] joinChannel', error)
      return { ok: false, error: 'No se pudo agregar a la persona al canal.' }
    }

    revalidatePath('/dashboard/canales')
    return { ok: true, data: await getChannelMembers(parsed.data.channelId) }
  } catch {
    return { ok: false, error: 'No tienes permiso para gestionar este canal.' }
  }
}

export async function leaveChannel(
  input: z.input<typeof membershipSchema>,
): Promise<CanalResult<CanalMember[]>> {
  try {
    const member = await requirePermission('canales:write')
    const parsed = membershipSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: 'Datos inválidos.' }

    const supabase = await createClient()
    const employeeId =
      parsed.data.employeeId ?? (await currentEmployeeId(supabase, member.orgId, member.userId))
    if (!employeeId) return { ok: false, error: NO_EMPLOYEE }

    const { error } = await supabase
      .from('channel_members')
      .delete()
      .eq('channel_id', parsed.data.channelId)
      .eq('employee_id', employeeId)

    if (error) {
      console.error('[canales] leaveChannel', error)
      return { ok: false, error: 'No se pudo quitar a la persona del canal.' }
    }

    // Messages stay. Leaving a channel is not retracting what you said in it,
    // and `channel_messages.author_id` is `on delete set null` for people who
    // leave the company — not for people who leave a room.
    revalidatePath('/dashboard/canales')
    return { ok: true, data: await getChannelMembers(parsed.data.channelId) }
  } catch {
    return { ok: false, error: 'No tienes permiso para gestionar este canal.' }
  }
}
