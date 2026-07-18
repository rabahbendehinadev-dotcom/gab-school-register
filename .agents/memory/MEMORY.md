# Memory Index

- [GAB ERP frontend constraints](gab-erp-frontend.md) — orval stage enum is frozen, ERP journey lives in payments/attendance/timeline; new pages use raw fetch + how to invalidate orval caches.
- [Language preference system](lang-pref.md) — default lang is "fr" (not "ar"); saved in staff.language column; GET/PUT /api/user/language in auth.ts; i18n-context.tsx syncs from backend on mount.
- [Global Search component](global-search.md) — Cmd+K command palette at artifacts/web/src/components/admin/GlobalSearch.tsx; searches /api/students?search=&limit=8; imported + keyboard-wired in AdminLayout.
- [UX uplift patterns](ux-uplift.md) — Dashboard has PriorityBar urgency cards + greeting; Students table has avatar initials + always-visible WhatsApp; Kanban cards have stage-colored left border via inline style; Tasks has summary stats bar.
