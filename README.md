# ik-photos

A self-hosted web gallery for browsing, downloading, and managing photos stored on [Infomaniak kDrive](https://www.infomaniak.com/en/kdrive). It connects to the kDrive API, indexes your photos locally for fast browsing, and provides a responsive gallery with lightbox, multi-selection, bulk download (ZIP), and deletion.

## Features

- Browse all photos and videos from your kDrive drives
- Responsive grid gallery with virtual scrolling and timeline scrubber
- Lightbox with preview preloading for instant navigation
- Multi-selection with shift-click and long-press support
- Bulk download as ZIP
- Delete photos (removes from kDrive and local database)
- Automatic periodic re-indexing (configurable cron)
- Multi-language support (EN, FR, DE, ES, IT)
- Light/dark theme
- JWT authentication with encrypted token storage (AES-256-GCM)

## Architecture

This is a **pnpm monorepo** managed by [Turborepo](https://turbo.build/) with three packages:

```
packages/
  shared/     # Shared TypeScript types and constants
  back/       # NestJS API server (REST)
  front/      # React SPA (Vite + Tailwind CSS)
```

- **Backend** (`@ik-photos/back`): NestJS, Drizzle ORM, PostgreSQL. Proxies the kDrive API for thumbnails/previews/downloads and maintains a local photo index.
- **Frontend** (`@ik-photos/front`): React 19, TanStack Query, React Virtuoso, Tailwind CSS 4. Communicates with the backend REST API.
- **Database**: PostgreSQL 16 (provided via Docker Compose in dev, or any PostgreSQL instance in production).

The backend acts as a proxy to the [Infomaniak API](https://developer.infomaniak.com/docs/api) so that the kDrive API token is never exposed to the browser.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 22
- [pnpm](https://pnpm.io/) >= 10
- [Docker](https://www.docker.com/) (for local PostgreSQL — not needed if you have an external database)

## Getting started

### 1. Clone and install

```bash
git clone <repo-url> ik-photos
cd ik-photos
pnpm install
```

### 2. Start the database

```bash
docker compose up -d
```

This starts a PostgreSQL 16 instance on port **5433** with database `ikphotos`, user `ik`, password `ik`.

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` to set your secrets:

```env
DATABASE_URL=postgresql://ik:ik@localhost:5433/ikphotos
JWT_SECRET=change-me-to-a-random-secret
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
ENCRYPTION_KEY=change-me-to-a-32-byte-hex-key
KDRIVE_API_BASE=https://api.kdrive.infomaniak.com
REINDEX_CRON=0 */6 * * *
PORT=3004
CORS_ORIGIN=http://localhost:3003
```

#### Database configuration

You can configure the database connection in two ways:

**Option A** — Single connection string (default, used by docker-compose):

```env
DATABASE_URL=postgresql://user:password@host:port/dbname
```

**Option B** — Individual variables (useful for managed databases):

```env
DB_HOST=postgresql-ik-photos.example.com
DB_PORT=5432
DB_NAME=ik-photos_db
DB_USERNAME=ik-photos
DB_PASSWORD=your-password
```

When `DB_HOST` is set and `DATABASE_URL` is not, the connection string is built automatically.

#### All variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | * | — | PostgreSQL connection string (or use `DB_*` vars below) |
| `DB_HOST` | * | — | Database host (alternative to `DATABASE_URL`) |
| `DB_PORT` | | `5432` | Database port |
| `DB_NAME` | | — | Database name |
| `DB_USERNAME` | | — | Database user |
| `DB_PASSWORD` | | — | Database password |
| `JWT_SECRET` | yes | — | Secret for signing JWT access tokens |
| `JWT_EXPIRY` | | `15m` | Access token lifetime (e.g. `15m`, `1h`) |
| `REFRESH_TOKEN_EXPIRY` | | `7d` | Refresh token lifetime (e.g. `7d`) |
| `ENCRYPTION_KEY` | yes | — | 32-byte hex key for AES-256-GCM encryption of stored kDrive tokens |
| `KDRIVE_API_BASE` | | `https://api.kdrive.infomaniak.com` | kDrive API base URL |
| `REINDEX_CRON` | | `0 */6 * * *` | Cron expression for automatic re-indexing |
| `PORT` | | `3004` | Backend server port |
| `CORS_ORIGIN` | | `http://localhost:3003` | Allowed CORS origin |
| `LOCAL_MODE` | | — | Set to `true` to bypass JWT auth and use a local account |
| `INFOMANIAK_TOKEN` | | — | Infomaniak API token, saved to local account on startup (local mode only) |

\* Either `DATABASE_URL` or `DB_HOST` must be set.

#### Frontend build variable

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE` | `http://localhost:3004/api` | API base URL baked into the frontend at build time |

For same-domain deployments, set `VITE_API_BASE=/api`.

### 4. Initialize the database

```bash
pnpm --filter @ik-photos/back run db:push
```

This creates the database tables from the Drizzle schema.

### 5. Run in development

```bash
pnpm dev
```

This starts both the backend (NestJS, port 3004) and frontend (Vite, port 3003) in watch mode via Turborepo.

Open http://localhost:3003 in your browser.

### 6. Create an Infomaniak API token

1. Go to https://manager.infomaniak.com/v3/ng/profile/user/token/list
2. Create a new token with the **drive** scope
3. Register an account in the app and paste your token

See the [Infomaniak API documentation](https://developer.infomaniak.com/docs/api) for more details.

### Local mode (no authentication)

For local development, you can skip account creation and JWT entirely. Set `LOCAL_MODE=true` in `.env`:

```env
LOCAL_MODE=true
DATABASE_URL=postgresql://ik:ik@localhost:5433/ikphotos
```

No `JWT_SECRET` or `ENCRYPTION_KEY` needed — they default automatically.

On first launch, the app shows a simplified login screen asking only for your Infomaniak API token. The token is verified against the kDrive API before being saved. On subsequent launches, the app starts directly — no login required.

You can also provide the token via environment variable to skip the UI prompt:

```env
INFOMANIAK_TOKEN=your-token-here
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LOCAL_MODE` | | — | Set to `true` to enable local mode (no JWT, no account) |
| `INFOMANIAK_TOKEN` | | — | Infomaniak API token (local mode only, alternative to UI prompt) |

## Building for production

```bash
# Build the frontend with the correct API base for your domain
VITE_API_BASE=/api pnpm --filter @ik-photos/front build

# Build the backend (compile TypeScript)
pnpm --filter @ik-photos/back build

# Or build a self-contained bundle (compile + bundle with ncc into a single file)
pnpm --filter @ik-photos/back run build:bundle
```

Output:
- `packages/front/dist/` — static SPA files (serve at `/`)
- `packages/back/dist/` — compiled NestJS server (run with `node dist/main.js`)
- `packages/back/bundle/` — single-file bundle (run with `node bundle/index.js`, no `node_modules` needed)

### Example deployment

Example `.env` for a production server:

```env
DB_HOST=postgresql.example.com
DB_PORT=5432
DB_NAME=ikphotos
DB_USERNAME=ikphotos
DB_PASSWORD=your-password
JWT_SECRET=<random-64-chars>
ENCRYPTION_KEY=<random-32-byte-hex>
PORT=3004
CORS_ORIGIN=https://photos.example.com
```

Build the frontend:

```bash
VITE_API_BASE=/api pnpm --filter @ik-photos/front build
```

Build and bundle the backend:

```bash
pnpm --filter @ik-photos/back run build:bundle
```

Configure your server with:
- A **Node.js process** running `packages/back/bundle/index.js` on path `/api`
- A **static files** directory pointing to `packages/front/dist/` on path `/`

Since both live on the same domain, the frontend calls `/api/...` as a relative path and no cross-origin issues arise.

## Deployment (CI/CD)

Deployment is automated via GitHub Actions. A single workflow (`.github/workflows/deploy.yml`) triggers on any `v*` tag and **auto-detects** which packages changed since the previous tag:

- If `packages/front/` changed → deploys the **frontend** to AlwaysData
- If `packages/back/` or `packages/shared/` changed → runs **DB migrations** on Neon, then deploys the **backend** to Koyeb

### Usage

```bash
git tag v1.2.0
git push --tags
```

If both front and back changed, both deploy jobs run in parallel.

### Required GitHub configuration

#### Secrets (`Settings > Secrets and variables > Actions > Secrets`)

| Secret | Description |
|--------|-------------|
| `ALWAYSDATA_SSH_KEY` **or** `ALWAYSDATA_PASSWORD` | Authentication for `ik-photos@ssh-ik-photos.alwaysdata.net`. Use **one** of the two (key recommended, password works too). |
| `DATABASE_URL` | Neon PostgreSQL connection string (e.g. `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/ikphotos?sslmode=require`). Used for running Drizzle migrations. |
| `KOYEB_TOKEN` | Koyeb API token. Generate one at https://app.koyeb.com/settings/api. |

> **AlwaysData SSH setup** : tu peux utiliser directement ton mot de passe AlwaysData (`ALWAYSDATA_PASSWORD`).
> Pour passer aux clés SSH (recommandé) :
> ```bash
> ssh-keygen -t ed25519 -f /tmp/alwaysdata_ci -N ""
> ssh-copy-id -i /tmp/alwaysdata_ci.pub ik-photos@ssh-ik-photos.alwaysdata.net
> # Copier le contenu de /tmp/alwaysdata_ci dans le secret ALWAYSDATA_SSH_KEY sur GitHub
> # Puis supprimer les fichiers locaux
> ```

#### Variables (`Settings > Secrets and variables > Actions > Variables`)

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE` | API base URL baked into the frontend build (e.g. `https://ik-photos-api.koyeb.app/api`). |

### Infrastructure

| Component | Provider | Details |
|-----------|----------|---------|
| Frontend | [AlwaysData](https://www.alwaysdata.com/) | Static files served via SCP upload to `/home/ik-photos/www` |
| Backend | [Koyeb](https://www.koyeb.com/) | Docker container from bundled `index.js` (free tier, `fra` region) |
| Database | [Neon](https://neon.tech/) | Serverless PostgreSQL, migrations via `drizzle-kit migrate` |

### Backend environment variables on Koyeb

These must be configured in the Koyeb dashboard (or via `koyeb service update`):

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Neon connection string |
| `JWT_SECRET` | Random 64+ character secret |
| `ENCRYPTION_KEY` | Random 32-byte hex key (`openssl rand -hex 32`) |
| `CORS_ORIGIN` | `https://ik-photos.alwaysdata.net` |

### Manual deployment

If you prefer to deploy manually without tags:

```bash
# Frontend
pnpm --filter @ik-photos/front build
scp -r packages/front/dist/* ik-photos@ssh-ik-photos.alwaysdata.net:/home/ik-photos/www

# Backend
pnpm --filter @ik-photos/back run build:bundle
koyeb deploy ./packages/back/bundle ik-photos/api \
  --archive-builder docker \
  --instance-type free \
  --ports 3004:http \
  --regions fra

# DB migrations
cd packages/back && npx drizzle-kit migrate
```

## Lint

```bash
pnpm lint
```

Runs `tsc --noEmit` on all three packages.

## Database commands

```bash
# Push schema changes to the database (development)
pnpm --filter @ik-photos/back run db:push

# Generate a migration
pnpm --filter @ik-photos/back run db:generate

# Run pending migrations
pnpm --filter @ik-photos/back run db:migrate

# Open Drizzle Studio (database browser)
pnpm --filter @ik-photos/back run db:studio
```

## License

[MIT](LICENSE)
