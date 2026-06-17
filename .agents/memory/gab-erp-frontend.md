---
name: GAB ERP frontend constraints
description: Non-obvious constraints when extending the GAB SCHOOL admin (CRM→ERP) frontend — orval enum freeze, raw fetch pattern, cache invalidation, Tailwind v4, i18n.
---

# GAB ERP frontend constraints

GAB SCHOOL is a 5-day intensive training CRM/ERP, NOT a traditional school. Arabic-RTL admin lives under `/gab-c7x2p`.

## Student stage enum is frozen by orval codegen
The orval-generated client (`lib/api-zod` / `lib/api-client-react`) hardcodes the student stage enum as `["new","contacted","interested","no_show","archived"]`.
**Why:** changing it requires editing the OpenAPI spec and re-running codegen, which ripples into typed mutations everywhere.
**How to apply:** do NOT model the full ERP journey (payment pending/confirmed, assigned, day1-5, completed) as stage values. The journey is delivered via the `payments`, `student_attendance`, timeline/activity, `followup_tasks`, and `notifications` tables instead. The profile stage selector only offers the 5 valid pipeline stages. Stats endpoints count both legacy + any new stage values gracefully.

## New ERP pages use raw fetch, not orval hooks
Pages added this work (StudentProfile, Tasks, NotificationCenter, Dashboard ERP metrics) call `fetch('/api'+path,{credentials:'include'})` directly because their endpoints are not in the OpenAPI spec.
**How to apply:** their TanStack Query keys are plain strings like `["student",id]`, `["payments",id]`, `["stats-erp"]`, `["stats-financials"]`, `["notifications"]`, `["timeline",id]`, `["attendance",id]`, `["notes",id]`.

## Invalidating orval caches from raw-fetch pages (cross-page freshness)
Orval query keys are arrays prefixed with the API path: students list = `["/api/students", params?]`, dashboard stats = `["/api/stats"]`.
**Why:** after a payment/stage/contact change on the profile, mounted list/pipeline/dashboard views would show stale data otherwise (default staleTime 0 only saves you on remount).
**How to apply:** after such mutations, invalidate by prefix: `["/api/students"]`, `["/api/stats"]`, plus the raw keys `["stats-erp"]`, `["stats-financials"]`, `["notifications"]`. Prefix match is the default for `invalidateQueries`.

## Tailwind v4, no animate plugin
The web artifact runs Tailwind v4 with NO `tailwindcss-animate` plugin. `animate-pulse` exists; custom animations (e.g. `animate-fadeup`) are defined as keyframes in `src/index.css`. Don't reach for plugin classes.

## i18n
`t` is typed from `translations.ar` in `src/contexts/i18n-context.tsx`. Any new key must be added to BOTH `ar` and `fr` or typecheck/lookup breaks. Vite does not typecheck — run `pnpm --filter @workspace/web run typecheck` explicitly.
