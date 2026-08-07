# Kigyo

People Operating System — plataforma de personas y operaciones: empleados,
firmas, inventario, nómina, tickets, riesgos, proyectos y un asistente de IA,
en una interfaz oscura monocroma.

Stack: **Next.js 16** (App Router) · **React 19** · **Tailwind v4** ·
**Supabase** (Postgres + Auth + Storage) · **Microsoft Foundry**
(Foundry IQ + Azure OpenAI) · TypeScript.

## Empezar

La puesta en marcha completa —Supabase, migraciones, Foundry IQ, variables de
entorno— está en **[docs/SETUP.md](docs/SETUP.md)**. Resumen:

```bash
npm install
cp .env.example .env.local     # rellénalo; no subas secretos al repo
npx supabase db push           # aplica las 8 migraciones
npm run dev
```

## Comandos

```bash
npm run dev            # servidor de desarrollo
npm run build          # build de producción
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm test               # vitest
npm run db:verify      # migraciones + aserciones RLS contra un Postgres local
npm run db:types       # regenera src/lib/supabase/types.ts desde el esquema
npm run db:seed        # datos de demostración
npm run check:foundry  # verifica el aislamiento por tenant en Foundry IQ
```

## Estructura

```
supabase/migrations/   Esquema, RLS, triggers de auditoría y rate limiting
supabase/tests/rls/    Aserciones de aislamiento entre organizaciones
src/app/               App Router — (auth), (dashboard), marketing, api/
src/components/        ui/ + layout/
src/lib/               auth, api, supabase, ai, validation, hooks
src/server/            queries/ (lectura RSC) y mutations/ (Server Functions)
scripts/               verificación de base de datos, tipos, seed, Foundry
```

Cada ruta del dashboard es un par: `page.tsx` (servidor: autoriza y carga
datos) y `client.tsx` (isla de interacción).

## Seguridad

Tres capas independientes, ninguna confiada por sí sola:

1. **RLS en Postgres.** Toda tabla de negocio lleva `org_id` y sus políticas se
   construyen sobre `app.orgs_with(permiso)`. La migración 08 retira los
   permisos de `anon` en `public`, así que una tabla sin política falla
   cerrada, no abierta.
2. **Autorización en servidor.** Cada página, Server Function y route handler
   llama a `requireMember()` / `requirePermission()`. `src/proxy.ts` redirige y
   pone las cabeceras de seguridad, pero **no es la frontera de autorización**.
3. **Interfaz.** `useMember().can()` oculta lo que el servidor rechazaría. Es
   una cortesía, no un control.

El modelo de permisos es uno solo, `módulo:acción`, definido en
`src/lib/auth/permissions.ts` y en `public.permissions`. Un test verifica que
ambos coincidan exactamente.

Verificación de aislamiento:

```bash
npm run db:verify
```

## Estado de los módulos

Sobre base de datos real: autenticación, roles y permisos, perfil y empresa,
trazabilidad (audit log escrito por trigger), asistente de IA y exportación.

El resto de pantallas todavía muestran datos de ejemplo en el cliente. El
esquema, las políticas y los tipos ya existen para todas; falta la capa de
consulta por módulo. Detalle completo y patrón a seguir en
[docs/SETUP.md](docs/SETUP.md).

## Documentación

- Puesta en marcha: [docs/SETUP.md](docs/SETUP.md)
- Sistema de diseño y tokens: `src/app/globals.css`
- Reglas para agentes y contribuciones: `AGENTS.md`
