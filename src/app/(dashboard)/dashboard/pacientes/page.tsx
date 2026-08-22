import RequirePermission from '@/components/layout/RequirePermission'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { DENTAL_SUBSECTOR, VET_SUBSECTOR } from '@/lib/domain'
import { getPacientes } from '@/server/queries/pacientes'
import { getOdontologia } from '@/server/queries/odontologia'
import { getVeterinaria } from '@/server/queries/veterinaria'
import { getRadiografias } from '@/server/queries/radiografias'
import Client from './client'

/**
 * Server shell. Authorization runs here, before any of the client bundle for
 * this route is sent — which matters more here than anywhere else in the app,
 * since the bundle would otherwise carry clinical data to the browser.
 */
export default function Page() {
  return (
    <RequirePermission permission="pacientes:read">
      <Loader />
    </RequirePermission>
  )
}

/** Split out so the read runs *after* the guard has answered. */
async function Loader() {
  const member = await requirePermission('pacientes:read')
  /**
   * Lo dental se lee para una clínica dental, y para una organización de salud
   * que nunca eligió subsector: la alternativa es que un odontólogo que saltó
   * la pregunta pierda el odontograma en silencio. Quien sí eligió rama —IPS,
   * laboratorio, veterinaria— no lo ve, y eso es exacto. El guard de sector
   * excluye a `fitness-centro`, que también lleva `pacientes` y no es salud.
   */
  const salud = member.companyType === 'salud'
  const dental = salud && (member.subsector === null || member.subsector === DENTAL_SUBSECTOR)
  const vet = member.subsector === VET_SUBSECTOR

  /**
   * Lo dental solo se lee para una clínica dental.
   *
   * Cinco de las seis ramas de salud no lo usan, y cobrarle a un laboratorio
   * clínico tres consultas más en cada carga para traer tablas que siempre le
   * vuelven vacías es el tipo de coste que nadie mide y todos pagan.
   *
   * Es presentación, no acceso: quien tenga `pacientes:read` puede leer estas
   * tablas por RLS igual, y así debe ser el día que la clínica se reclasifique.
   */
  const [data, odonto, vetData, imagenes, catalogo] = await Promise.all([
    getPacientes(),
    dental ? getOdontologia() : Promise.resolve(null),
    vet ? getVeterinaria() : Promise.resolve(null),
    // Las imágenes son de todas las ramas de salud: una lesión fotografiada
    // la necesita igual el veterinario que el odontólogo.
    getRadiografias(),
    dental && member.modules.has('catalogos') && can(member.permissions, 'catalogos:read')
      ? catalogoDental(member.orgId)
      : Promise.resolve([]),
  ])

  return <Client data={data} odonto={odonto} vet={vetData} imagenes={imagenes} catalogo={catalogo} />
}

/**
 * Los procedimientos del catálogo, para poner precio a una línea del plan.
 *
 * Una consulta suelta y no `rosterFor`-style en shared.ts porque solo la usa
 * esta pantalla: una clínica que no lleva catálogo escribe el precio a mano y
 * no pierde nada.
 */
async function catalogoDental(orgId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select('id, name, price_cents')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(300)

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    priceCents: p.price_cents,
  }))
}
