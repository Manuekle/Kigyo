/**
 * Browser-side fetch wrapper that understands the problem+json envelope the
 * route handlers return.
 *
 * Without it every call site re-implements "read .error, fall back to a
 * generic string" — which is how the old pages ended up showing
 * `undefined` whenever the response shape changed.
 */

export interface ApiProblem {
  type: string
  title: string
  status: number
  detail?: string
  errors?: Record<string, string[]>
}

export class ApiClientError extends Error {
  readonly status: number
  readonly problem: ApiProblem

  constructor(problem: ApiProblem) {
    super(problem.detail ?? problem.title)
    this.name = 'ApiClientError'
    this.status = problem.status
    this.problem = problem
  }

  /** First message for a given field, for inline form errors. */
  fieldError(field: string): string | undefined {
    return this.problem.errors?.[field]?.[0]
  }
}

const NETWORK_ERROR: ApiProblem = {
  type: 'kigyo:network',
  title: 'Sin conexión',
  status: 0,
  detail: 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.',
}

export async function apiFetch<T = unknown>(
  input: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response
  try {
    response = await fetch(input, {
      ...init,
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        accept: 'application/json',
        ...init.headers,
      },
    })
  } catch {
    throw new ApiClientError(NETWORK_ERROR)
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    const problem = payload as Partial<ApiProblem> | null
    throw new ApiClientError({
      type: problem?.type ?? 'about:blank',
      title: problem?.title ?? 'Error',
      status: response.status,
      detail: problem?.detail ?? 'Algo salió mal. Intenta de nuevo.',
      errors: problem?.errors,
    })
  }

  return payload as T
}

/** Turns any thrown value into a message safe to render in the UI. */
export function errorMessage(error: unknown, fallback = 'Algo salió mal. Intenta de nuevo.'): string {
  if (error instanceof ApiClientError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}
