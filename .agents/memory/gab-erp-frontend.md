---
name: GAB ERP frontend constraints
description: Non-obvious constraints when extending the GAB SCHOOL admin (CRM→ERP) frontend — orval enum handling, expanded stages, raw fetch pattern, cache invalidation, Tailwind v4, i18n.
---

# GAB ERP frontend constraints

GAB SCHOOL is a 5-day intensive training CRM/ERP, NOT a traditional school. Arabic-RTL admin lives under `/gab-c7x2p`.

## Student stage enum — bypassed in backend, 10 stages now live

The orval-generated client still hardcodes 5 stages: `["new","contacted","interested","no_show","archived"]`. The backend has been DECOUPLED from this: all student route response parsers (`ListStudentsResponse.parse`, `GetStudentResponse.parse`, `UpdateStudentResponse.parse`, `UpdateStudentStageResponse.parse`, `AssignStudentToGroupResponse.parse`) were replaced with `res.json(student)` directly. Stage body validation in PATCH /students/:id/stage uses a local `ALL_STAGE_VALUES` const (not orval's schema).

The 10 live stages (value → Arabic label):
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

**Why:** The orval-generated Zod schemas would throw on any stage not in the 5-value enum, breaking all student API responses the moment a student gets a new stage value. Replacing the parsers is the safest, least-invasive fix.
**How to apply:** When adding new stage values, update `ALL_STAGE_VALUES` in `artifacts/api-server/src/routes/students.ts` and `ALL_STAGES` in `artifacts/web/src/pages/admin/Students.tsx`. Do NOT use orval response parsers on student objects.

## New endpoints (not in OpenAPI spec)

- `GET /api/students/stage-counts` — returns `{_total: N, new: N, contacted: N, ...}`. Must be registered BEFORE `GET /api/students/:id` in Express routing.
- `PATCH /api/students/bulk/stage` — body `{ids: number[], stage: string}`. Also before `:id` routes.

## Frontend Students.tsx uses direct fetch (not orval)

The students list uses `useQuery` with `fetch(buildUrl(filters), {credentials:"include"})` — not `useListStudents` from orval — because orval's `ListStudentsQueryParams` validates stage as the old 5-value enum and new stage values would be silently dropped.

**How to apply:** Stage filter, city filter, and date range filters are all passed as raw query string params. The query key is `["students-list", filters]`. Inline stage changes use `PATCH /api/students/:id/stage`; bulk changes use `PATCH /api/students/bulk/stage`.

The stage-counts query key is `["stage-counts"]`. After stage mutations, invalidate both `["students-list"]`, `["stage-counts"]`, `["/api/students"]`, and `["stats-erp"]`.

**Error-guard the fetch:** Always check `if (!r.ok) throw new Error(...)` before calling `.json()` in queryFn. Otherwise non-ok responses store the error body as query data and crash downstream `.map()` calls.

## New pages use raw fetch, not orval hooks

Pages added this work (StudentProfile, Tasks, NotificationCenter, Dashboard ERP metrics, Students list) call fetch directly. Their TanStack Query keys: `["student",id]`, `["payments",id]`, `["stats-erp"]`, `["stats-financials"]`, `["notifications"]`, `["timeline",id]`, `["attendance",id]`, `["notes",id]`, `["students-list",filters]`, `["stage-counts"]`.

## Invalidating orval caches from raw-fetch pages

Orval query keys start with the API path: students list = `["/api/students", params?]`, dashboard stats = `["/api/stats"]`.
After stage/payment/contact mutations, also invalidate: `["/api/students"]`, `["/api/stats"]`, `["stats-erp"]`, `["stats-financials"]`, `["notifications"]`.

## Tailwind v4, no animate plugin

The web artifact runs Tailwind v4 with NO `tailwindcss-animate` plugin. `animate-pulse` exists; custom animations (e.g. `animate-fadeup`) are defined as keyframes in `src/index.css`. Don't reach for plugin classes.

## i18n

`t` is typed from `translations.ar` in `src/contexts/i18n-context.tsx`. Any new key must be added to BOTH `ar` and `fr` or typecheck/lookup breaks. Vite does not typecheck — run `pnpm --filter @workspace/web run typecheck` explicitly.
