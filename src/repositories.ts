import { and, asc, desc, eq, gt, isNull, lt, or, type SQL } from 'drizzle-orm'
import { UniAuthError, UniAuthErrorCode, type AuditEventQuery } from '@alyldas/uniauth-core'
import type {
  AuditLogRepo,
  CredentialRepo,
  IdentityRepo,
  SessionRepo,
  UserRepo,
  VerificationRepo,
} from '@alyldas/uniauth-core/contracts'
import { mapCredentialWriteError, mapIdentityWriteError, mapSessionWriteError } from './errors.js'
import {
  mapAuditEventRow,
  mapCredentialRow,
  mapIdentityRow,
  mapSessionRow,
  mapUserRow,
  mapVerificationRow,
} from './mappers.js'
import { buildPatch } from './patch.js'
import { first, forUpdate, required, rows } from './query-helpers.js'
import {
  uniauthAuditEvents,
  uniauthCredentials,
  uniauthIdentities,
  uniauthSessions,
  uniauthUsers,
  uniauthVerifications,
} from './schema.js'
import type { DrizzleExecutor } from './types.js'

type GetDb = () => DrizzleExecutor

export function createUserRepo(getDb: GetDb): UserRepo {
  const findById: UserRepo['findById'] = async (id) =>
    first(await getDb().select().from(uniauthUsers).where(eq(uniauthUsers.id, id))).map(mapUserRow)

  return {
    findById,
    create: async (user) =>
      required(
        await getDb()
          .insert(uniauthUsers)
          .values({
            id: user.id,
            displayName: user.displayName ?? null,
            email: user.email ?? null,
            phone: user.phone ?? null,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            disabledAt: user.disabledAt ?? null,
            metadata: user.metadata ?? null,
          })
          .returning(),
        mapUserRow,
      ),
    update: async (id, patch) => {
      const existing = await findById(id)

      if (!existing) {
        throw new UniAuthError(UniAuthErrorCode.UserNotFound, 'User was not found.')
      }

      const update = buildPatch(patch, {
        displayName: 'displayName',
        email: 'email',
        phone: 'phone',
        updatedAt: 'updatedAt',
        disabledAt: 'disabledAt',
        metadata: 'metadata',
      })

      if (!update) {
        return existing
      }

      return required(
        await getDb().update(uniauthUsers).set(update).where(eq(uniauthUsers.id, id)).returning(),
        mapUserRow,
      )
    },
  }
}

export function createIdentityRepo(getDb: GetDb): IdentityRepo {
  const findById: IdentityRepo['findById'] = async (id) =>
    first(await getDb().select().from(uniauthIdentities).where(eq(uniauthIdentities.id, id))).map(
      mapIdentityRow,
    )

  const update: IdentityRepo['update'] = async (id, patch) => {
    const existing = await findById(id)

    if (!existing) {
      throw new UniAuthError(UniAuthErrorCode.IdentityNotFound, 'Identity was not found.')
    }

    const updatePatch = buildPatch(patch, {
      userId: 'userId',
      provider: 'provider',
      providerUserId: 'providerUserId',
      status: 'status',
      email: 'email',
      emailVerified: 'emailVerified',
      phone: 'phone',
      phoneVerified: 'phoneVerified',
      trust: 'trust',
      updatedAt: 'updatedAt',
      disabledAt: 'disabledAt',
      metadata: 'metadata',
    })

    if (!updatePatch) {
      return existing
    }

    try {
      return required(
        await getDb()
          .update(uniauthIdentities)
          .set(updatePatch)
          .where(eq(uniauthIdentities.id, id))
          .returning(),
        mapIdentityRow,
      )
    } catch (error) {
      throw mapIdentityWriteError(error)
    }
  }

  return {
    findById,
    findByProviderUserId: async (provider, providerUserId) =>
      first(
        await getDb()
          .select()
          .from(uniauthIdentities)
          .where(
            and(
              eq(uniauthIdentities.provider, provider),
              eq(uniauthIdentities.providerUserId, providerUserId),
            ),
          ),
      ).map(mapIdentityRow),
    findByVerifiedEmail: async (email) =>
      rows(
        await getDb()
          .select()
          .from(uniauthIdentities)
          .where(
            and(
              eq(uniauthIdentities.status, 'active'),
              eq(uniauthIdentities.emailVerified, true),
              eq(uniauthIdentities.email, email),
            ),
          )
          .orderBy(asc(uniauthIdentities.createdAt), asc(uniauthIdentities.id)),
        mapIdentityRow,
      ),
    findByVerifiedPhone: async (phone) =>
      rows(
        await getDb()
          .select()
          .from(uniauthIdentities)
          .where(
            and(
              eq(uniauthIdentities.status, 'active'),
              eq(uniauthIdentities.phoneVerified, true),
              eq(uniauthIdentities.phone, phone),
            ),
          )
          .orderBy(asc(uniauthIdentities.createdAt), asc(uniauthIdentities.id)),
        mapIdentityRow,
      ),
    listByUserId: async (userId) =>
      rows(
        await getDb()
          .select()
          .from(uniauthIdentities)
          .where(eq(uniauthIdentities.userId, userId))
          .orderBy(asc(uniauthIdentities.createdAt), asc(uniauthIdentities.id)),
        mapIdentityRow,
      ),
    create: async (identity) => {
      try {
        return required(
          await getDb()
            .insert(uniauthIdentities)
            .values({
              id: identity.id,
              userId: identity.userId,
              provider: identity.provider,
              providerUserId: identity.providerUserId,
              status: identity.status,
              email: identity.email ?? null,
              emailVerified: identity.emailVerified ?? null,
              phone: identity.phone ?? null,
              phoneVerified: identity.phoneVerified ?? null,
              trust: identity.trust ?? null,
              createdAt: identity.createdAt,
              updatedAt: identity.updatedAt,
              disabledAt: identity.disabledAt ?? null,
              metadata: identity.metadata ?? null,
            })
            .returning(),
          mapIdentityRow,
        )
      } catch (error) {
        throw mapIdentityWriteError(error)
      }
    },
    update,
    disableForUserIfAnotherActive: async (id, userId, patch) => {
      const query = getDb()
        .select()
        .from(uniauthIdentities)
        .where(
          and(
            eq(uniauthIdentities.userId, userId),
            eq(uniauthIdentities.status, 'active'),
            isNull(uniauthIdentities.disabledAt),
          ),
        )
        .orderBy(asc(uniauthIdentities.createdAt), asc(uniauthIdentities.id))
      const activeIdentities = rows(await forUpdate(query), mapIdentityRow)
      const target = activeIdentities.find((identity) => identity.id === id)

      if (!target) {
        throw new UniAuthError(UniAuthErrorCode.IdentityNotFound, 'Identity was not found.')
      }

      if (activeIdentities.length <= 1) {
        throw new UniAuthError(
          UniAuthErrorCode.LastIdentity,
          'Cannot unlink the last active identity.',
        )
      }

      return update(id, patch)
    },
  }
}

export function createCredentialRepo(getDb: GetDb): CredentialRepo {
  return {
    findPasswordByEmail: async (email) =>
      first(
        await getDb()
          .select()
          .from(uniauthCredentials)
          .where(
            and(eq(uniauthCredentials.type, 'password'), eq(uniauthCredentials.subject, email)),
          ),
      ).map(mapCredentialRow),
    findPasswordByUserId: async (userId) =>
      first(
        await getDb()
          .select()
          .from(uniauthCredentials)
          .where(
            and(eq(uniauthCredentials.type, 'password'), eq(uniauthCredentials.userId, userId)),
          ),
      ).map(mapCredentialRow),
    listByUserId: async (userId) =>
      rows(
        await getDb()
          .select()
          .from(uniauthCredentials)
          .where(eq(uniauthCredentials.userId, userId))
          .orderBy(asc(uniauthCredentials.createdAt), asc(uniauthCredentials.id)),
        mapCredentialRow,
      ),
    create: async (credential) => {
      try {
        return required(
          await getDb()
            .insert(uniauthCredentials)
            .values({
              id: credential.id,
              userId: credential.userId,
              type: credential.type,
              subject: credential.subject,
              passwordHash: credential.passwordHash,
              createdAt: credential.createdAt,
              updatedAt: credential.updatedAt,
              metadata: credential.metadata ?? null,
            })
            .returning(),
          mapCredentialRow,
        )
      } catch (error) {
        throw mapCredentialWriteError(error)
      }
    },
    update: async (id, patch) => {
      const existing = first(
        await getDb().select().from(uniauthCredentials).where(eq(uniauthCredentials.id, id)),
      ).map(mapCredentialRow)

      if (!existing) {
        throw new UniAuthError(UniAuthErrorCode.CredentialNotFound, 'Credential was not found.')
      }

      const update = buildPatch(patch, {
        userId: 'userId',
        subject: 'subject',
        passwordHash: 'passwordHash',
        updatedAt: 'updatedAt',
        metadata: 'metadata',
      })

      if (!update) {
        return existing
      }

      try {
        return required(
          await getDb()
            .update(uniauthCredentials)
            .set(update)
            .where(eq(uniauthCredentials.id, id))
            .returning(),
          mapCredentialRow,
        )
      } catch (error) {
        throw mapCredentialWriteError(error)
      }
    },
  }
}

export function createVerificationRepo(getDb: GetDb): VerificationRepo {
  const findById: VerificationRepo['findById'] = async (id) =>
    first(
      await getDb().select().from(uniauthVerifications).where(eq(uniauthVerifications.id, id)),
    ).map(mapVerificationRow)

  return {
    findById,
    findByIdForUpdate: async (id) =>
      first(
        await forUpdate(
          getDb().select().from(uniauthVerifications).where(eq(uniauthVerifications.id, id)),
        ),
      ).map(mapVerificationRow),
    create: async (verification) =>
      required(
        await getDb()
          .insert(uniauthVerifications)
          .values({
            id: verification.id,
            purpose: verification.purpose,
            target: verification.target,
            provider: verification.provider ?? null,
            channel: verification.channel ?? null,
            secretHash: verification.secretHash,
            status: verification.status,
            createdAt: verification.createdAt,
            expiresAt: verification.expiresAt,
            consumedAt: verification.consumedAt ?? null,
            metadata: verification.metadata ?? null,
          })
          .returning(),
        mapVerificationRow,
      ),
    update: async (id, patch) => {
      const existing = await findById(id)

      if (!existing) {
        throw new UniAuthError(UniAuthErrorCode.VerificationNotFound, 'Verification was not found.')
      }

      const update = buildPatch(patch, {
        purpose: 'purpose',
        target: 'target',
        provider: 'provider',
        channel: 'channel',
        secretHash: 'secretHash',
        status: 'status',
        expiresAt: 'expiresAt',
        consumedAt: 'consumedAt',
        metadata: 'metadata',
      })

      if (!update) {
        return existing
      }

      return required(
        await getDb()
          .update(uniauthVerifications)
          .set(update)
          .where(eq(uniauthVerifications.id, id))
          .returning(),
        mapVerificationRow,
      )
    },
  }
}

export function createSessionRepo(getDb: GetDb): SessionRepo {
  const findById: SessionRepo['findById'] = async (id) =>
    first(await getDb().select().from(uniauthSessions).where(eq(uniauthSessions.id, id))).map(
      mapSessionRow,
    )

  return {
    findById,
    findByTokenHash: async (tokenHash) =>
      first(
        await getDb()
          .select()
          .from(uniauthSessions)
          .where(eq(uniauthSessions.tokenHash, tokenHash)),
      ).map(mapSessionRow),
    listByUserId: async (userId) =>
      rows(
        await getDb()
          .select()
          .from(uniauthSessions)
          .where(eq(uniauthSessions.userId, userId))
          .orderBy(asc(uniauthSessions.createdAt), asc(uniauthSessions.id)),
        mapSessionRow,
      ),
    create: async (session) => {
      try {
        return required(
          await getDb()
            .insert(uniauthSessions)
            .values({
              id: session.id,
              userId: session.userId,
              tokenHash: session.tokenHash,
              status: session.status,
              createdAt: session.createdAt,
              expiresAt: session.expiresAt,
              revokedAt: session.revokedAt ?? null,
              lastSeenAt: session.lastSeenAt ?? null,
              metadata: session.metadata ?? null,
            })
            .returning(),
          mapSessionRow,
        )
      } catch (error) {
        throw mapSessionWriteError(error)
      }
    },
    update: async (id, patch) => {
      const existing = await findById(id)

      if (!existing) {
        throw new UniAuthError(UniAuthErrorCode.SessionNotFound, 'Session was not found.')
      }

      const update = buildPatch(patch, {
        userId: 'userId',
        tokenHash: 'tokenHash',
        status: 'status',
        expiresAt: 'expiresAt',
        revokedAt: 'revokedAt',
        lastSeenAt: 'lastSeenAt',
        metadata: 'metadata',
      })

      if (!update) {
        return existing
      }

      try {
        return required(
          await getDb()
            .update(uniauthSessions)
            .set(update)
            .where(eq(uniauthSessions.id, id))
            .returning(),
          mapSessionRow,
        )
      } catch (error) {
        throw mapSessionWriteError(error)
      }
    },
  }
}

export function createAuditLogRepo(getDb: GetDb): AuditLogRepo {
  return {
    append: async (event) => {
      await getDb()
        .insert(uniauthAuditEvents)
        .values({
          id: event.id,
          type: event.type,
          occurredAt: event.occurredAt,
          userId: event.userId ?? null,
          identityId: event.identityId ?? null,
          sessionId: event.sessionId ?? null,
          metadata: event.metadata ?? null,
        })
    },
    list: async (input: AuditEventQuery = {}) => {
      const filters: SQL[] = []

      if (input.userId) {
        filters.push(eq(uniauthAuditEvents.userId, input.userId))
      }

      if (input.identityId) {
        filters.push(eq(uniauthAuditEvents.identityId, input.identityId))
      }

      if (input.sessionId) {
        filters.push(eq(uniauthAuditEvents.sessionId, input.sessionId))
      }

      if (input.type) {
        filters.push(eq(uniauthAuditEvents.type, input.type))
      }

      if (input.before) {
        filters.push(
          or(
            lt(uniauthAuditEvents.occurredAt, input.before.occurredAt),
            and(
              eq(uniauthAuditEvents.occurredAt, input.before.occurredAt),
              lt(uniauthAuditEvents.id, input.before.id),
            ),
          )!,
        )
      }

      if (input.after) {
        filters.push(
          or(
            gt(uniauthAuditEvents.occurredAt, input.after.occurredAt),
            and(
              eq(uniauthAuditEvents.occurredAt, input.after.occurredAt),
              gt(uniauthAuditEvents.id, input.after.id),
            ),
          )!,
        )
      }

      let query = getDb()
        .select()
        .from(uniauthAuditEvents)
        .where(filters.length > 0 ? and(...filters) : undefined)
        .orderBy(desc(uniauthAuditEvents.occurredAt), desc(uniauthAuditEvents.id))

      if (input.limit !== undefined) {
        query = query.limit(input.limit)
      }

      return rows(await query, mapAuditEventRow)
    },
  }
}
