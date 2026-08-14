-- ═══════════════════════════════════════════════════════════════════════════
-- 44 — Las comandas por fin llegan al arqueo
--
-- La migración 25 creó `restaurant_orders.cash_session_id` con este comentario:
--
--     'The till session this order was paid into. Set when the order is paid;
--      what expected_cents is summed from.'
--
-- Nada lo escribía nunca. `setComandaStatus` marca la comanda como «Pagada» y
-- deja la columna nula, así que el cierre de caja del restaurante —- que suma
-- exactamente esa columna—- daba cero todas las noches. La funcionalidad
-- existía en el esquema, en el comentario y en la consulta del cierre; lo único
-- que faltaba era la línea que las une, y por eso nadie lo notó: no falla, solo
-- responde cero.
--
-- Esta migración aporta la mitad que es esquema. La otra mitad, escribir la
-- columna al cobrar, va en `src/server/mutations/restaurante.ts`.
--
-- ─── Y el medio de pago, que tampoco existía ───────────────────────────────
--
-- Sin él, toda comanda pagada cuenta como efectivo. Para un restaurante que
-- acepta tarjeta —- todos—- eso significa que el arqueo reporta un faltante
-- igual a lo cobrado con datáfono, cada noche, y que la única salida es dejar
-- de usar la caja. Es el mismo error que `pos_sales` evita desde el primer día
-- teniendo `payment_method`, y no hay razón para que la comanda sea distinta.
--
-- El default es 'Efectivo' y las filas que ya existen lo reciben, que es
-- exactamente lo que el código de hoy asume. Ninguna cifra histórica cambia.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.restaurant_orders
  add column if not exists payment_method text not null default 'Efectivo'
    check (payment_method in ('Transferencia', 'Efectivo', 'Tarjeta', 'Cheque', 'Otro'));

comment on column public.restaurant_orders.payment_method is
  'Con qué se pagó la comanda. Solo «Efectivo» llega al cajón y cuenta para el arqueo; '
  'lo demás se cobró y no está ahí. Espejo de PAYMENT_METHODS en src/lib/domain.ts.';

-- El índice que el arqueo consulta: las comandas en efectivo de un turno.
-- Parcial, porque preguntar por las de un turno solo tiene sentido cuando hay
-- turno, y la enorme mayoría de las filas históricas no lo tienen.
create index if not exists restaurant_orders_session_cash_idx
  on public.restaurant_orders (cash_session_id, status)
  where cash_session_id is not null;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   drop index if exists restaurant_orders_session_cash_idx;
--   alter table public.restaurant_orders drop column if exists payment_method;
-- ═══════════════════════════════════════════════════════════════════════════
