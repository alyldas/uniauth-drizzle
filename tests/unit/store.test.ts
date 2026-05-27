import { describe, expect, it } from 'vitest'
import {
  ProviderTrustLevel,
  UniAuthErrorCode,
  asCredentialId,
  asIdentityId,
  asSessionId,
  asUserId,
  asVerificationId,
} from '@alyldas/uniauth-core'
import { createDrizzleAuthStore } from '../../src/store.js'
import type {
  DrizzleExecutor,
  DrizzleInsertBuilder,
  DrizzleSelectBuilder,
  DrizzleUpdateBuilder,
} from '../../src/types.js'

type QueryStep =
  | {
      readonly kind: 'result'
      readonly rows?: readonly object[]
    }
  | {
      readonly kind: 'error'
      readonly error: unknown
    }

interface RecordedQuery {
  readonly executor: 'db' | 'tx'
  readonly action: 'select' | 'insert' | 'update'
  readonly lock?: 'update'
}

interface StubDbHarness {
  readonly calls: readonly RecordedQuery[]
  readonly db: DrizzleExecutor
  readonly remainingSteps: number
  readonly transactionCount: number
}

const date = new Date('2026-01-01T00:00:00.000Z')
const later = new Date('2026-01-01T00:01:00.000Z')

function result(rows: readonly object[] = []): QueryStep {
  return {
    kind: 'result',
    rows,
  }
}

function failure(error: unknown): QueryStep {
  return {
    kind: 'error',
    error,
  }
}

function createStubDb(steps: readonly QueryStep[], withTransaction = true): StubDbHarness {
  const queue = [...steps]
  const calls: RecordedQuery[] = []
  let transactionCount = 0

  const consume = (executor: 'db' | 'tx', action: RecordedQuery['action'], lock?: 'update') => {
    calls.push({ executor, action, ...(lock ? { lock } : {}) })
    const next = queue.shift()

    if (!next) {
      throw new Error(`Unexpected ${action} query.`)
    }

    if (next.kind === 'error') {
      throw next.error
    }

    return [...(next.rows ?? [])]
  }

  const createExecutor = (executor: 'db' | 'tx'): DrizzleExecutor => ({
    select: () => new SelectBuilder((lock) => consume(executor, 'select', lock)),
    insert: () => new InsertBuilder(() => consume(executor, 'insert')),
    update: () => new UpdateBuilder(() => consume(executor, 'update')),
    ...(withTransaction
      ? {
          transaction: async <T>(operation: (tx: DrizzleExecutor) => Promise<T>) => {
            transactionCount += 1
            return operation(createExecutor('tx'))
          },
        }
      : {}),
  })

  return {
    get calls() {
      return calls
    },
    db: createExecutor('db'),
    get remainingSteps() {
      return queue.length
    },
    get transactionCount() {
      return transactionCount
    },
  }
}

class SelectBuilder implements DrizzleSelectBuilder {
  private lock?: 'update'

  constructor(private readonly consume: (lock?: 'update') => object[]) {}

  from(): DrizzleSelectBuilder {
    return this
  }

  where(): DrizzleSelectBuilder {
    return this
  }

  orderBy(): DrizzleSelectBuilder {
    return this
  }

  limit(): DrizzleSelectBuilder {
    return this
  }

  for(lock: 'update'): DrizzleSelectBuilder {
    this.lock = lock
    return this
  }

  then<TResult1 = unknown[], TResult2 = never>(
    onfulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.consume(this.lock)).then(onfulfilled, onrejected)
  }
}

class InsertBuilder implements DrizzleInsertBuilder {
  constructor(private readonly consume: () => object[]) {}

  values(): DrizzleInsertBuilder {
    return this
  }

  async returning(): Promise<unknown[]> {
    return this.consume()
  }

  then<TResult1 = unknown[], TResult2 = never>(
    onfulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.returning().then(onfulfilled, onrejected)
  }
}

class UpdateBuilder implements DrizzleUpdateBuilder {
  constructor(private readonly consume: () => object[]) {}

  set(): DrizzleUpdateBuilder {
    return this
  }

  where(): DrizzleUpdateBuilder {
    return this
  }

  async returning(): Promise<unknown[]> {
    return this.consume()
  }

  then<TResult1 = unknown[], TResult2 = never>(
    onfulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.returning().then(onfulfilled, onrejected)
  }
}

function userRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'user-1',
    displayName: null,
    email: null,
    phone: null,
    createdAt: date,
    updatedAt: later,
    disabledAt: null,
    metadata: null,
    ...overrides,
  }
}

function identityRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'identity-1',
    userId: 'user-1',
    provider: 'oidc',
    providerUserId: 'provider-user-1',
    status: 'active',
    email: 'user@example.com',
    emailVerified: true,
    phone: null,
    phoneVerified: null,
    trust: null,
    createdAt: date,
    updatedAt: later,
    disabledAt: null,
    metadata: null,
    ...overrides,
  }
}

function credentialRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'credential-1',
    userId: 'user-1',
    type: 'password',
    subject: 'user@example.com',
    passwordHash: 'hashed-password',
    createdAt: date,
    updatedAt: later,
    metadata: null,
    ...overrides,
  }
}

function verificationRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'verification-1',
    purpose: 'sign-in',
    target: 'user@example.com',
    provider: null,
    channel: null,
    secretHash: 'hashed-secret',
    status: 'pending',
    createdAt: date,
    expiresAt: new Date('2026-01-01T00:10:00.000Z'),
    consumedAt: null,
    metadata: null,
    ...overrides,
  }
}

function sessionRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'session-1',
    userId: 'user-1',
    tokenHash: 'hashed-session-token',
    status: 'active',
    createdAt: date,
    expiresAt: new Date('2026-01-31T00:00:00.000Z'),
    revokedAt: null,
    lastSeenAt: null,
    metadata: null,
    ...overrides,
  }
}

describe('DrizzleAuthStore parity coverage', () => {
  it('maps row payloads into public entities', async () => {
    const harness = createStubDb([
      result([
        userRow({
          displayName: 'Alice',
          email: 'alice@example.com',
          phone: '+10000000000',
          disabledAt: new Date('2026-01-01T00:02:00.000Z'),
          metadata: { role: 'admin' },
        }),
      ]),
      result([
        identityRow({
          trust: {
            level: ProviderTrustLevel.Trusted,
            signals: [' device ', '', 'device', 'federated'],
            metadata: { source: 'oidc' },
          },
          phone: '+10000000000',
          phoneVerified: true,
          disabledAt: new Date('2026-01-01T00:03:00.000Z'),
          metadata: { state: 'seeded' },
        }),
      ]),
      result([
        {
          ...identityRow(),
          id: 'identity-2',
          providerUserId: 'provider-user-2',
          emailVerified: null,
          trust: {
            level: ProviderTrustLevel.Neutral,
            signals: [],
            metadata: null,
          },
        },
      ]),
      result([
        {
          ...identityRow(),
          id: 'identity-3',
          providerUserId: 'provider-user-3',
          trust: {
            level: ProviderTrustLevel.Untrusted,
          },
        },
      ]),
      result([
        {
          ...identityRow({
            id: 'identity-4',
            providerUserId: 'provider-user-4',
            phone: '+12223334444',
            phoneVerified: true,
          }),
          trust: null,
        },
      ]),
      result([
        {
          ...identityRow({
            id: 'identity-5',
            providerUserId: 'provider-user-5',
          }),
          trust: {
            level: ProviderTrustLevel.Trusted,
            metadata: null,
          },
        },
      ]),
      result([
        credentialRow({
          metadata: { source: 'import' },
        }),
      ]),
      result([
        verificationRow({
          provider: 'email-otp',
          channel: 'email',
          consumedAt: new Date('2026-01-01T00:05:00.000Z'),
          metadata: { attempt: 1 },
        }),
      ]),
      result([
        sessionRow({
          revokedAt: new Date('2026-01-01T00:06:00.000Z'),
          lastSeenAt: new Date('2026-01-01T00:07:00.000Z'),
        }),
      ]),
    ])
    const store = createDrizzleAuthStore({ db: harness.db })

    await expect(store.userRepo.findById(asUserId('user-1'))).resolves.toMatchObject({
      id: asUserId('user-1'),
      displayName: 'Alice',
      email: 'alice@example.com',
      phone: '+10000000000',
      metadata: { role: 'admin' },
    })
    await expect(store.identityRepo.findById(asIdentityId('identity-1'))).resolves.toMatchObject({
      id: asIdentityId('identity-1'),
      trust: {
        level: ProviderTrustLevel.Trusted,
        signals: ['device', 'federated'],
        metadata: { source: 'oidc' },
      },
      metadata: { state: 'seeded' },
    })
    await expect(
      store.identityRepo.findByProviderUserId('oidc', 'provider-user-2'),
    ).resolves.toMatchObject({
      id: asIdentityId('identity-2'),
      trust: { level: ProviderTrustLevel.Neutral },
    })
    await expect(store.identityRepo.findByVerifiedEmail('user@example.com')).resolves.toMatchObject(
      [
        {
          id: asIdentityId('identity-3'),
          trust: { level: ProviderTrustLevel.Untrusted },
        },
      ],
    )
    await expect(store.identityRepo.findByVerifiedPhone('+12223334444')).resolves.toMatchObject([
      {
        id: asIdentityId('identity-4'),
      },
    ])
    await expect(store.identityRepo.listByUserId(asUserId('user-1'))).resolves.toMatchObject([
      {
        id: asIdentityId('identity-5'),
        trust: { level: ProviderTrustLevel.Trusted },
      },
    ])
    await expect(
      store.credentialRepo.findPasswordByEmail('user@example.com'),
    ).resolves.toMatchObject({
      id: asCredentialId('credential-1'),
      metadata: { source: 'import' },
    })
    await expect(
      store.verificationRepo.findById(asVerificationId('verification-1')),
    ).resolves.toMatchObject({
      id: asVerificationId('verification-1'),
      provider: 'email-otp',
      channel: 'email',
      metadata: { attempt: 1 },
    })
    await expect(store.sessionRepo.findById(asSessionId('session-1'))).resolves.toMatchObject({
      id: asSessionId('session-1'),
      status: 'active',
    })

    expect(harness.remainingSteps).toBe(0)
  })

  it('maps write failures into UniAuth domain errors', async () => {
    const identityWriteError = new Error('identity write failed')
    const credentialWriteError = new Error('credential write failed')
    const sessionWriteError = new Error('session write failed')
    const harness = createStubDb([
      failure({ code: '23505' }),
      failure({ code: '23503' }),
      failure('identity-unknown'),
      result([identityRow()]),
      failure(identityWriteError),
      failure({ code: '23505' }),
      failure({ code: '23503' }),
      failure('credential-unknown'),
      result([credentialRow()]),
      failure(credentialWriteError),
      failure({ code: '23505' }),
      failure({ code: '23503' }),
      failure('session-unknown'),
      result([sessionRow()]),
      failure(sessionWriteError),
    ])
    const store = createDrizzleAuthStore({ db: harness.db })

    await expect(
      store.identityRepo.create({
        id: asIdentityId('identity-create-1'),
        userId: asUserId('user-1'),
        provider: 'oidc',
        providerUserId: 'provider-user-create-1',
        status: 'active',
        createdAt: date,
        updatedAt: date,
      }),
    ).rejects.toMatchObject({
      code: UniAuthErrorCode.IdentityAlreadyLinked,
    })
    await expect(
      store.identityRepo.create({
        id: asIdentityId('identity-create-fk'),
        userId: asUserId('missing-user'),
        provider: 'oidc',
        providerUserId: 'provider-user-create-fk',
        status: 'active',
        createdAt: date,
        updatedAt: date,
      }),
    ).rejects.toMatchObject({
      code: UniAuthErrorCode.UserNotFound,
    })
    await expect(
      store.identityRepo.create({
        id: asIdentityId('identity-create-2'),
        userId: asUserId('user-1'),
        provider: 'oidc',
        providerUserId: 'provider-user-create-2',
        status: 'active',
        createdAt: date,
        updatedAt: date,
      }),
    ).rejects.toThrow('Unknown Drizzle error.')
    await expect(
      store.identityRepo.update(asIdentityId('identity-1'), {
        providerUserId: 'updated-provider-user',
      }),
    ).rejects.toBe(identityWriteError)

    await expect(
      store.credentialRepo.create({
        id: asCredentialId('credential-create-1'),
        userId: asUserId('user-1'),
        type: 'password',
        subject: 'user@example.com',
        passwordHash: 'hash',
        createdAt: date,
        updatedAt: date,
      }),
    ).rejects.toMatchObject({
      code: UniAuthErrorCode.CredentialAlreadyExists,
    })
    await expect(
      store.credentialRepo.create({
        id: asCredentialId('credential-create-fk'),
        userId: asUserId('missing-user'),
        type: 'password',
        subject: 'missing-user@example.com',
        passwordHash: 'hash',
        createdAt: date,
        updatedAt: date,
      }),
    ).rejects.toMatchObject({
      code: UniAuthErrorCode.UserNotFound,
    })
    await expect(
      store.credentialRepo.create({
        id: asCredentialId('credential-create-2'),
        userId: asUserId('user-1'),
        type: 'password',
        subject: 'user@example.com',
        passwordHash: 'hash',
        createdAt: date,
        updatedAt: date,
      }),
    ).rejects.toThrow('Unknown Drizzle error.')
    await expect(
      store.credentialRepo.update(asCredentialId('credential-1'), { passwordHash: 'new-hash' }),
    ).rejects.toBe(credentialWriteError)

    await expect(
      store.sessionRepo.create({
        id: asSessionId('session-create-1'),
        userId: asUserId('user-1'),
        tokenHash: 'duplicate-token-hash',
        status: 'active',
        createdAt: date,
        expiresAt: new Date('2026-02-01T00:00:00.000Z'),
      }),
    ).rejects.toMatchObject({
      code: UniAuthErrorCode.InvalidInput,
    })
    await expect(
      store.sessionRepo.create({
        id: asSessionId('session-create-fk'),
        userId: asUserId('missing-user'),
        tokenHash: 'missing-user-token-hash',
        status: 'active',
        createdAt: date,
        expiresAt: new Date('2026-02-01T00:00:00.000Z'),
      }),
    ).rejects.toMatchObject({
      code: UniAuthErrorCode.UserNotFound,
    })
    await expect(
      store.sessionRepo.create({
        id: asSessionId('session-create-2'),
        userId: asUserId('user-1'),
        tokenHash: 'unknown-error-token-hash',
        status: 'active',
        createdAt: date,
        expiresAt: new Date('2026-02-01T00:00:00.000Z'),
      }),
    ).rejects.toThrow('Unknown Drizzle error.')
    await expect(
      store.sessionRepo.update(asSessionId('session-1'), { tokenHash: 'new-token-hash' }),
    ).rejects.toBe(sessionWriteError)

    expect(harness.remainingSteps).toBe(0)
  })

  it('guards missing rows, invalid trust payloads, and last identity unlink checks', async () => {
    const harness = createStubDb([
      result(),
      result([
        identityRow({
          trust: { level: 'invalid-trust-level' },
        }),
      ]),
      result([
        identityRow({
          trust: { level: ProviderTrustLevel.Trusted, signals: [1] },
        }),
      ]),
      result([
        identityRow({
          trust: { level: ProviderTrustLevel.Trusted, metadata: [] },
        }),
      ]),
      result([identityRow()]),
      result([]),
    ])
    const store = createDrizzleAuthStore({ db: harness.db })

    await expect(
      store.userRepo.create({
        id: asUserId('user-create-1'),
        createdAt: date,
        updatedAt: date,
      }),
    ).rejects.toThrow('Expected a database row to be returned.')
    await expect(store.identityRepo.findById(asIdentityId('identity-1'))).rejects.toThrow(
      'Invalid provider trust payload returned from Drizzle.',
    )
    await expect(store.identityRepo.findById(asIdentityId('identity-1'))).rejects.toThrow(
      'Invalid provider trust signals returned from Drizzle.',
    )
    await expect(store.identityRepo.findById(asIdentityId('identity-1'))).rejects.toThrow(
      'Expected a JSON object returned from Drizzle.',
    )
    await expect(
      store.identityRepo.disableForUserIfAnotherActive(
        asIdentityId('identity-1'),
        asUserId('user-1'),
        {
          status: 'disabled',
          disabledAt: later,
        },
      ),
    ).rejects.toMatchObject({
      code: UniAuthErrorCode.LastIdentity,
    })
    await expect(
      store.identityRepo.disableForUserIfAnotherActive(
        asIdentityId('missing'),
        asUserId('user-1'),
        {
          status: 'disabled',
          disabledAt: later,
        },
      ),
    ).rejects.toMatchObject({
      code: UniAuthErrorCode.IdentityNotFound,
    })

    expect(harness.calls.some((call) => call.lock === 'update')).toBe(true)
    expect(harness.remainingSteps).toBe(0)
  })

  it('runs transactional operations through the active Drizzle transaction', async () => {
    const harness = createStubDb([result([userRow({ id: 'transaction-user' })])])
    const store = createDrizzleAuthStore({ db: harness.db })

    await expect(
      store.run(async () => {
        await expect(store.userRepo.findById(asUserId('transaction-user'))).resolves.toMatchObject({
          id: asUserId('transaction-user'),
        })

        return store.run(async () => 'nested-ok')
      }),
    ).resolves.toBe('nested-ok')

    expect(harness.transactionCount).toBe(1)
    expect(harness.calls.map((call) => call.executor)).toEqual(['tx'])
    expect(harness.remainingSteps).toBe(0)
  })

  it('falls back to direct execution when the executor has no transaction support', async () => {
    const harness = createStubDb([result([userRow({ id: 'direct-user' })])], false)
    const store = createDrizzleAuthStore({ db: harness.db })

    await expect(
      store.run(() => store.userRepo.findById(asUserId('direct-user'))),
    ).resolves.toMatchObject({
      id: asUserId('direct-user'),
    })

    expect(harness.transactionCount).toBe(0)
    expect(harness.calls.map((call) => call.executor)).toEqual(['db'])
    expect(harness.remainingSteps).toBe(0)
  })
})
