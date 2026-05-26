# Postgres Persistence

`@alyldas/uniauth-drizzle` provides the Postgres storage adapter for UniAuth repository ports using
Drizzle table definitions and query builders.

## Public API

```ts
import {
  createDrizzleAuthStore,
  uniauthDrizzleSchema,
  uniauthUsers,
  uniauthIdentities,
  uniauthCredentials,
  uniauthVerifications,
  uniauthSessions,
  uniauthAuditEvents,
} from '@alyldas/uniauth-drizzle'
```

## Runtime Boundary

The application owns:

- the actual Drizzle driver and database connection lifecycle;
- connection string and secret loading;
- migrations and schema rollout policy;
- retry policy and pool sizing;
- backup, replication, and failover setup.

UniAuth owns only the repository and transaction wiring around the existing core ports.

## Wiring Example

```ts
import { DefaultAuthService } from '@alyldas/uniauth-core'
import { createDrizzleAuthStore, uniauthDrizzleSchema } from '@alyldas/uniauth-drizzle'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }), {
  schema: uniauthDrizzleSchema,
})
const store = createDrizzleAuthStore({ db })

const service = new DefaultAuthService({
  repos: store,
  transaction: store,
})
```

## Schema Parity

The Drizzle schema defines the same UniAuth persistence surface as the extracted Postgres adapter:

- `uniauth_users`
- `uniauth_identities`
- `uniauth_credentials`
- `uniauth_verifications`
- `uniauth_sessions`
- `uniauth_audit_events`

The schema includes:

- a unique constraint on `(provider, provider_user_id)` in `uniauth_identities`;
- unique constraints on `(type, subject)` and `(type, user_id)` in `uniauth_credentials`;
- a unique `token_hash` on `uniauth_sessions` so client session tokens are not stored raw;
- partial indexes for verified email and phone lookups on active identities;
- explicit `jsonb` columns for adapter-owned `metadata` and provider `trust`.

## Transaction Model

`DrizzleAuthStore` implements `UnitOfWork`. `run()` uses `db.transaction(...)` when the provided
executor supports it and reuses the active transaction inside nested UniAuth flows. If the executor
does not expose transactions, `run()` executes the callback directly.

This lets link, unlink, merge, session, and verification writes share one database transaction when
the service calls them through UniAuth core.

## Security Notes

- Verification secrets remain hashed at rest; the adapter stores only `secret_hash`.
- Client session tokens remain hashed at rest; the adapter stores only `token_hash`.
- Trust and metadata fields are stored as `jsonb`, but provider SDK objects should still be reduced
  before they reach UniAuth.
- The adapter does not infer ownership from email or phone outside the core policy flow.
