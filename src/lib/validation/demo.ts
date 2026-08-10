import { z } from 'zod'

import { emailSchema } from './auth'

/**
 * Shared by the contact form and its route handler. The form checks it to give
 * inline feedback; the server re-parses because client-side validation is a
 * convenience, not a control.
 *
 * The bounds match the CHECK constraints on `public.demo_requests` — a value
 * the schema accepts and Postgres rejects would surface as a 500 instead of a
 * field error.
 */
export const demoRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Ingresa tu nombre.')
    .max(160, 'El nombre es demasiado largo.'),
  email: emailSchema,
  company: z
    .string()
    .trim()
    .max(120, 'El nombre de la empresa es demasiado largo.')
    .optional(),
  message: z
    .string()
    .trim()
    .min(10, 'Cuéntanos un poco más — al menos 10 caracteres.')
    .max(2000, 'El mensaje es demasiado largo.'),
})

export type DemoRequestInput = z.infer<typeof demoRequestSchema>
