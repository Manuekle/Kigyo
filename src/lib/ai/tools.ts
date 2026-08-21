import 'server-only'
import { tool } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { can, type Permission } from '@/lib/auth/permissions'
import type { Member } from '@/lib/auth/session'
import type { InventoryCategory, TicketArea } from '@/lib/supabase/types'

/**
 * Live operational data for the assistant.
 *
 * These answer the questions the old `simulatedReply()` faked with a chain of
 * keyword `if`s — pending signatures, open tickets, inventory, risk, document
 * compliance — except against the real database.
 *
 * Two properties hold for every tool here:
 *
 *   1. They query through the caller's own Supabase session, so RLS applies.
 *      The service-role client is deliberately not used: a tool that bypassed
 *      RLS would let a carefully worded prompt read another tenant's rows.
 *   2. A tool is only offered to the model when the caller holds the matching
 *      permission. Someone without payroll access is not handed a payroll tool
 *      and then refused — the model never sees that it exists.
 *
 * All but one of them read. `crearTicket` is the exception, and it carries a
 * third guarantee: `needsApproval` parks the call until the person approves it
 * on screen, so a prompt that talks the model into filing tickets still ends
 * at a button someone has to press.
 */

// The enum columns are typed unions in the generated schema, so the model is
// constrained to values the database will actually accept rather than being
// free to invent an area name that silently matches nothing.
const TICKET_AREAS = [
  'TI', 'Nómina', 'Personas', 'Finanzas', 'Legal', 'Contratos', 'Onboarding',
  'Permisos', 'Capacitación', 'Administración', 'Beneficios', 'Otro',
] as const satisfies readonly TicketArea[]

const INVENTORY_CATEGORIES = [
  'Cómputo', 'Monitor', 'Móvil', 'Tablet', 'Periférico', 'Mobiliario',
  'Herramientas', 'Vehículos', 'Electrónica', 'Otro',
] as const satisfies readonly InventoryCategory[]

function formatDate(value: string | null): string {
  if (!value) return 'sin fecha'
  return new Date(value).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function daysSince(value: string | null): number | null {
  if (!value) return null
  return Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)
}

/** Supabase returns embedded relations as an object or null depending on shape. */
function personName(relation: unknown): string | undefined {
  const value = Array.isArray(relation) ? relation[0] : relation
  return (value as { full_name?: string } | null)?.full_name
}

function defineTools(member: Member) {
  return {
    firmasPendientes: tool({
      description:
        'Lista las solicitudes de firma pendientes o vencidas de la organización, ' +
        'con quién debe firmar y cuántos días lleva pendiente.',
      inputSchema: z.object({
        soloVencidas: z
          .boolean()
          .default(false)
          .describe('Si es true, solo devuelve las que ya pasaron su fecha límite.'),
      }),
      async execute({ soloVencidas }) {
        const supabase = await createClient()
        const base = supabase
          .from('signature_requests')
          .select('code, title, kind, status, requested_on, due_on, employees:signer_id(full_name)')
          .is('deleted_at', null)
          .order('due_on', { ascending: true, nullsFirst: false })
          .limit(50)

        const { data, error } = await (soloVencidas
          ? base.eq('status', 'Vencido')
          : base.in('status', ['Pendiente', 'Vencido']))

        if (error) return { error: 'No se pudieron leer las firmas.' }

        return {
          total: data.length,
          firmas: data.map((row) => ({
            codigo: row.code,
            documento: row.title,
            tipo: row.kind,
            estado: row.status,
            firmante: personName(row.employees) ?? 'sin asignar',
            solicitada: formatDate(row.requested_on),
            vence: formatDate(row.due_on),
            diasPendiente: daysSince(row.requested_on),
          })),
        }
      },
    }),

    ticketsAbiertos: tool({
      description:
        'Resume los tickets de soporte: totales por estado y los abiertos más relevantes, ' +
        'opcionalmente filtrados por área o prioridad.',
      inputSchema: z.object({
        area: z.enum(TICKET_AREAS).optional(),
        prioridad: z.enum(['Alta', 'Media', 'Baja']).optional(),
      }),
      async execute({ area, prioridad }) {
        const supabase = await createClient()
        let query = supabase
          .from('tickets')
          .select('code, subject, area, priority, status, created_at, employees:requester_id(full_name)')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(100)

        if (area) query = query.eq('area', area)
        if (prioridad) query = query.eq('priority', prioridad)

        const { data, error } = await query
        if (error) return { error: 'No se pudieron leer los tickets.' }

        const porEstado = data.reduce<Record<string, number>>((acc, row) => {
          acc[row.status] = (acc[row.status] ?? 0) + 1
          return acc
        }, {})

        return {
          total: data.length,
          porEstado,
          abiertos: data
            .filter((row) => row.status === 'Abierto' || row.status === 'En proceso')
            .slice(0, 15)
            .map((row) => ({
              codigo: row.code,
              asunto: row.subject,
              area: row.area,
              prioridad: row.priority,
              estado: row.status,
              solicitante: personName(row.employees) ?? 'desconocido',
              creado: formatDate(row.created_at),
            })),
        }
      },
    }),

    estadoInventario: tool({
      description:
        'Estado del inventario de activos: totales por estado y los activos sin asignar.',
      inputSchema: z.object({
        categoria: z.enum(INVENTORY_CATEGORIES).optional(),
      }),
      async execute({ categoria }) {
        const supabase = await createClient()
        let query = supabase
          .from('inventory_assets')
          .select('code, name, category, status, serial')
          .is('deleted_at', null)
          .limit(500)

        if (categoria) query = query.eq('category', categoria)

        const { data, error } = await query
        if (error) return { error: 'No se pudo leer el inventario.' }

        const porEstado = data.reduce<Record<string, number>>((acc, row) => {
          acc[row.status] = (acc[row.status] ?? 0) + 1
          return acc
        }, {})

        return {
          total: data.length,
          porEstado,
          sinAsignar: data
            .filter((row) => row.status === 'Disponible')
            .slice(0, 20)
            .map((row) => ({
              codigo: row.code,
              activo: row.name,
              categoria: row.category,
              serial: row.serial,
            })),
        }
      },
    }),

    riesgosAbiertos: tool({
      description: 'Riesgos abiertos de la organización, ordenados por severidad.',
      inputSchema: z.object({
        severidad: z.enum(['Alta', 'Media', 'Baja']).optional(),
      }),
      async execute({ severidad }) {
        const supabase = await createClient()
        let query = supabase
          .from('risks')
          .select(
            'code, category, title, area, severity, detail, action, due_on, employees:employee_id(full_name)',
          )
          .is('deleted_at', null)
          .eq('status', 'Abierto')
          .limit(100)

        if (severidad) query = query.eq('severity', severidad)

        const { data, error } = await query
        if (error) return { error: 'No se pudieron leer los riesgos.' }

        const orden = { Alta: 0, Media: 1, Baja: 2 } as const
        return {
          total: data.length,
          riesgos: [...data]
            .sort((a, b) => orden[a.severity] - orden[b.severity])
            .slice(0, 20)
            .map((row) => ({
              codigo: row.code,
              categoria: row.category,
              titulo: row.title,
              area: row.area,
              severidad: row.severity,
              detalle: row.detail,
              accion: row.action,
              persona: personName(row.employees),
              vence: formatDate(row.due_on),
            })),
        }
      },
    }),

    cumplimientoDocumental: tool({
      description:
        'Estado del repositorio documental: totales por estado, porcentaje de cumplimiento ' +
        'y documentos vencidos o por vencer.',
      inputSchema: z.object({
        diasHorizonte: z
          .number()
          .int()
          .min(1)
          .max(365)
          .default(30)
          .describe('Ventana en días para considerar un documento "por vencer".'),
      }),
      async execute({ diasHorizonte }) {
        const supabase = await createClient()
        const horizon = new Date(Date.now() + diasHorizonte * 86_400_000)
          .toISOString()
          .slice(0, 10)

        const { data, error } = await supabase
          .from('documents')
          .select('code, name, kind, status, expires_on, department')
          .is('deleted_at', null)
          .limit(500)

        if (error) return { error: 'No se pudieron leer los documentos.' }

        const porEstado = data.reduce<Record<string, number>>((acc, row) => {
          acc[row.status] = (acc[row.status] ?? 0) + 1
          return acc
        }, {})

        const total = data.length
        const vigentes = porEstado['Vigente'] ?? 0

        return {
          total,
          porEstado,
          cumplimientoPct: total ? Math.round((vigentes / total) * 100) : 0,
          porVencer: data
            .filter((row) => row.expires_on !== null && row.expires_on <= horizon)
            .slice(0, 20)
            .map((row) => ({
              codigo: row.code,
              documento: row.name,
              tipo: row.kind,
              area: row.department,
              vence: formatDate(row.expires_on),
            })),
        }
      },
    }),

    resumenEquipo: tool({
      description:
        'Conteo de la plantilla por estado, departamento y ubicación. No devuelve datos ' +
        'personales más allá de agregados.',
      inputSchema: z.object({
        departamento: z.string().max(80).optional(),
      }),
      async execute({ departamento }) {
        const supabase = await createClient()
        let query = supabase
          .from('employees')
          .select('department, location, status')
          .is('deleted_at', null)
          .limit(1000)

        if (departamento) query = query.eq('department', departamento)

        const { data, error } = await query
        if (error) return { error: 'No se pudo leer el directorio.' }

        const count = (key: 'department' | 'location' | 'status') =>
          data.reduce<Record<string, number>>((acc, row) => {
            const value = row[key] || 'Sin definir'
            acc[value] = (acc[value] ?? 0) + 1
            return acc
          }, {})

        return {
          total: data.length,
          activos: data.filter((row) => row.status === 'Activo').length,
          porDepartamento: count('department'),
          porUbicacion: count('location'),
          porEstado: count('status'),
        }
      },
    }),

    crearTicket: tool({
      description:
        'Crea un ticket de soporte. Es la única herramienta que escribe: la persona ' +
        'tiene que aprobarla en la interfaz antes de que se ejecute, así que propón ' +
        'el ticket con los datos que tengas y espera la decisión. Si falta el área o ' +
        'la prioridad, elige la más razonable y dilo en la respuesta — la persona lo ' +
        've en la tarjeta antes de aprobar.',
      inputSchema: z.object({
        asunto: z.string().trim().min(3).max(200).describe('Título del ticket.'),
        descripcion: z.string().trim().max(4000).default(''),
        area: z.enum(TICKET_AREAS).default('Otro'),
        prioridad: z.enum(['Alta', 'Media', 'Baja']).default('Media'),
      }),
      // El modelo nunca escribe por su cuenta. Con esto el SDK detiene la
      // llamada en `approval-requested` y solo ejecuta cuando la respuesta de
      // aprobación vuelve desde el cliente; ver ApprovalCard en la página.
      needsApproval: true,
      async execute({ asunto, descripcion, area, prioridad }) {
        const supabase = await createClient()

        // Quien reporta es quien está en sesión, no quien nombre el modelo:
        // un ticket abierto «a nombre de» otra persona es otra función.
        const { data: employee } = await supabase
          .from('employees')
          .select('id')
          .eq('org_id', member.orgId)
          .eq('user_id', member.userId)
          .is('deleted_at', null)
          .maybeSingle()

        const { data, error } = await supabase
          .from('tickets')
          .insert({
            org_id: member.orgId,
            subject: asunto,
            body: descripcion,
            area,
            priority: prioridad,
            status: 'Abierto',
            requester_id: employee?.id ?? null,
            origin: 'Interno',
          })
          .select('code, subject, area, priority')
          .single()

        if (error) {
          console.error('[ai] crearTicket', error)
          return { error: 'No se pudo crear el ticket.' }
        }

        return {
          creado: true,
          codigo: data.code,
          asunto: data.subject,
          area: data.area,
          prioridad: data.priority,
        }
      },
    }),
  }
}

/**
 * The set of tools this member may use.
 *
 * Built with conditional spreads rather than a loop over a permission map: an
 * indexed assignment across differently-typed tools produces a union TS cannot
 * represent, and spreading keeps each tool's own input/output types intact
 * while still putting the required permission next to the tool.
 */
export function buildTools(member: Member) {
  const all = defineTools(member)
  /**
   * Las dos puertas, no una.
   *
   * Esto comprobaba solo el permiso, y el permiso responde «esta persona puede
   * ver X» — no «esta empresa usa X». Son ortogonales en todo el resto del
   * producto: `requirePermission` mira las dos, y `member.can()` en la interfaz
   * también. Aquí faltaba la del módulo, así que una empresa que apagaba
   * Inventario en Configuración lo veía desaparecer del menú y seguía pudiendo
   * preguntárselo al asistente, porque el rol conservaba `inventario:read`.
   *
   * Apagar un módulo tiene que apagarlo en todas partes o no significa nada.
   * Es el mismo agujero que el envoltorio de `lib/api/handler.ts` documenta
   * haber tapado en su día para las rutas HTTP.
   */
  const has = (permission: Permission) =>
    member.modules.has(permission.split(':')[0]) && can(member.permissions, permission)

  return {
    ...(has('firmas:read') ? { firmasPendientes: all.firmasPendientes } : {}),
    ...(has('tickets:read') ? { ticketsAbiertos: all.ticketsAbiertos } : {}),
    ...(has('inventario:read') ? { estadoInventario: all.estadoInventario } : {}),
    ...(has('riesgos:read') ? { riesgosAbiertos: all.riesgosAbiertos } : {}),
    ...(has('documentos:read') ? { cumplimientoDocumental: all.cumplimientoDocumental } : {}),
    ...(has('empleados:read') ? { resumenEquipo: all.resumenEquipo } : {}),
    ...(has('tickets:write') ? { crearTicket: all.crearTicket } : {}),
  }
}
