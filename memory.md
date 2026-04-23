# Project Memory — EBS Project Tracker

> **Read this file first in any new session.** Contains everything needed to get full context on this project without re-exploring. Keep it updated whenever architecture, decisions, or state change.

---

## 1. What this project is

A single GitHub repo hosting **two separate applications** that share one Supabase backend:

| App | Purpose | Stack | Path |
|-----|---------|-------|------|
| **EBS Project Tracker** | Portfolio dashboard — projects, milestones, risks, Gantt, MBR report export | React 18 + Vite + Tailwind | `/` (root) |
| **EBS Tracker** | Personal work-time tracker — log tasks, categories, hours, admin panel | Vanilla HTML/CSS/JS (no build) | `/ebs-tracker/` |

Both apps are used internally at EBS (Kuwait). Admins can create/edit projects and manage users; regular users can view projects and log their own tasks.

---

## 2. Local setup

- **Working directory:** `c:\Users\jeswin\Desktop\MY websites\xyz`
- **Git user:** `utcebs` / `jeswinjerin@gmail.com`
- **GitHub remote:** `https://github.com/utcebs/EBS-.git` (note: repo name is `EBS-` with a trailing dash)
- **Auth:** Personal Access Token stored in Windows Credential Manager — git push/pull works without prompts
- **Node commands:** `npm run dev` (Vite dev server), `npm run build` (production build to `dist/`)

---

## 3. Live URLs

- **React app (main):** `https://utcebs.github.io/EBS-/`
- **EBS Tracker:** `https://utcebs.github.io/EBS-/ebs-tracker/`
- **GitHub repo:** `https://github.com/utcebs/EBS-`
- **Supabase project:** `https://hddfkkojfvmjuxsyhcgh.supabase.co` (project ref: `hddfkkojfvmjuxsyhcgh`)

> ⚠️ The repo slug has a trailing dash. `https://utcebs.github.io/EBS/` (no dash) is a different/broken path — always use `EBS-`.

---

## 4. File structure

```
/
├── .github/workflows/deploy.yml    GitHub Actions: build React app, copy ebs-tracker, deploy to gh-pages
├── index.html                      React app entry (Vite processes this)
├── vite.config.js                  base: './' + outDir: 'dist'
├── package.json                    Deps: react, react-router-dom, supabase-js, recharts, pptxgenjs, xlsx, tailwind
├── src/
│   ├── main.jsx                    HashRouter + React.StrictMode
│   ├── supabaseClient.js           ⚠️ Exports TWO clients (see §7)
│   ├── App.jsx                     Main React app file — all components, routes, providers
│   ├── components/
│   │   ├── LandingPage.jsx         Landing page at `/` (hero, description, achievements, vision, team tree, footer)
│   │   ├── ParticleNetwork.jsx     R3F / three.js network-of-particles animation in the landing hero
│   │   └── Editable.jsx            Inline admin edit primitives (EditableText, EditableImage)
│   └── index.css                   Tailwind entrypoint
├── public/
│   ├── sw.js                       Self-destruct service worker (wipes caches, unregisters itself)
│   ├── 404.html                    GitHub Pages SPA redirect
│   └── ebs-logo.png, icons, etc.
├── ebs-tracker/                    Vanilla JS app — gets copied into dist/ebs-tracker by the workflow
│   ├── index.html                  Login screen
│   ├── dashboard.html, tasks.html, log.html, performance.html, admin.html
│   ├── sw.js                       Service worker — scoped to /ebs-tracker/ only, GET+same-origin only
│   ├── js/config.js                Hardcoded Supabase URL/key, holidays, levels, badges, subcategories
│   ├── js/auth.js                  Login, session sync (reads Supabase Auth from localStorage)
│   └── js/utils.js                 Date helpers, Kuwait working days, Ramadan hours, etc.
├── COMBINED_SETUP.sql              Full Supabase schema — all tables, RLS, policies, grants
├── supabase_schema.sql             React-app-only subset (projects/milestones/risks + RLS)
├── seed_data.sql                   Sample project data
└── memory.md                       This file
```

All React code lives in [src/App.jsx](src/App.jsx) — one big file. Components are defined top-to-bottom:
`AuthProvider` → `ProjectsProvider` → utility components → `Layout` → `Dashboard` → `ProjectTracker` → `ProjectFormModal` → `ProjectDetail` → `MilestoneFormModal` → `RiskFormModal` → `GanttChartPage` → `LoginPage` → `AdminUsersPage` → `App` (default export).

---

## 5. Routes (HashRouter)

| Path | Component | Purpose |
|------|-----------|---------|
| `#/` | `LandingPage` | Public department landing — hero, description, achievements, vision, team tree, footer. Admin inline-edits all text and team photos. |
| `#/dashboard` | `Dashboard` | Portfolio overview — charts, summary cards, drill-down (was at `/` before 2026-04-23) |
| `#/projects` | `ProjectTracker` | Projects list, search, filter, bulk upload, new/edit/delete, **Export All → Excel** |
| `#/projects/:id` | `ProjectDetail` | Project header, milestones tab (w/ bulk upload), risks tab (w/ bulk upload), project dashboard with **Hours by Employee** chart |
| `#/gantt` | `GanttChartPage` | Timeline chart across all projects |
| `#/login` | `LoginPage` | Admin email/password login |
| `#/admin/users` | `AdminUsersPage` | Admin — create users, reset passwords |
| `#/admin/team` | `AdminTeamPage` | Admin — pick which profiles appear on landing page, set lead + display order |

Guests see everything read-only. Admins (`profile.role === 'admin'`) see edit/create/delete buttons.

---

## 6. Deployment — GitHub Pages via Actions

`.github/workflows/deploy.yml` runs on every push to `main`:

1. `npm ci` + `npm run build` → produces `dist/`
2. `cp -r ebs-tracker dist/ebs-tracker`
3. `peaceiris/actions-gh-pages@v4` pushes `dist/` to the `gh-pages` branch
4. GitHub Pages is set to serve `gh-pages` / root

**Important:** `dist/` is gitignored. The `main` branch has source; `gh-pages` has built output. Never commit to `gh-pages` manually.

---

## 7. Supabase

**Project:** `hddfkkojfvmjuxsyhcgh.supabase.co`
**Anon key:** hardcoded in `src/supabaseClient.js` and `ebs-tracker/js/config.js` (safe — it's public by design).

### Two clients (critical pattern)

[src/supabaseClient.js](src/supabaseClient.js) exports **two** Supabase clients:

- `supabase` — the normal auth-enabled client. Used for login, session, admin writes (insert/update/delete).
- `supabasePublic` — separate client with `persistSession: false`, `autoRefreshToken: false`, isolated `storageKey: 'sb-public-readonly'`. Used for ALL public reads (projects/milestones/risks).

**Why:** When a user logs into EBS Tracker, their Supabase session lands in `localStorage`. The React app's shared client would then try to use that session for reads — and the first read after navigating back would silently hang (no network request, no error). Using a separate non-persistent client for reads dodges this deadlock entirely.

**Rule:** Reads → `supabasePublic`. Writes and auth → `supabase`.

### Tables

- `projects` — `id, project_number, project_name, status, priority, phase, percent_complete, start_date, end_date, dept_module, business_owner, total_cost_kwd, key_risks, dependencies, mitigation, notes_updates, actions_needed, proj_unique_id, ...`
- `milestones` — tied to `project_id`, has `development_status` + `uat_status`
- `risks` — tied to `project_id`, has `impact` + `likelihood`
- `profiles` — one row per auth user, with `role` (`user` or `admin`). **Extended (2026-04-23)**: `avatar_url`, `job_title`, `bio`, `display_order`, `show_on_landing`, `is_team_lead` — used by the landing page team section.
- `task_logs` — has `linked_project_id` (TEXT FK → `projects.proj_unique_id`) used by the per-project Hours-by-Employee chart.
- `priority_tasks` — `status` constraint extended to include `on_hold`. New columns `hold_reason`, `hold_set_at`, `hold_set_by` power the on-hold flow on the tasks board.
- `landing_page_content` — **new singleton table** with `hero_title`, `hero_subtitle`, `description`, `achievements` (JSONB), `vision`, `footer_text`. Public read, authenticated write.
- `support_subcategories`, `testing_subcategories`, `project_subcategories`, `employee_leaves`, `war_day_ranges`, `app_settings` — EBS Tracker config tables.

### Storage buckets

- `team-photos` — created in the Supabase Dashboard. Public read; authenticated write. Used for `profiles.avatar_url` uploads from the landing team section (EditableImage).

### RLS

- `projects`, `milestones`, `risks` have RLS **enabled** with:
  - `SELECT USING (true)` — anyone (anon + authenticated) can read
  - `INSERT/UPDATE/DELETE WITH CHECK (auth.role() = 'authenticated')` — only logged-in admins can write
- `profiles`, `task_logs`, everything else — RLS **disabled**

### Auth

- Shared Supabase Auth — one login works for both apps
- React app: `supabase.auth.signInWithPassword` → session in localStorage → EBS Tracker reads same session on load via `syncSessionFromSupabase()` in `ebs-tracker/js/auth.js`
- `profiles.role` determines admin vs user

---

## 8. Service Workers — history and current state

Three things to know:

1. **React app (`public/sw.js`)** — self-destruct. Deletes all caches on activate, then unregisters itself, then force-reloads all clients. No fetch interception. Never re-registered.
2. **EBS Tracker (`ebs-tracker/sw.js`)** — active, scoped to `/ebs-tracker/` only. Network-first with cache fallback. **Skips non-GET and cross-origin requests** (fix from April 2026: was previously trying to `cache.put` POST requests which crashed with "Request method 'POST' is unsupported" — and in some cases leaked into blocking Supabase calls from the React app).
3. **`main.jsx` and `index.html`** both run `getRegistrations().then(regs => regs.forEach(r => r.unregister()))` on every load as belt-and-suspenders cleanup.

Cache key is versioned (`ebs-tracker-v5`). Bump the version when changing SW behavior to force eviction.

---

## 9. Known-issue history (debugging breadcrumbs)

### Fixed — April 2026
- **Service worker caching POST requests** → `sw.js:22` crash. Fixed by skipping non-GET and cross-origin in `ebs-tracker/sw.js`.
- **GitHub Secrets overriding hardcoded Supabase credentials** → silent wrong-project connection. Fixed by removing `import.meta.env` pattern and hardcoding directly in `src/supabaseClient.js`.
- **`ProjectDetail.fetchAll` had zero error handling** → silent failures. Wrapped in try/catch; added `fetchError` state + retry button.
- **Form fields missing `id`/`name`/`autoComplete`** → browser autofill warning. Added to all inputs on `LoginPage` and `AdminUsersPage`.
- **Cross-app auth deadlock** → after logging into EBS Tracker then returning to React app, the first Supabase read hung with no network request. Fixed by introducing the `supabasePublic` second client (see §7).
- **Login stuck on "Signing in…" after 200 auth response** → `signInWithPassword` returned 200 but UI never transitioned. Cause: Supabase JS v2 fires `onAuthStateChange` callbacks _while still holding the internal GoTrue lock_. The callback did `await fetchProfile()` which called `supabase.from('profiles')...` — that query then tried to acquire the same lock → self-deadlock. Fixed by (a) using `supabasePublic` inside `fetchProfile`, and (b) making both `onAuthStateChange` and `getSession().then()` callbacks synchronous — fire-and-forget the profile fetch instead of awaiting it.

### Fixed — 2026-04-23 (post-deploy)
- **`/admin/team` white-screen on click** → `ReferenceError: User is not defined`. `AdminTeamPage` used the lucide `User` icon but only `Users` + `UserCog` were imported. Lesson: Vite/ESBuild doesn't error on missing named imports from side-effect-free barrel files — the reference survives to runtime. When adding a new lucide icon to a component, double-check it's in the top-of-file import list.
- **Wrong Supabase project** for SQL migration → ran on `alqvknnpgcrupxtomcdv` instead of `hddfkkojfvmjuxsyhcgh`. All DDL succeeded silently but the REST API (pointed at the real project) returned 404/400. Diagnosis: look at the project ref in the Supabase dashboard URL (`/dashboard/project/<ref>/...`) BEFORE running any migration. Always verify by updating a unique marker value then curling the REST API.

### New (2026-04-23) — Department portal + tracker updates
- **New LandingPage at `/`**; Dashboard moved to `/dashboard`. Sidebar nav gained "Home" (landing) + "Landing Team" admin link.
- **3D hero**: `@react-three/fiber@8` (React 18 compat) + particle-network animation in `ParticleNetwork.jsx` — lazy-loaded via `React.lazy` so the main bundle stays smaller. Falls back to static SVG when `prefers-reduced-motion` is set.
- **Inline admin edit** on landing — `EditableText` + `EditableImage` primitives. Writes go through the auth-enabled `supabase` client. Photos upload to Supabase Storage bucket `team-photos`.
- **Dashboard chart** — "Projects by Department" replaced with "Projects by Owner" (uses existing `projects.business_owner` text column; no migration needed). Drill-down preserved.
- **Per-project bulk upload** for milestones + risks, using the same template/parse pattern as projects. Helpers: `downloadMilestoneTemplate`, `parseMilestoneBulk`, `downloadRiskTemplate`, `parseRiskBulk`, `handleMilestoneBulk`, `handleRiskBulk`.
- **Export all → Excel** — `exportAllToExcel(projects)` fetches milestones + risks in parallel (`supabasePublic`), writes 4-sheet workbook (Projects / Milestones / Risks / Gantt-data), filename `EBS_Projects_Export_YYYYMMDD.xlsx`.
- **Employee-hours visual** on ProjectDetail dashboard: horizontal bar chart of `SUM(hours_spent)` per `team_member` from `task_logs` where `linked_project_id = project.proj_unique_id`. Clicking a bar opens drill-down modal of individual log entries.
- **EBS Tracker login-flash** — `ebs-tracker/index.html` now renders a full-page spinner overlay (`.auth-check`) by default; `syncSessionFromSupabase()` either redirects (session found) or reveals the login form. No more visible login flash when arriving from the React app.
- **tasks.html "Move to Log" modal** — ported project picker from `log.html` (`ensureLogModalProjects`). Month + week now auto-update from the date via `recalcLogModalWeek` listener. `task_logs.linked_project_id` is written on insert.
- **On-hold for priority_tasks** — `tasks.html` gained a 🚧 Hold button per card + a hold-reason modal. `loadTasks` now fetches `pending` + `on_hold`. Reason visible to everyone (board + admin view). Admins also see `done`/`logged` via status chips.
- **Status filter chips** for admin on tasks.html — row of clickable chips (Active / Pending / On Hold / Done / Logged / All) with live counts; filter applied in `getVisibleTasks`.
- **Accomplishment Rate KPI removed** from `performance.html` and `admin.html` (calc still in `utils.js` for back-compat — harmless).
- **XP + Badges rebalanced** in `ebs-tracker/js/config.js` — 10 levels up to 4,200+ h; badges recalibrated (Century → 5K, Week Warrior → Year Veteran, etc.). CSS for `lvl-7` through `lvl-10` added to `ebs-tracker/css/style.css`.

### Pattern
All these silent-failure bugs were "no console error, no data." Lesson: when a Supabase query returns nothing, always check whether the Network tab shows the request at all. If it doesn't, it's a client-side auth/SW/caching issue, not a data issue.

**Rule for Supabase auth callbacks:** Never `await` a Supabase call inside an `onAuthStateChange` listener or the `.then()` of `getSession()`. The GoTrue lock is still held. Always use `supabasePublic` there, and always fire-and-forget.

---

## 10. Testing checklist (regression guard)

After any change touching auth, Supabase clients, or service workers, verify in an **incognito window**:

1. ✅ Open `https://utcebs.github.io/EBS-/` fresh — Landing page loads (hero animation, description, achievements, vision, team tree, footer).
2. ✅ Click **View our Projects** → `/#/projects` loads with full list.
3. ✅ `/#/dashboard` shows Portfolio charts. "Projects by Owner" chart populated; clicking a bar drills down.
4. ✅ Click a project → detail page loads milestones + risks + Employee-hours chart.
5. ✅ Admin: Export All → Excel downloads a 4-sheet workbook with data populated.
6. ✅ Admin: in a project, Milestones tab shows Template + Bulk Upload buttons; template downloads; sample upload inserts rows.
7. ✅ Same check on Risks tab.
8. ✅ Admin: `/#/admin/team` lets you toggle `show_on_landing`, set display order + team lead; inline edit on landing saves names/titles/bios/photos.
9. ✅ Navigate to `/ebs-tracker/` — if already logged in, spinner then redirect (no login flash); else login form.
10. ✅ Log in as admin (from tracker) → redirected to EBS Tracker dashboard.
11. ✅ Back at `/` → data still loads (cross-app session doesn't deadlock).
12. ✅ `tasks.html` "Move to Log" modal has project dropdown + month/week auto-update on date change.
13. ✅ `tasks.html` card: 🚧 Hold button prompts reason; saved on-hold tasks show amber pill + reason inline.
14. ✅ Admin sees status chips (Active / Pending / On Hold / Done / Logged / All) with live counts; clicking filters the board.
15. ✅ `performance.html` no longer shows "Accomplishment Rate" KPI.
16. ✅ User with 1,500 h shows as "Expert" (L5) — new 10-level system live.
17. ✅ Console: zero red errors; Network: GET `/rest/v1/projects`, `/rest/v1/landing_page_content`, `/rest/v1/profiles` all return 200.

---

## 11. When adding new features

- **New public read query:** use `supabasePublic` (not `supabase`)
- **New write / auth-gated operation:** use `supabase`
- **New route:** add to the `<Routes>` block in `Layout` (in `App.jsx`)
- **New Supabase table:** update both `supabase_schema.sql` and `COMBINED_SETUP.sql`; add RLS policies if it needs admin-only writes; run the SQL in the Supabase SQL editor
- **New form input:** always give it `id`, `name`, `autoComplete`

---

## 12. Quick commands

```bash
# Make changes, then:
git add <files>
git commit -m "msg"
git push
# GitHub Actions auto-builds & deploys. Watch: github.com/utcebs/EBS-/actions
```

```bash
# Local dev:
npm run dev        # Vite dev server at localhost:5173

# Test production build locally:
npm run build && npm run preview
```

---

_Last updated: 2026-04-23 — department portal release: new landing page at `/` (Dashboard moved to `/dashboard`), 3D particle-network hero, inline admin edit, Excel export-all, per-project milestone/risk bulk upload, Employee-hours chart on project detail, EBS Tracker login-flash fix, task on-hold flow, admin status chips, 10-level XP rebalance. New Supabase table `landing_page_content`; profiles + priority_tasks extended; Storage bucket `team-photos` created._

---

## 13. Post-launch iterations log (2026-04-23, after portal release)

Everything below happened in one continuous working session. Captured here so future sessions don't re-explore the same ground.

### Supabase project confusion (solved)
- User initially ran the landing migration SQL against a **different** Supabase project (`alqvknnpgcrupxtomcdv`). The app connects to `hddfkkojfvmjuxsyhcgh`. Always verify the project ref in the Supabase dashboard URL (`/dashboard/project/<ref>/...`) before migrations.
- Debugging trick used: update a known row to a unique marker value in SQL, then curl the live REST endpoint. If curl doesn't return the marker → wrong project.

### Auto-confirm trigger
- Supabase's built-in SMTP has a ~4/hr rate limit; hitting it blocks user creation with `email rate limit exceeded`. Fix: dashboard → Auth → Providers → Email → toggle **"Confirm email" OFF** (do NOT disable the entire Email provider).
- Plus a belt-and-suspenders trigger in the DB so users are always confirmed:
  ```sql
  CREATE TRIGGER auto_confirm_auth_user_trigger
    BEFORE INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_auth_user();
  ```
  Function sets `NEW.email_confirmed_at := NOW()` if null. Deployed. `confirmed_at` is a generated column — don't try to UPDATE it directly.

### Avatar-sync scoping bug (solved)
- `loadSidebarStats` in `ebs-tracker/js/utils.js` ran `.querySelectorAll('.user-avatar, .hero-avatar')` and overwrote every match with the current admin's avatar. Rows in the admin users list had no `data-user-id` → they fell through the guard and all got clobbered to look like the admin. This also made newly-created users appear "unchanged".
- Fix: selector is now `#sb-avatar, [data-user-id="<userId>"]` — only updates tagged elements. User-list rows also got `data-user-id` added as defense-in-depth.

### UI / UX iterations
- **Sidebar is collapsible on every viewport** now (was desktop-permanent). Floating menu icon top-left, close → restores full-width content. Floating sign-out group top-right. Hidden on landing route.
- **Manage Users** link removed from the React app's sidebar — user management stays in the EBS Tracker admin panel. `/admin/users` route + component are dead code but left in place.
- **Landing Team** admin page stays in the sidebar under the admin section.
- **Scroll resets to top on every route change** — `useEffect` keyed to `location.pathname` scrolls `#main-scroll` (the `<main>` `overflow-y-auto` container) to 0.
- **Landing → Dashboard CTA**: hero's "Explore Projects" button routes to `/dashboard` (not `/projects`). Achievements section's "View our Projects" still routes to `/projects`.
- **Vision section bg**: was `from-brand-600 to-brand-800` blue gradient; now pure black with subtle grid + central light pool (matches hero aesthetic).
- **Team subtitle**: "The people behind the work" → "The minds that power the platform".
- **Footer**: Union Trading Co. wordmark (left), hardcoded `Contact Us` block with `mailto:ebs@utc.com.kw` (center), editable `footer_text` (right). Stacks on mobile.
- **Week number**: now month-of-week (1-4). `getWeekNumber` returns `Math.min(Math.ceil(d.getDate()/7), 4)`. Weekly aggregators (`calculateStats` All-Rounder key + `aggregateByWeek` bucketing) disambiguate across months using `YYYY-MM-Wn` keys + `Mon Wn` labels.
- **Bulk upload template** now includes a Linked Project column (sheet H) + dedicated "Projects" sheet listing valid `proj_unique_id` + name. Parser validates + enforces mandatory linking when `app_settings.project_link_mandatory = true`.
- **Admin Project Analytics tab** (EBS tracker admin.html): replaced raw-data tables with Chart.js bar charts; clicking a bar opens a drill-down modal of the underlying logs.
- **Avatar sync**: landing-page photo upload now propagates into the EBS tracker's sidebar + hero avatars. `auth.js` caches `avatar_url` in `wt_session`; `loadSidebarStats` refetches + syncs on every page load.
- **Performance KPI**: removed the "Accomplishment Rate" card from `performance.html` and `admin.html`. Calculation still computed in `utils.js` but unused.
- **CI**: workflow bumped to `actions/checkout@v5`, `actions/setup-node@v5`, Node 22. `peaceiris/actions-gh-pages@v4` stays. If the deploy step fails with "HTTP 500 / expected packfile" — transient GitHub git-server flake. Just re-run the workflow.

### Logos / brand assets (multi-iteration)
- **Browser tab favicon** = `public/favicon.png` + `ebs-tracker/favicon.png` (the Uj-only mark, black on white, dedicated file).
- **PWA icons / apple-touch** = the old EBS Ü mark, untouched (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, and `-light` variants in the tracker).
- **Landing hero logo** = `public/ebs-logo-white.png` (Ü EBS mark, white on transparent — visible directly on the black hero with a soft radial halo, no tile).
- **Landing footer** = `public/union-trading-logo.png` (Union Trading Co. wordmark, full color).
- **EBS tracker in-page logos** = still `ebs-tracker/logo.png` (dark-mode, `mix-blend-mode: screen`) and `logo-light.png` (light-mode). Whenever the hero gets a new EBS mark, both sets want updating.

### Theme port: dark monochrome across every page
- **Approach**: a single `.app-dark` CSS override layer in `src/index.css` flips `bg-white`, `bg-surface-*`, `text-surface-*`, borders, status pills, inputs, divides, etc. Layout's `<main>` wraps in `app-dark` for every non-landing route. Landing page is untouched (already has its own monochrome design).
- **Editorial layer**: on top of the base flip, a refined set of rules adds:
  - Two soft white radial glows in the corners + a subtle SVG grain overlay (film texture), both `position:fixed` at z-index 0
  - Cards become linear-gradient surfaces with a 1px inner highlight + deep shadow + backdrop-blur
  - Typography: tighter tracking on headings, tabular numerals via `.font-mono`, stylistic alternates via `.font-display`, 0.12em uppercase tracking
  - Tables: hairline separators, tracked caps in headers
  - Modal chrome: gradient panel + hairline, blurred backdrop
  - Sidebar active link: gradient + inner ring instead of flat tint
- **Status colors stay semantic**: emerald/amber/red/blue/slate retained, just reshaped at 15% alpha + brightened text for readability.
- **EBS tracker**: CSS variables in `ebs-tracker/css/style.css` retuned — bg pure black, accent pure white (was gold), primary button white pill with black text, `.req` asterisk switched from accent → danger so it stays visible.
- **Gotcha**: Tailwind's `border-surface-50` was initially missed in the override list — Gantt chart has many month/row divider lines using that class and they read as bright white lines on black. Fix: explicit `.app-dark .border-surface-50 { border-color: rgba(255,255,255,0.03) !important }` plus tightening `border-surface-100` from 6% → 5%.
- **Particle animation**: temporarily dimmed to 40% + mix-blend-screen while iterating; restored to 95% opacity with no blend mode so it reads as a prominent silver constellation across the hero.

### Files changed in this iteration session (past the initial portal release)
- `src/App.jsx` — sidebar collapsible, scroll-to-top, nav entries, misc
- `src/components/LandingPage.jsx` — hero layout iterations, CTA routing, Vision/Team/Footer copy + layout
- `src/components/ParticleNetwork.jsx` — blue → silver (monochrome)
- `src/index.css` — dark theme overrides + editorial layer
- `index.html` — Google Fonts tweak (Instrument Serif briefly added then removed)
- `public/favicon.png`, `public/ebs-logo-white.png`, `public/union-trading-logo.png`, `public/union-trading-logo-white.png` — new assets
- `ebs-tracker/index.html`, `dashboard.html`, `tasks.html`, `log.html`, `performance.html`, `admin.html` — favicon links, bulk upload, analytics charts, on-hold flow, status chips, avatar sync, week label
- `ebs-tracker/js/auth.js`, `ebs-tracker/js/utils.js` — avatar caching, month-week, scoped sync
- `ebs-tracker/js/config.js` — 10-level XP + rebalanced badges
- `ebs-tracker/css/style.css` — monochrome CSS variables
- `.github/workflows/deploy.yml` — Node 22, action v5
- Supabase — auto-confirm trigger added; Confirm Email toggle OFF
