# Kigyo — Design System

People Operating System (POS) for modern HR teams. Aesthetic: **"Chinese Ink"** — monochrome, dark, high-contrast. No chromatic brand color; hierarchy comes from white-on-black opacity steps, weight, and spacing.

Source of truth: `src/app/globals.css` (`:root`). Never hardcode — always `var(--token)`.

---

## Color — monochrome (dark)

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#161616` | Page background |
| `--bg2` / `--panel` | `#1A1A1A` | Cards, inputs |
| `--elevated` | `#202020` | Raised surfaces |
| `--hover` | `#252525` | Hover bg |
| `--active` | `#2A2A2A` | Active/pressed bg |
| `--line` | `rgba(255,255,255,.06)` | Borders |
| `--line2` | `rgba(255,255,255,.04)` | Subtle dividers |
| `--ink` | `#FFFFFF` | Primary text |
| `--ink2` | `rgba(255,255,255,.72)` | Secondary text |
| `--ink3` | `rgba(255,255,255,.45)` | Muted / placeholders |

**Semantic tones are also monochrome** (`--grn/--amb/--red/--blu/--vio` + `s`/`d` variants) — all resolve to white at varying opacity, not real colors. Status differentiation relies on label + position, not hue. Legacy `--accent`, `--*-bg` aliases exist for compat.

---

## Typography

| Font | Variable / family | Usage |
|---|---|---|
| Candid | `'Candid'` (self-hosted `.otf`, `public/font/`) | All UI text — 400 + 700 italic |
| Geist Mono | `--font-geist-mono` (`next/font/google`) | `.mono` — IDs, serials, numeric data |

Base: `.nrh, .nrh *` → Candid 400, `letter-spacing: -.01em`.

---

## Radius

`--r-sm:8` · `--r:12` · `--r-lg:16` · `--r-xl:20` · `--r-2xl:24` · `--rfull:999` (pills/buttons/inputs).

## Elevation

`--e1` (1px) → `--e2` (card) → `--e3` (hover) → `--e4` (modals/drawers). `--eabraham` = ultra-soft stacked. Shadows are near-invisible by design (dark theme).

## Spacing

`--sp-4 … --sp-48` scale. Content padding `28px 32px` (mobile `16px 14px`).

---

## Layout

```
body.nrh (100vh flex row)
  ├── .sb (sidebar, 272px)
  └── .main (flex:1, col, overflow hidden)
        ├── .top (topbar, 56px)
        └── .content (flex:1, scrollable, padding 28px 32px)
```

Sidebar → fixed overlay at `≤760px` (`.open` toggle). Full-height pages (AI chat) add `.content-chat` to strip `.content` padding/scroll so their own composer pins to the bottom.

---

## Key components

- **Buttons** `.btn` — pill, `.btn.pri` = white-filled dark-text primary, `.btn.dark`. Form submit buttons match input height (`36px`, `13.5px`).
- **Inputs** `.field` / `.premium-input` — `36px`, `--rfull`, `--bg2`, `13.5px`.
- **Cards** `.card` — `--bg2`, `--e2`, lifts to `--e3` on hover.
- **KPI/Stat** `.kpi` / `.stat` — big value + delta badge.
- **Badges** `.badge` — pill, outline default, `.filled-{tone}`.
- **Tables** `.tbl` — uppercase mono headers, row hover.
- **Kanban** `.board` / `.col` / `.tkcard`.
- **AI page** `.ia-page` — full-height flex column, `.ia-msgs` scroll region, pinned `.ia-composer`; welcome uses MetaBalls orb + suggestion chips.
- **Drawers / Modals / Toasts** `.drawer` / `.modal` / `.toast` — slide/pop animations, mobile bottom-sheet.

---

## Status → tone

`tone()` in `src/lib/utils.ts` is the source of truth (Activo/Completado → grn, Pendiente/En proceso → amb, Expirado/Rechazado → red, Inactivo → neu, etc.). Tones render monochrome.

## JS helpers (`src/lib/utils.ts`)

`initials()` · `tone()` · `prioTone()` · `cop()` (COP currency) · `clsx` · `exportExcel`.

---

## Animations

Custom keyframes in `globals.css`: `shiny-text`, `blink-cursor`, `iaIn` (chat bubbles), `shimmer`, dropdown/modal/panel open-close (driven by `--*-dur` / `--*-ease` tokens). All respect `prefers-reduced-motion`.

---

## Routes

```
src/app/
  layout.tsx              ← root (Geist Mono, body.nrh, metadata)
  page.tsx                ← landing
  about about/ contact/ faq/ pricing/ privacy/ terms/   ← marketing
  robots.ts sitemap.ts error.tsx not-found.tsx
  (auth)/                 ← login · register · forgot-password
  api/auth/               ← login · register · forgot-password · verify-otp · reset-password
  (dashboard)/
    layout.tsx            ← Sidebar + Topbar + AppProvider
    dashboard/
      page.tsx  ia/  empleados/  firmas/  inventario/  documentos/
      consultoria/  tickets/  calendario/  asistencia/  nomina/
      riesgos/  trazabilidad/  configuracion/  canales/  catalogos/
      compras/  cotizaciones/  hseq/  ordenes-compra/  proyectos/  tienda/
```

Stack: Next.js 16 (App Router) · React 19 · Tailwind v4 (`@import "tailwindcss"`) · icons from `@hugeicons/react` + `lucide-react`.
