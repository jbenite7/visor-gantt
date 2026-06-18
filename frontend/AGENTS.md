# FRONTEND — Legacy Vanilla JS/CSS

Mobile-first vanilla JS/CSS frontend. No build step — deploys to shared hosting (cPanel/SiteGround).

## STRUCTURE

```
public/
├── index.php            # Main entry — upload form + project list
├── api.php              # Backend API proxy (JSON endpoints)
├── holidays_api.php     # Holiday CRUD API
├── js/
│   ├── app.js           # 74+ functions — Gantt rendering, table, tooltips
│   └── holidays.js      # Holiday management UI
├── css/
│   └── style.css        # Mobile-first CSS with --aia-* variables
├── favicon.png
├── logo.png
└── .user.ini            # PHP config (upload limits)
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Main app logic | `js/app.js` | Frappe Gantt integration, 74+ functions |
| Holiday UI | `js/holidays.js` | CRUD for holiday management |
| All styles | `css/style.css` | Mobile-first, AIA brand variables |
| API endpoints | `api.php` | JSON-only responses |
| Entry point | `index.php` | Upload form + project list |

## CONVENTIONS

- Mobile First: CSS written for small screens, scale up with `@media (min-width: ...)`
- No build step: vanilla JS (ES6+), no bundler, no transpiler
- AIA brand: Use `--aia-*` CSS variables (from `test_data/manual-de-marca-aia.json`)
- Backend owns all calculation — frontend only renders JSON

## ANTI-PATTERNS

- DO NOT add React/Vue/frameworks — this is vanilla JS for shared hosting
- DO NOT add npm/webpack/vite — no build step by design
- DO NOT put business logic in app.js — backend calculates, frontend renders
