/** Mensajes públicos del portal de soporte. */
export const PORTAL_ERRORS: Record<string, string> = {
  KG201: 'El enlace no es válido.',
  KG202: 'El enlace venció. Pide uno nuevo.',
  KG203: 'El enlace fue revocado.',
  KG204: 'Demasiadas peticiones. Espera un momento y vuelve a intentar.',
  KG207: 'El ticket no existe.',
  KG208: 'El asunto debe tener entre 1 y 200 caracteres.',
  KG209: 'Escribe tu mensaje.',
  KG210: 'El ticket no existe o ya está cerrado.',
}

export interface PortalTicket {
  code: string
  subject: string
  status: string
  created_at: string
  body: string
}

export interface PortalComment {
  author: string
  body: string
  created_at: string
}