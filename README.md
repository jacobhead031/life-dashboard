# Life Dashboard

Personal single-user dashboard: goals, habits, books, learning, budget, health, school, and a projects / to-do "second brain". Next.js 16 (App Router) + React 19 + Supabase, deployed on Vercel from `main`.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npx tsc --noEmit && npm run lint
```

`.env.local` needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Layout

- `app/<tab>/page.tsx` — server component: auth check + Supabase fetch
- `app/<tab>/<Tab>Content.tsx` — client component for that tab
- `app/actions.ts` — every mutation (server actions; they throw on failure)
- `app/globals.css` — all styling, hand-written classes (no Tailwind utilities)
- `components/cards/` — home-page bento cards
- `lib/utils.ts` — date helpers; all "today" logic goes through `todayStr()`
- `supabase/migrations/` — schema, replayable from `000`

Schema reference and project rules live in [CLAUDE.md](CLAUDE.md). The morning email that reads this database lives outside the repo in `~/health-coach`.
