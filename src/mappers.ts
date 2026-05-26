import {
  asAuditEventId,
  asCredentialId,
  asIdentityId,
  asSessionId,
  asUserId,
  asVerificationId,
  ProviderTrustLevel,
  type AuthIdentity,
  type AuditEvent,
  type AuthIdentityProvider,
  type Credential,
  type OtpChannel,
  type ProviderTrustContext,
  type Session,
  type User,
  type Verification,
} from '@alyldas/uniauth-core'
import type {
  uniauthAuditEvents,
  uniauthCredentials,
  uniauthIdentities,
  uniauthSessions,
  uniauthUsers,
  uniauthVerifications,
} from './schema.js'

type UserRow = typeof uniauthUsers.$inferSelect
type IdentityRow = typeof uniauthIdentities.$inferSelect
type CredentialRow = typeof uniauthCredentials.$inferSelect
type VerificationRow = typeof uniauthVerifications.$inferSelect
type SessionRow = typeof uniauthSessions.$inferSelect
type AuditEventRow = typeof uniauthAuditEvents.$inferSelect

export function mapUserRow(row: UserRow): User {
  return {
    id: asUserId(row.id),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...optionalProp('displayName', row.displayName),
    ...optionalProp('email', row.email),
    ...optionalProp('phone', row.phone),
    ...optionalProp('disabledAt', row.disabledAt),
    ...optionalProp('metadata', row.metadata),
  }
}

export function mapIdentityRow(row: IdentityRow): AuthIdentity {
  return {
    id: asIdentityId(row.id),
    userId: asUserId(row.userId),
    provider: row.provider,
    providerUserId: row.providerUserId,
    status: row.status as AuthIdentity['status'],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...optionalProp('email', row.email),
    ...optionalProp('emailVerified', row.emailVerified),
    ...optionalProp('phone', row.phone),
    ...optionalProp('phoneVerified', row.phoneVerified),
    ...optionalProp('trust', readProviderTrust(row.trust)),
    ...optionalProp('disabledAt', row.disabledAt),
    ...optionalProp('metadata', row.metadata),
  }
}

export function mapCredentialRow(row: CredentialRow): Credential {
  return {
    id: asCredentialId(row.id),
    userId: asUserId(row.userId),
    type: row.type as Credential['type'],
    subject: row.subject,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...optionalProp('metadata', row.metadata),
  }
}

export function mapVerificationRow(row: VerificationRow): Verification {
  return {
    id: asVerificationId(row.id),
    purpose: row.purpose,
    target: row.target,
    secretHash: row.secretHash,
    status: row.status as Verification['status'],
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    ...optionalProp('provider', row.provider as AuthIdentityProvider | null),
    ...optionalProp('channel', row.channel as OtpChannel | null),
    ...optionalProp('consumedAt', row.consumedAt),
    ...optionalProp('metadata', row.metadata),
  }
}

export function mapSessionRow(row: SessionRow): Session {
  return {
    id: asSessionId(row.id),
    userId: asUserId(row.userId),
    tokenHash: row.tokenHash,
    status: row.status as Session['status'],
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    ...optionalProp('revokedAt', row.revokedAt),
    ...optionalProp('lastSeenAt', row.lastSeenAt),
    ...optionalProp('metadata', row.metadata),
  }
}

export function mapAuditEventRow(row: AuditEventRow): AuditEvent {
  return {
    id: asAuditEventId(row.id),
    type: row.type as AuditEvent['type'],
    occurredAt: row.occurredAt,
    ...optionalProp('userId', row.userId ? asUserId(row.userId) : undefined),
    ...optionalProp('identityId', row.identityId ? asIdentityId(row.identityId) : undefined),
    ...optionalProp('sessionId', row.sessionId ? asSessionId(row.sessionId) : undefined),
    ...optionalProp('metadata', row.metadata),
  }
}

function readProviderTrust(
  value: Record<string, unknown> | null,
): ProviderTrustContext | undefined {
  if (!value) {
    return undefined
  }

  const level = readTrustLevel(value.level)

  if (!level) {
    throw new Error('Invalid provider trust payload returned from Drizzle.')
  }

  const signals = readTrustSignals(value.signals)

  return {
    level,
    ...optionalProp('signals', signals),
    ...optionalProp('metadata', readRecord(value.metadata)),
  }
}

function readTrustLevel(value: unknown): ProviderTrustLevel | undefined {
  if (value === ProviderTrustLevel.Trusted) {
    return ProviderTrustLevel.Trusted
  }

  if (value === ProviderTrustLevel.Neutral) {
    return ProviderTrustLevel.Neutral
  }

  if (value === ProviderTrustLevel.Untrusted) {
    return ProviderTrustLevel.Untrusted
  }

  return undefined
}

function readTrustSignals(value: unknown): readonly string[] | undefined {
  if (value === undefined) {
    return undefined
  }

  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error('Invalid provider trust signals returned from Drizzle.')
  }

  return value.length > 0
    ? [...new Set(value.map((entry) => entry.trim()).filter(Boolean))]
    : undefined
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined || value === null) {
    return undefined
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected a JSON object returned from Drizzle.')
  }

  return value as Record<string, unknown>
}

function optionalProp<Key extends string, Value>(
  key: Key,
  value: Value | null | undefined,
): { readonly [Property in Key]: Value } | Record<string, never> {
  return value === undefined || value === null
    ? {}
    : ({ [key]: value } as { readonly [Property in Key]: Value })
}
