/**
 * Vocabulario del módulo leads, compartido entre servidor y cliente.
 *
 * Vive aquí y no en `queries/leads.ts` porque ese archivo es `server-only`
 * y el formulario del cliente también necesita las opciones — importar de
 * allí es exactamente el tipo de error que solo aparece al navegar.
 */

export const LEAD_SOURCES = ['Referido', 'Web', 'Campaña', 'Llamada', 'Otro'] as const
export const LEAD_STAGES = ['Nuevo', 'Contactado', 'Calificado', 'Perdido', 'Convertido'] as const
export const ACTIVITY_KINDS = ['Llamada', 'Correo', 'Nota', 'Agenda'] as const
