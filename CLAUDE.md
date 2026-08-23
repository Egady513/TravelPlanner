# Road Trip Planner — Claude Agent Context

> ## 👉 READ `AGENTS.md` IN THIS REPO FIRST
> It is the shared contract for **all** AI tools (Claude Code, Codex, ChatGPT).
> It carries Rule 0 (review recent commits before any new work), the commit
> tagging convention, branch rules, the QA gate rule, writing conventions and
> the 513Sips color palette. This file holds Claude-specific notes only and
> defers to `AGENTS.md` on anything shared.

> Vault path, Eddie's identity, and save protocol: `~/.claude/CLAUDE.md` (global — always loaded)
> Vault: `C:\Users\eddie.gady\OneDrive - Centric Consulting\Eddie\Obsidian Brain\`
> Vault MOC for this project: `01-MOC\MOC-Travel-Planner.md`

## Tech Stack
- **Framework:** Next.js 14 App Router (no `src/` dir, `@/` alias maps to root)
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS
- **State:** React Context (`lib/store.tsx`) — `useTrip()` hook
- **Backend:** Supabase (`lib/supabase.ts`), Anthropic SDK (`@anthropic-ai/sdk`)
- **Maps:** Google Maps JS API via `@googlemaps/js-api-loader`
- **DnD:** `@hello-pangea/dnd`

## Key Files
```
app/page.tsx              — main app shell, trip view, modal state
app/api/scout/chat/       — Scout streaming chat API
app/api/scout/tips/       — Scout proactive tips API
components/Map.tsx        — Google Maps component (TripMap)
components/Sidebar.tsx    — day list, Scout tips
components/ScoutPanel.tsx — Scout chat drawer
components/DayDetailPanel.tsx — activity list with DnD
lib/store.tsx             — TripContext, all mutations
lib/supabase.ts           — Supabase helpers
lib/validation.ts         — validateDay / validateTrip
types/index.ts            — all shared types (Trip, Day, Activity, etc.)
docs/plans/               — implementation plans
```

## Commands
```bash
npx tsc --noEmit          # TypeScript check — run after every task
npm run build             # Full production build — run before committing
npm run dev               # Dev server at localhost:3000
npm run lint              # ESLint
```

**No test suite.** Verification = TypeScript check + production build + visual spot-check in dev server.

## Environment Variables (already in .env.local)
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — Google Maps JS API
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase
- `ANTHROPIC_API_KEY` — server-side only, never `NEXT_PUBLIC_`

## Conventions
- All client components need `'use client'` directive
- Scout chat uses `claude-sonnet-4-6`, tips use `claude-haiku-4-5-20251001`
- Google Maps types come from `@types/google.maps` (bundled with `@googlemaps/js-api-loader`)
- `validateTrip()` must be called after any mutation that changes `days` — returns validated days array
- Supabase project ID: `qxtcfbcteuqtofdusbrb`

## Active Sprint
Implementation plan: `docs/plans/2026-02-21-scout-intelligence-implementation.md`

Tasks 1–11. Use `superpowers:executing-plans` skill when starting work.

## Git
- Branch: `master` (main branch is `main`)
- Commit each task independently with ID in message, e.g. `feat(map): ... (V2-D3)`
- Run `npx tsc --noEmit && npm run build` before committing
