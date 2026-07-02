# Kigyo

People Operating System (POS) — an HR platform for modern teams. Employees, signatures, inventory, payroll, tickets, training, risk, recruitment, and an AI assistant, in one dark monochrome UI.

Stack: **Next.js 16** (App Router) · **React 19** · **Tailwind v4** · TypeScript.

## Develop

```bash
npm run dev      # dev server → http://localhost:3000
npm run build    # production build
npm run start    # serve build
npm run lint     # eslint
```

## Structure

```
src/app/            App Router — (auth), (dashboard), marketing pages, api/auth
src/components/      ui/ + layout/ (Sidebar, Topbar)
src/lib/            types, utils, context, data/ (seed data per module)
src/app/globals.css Full design system (see DESIGN.md)
```

- Design system & tokens: `DESIGN.md`
- Agent/contributor rules: `AGENTS.md`, `.claude/CLAUDE.md`
