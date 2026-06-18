# V2 — Next.js 16 TypeScript

Next.js App Router rewrite of the Gantt viewer. TypeScript + Tailwind CSS 4 + Supabase/PostgreSQL.

## STRUCTURE

```
src/
├── app/
│   ├── layout.tsx              # Root layout (Geist font, Tailwind)
│   ├── page.tsx                # Home — project list / upload
│   ├── globals.css             # Tailwind imports + CSS vars
│   ├── upload/page.tsx         # Upload .mpp form
│   ├── gantt-demo/page.tsx     # Gantt chart demo page
│   └── actions/upload.ts       # Server Action — parse + store .mpp
├── components/
│   └── gantt/
│       ├── GanttChart.tsx      # Main Gantt React component
│       ├── types.ts            # Gantt task/dependency types
│       └── utils.ts            # Date/position calculation helpers
├── lib/
│   ├── db.ts                   # Supabase client + query helpers
│   ├── parser/
│   │   ├── mpp-parser.ts       # fast-xml-parser → structured data
│   │   └── mpp-parser.test.ts  # Parser unit tests
│   └── scheduling/
│       ├── cpm.ts              # CPM algorithm (TypeScript port)
│       ├── cpm.test.ts         # CPM unit tests
│       ├── calendar.ts         # Working day/holiday logic
│       ├── calendar.test.ts    # Calendar unit tests
│       └── types.ts            # Scheduling domain types
scripts/
├── setup_db.js                 # DB schema initialization
test_data/                      # Test XML fixtures
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Parse .mpp XML | `src/lib/parser/mpp-parser.ts` | Uses `fast-xml-parser` |
| CPM algorithm | `src/lib/scheduling/cpm.ts` | Forward/Backward pass |
| Calendar logic | `src/lib/scheduling/calendar.ts` | Mon-Sat work week |
| DB queries | `src/lib/db.ts` | Supabase + raw `pg` |
| Upload flow | `src/app/actions/upload.ts` | Server Action |
| Gantt rendering | `src/components/gantt/GanttChart.tsx` | React component |

## CONVENTIONS

- `@/*` path alias → `./src/*`
- Server Components by default — `"use client"` only for interactive components
- Tests: Jest + ts-jest, `npm test` from v2/
- Tailwind CSS 4 (PostCSS plugin, no config file)
- Strict TypeScript (`"strict": true` in tsconfig)

## ANTI-PATTERNS

- DO NOT use `any` type — strict mode enforced
- DO NOT mix server/client data fetching — use Server Actions for mutations
- DO NOT import from `../` — use `@/` alias consistently
