/**
 * Cola local de ventas POS offline.
 *
 * Wrapper delgado sobre IndexedDB para encolar ventas que el navegador no
 * pudo mandar al servidor (sin red, server caído) y reproducirlas cuando
 * la red vuelve. Cada venta lleva un `clientUuid` generado en el cliente —
 * el servidor lo persisted como `pos_sales.client_uuid` y, gracias al
 * unique index parcial y al early return de `register_pos_sale`, un
 * reintento duplica silenciosamente sin recobrar existencias dos veces.
 *
 * Sin dependencia externa (no Dexie): IndexedDB crudo. Una sola object
 * store (`pos_outbox`) indexada por `clientUuid` (único). Suficiente para
 * una cola simple — si la cola crece más allá de lo previsto, migrar a
 * Dexie es un reemplazo local que no toca el servidor ni la UI.
 */

const DB_NAME = 'kigyo-pos-outbox'
const DB_VERSION = 1
const STORE = 'pos_outbox'

export type OutboxStatus = 'pending' | 'error'

export interface PosOutboxEntry {
  /** UUID generado en el cliente (crypto.randomUUID). Idempotent key. */
  clientUuid: string
  /** ISO timestamp — para ordenar y mostrar "hace Cuánto". */
  createdAt: string
  status: OutboxStatus
  /** Ventas listas para enviar; matchea `saleSchema` del server. */
  payload: PosOutboxPayload
  /** Último error de envío, si status = 'error'. */
  lastError?: string
  /** Código de error DIAN/POS si viene del RPC (KG101/2/3). Vacío si no. */
  errorCode?: string
}

export interface PosOutboxPayload {
  items: Array<{ productId: string; quantity: number }>
  paymentMethod: string
  customerName: string
  discountCents: number
  notes: string
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB no disponible en este entorno.'))
  }
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'clientUuid' })
        store.createIndex('createdAt', 'createdAt', { unique: false })
        store.createIndex('status', 'status', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('No se pudo abrir el outbox.'))
  })
  return dbPromise
}

function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const store = t.objectStore(STORE)
        const req = fn(store)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error ?? new Error('Operación de outbox fallida.'))
      }),
  )
}

/** Soporte de IndexedDB en el usuario (clientes rápidos sin cookies). */
export function offlineQueueAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

/** Encola una venta para enviar cuando haya red. */
export async function enqueuePosSale(
  payload: PosOutboxPayload,
): Promise<PosOutboxEntry> {
  const entry: PosOutboxEntry = {
    clientUuid: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: 'pending',
    payload,
  }
  await tx('readwrite', (store) => store.add(entry))
  return entry
}

/** Lista pendientes ordenadas por createdAt asc (FIFO — el más viejo primero). */
export async function listPendingPosSales(): Promise<PosOutboxEntry[]> {
  const all = (await tx<PosOutboxEntry[]>('readonly', (store) => store.getAll())) ?? []
  return all
    .filter((e) => e.status === 'pending' || e.status === 'error')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** Cuenta pendientes para el badge. */
export async function countPendingPosSales(): Promise<number> {
  const db = await openDb()
  return new Promise<number>((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly')
    const store = t.objectStore(STORE)
    const index = store.index('status')
    const req = index.count('pending')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Quita una venta de la cola (envío exitoso). */
export async function clearPosSale(clientUuid: string): Promise<void> {
  await tx('readwrite', (store) => store.delete(clientUuid))
}

/** Marca una venta con error de envío (se queda en cola para nuevo reintento). */
export async function markPosSaleError(
  clientUuid: string,
  lastError: string,
  errorCode?: string,
): Promise<void> {
  const existing = await tx<PosOutboxEntry | undefined>('readonly', (store) =>
    store.get(clientUuid),
  )
  if (!existing) return
  await tx('readwrite', (store) =>
    store.put({
      ...existing,
      status: 'error',
      lastError,
      errorCode,
    }),
  )
}

/** Vacía toda la cola (úsalo con precaución — elimina las ventas no enviadas). */
export async function clearAllPosOutbox(): Promise<void> {
  await tx('readwrite', (store) => store.clear())
}