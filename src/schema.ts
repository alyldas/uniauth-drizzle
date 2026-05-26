import { sql } from 'drizzle-orm'
import { boolean, check, index, jsonb, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'

export const uniauthUsers = pgTable('uniauth_users', {
  id: text('id').primaryKey(),
  displayName: text('display_name'),
  email: text('email'),
  phone: text('phone'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  disabledAt: timestamp('disabled_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
})

export const uniauthIdentities = pgTable(
  'uniauth_identities',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => uniauthUsers.id, { onDelete: 'restrict' }),
    provider: text('provider').notNull(),
    providerUserId: text('provider_user_id').notNull(),
    status: text('status').notNull(),
    email: text('email'),
    emailVerified: boolean('email_verified'),
    phone: text('phone'),
    phoneVerified: boolean('phone_verified'),
    trust: jsonb('trust').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  },
  (table) => [
    // noinspection SqlNoDataSourceInspection -- Drizzle validates this SQL fragment against generated columns at runtime.
    check('uniauth_identities_status_check', sql`${table.status} in ('active', 'disabled')`),
    unique('uniauth_identities_provider_user_key').on(table.provider, table.providerUserId),
    index('uniauth_identities_user_idx').on(table.userId),
    index('uniauth_identities_verified_email_idx')
      .on(table.email)
      .where(
        // noinspection SqlNoDataSourceInspection -- Drizzle validates this SQL fragment against generated columns at runtime.
        sql`${table.status} = 'active' and ${table.emailVerified} = true and ${table.email} is not null`,
      ),
    index('uniauth_identities_verified_phone_idx')
      .on(table.phone)
      .where(
        // noinspection SqlNoDataSourceInspection -- Drizzle validates this SQL fragment against generated columns at runtime.
        sql`${table.status} = 'active' and ${table.phoneVerified} = true and ${table.phone} is not null`,
      ),
  ],
)

export const uniauthCredentials = pgTable(
  'uniauth_credentials',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => uniauthUsers.id, { onDelete: 'restrict' }),
    type: text('type').notNull(),
    subject: text('subject').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  },
  (table) => [
    unique('uniauth_credentials_type_subject_key').on(table.type, table.subject),
    unique('uniauth_credentials_type_user_key').on(table.type, table.userId),
    index('uniauth_credentials_user_idx').on(table.userId),
  ],
)

export const uniauthVerifications = pgTable(
  'uniauth_verifications',
  {
    id: text('id').primaryKey(),
    purpose: text('purpose').notNull(),
    target: text('target').notNull(),
    provider: text('provider'),
    channel: text('channel'),
    secretHash: text('secret_hash').notNull(),
    status: text('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  },
  (table) => [
    check(
      'uniauth_verifications_status_check',
      // noinspection SqlNoDataSourceInspection -- Drizzle validates this SQL fragment against generated columns at runtime.
      sql`${table.status} in ('pending', 'consumed')`,
    ),
    index('uniauth_verifications_target_idx').on(table.target),
  ],
)

export const uniauthSessions = pgTable(
  'uniauth_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => uniauthUsers.id, { onDelete: 'restrict' }),
    tokenHash: text('token_hash').notNull().unique(),
    status: text('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  },
  (table) => [
    check(
      'uniauth_sessions_status_check',
      // noinspection SqlNoDataSourceInspection -- Drizzle validates this SQL fragment against generated columns at runtime.
      sql`${table.status} in ('active', 'revoked', 'expired')`,
    ),
    index('uniauth_sessions_user_idx').on(table.userId),
  ],
)

export const uniauthAuditEvents = pgTable(
  'uniauth_audit_events',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    userId: text('user_id'),
    identityId: text('identity_id'),
    sessionId: text('session_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  },
  (table) => [
    index('uniauth_audit_events_user_idx').on(table.userId),
    index('uniauth_audit_events_identity_idx').on(table.identityId),
    index('uniauth_audit_events_session_idx').on(table.sessionId),
    index('uniauth_audit_events_occurred_idx').on(table.occurredAt),
    index('uniauth_audit_events_type_occurred_idx').on(table.type, table.occurredAt.desc()),
  ],
)

// noinspection JSUnusedGlobalSymbols -- Public schema object is consumed by Drizzle database initialization.
export const uniauthDrizzleSchema = {
  uniauthAuditEvents,
  uniauthCredentials,
  uniauthIdentities,
  uniauthSessions,
  uniauthUsers,
  uniauthVerifications,
}
