-- ═══════════════════════════════════════════════════════════════════════════
-- 111 — La empresa no sabía dónde queda, y la factura sí lo pregunta.
--
-- `organizations` guarda nombre, razón social, NIT, país, moneda y zona
-- horaria desde la migración 30, y ni ciudad ni dirección. Dos consecuencias,
-- las dos escritas hoy en el código como marcadores:
--
--   · `src/server/mutations/dian.ts` manda `organizationCity: '—'` y
--     `organizationAddress: '—'` al UBL. Antes mandaba `org.country` como
--     ciudad, así que el `<cbc:CityName>` del XML salía con un código de país;
--     se cambió al marcador para no rellenar un campo con otro dato, y quedó
--     anotado que producción exige estas dos columnas.
--   · Cualquier documento que se imprima —factura, cotización, recibo— habla
--     de una empresa sin domicilio.
--
-- Nullable las dos, y a propósito: pedirlas obligatorias rompería el alta de
-- toda empresa existente y convertiría el primer paso del asistente en un
-- formulario fiscal. «Todavía no lo dijeron» y «lo dijeron en blanco» siguen
-- siendo hechos distintos — el mismo motivo por el que `updateCompanyProfile`
-- guarda null y no cadena vacía.
--
-- No se añade departamento ni código DANE. La DIAN los pedirá en producción y
-- salen de un catálogo oficial que este repositorio no tiene; inventarlos sería
-- exactamente lo que `AGENTS.md` prohíbe para las cifras regulatorias. Cuando
-- llegue el proveedor homologado, esa tabla llega con él.
--
-- Sin RLS nueva: son columnas de una tabla que ya está gobernada, y la
-- migración 99 pone su guardia de escritura sobre la fila, no sobre la columna.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.organizations
  add column if not exists city text,
  add column if not exists address text;

alter table public.organizations
  drop constraint if exists organizations_city_len,
  add constraint organizations_city_len check (city is null or char_length(city) between 1 and 80);

alter table public.organizations
  drop constraint if exists organizations_address_len,
  add constraint organizations_address_len check (address is null or char_length(address) between 1 and 200);

comment on column public.organizations.city is
  'Ciudad del domicilio de la empresa. Sale en los documentos y es el <cbc:CityName> del UBL de la DIAN.';
comment on column public.organizations.address is
  'Dirección del domicilio de la empresa. Es el <cbc:AddressLine> del UBL de la DIAN.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback
--
--   alter table public.organizations drop constraint organizations_city_len;
--   alter table public.organizations drop constraint organizations_address_len;
--   alter table public.organizations drop column city, drop column address;
-- ═══════════════════════════════════════════════════════════════════════════
