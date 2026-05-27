# UniAuth Drizzle Adapter

[![GitHub Packages](https://img.shields.io/static/v1?label=GitHub%20Packages&message=%40alyldas%2Funiauth-drizzle&color=24292f&logo=github)](https://github.com/users/alyldas/packages/npm/package/uniauth-drizzle)

Drizzle storage adapter for `@alyldas/uniauth-core`.

This package implements only the UniAuth storage contracts:

- `AuthServiceRepositories`;
- `UnitOfWork`;
- PostgreSQL tables for Drizzle.

It does not verify passwords, issue sessions, parse HTTP requests, send OTP messages, or duplicate
auth policy logic from `@alyldas/uniauth-core`.

## Runtime Boundary

Applications own Drizzle driver setup, connection lifecycle, migrations, retry policy, and database
operations outside the UniAuth repository contracts. This package owns only table definitions,
repository implementations, and transaction wiring for UniAuth.

## Install

Configure the GitHub Packages registry for the package scope before installing:

```ini
@alyldas:registry=https://npm.pkg.github.com
```

GitHub Packages can require authentication for package reads. Use a token with `read:packages` in local npm config or CI secrets; do not commit tokens.

```sh
npm install @alyldas/uniauth-core @alyldas/uniauth-drizzle drizzle-orm
```

## Usage

```ts
import { DefaultAuthService } from '@alyldas/uniauth-core'
import { createDrizzleAuthStore } from '@alyldas/uniauth-drizzle'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }))
const store = createDrizzleAuthStore({ db })

const auth = new DefaultAuthService({
  repos: store,
  transaction: store,
})
```

Use the exported Drizzle tables in migrations:

```ts
import {
  uniauthAuditEvents,
  uniauthCredentials,
  uniauthIdentities,
  uniauthSessions,
  uniauthUsers,
  uniauthVerifications,
} from '@alyldas/uniauth-drizzle'
```

See [Postgres persistence](docs/postgres.md) for the schema parity notes, transaction boundary, and
runtime ownership split.

## Security Notes

- Verification secrets and session tokens must reach this adapter already hashed by UniAuth core.
- Metadata and trust payloads are stored as JSON, but provider SDK objects should be reduced before
  they reach UniAuth.
- The adapter does not infer account ownership outside UniAuth policy.

## Local Checks

```sh
npm run check
```
