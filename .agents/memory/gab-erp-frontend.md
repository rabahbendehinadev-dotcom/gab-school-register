---
name: GAB ERP frontend constraints
description: Non-obvious constraints when extending the GAB SCHOOL admin (CRM→ERP) frontend — orval enum handling, expanded stages, raw fetch pattern, groups hub, cache invalidation, Tailwind v4, i18n.
---

# GAB ERP frontend constraints

GAB SCHOOL is a 5-day intensive training CRM/ERP, NOT a traditional school. Arabic-RTL admin lives under `/gab-c7x2p`.

## Student stage enum — bypassed in backend, 10 stages now live

The orval-generated client still hardcodes 5 stages. The backend has been DECOUPLED from this: all student route response parsers were replaced with `res.json(student)` directly. Stage body validation in PATCH /students/:id/stage uses a local `ALL_STAGE_VALUES` const.

The 10 live stages (value → Arabic):
- `new` → تسجيل جديد
- `contacted` → تم التواصل
- `interested` → مهتم
- `payment_pending` → ينتظر الدفع
- `payment_confirmed` → تم الدفع
- `confirmed` → مؤكد للدورة
- `attended` → حضر
- `no_show` → لم يحضر
- `completed` → مكتمل التكوين
- `archived` → أرشيف

**Why:** The orval-generated Zod schemas throw on any stage not in the 5-value enum, breaking API responses. Replacing the parsers is the safest fix.
**How to apply:** Update `ALL_STAGE_VALUES` in `artifacts/api-server/src/routes/students.ts` and `ALL_STAGES` in any frontend page that lists stages. Do NOT use orval response parsers on student objects.

## Groups page is the primary hub (not Pipeline)

The `/gab-c7x2p/groups` page is now the main session management hub. Pipeline (`/gab-c7x2p/pipeline`) is kept as a route but removed from navigation. The nav uses `t.schedules` ("الجداول") for the groups nav item, NOT `t.groups`.

Groups.tsx uses a master-detail pattern: list view (cards) → click → detail view (student table) — no URL change. Both views live in the same component with `selectedGroupId` state.

**Why:** User wants sessions (groups) to be the center of the system with student management inline, not a separate Kanban.

## Groups backend: single SQL query for stats

The `GET /groups` endpoint now uses a single SQL query with `COUNT(s.id) FILTER (WHERE ...)` aggregates instead of N+1 queries. Returns `confirmedCount`, `paidCount`, `absentCount` per group. Bypasses `ListGroupsResponse.parse()` — uses `res.json()`.

The `GET /groups/:id` also bypasses `GetGroupResponse.parse()`, adds `deleted_at IS NULL` filter on students, and computes stats in JS.

**Why:** `GetGroupResponse.parse()` from orval validates student stage as the 5-value enum — it would fail for students with new stages.
**How to apply:** Any new groups endpoint that returns student objects must bypass orval parsers.

## New endpoints (not in OpenAPI spec)

- `GET /api/students/stage-counts` — per-stage counts. Must be before `GET /api/students/:id` in Express routing.
- `PATCH /api/students/bulk/stage` — bulk stage update. Must be before `/:id` routes.

## Frontend pages use direct fetch (not orval hooks)

Students.tsx, Groups.tsx (detail), Tasks, NotificationCenter, Dashboard ERP use `fetch("/api"+path, {credentials:"include"})` — not orval hooks.

**Error-guard mandatory:** Always check `if (!r.ok) throw new Error(...)` before `.json()` in queryFn. Non-ok responses return error bodies (objects) that crash downstream `.map()` calls.

**Fetch PATCH pattern for student updates:**
```js
fetch(`/api/students/${id}`, {
  method: 'PATCH', credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ paymentStatus: next })  // or note, groupId, etc.
})
```

## Query key conventions

- Groups list: `["groups-list"]`
- Group detail: `["group-detail", groupId]`
- Students list: `["students-list", filters]`
- Stage counts: `["stage-counts"]`
- Student detail: `["student", id]`

After mutations that affect groups, invalidate: `["groups-list"]`, `["group-detail", groupId]`, `["students-list"]`, `["stage-counts"]`.
After stage/payment/contact mutations, also invalidate: `["/api/students"]`, `["/api/stats"]`, `["stats-erp"]`, `["stats-financials"]`.

## Tailwind v4, no animate plugin

No `tailwindcss-animate` plugin. `animate-pulse` exists; custom animations defined in `src/index.css`.

## i18n

`t` is typed from `translations.ar` in `src/contexts/i18n-context.tsx`. New keys MUST be added to BOTH ar and fr or typecheck fails. Use `lang` with inline string objects as an alternative to avoid modifying context for new UI strings.

Key navigation labels: `t.schedules` = "الجداول" for the groups nav item. `t.groups` = "المجموعات" (NOT used in nav anymore).
