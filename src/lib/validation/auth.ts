import { z } from 'zod'

/**
 * Shared by the forms and the route handlers, so the browser and the server
 * never disagree about what is valid. The server always re-parses: client-side
 * validation is a convenience, not a control.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Ingresa un correo válido.')
  .max(254, 'El correo es demasiado largo.')
  .pipe(z.email('Ingresa un correo válido.'))

/**
 * Minimum length only, deliberately. Composition rules ("must contain a
 * symbol") push people towards `Password1!` and are no longer recommended by
 * NIST SP 800-63B; length plus a breach check is what actually helps. Supabase
 * enforces its own configured minimum on top of this.
 */
export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(72, 'La contraseña no puede superar 72 caracteres.')

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Ingresa tu contraseña.'),
})

/**
 * Signing up registers a *person*, and nothing else.
 *
 * It used to also ask for a company name and a sector, which the signup trigger
 * turned into an organization — and then the wizard at /onboarding asked for
 * both again, because it is the screen that can actually explain what a sector
 * does and show what it proposes. The customer answered twice and the second
 * answer won.
 *
 * So the questions live in one place now, and it is the one with room for them.
 * The trigger names the first company after the person; the wizard's first step
 * renames it.
 */
export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Ingresa tu nombre.').max(160, 'El nombre es demasiado largo.'),
  email: emailSchema,
  password: passwordSchema,
})

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

export const verifyOtpSchema = z.object({
  email: emailSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'El código son 6 dígitos.'),
})

export const resetPasswordSchema = z.object({
  password: passwordSchema,
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
