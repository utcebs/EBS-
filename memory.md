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
│   ├── App.jsx                     Entire React app in one 1700-line file — all components, routes, providers
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
| `#/` | `Dashboard` | Portfolio overview — charts, summary cards, drill-down |
| `#/projects` | `ProjectTracker` | Projects list, search, filter, bulk upload, new/edit/delete |
| `#/projects/:id` | `ProjectDetail` | Project header, milestones tab, risks tab, project dashboard |
| `#/gantt` | `GanttChartPage` | Timeline chart across all projects |
| `#/login` | `LoginPage` | Admin email/password login |
| `#/admin/users` | `AdminUsersPage` | Admin — create users, reset passwords |

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

- `projects` — `id, project_number, project_name, status, priority, phase, percent_complete, start_date, end_date, dept_module, business_owner, total_cost_kwd, key_risks, dependencies, mitigation, notes_updates, actions_needed, ...`
- `milestones` — tied to `project_id`, has `development_status` + `uat_status`
- `risks` — tied to `project_id`, has `impact` + `likelihood`
- `profiles` — one row per auth user, with `role` (`user` or `admin`)
- `task_logs`, `priority_tasks`, `support_subcategories`, `testing_subcategories`, `project_subcategories`, `employee_leaves`, `war_day_ranges`, `app_settings` — EBS Tracker tables

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

### Pattern
All these silent-failure bugs were "no console error, no data." Lesson: when a Supabase query returns nothing, always check whether the Network tab shows the request at all. If it doesn't, it's a client-side auth/SW/caching issue, not a data issue.

---

## 10. Testing checklist (regression guard)

After any change touching auth, Supabase clients, or service workers, verify in an **incognito window**:

1. ✅ Open `https://utcebs.github.io/EBS-/` fresh — projects load on dashboard + `/projects`
2. ✅ Click a project → detail page loads milestones + risks
3. ✅ Navigate to `/ebs-tracker/` → login screen works
4. ✅ Log in as admin → redirected to EBS Tracker dashboard
5. ✅ Navigate back to main site at `/` → projects **still load** (this is the regression case)
6. ✅ Console tab: no red errors
7. ✅ Network tab filtered by `supabase`: GET requests to `/rest/v1/projects` return 200 with array

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

_Last updated: 2026-04-22 — after adding the two-client Supabase fix for cross-app auth deadlock._
