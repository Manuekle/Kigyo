<div align="center">

<img src="public/icon.svg" alt="" width="88" height="88">

# Kigyo

**CRM · ERP · POS, multiempresa, para pymes**

Una empresa elige su sector y Kigyo se ajusta a él: enciende los módulos que ese
negocio usa, propone los roles que ese negocio tiene, y deja apagado el resto.

<br>

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-087EA4?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20·%20RLS-3FCF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)

</div>

---

## Qué es

Una suite de gestión donde el catálogo es grande y lo que cada cliente ve es
pequeño. **57 módulos conmutables** (más 2 que son el armazón) cubren personas,
operación, comercial, herramientas de equipo y **11 verticales de industria** —
pacientes, estudiantes, restaurante, agro, inmuebles, hotelería, socios, obra,
suscriptores, puestos y contratación pública.

Nadie los quiere todos. **23 sectores** y **84 subsectores** proponen un punto de
partida (una clínica arranca en Pacientes, una constructora en Obra), **94
conjuntos de roles** por sector traen los oficios de cada industria —«Médico/a»,
«Cajero/a», «Capataz», «Regente de farmacia»— con sus permisos ya puestos, y a
partir de ahí todo es conmutable.

**Colombia primero:** nómina con reglas versionadas y PILA, facturación
electrónica DIAN (ambiente demo), IVA por línea, pagos por Wompi, y el corte del
día en la zona horaria de la empresa y no en UTC.

**Stack:** Next.js 16 (App Router, `src/proxy.ts` en vez de `middleware.ts`) ·
React 19 · TypeScript · Tailwind v4 · Supabase (Postgres + Auth + Storage) ·
Microsoft Foundry Models + AI SDK · Polar (suscripciones) · Wompi (cobros).

## Cómo está organizado un cliente

```
Account        public.accounts        plan, facturación, límites
  └── Empresa  public.organizations   el negocio: sector, módulos, datos  ← org_id
        └── Sede public.sites         sucursal
```

> [!IMPORTANT]
> **`public.organizations` es la EMPRESA, no la cuenta.** Toda tabla de negocio
> lleva `org_id` y esa columna significa *id de empresa*. Es deliberado y no es
> negociable: las reglas están en [AGENTS.md](AGENTS.md) y hay tests que las
> fijan.

Pertenecer al account decide quién paga y quién puede crear empresas. Leer o
escribir datos de una empresa **siempre** exige una fila en `public.memberships`.

## Quién ve qué

Cuatro compuertas, siempre en este orden, en `src/lib/auth/session.ts`:

| # | Pregunta | Dónde vive la respuesta |
| --- | --- | --- |
| 0 | ¿la empresa está al día? | `accounts.access_state` · `organizations.status` |
| 1 | ¿el plan lo incluye? | `accounts.plan` → `src/lib/plans.ts` |
| 2 | ¿la empresa lo encendió? | `organizations.enabled_modules` |
| 3 | ¿esta persona puede abrirlo? | `role_permissions` |

Se comprueban de fuera hacia dentro, así que el rechazo nombra la compuerta que
te detuvo y no una genérica. La misma respuesta la dan `requirePermission()` en
el servidor (544 llamadas), `<RequirePermission>` en cada página, el handler de
API, las políticas RLS y el filtro del sidebar — el menú nunca anuncia una
puerta cerrada.

Los roles son **filas por empresa**, no una enumeración: un dueño inventa
«Residente de obra» y le da los permisos que quiera desde Configuración.

## El registro de módulos es la única fuente

`src/lib/modules/registry.ts` declara los 59 módulos. De ahí se **derivan** el
sidebar, la paleta de comandos, los títulos de página, la tabla de rutas, los
115 permisos `módulo:acción`, los iconos y el SQL de `app.valid_module_keys()`
(`npm run db:module-sql`). Los tests fijan las dos direcciones.

Añadir un módulo es una entrada en ese archivo, una carpeta de ruta, un
`queries/` y un `mutations/`. Nada más hay que tocar a mano.

## Empezar

La puesta en marcha completa —Supabase, migraciones, Foundry, variables de
entorno— está en **[docs/SETUP.md](docs/SETUP.md)**. Resumen:

```bash
npm install
cp .env.example .env.local     # rellénalo; nunca subas secretos al repo
npm run db:push                # aplica las migraciones
npm run dev
```

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest — catálogo, permisos, planes, sectores, guardias |
| `npm run test:e2e` | Playwright. **`workers: 1` es obligatorio**: los specs comparten el usuario demo |
| `npm run db:push` | Aplica migraciones |
| `npm run db:verify` | Migraciones y aserciones RLS contra un Postgres local |
| `npm run db:types` | Regenera `src/lib/supabase/types.ts` desde el esquema |
| `npm run db:module-sql` | Imprime el SQL derivado del registro de módulos |
| `npm run db:seed` | Datos de demostración |
| `npm run db:plan` | Cambia el plan de una cuenta |
| `npm run check:foundry` | Verifica el aislamiento por tenant en Foundry IQ |

## Arquitectura

```
supabase/migrations/   Esquema, RLS, triggers de auditoría, rate limiting
supabase/tests/rls/    Aserciones de aislamiento entre empresas y entre cuentas
src/proxy.ts           Refresco de sesión, redirecciones y cabeceras (CSP con nonce)
src/app/               App Router — (auth), (dashboard), (mostrador), onboarding, api/
                       y el sitio público: /, /soluciones/[sector], /pricing, /faq…
src/components/        ui/ + layout/ + marketing/ + ai/ + extend/ (visores)
src/lib/               modules/ (el registro), auth, plans, sectors, domain, supabase, ai
src/server/            queries/ (lectura RSC) y mutations/ (Server Functions)
e2e/                   Playwright contra la instancia real
scripts/               verificación de base de datos, tipos, seed, Foundry
```

Cada ruta del dashboard es un par: `page.tsx` (servidor: autoriza y carga datos)
y `client.tsx` (isla de interacción). Un test recorre las 62 rutas —y las de
fuera del dashboard, como `/mostrador`— y falla si alguna no pasa por su guardia.

`/mostrador` es el POS a pantalla completa: el mismo cliente y las mismas cuatro
compuertas, sin rail ni topbar, para la tablet de un mostrador. Es un route group
y no un subdominio, y el porqué está escrito en `src/app/(mostrador)/layout.tsx`.

El sitio público tiene una página por sector en `/soluciones/[sector]`, generada
desde `COMPANY_TYPES` y `SUGGESTED_ROLES`: lista los módulos que ese negocio
enciende y los oficios que recibe, así que no puede prometer nada que el producto
no vaya a configurar.

`src/lib/domain.ts` **no es sobre dominios web**: son los vocabularios que los
`check` de la base aceptan (estados de factura, tipos de inmueble…), con un test
que los compara contra las migraciones. El dominio web está en `src/lib/site.ts`.

## Seguridad

Tres capas independientes, ninguna confiada por sí sola:

1. **RLS en Postgres.** 203 tablas, 1.312 políticas. Toda tabla de negocio lleva
   `org_id` y sus políticas se generan con `app.apply_standard_rls` sobre
   `app.orgs_with(permiso)`. La migración 08 retira los permisos de `anon` en
   `public`, así que una tabla sin política falla cerrada. Encima, políticas
   RESTRICTIVE bloquean **toda escritura** de una cuenta impaga
   (`app.company_is_active`), así que el muro de pago no depende de TypeScript.
2. **Autorización en servidor.** Cada página, Server Function y route handler
   llama a `requireMember()` / `requirePermission()`. `src/proxy.ts` redirige y
   pone las cabeceras, pero **no es la frontera de autorización** — el matching
   de proxy ha sido evitable en releases de Next.
3. **Interfaz.** `useMember().can()` oculta lo que el servidor rechazaría. Es una
   cortesía, no un control.

```bash
npm run db:verify      # aislamiento entre empresas y entre cuentas
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

**Tipografía.** Tres caras variables autoalojadas, cada una con un trabajo:
[Saans](https://befonts.com/saans-font-family.html) solo para los títulos
grandes, [Inter](https://rsms.me/inter/) para todo lo que se lee y para las
cifras tabulares, y [Caveat](https://fonts.google.com/specimen/Caveat) para las
firmas. Saans cae a Inter y no a la fuente del sistema, así que un fallo de
descarga no cambia la métrica de la página.

> [!IMPORTANT]
> Saans se incluye bajo licencia **Personal Use Only**
> (`public/fonts/saans/LICENSE.txt`). Para uso comercial hace falta adquirir la
> licencia o sustituir la familia.

**Movimiento.** Transiciones de [transitions.dev](https://transitions.dev)
tokenizadas: modales, dropdowns, acordeones, toasts, reveals en scroll. Todo
respeta `prefers-reduced-motion`, y el reveal de la landing es aditivo — sin
JavaScript la página se lee igual.

**Efectos.** `metal-fx` (anillo metálico WebGL en los CTA), `border-beam` (haz
en el compositor de IA mientras responde), `thinking-orbs` (indicador de estado
del asistente) y `cuelume` (sonidos de interfaz, desactivados por defecto, con
interruptor en la barra superior).

## Estado

Sobre base de datos real, sin datos de ejemplo en pantalla: los 57 módulos, el
onboarding por sector, el muro de pago, el POS con cola offline en IndexedDB, la
nómina con cierre inmutable, el RAG documental y el asistente.

Pendiente de proveedor externo, no de código: DIAN en producción (proveedor
homologado + certificado), Wompi en vivo, entrega real de correo/WhatsApp para
Marketing y Notificaciones, y la validación de un contador laboral para nómina.

## Documentación

| Archivo | Para qué |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Reglas vinculantes: `org_id`, RLS congelado, cómo se añade un módulo |
| [docs/SETUP.md](docs/SETUP.md) | Puesta en marcha de cero |
| [docs/ARQUITECTURA_ACTUAL.md](docs/ARQUITECTURA_ACTUAL.md) | Mapa técnico: tablas, módulos, flujos |
| [docs/CONTEXTO_SESION.md](docs/CONTEXTO_SESION.md) | Bitácora: qué se hizo, qué falla, qué queda |
| [docs/AUDITORIA_ARQUITECTURA_KIGYO.md](docs/AUDITORIA_ARQUITECTURA_KIGYO.md) | Histórico congelado — por qué `org_id` es la empresa. Citado desde código |
| [docs/FASE_0_CONTRATOS.md](docs/FASE_0_CONTRATOS.md) | Histórico congelado — contratos multiempresa. Citado desde migraciones y tests |
