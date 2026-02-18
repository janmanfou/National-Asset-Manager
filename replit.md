# National Voter Data Conversion Engine

## Overview

This is a full-stack web application called "VoterData Engine" — a National Voter Data Conversion and Election Intelligence platform. It processes electoral roll PDFs and Excel files, extracts voter data via OCR, stores it in a PostgreSQL database, and provides analytics dashboards with campaign strategy insights.

Key features:
- **Batch file upload** (PDF/ZIP) with processing queue and progress tracking
- **Voter record management** with search, pagination, and status tracking (verified/flagged/incomplete)
- **Election Intelligence Engine** with voter segmentation (age, gender, booth), predictive analytics, and campaign strategy generation
- **Audit logging** for system activity tracking
- **Authentication** with role-based access (admin, candidate, worker)
- **Dashboard** with file processing stats, voter stats, and recent activity

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State/Data Fetching**: TanStack React Query for server state management
- **Styling**: Tailwind CSS v4 with CSS variables for theming, shadcn/ui component library (New York style)
- **Charts**: Recharts for data visualization (bar charts, pie charts, radar charts, area charts)
- **Build Tool**: Vite
- **Path aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend
- **Framework**: Express.js running on Node.js with TypeScript (tsx for dev, esbuild for production)
- **API Pattern**: REST API with `/api/` prefix. All API routes are registered in `server/routes.ts`
- **File Uploads**: Multer for handling PDF/ZIP uploads (up to 5GB), stored in `uploads/` directory
- **Authentication**: Custom session-based auth using in-memory session Map with cookie-based session IDs. Passwords hashed with bcryptjs. Auth middleware protects API routes.
- **Development**: Vite dev server is integrated as middleware for HMR during development. In production, static files are served from `dist/public/`.

### Database
- **Database**: PostgreSQL (required, via `DATABASE_URL` environment variable)
- **ORM**: Drizzle ORM with `drizzle-kit` for migrations
- **Schema location**: `shared/schema.ts` — shared between frontend and backend
- **Connection**: `node-postgres` (pg) pool in `server/db.ts`
- **Key tables**:
  - `users` — user accounts with roles (admin/candidate/worker)
  - `uploaded_files` — file upload tracking with status/progress
  - `voter_records` — extracted voter data (name, EPIC, age, gender, address, gram, thana, panchayat, block, tahsil, jilla)
  - `audit_logs` — system activity trail
- **Schema push**: Use `npm run db:push` to push schema changes to the database

### Storage Layer
- `server/storage.ts` defines an `IStorage` interface with a `DatabaseStorage` implementation
- Provides methods for CRUD on users, files, voter records, and audit logs
- Includes analytics queries: gender distribution, age distribution, booth stats

### Project Structure
```
client/               # Frontend React app
  src/
    components/       # UI components (shadcn/ui + custom)
      analytics/      # Chart components for election intelligence
      layout/         # Sidebar navigation
      upload/         # Upload-related components
      ui/             # shadcn/ui base components
    hooks/            # Custom React hooks
    lib/              # Utilities, query client, mock data
    pages/            # Route pages (dashboard, upload, processing, records, analytics, audit, settings, auth)
server/               # Backend Express app
  index.ts            # App entry point
  routes.ts           # API route definitions
  storage.ts          # Database storage layer
  db.ts               # Database connection
  vite.ts             # Vite dev server integration
  static.ts           # Production static file serving
shared/               # Shared code between client and server
  schema.ts           # Drizzle database schema + Zod validation
migrations/           # Drizzle migration files
script/
  build.ts            # Production build script (Vite + esbuild)
```

### Build & Dev Commands
- `npm run dev` — Start development server (Express + Vite HMR) on port 5000
- `npm run build` — Build for production (client via Vite, server via esbuild)
- `npm run start` — Run production build
- `npm run db:push` — Push Drizzle schema to PostgreSQL

## External Dependencies

### Database
- **PostgreSQL** — Primary data store, connected via `DATABASE_URL` environment variable. Required for the app to run.

### Key NPM Packages
- **drizzle-orm** + **drizzle-kit** — ORM and migration tooling for PostgreSQL
- **express** — HTTP server framework
- **multer** — Multipart file upload handling
- **bcryptjs** — Password hashing
- **xlsx** — Excel file parsing (for voter data import)
- **recharts** — Data visualization charts
- **@tanstack/react-query** — Async state management
- **wouter** — Client-side routing
- **zod** + **drizzle-zod** — Schema validation
- **shadcn/ui** — UI component library (Radix UI primitives + Tailwind)

### Replit-specific
- **@replit/vite-plugin-runtime-error-modal** — Runtime error overlay
- **@replit/vite-plugin-cartographer** — Dev tooling (dev only)
- **@replit/vite-plugin-dev-banner** — Dev banner (dev only)
- Custom `vite-plugin-meta-images.ts` for OpenGraph meta tag injection using Replit deployment URLs