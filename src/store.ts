import { AsyncLocalStorage } from 'node:async_hooks'
import type {
  AuditLogRepo,
  AuthServiceRepositories,
  CredentialRepo,
  IdentityRepo,
  SessionRepo,
  UnitOfWork,
  UserRepo,
  VerificationRepo,
} from '@alyldas/uniauth-core/contracts'
import {
  createAuditLogRepo,
  createCredentialRepo,
  createIdentityRepo,
  createSessionRepo,
  createUserRepo,
  createVerificationRepo,
} from './repositories.js'
import type {
  CreateDrizzleAuthStoreOptions,
  DrizzleAuthStoreLike,
  DrizzleExecutor,
} from './types.js'

export class DrizzleAuthStore implements DrizzleAuthStoreLike, AuthServiceRepositories, UnitOfWork {
  private readonly transactionScope = new AsyncLocalStorage<DrizzleExecutor>()

  constructor(private readonly options: CreateDrizzleAuthStoreOptions) {}

  readonly userRepo: UserRepo = createUserRepo(() => this.db)

  readonly identityRepo: IdentityRepo = createIdentityRepo(() => this.db)

  readonly credentialRepo: CredentialRepo = createCredentialRepo(() => this.db)

  readonly verificationRepo: VerificationRepo = createVerificationRepo(() => this.db)

  readonly sessionRepo: SessionRepo = createSessionRepo(() => this.db)

  readonly auditLogRepo: AuditLogRepo = createAuditLogRepo(() => this.db)

  // noinspection JSUnusedGlobalSymbols -- Required by the UnitOfWork public contract.
  async run<T>(operation: () => Promise<T>): Promise<T> {
    const activeTransaction = this.transactionScope.getStore()

    if (activeTransaction) {
      return operation()
    }

    if (!this.options.db.transaction) {
      return operation()
    }

    return this.options.db.transaction((tx) => this.transactionScope.run(tx, operation))
  }

  private get db(): DrizzleExecutor {
    return this.transactionScope.getStore() ?? this.options.db
  }
}

// noinspection JSUnusedGlobalSymbols -- Public package factory exported from src/index.ts.
export function createDrizzleAuthStore(options: CreateDrizzleAuthStoreOptions): DrizzleAuthStore {
  return new DrizzleAuthStore(options)
}
