# Workspace

## Overview

pnpm workspace monorepo using TypeScript. GAB SCHOOL - Student Registration and CRM Management System for a training academy.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: Session-based (express-session)
- **File uploads**: Multer

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── web/                # React + Vite frontend (landing + admin CRM)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Application Features

### Public Website (/)
- Landing page with hero section, training descriptions, image gallery
- Student registration form (firstName, lastName, phone, whatsapp, city, trainingType, housingNeeded, experienceLevel, note)
- WhatsApp contact button
- Gallery section pulls images from API

### Admin CRM Dashboard (/admin)
- Login at /admin/login (default: admin / admin123)
- Dashboard with stats overview
- Student pipeline (stages: new, contacted, interested, no_show, archived)
- Student list with search/filter
- Group/batch management (create, edit, assign students)
- Staff management with roles (admin, manager, assistant, staff)
- Activity journal logging all system actions
- Gallery image upload and management

### Database Tables
- `staff` — admin users with roles and password hashes
- `students` — registered students with pipeline stage and group assignment
- `groups` — training groups with capacity and status
- `activity_logs` — audit log of all system actions
- `gallery_images` — uploaded images for the public gallery

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only emit `.d.ts` files during typecheck

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build`
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/web` (`@workspace/web`)

React + Vite frontend serving both the public landing page and admin CRM dashboard. Uses wouter for routing, React Query for data fetching, react-hook-form + zod for form validation, and shadcn/ui + Tailwind for styling.

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server with session-based auth, file uploads (multer), and activity logging.

- Routes: auth, students, groups, staff, activity, gallery, health
- Middleware: auth (requireAuth, requireRole)
- Seeds default admin on first startup (admin/admin123)
- Serves uploaded files from /api/uploads/

### `lib/db` (`@workspace/db`)

Database layer: staff, students, groups, activity_logs, gallery_images tables.

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec and Orval codegen config. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from OpenAPI spec.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks from OpenAPI spec.
