<div align="center">

<img src="public/icon.svg" alt="" width="88" height="88">

# Kigyo

**People Operating System**

Empleados, firmas, inventario, nómina, tickets, riesgos y proyectos
en una sola plataforma, con un asistente de IA que responde sobre tus datos.

<br>

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-087EA4?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20·%20RLS-3FCF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)

</div>

---

## Qué es

Kigyo centraliza la operación de personas de una empresa: contratos que vencen,
firmas pendientes, riesgos abiertos, tickets sin respuesta, inventario asignado.
El dashboard cubre **21 módulos**, y el asistente responde en lenguaje natural
consultando la base de datos en vivo y —opcionalmente— documentos indexados en
Foundry IQ.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 ·
Supabase (Postgres + Auth + Storage) · Microsoft Foundry Models · AI SDK.

## Empezar

La puesta en marcha completa —Supabase, migraciones, Foundry IQ, variables de
entorno— está en **[docs/SETUP.md](docs/SETUP.md)**. Resumen:

```bash
npm install
cp .env.example .env.local     # rellénalo; no subas secretos al repo
npx supabase db push           # aplica las 9 migraciones
npm run dev
```

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run db:verify` | Migraciones y aserciones RLS contra un Postgres local |
| `npm run db:types` | Regenera `src/lib/supabase/types.ts` desde el esquema |
| `npm run db:seed` | Datos de demostración |
| `npm run check:foundry` | Verifica el aislamiento por tenant en Foundry IQ |

## Arquitectura

```
supabase/migrations/   Esquema, RLS, triggers de auditoría y rate limiting
supabase/tests/rls/    Aserciones de aislamiento entre organizaciones
src/app/               App Router — (auth), (dashboard), marketing, api/
src/components/        ui/ + layout/ + marketing/
src/lib/               auth, api, supabase, ai, context, validation, hooks
src/server/            queries/ (lectura RSC) y mutations/ (Server Functions)
scripts/               verificación de base de datos, tipos, seed, Foundry
```

Cada ruta del dashboard es un par: `page.tsx` (servidor: autoriza y carga datos)
y `client.tsx` (isla de interacción).

## Seguridad

Tres capas independientes, ninguna confiada por sí sola:

1. **RLS en Postgres.** Toda tabla de negocio lleva `org_id` y sus políticas se
   construyen sobre `app.orgs_with(permiso)`. La migración 08 retira los
   permisos de `anon` en `public`, así que una tabla sin política falla cerrada,
   no abierta.
2. **Autorización en servidor.** Cada página, Server Function y route handler
   llama a `requireMember()` / `requirePermission()`. `src/proxy.ts` redirige y
   pone las cabeceras de seguridad (CSP con nonce por petición), pero **no es la
   frontera de autorización**.
3. **Interfaz.** `useMember().can()` oculta lo que el servidor rechazaría. Es una
   cortesía, no un control.

El modelo de permisos es uno solo, `módulo:acción`, definido en
`src/lib/auth/permissions.ts` y en `public.permissions`. Un test verifica que
ambos coincidan exactamente.

```bash
npm run db:verify      # aislamiento entre organizaciones
```

## Sistema de diseño

Todo vive en [`src/app/globals.css`](src/app/globals.css) como tokens; no hay
segunda hoja de estilos por tema.

**Temas.** `--ink-rgb` es un canal de tinta: un triple `R G B` sin envolver, de
modo que cada valor translúcido se escribe `rgb(var(--ink-rgb) / a)` y sigue al
tema solo. Cambiar de tema es un cambio de paleta, no un stylesheet paralelo.
La preferencia tiene tres estados (`system` / `light` / `dark`) y un script
síncrono en `<head>` fija el atributo antes del primer pintado, así que no hay
parpadeo. Ambos temas cumplen contraste **WCAG AA**.

**Tipografía.** [Saans](https://befonts.com/saans-font-family.html) como fuente
variable autoalojada. Un solo archivo cubre la familia entera con tres ejes:
`wght` 300–900, `ital` y `MONO` 0–100 — las variantes monoespaciadas salen del
eje `MONO`, no de una segunda descarga. Escala de pesos: 400 cuerpo · 500 · 600
énfasis.

> [!IMPORTANT]
> Saans se incluye bajo licencia **Personal Use Only** (`public/font/saans-font-family/Befonts-License.txt`).
> Para uso comercial hace falta adquirir la licencia correspondiente o sustituir
> la familia.

**Movimiento.** Transiciones de [transitions.dev](https://transitions.dev)
tokenizadas: modales, dropdowns, acordeones, toasts, reveals en scroll. Todo
respeta `prefers-reduced-motion`, y el reveal de la landing es aditivo — sin
JavaScript la página se lee igual.

**Efectos.** `metal-fx` (anillo metálico WebGL en los CTA), `border-beam` (haz
en el compositor de IA mientras responde), `thinking-orbs` (indicador de estado
del asistente) y `cuelume` (sonidos de interfaz, desactivados por defecto, con
interruptor en la barra superior).

## Estado de los módulos

Sobre base de datos real: autenticación, roles y permisos, perfil y empresa,
trazabilidad (audit log escrito por trigger), asistente de IA y exportación.

El resto de pantallas todavía muestran datos de ejemplo en el cliente. El
esquema, las políticas y los tipos ya existen para todas; falta la capa de
consulta por módulo. Detalle completo y patrón a seguir en
[docs/SETUP.md](docs/SETUP.md).

## Documentación

- Puesta en marcha — [docs/SETUP.md](docs/SETUP.md)
- Reglas para agentes y contribuciones — [AGENTS.md](AGENTS.md)
- Tokens de diseño — [`src/app/globals.css`](src/app/globals.css)
