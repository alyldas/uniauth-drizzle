import { UniAuthError, UniAuthErrorCode } from '@alyldas/uniauth-core'

const UniqueViolationCode = '23505'
const ForeignKeyViolationCode = '23503'

export function mapIdentityWriteError(error: unknown): Error {
  if (hasDatabaseCode(error, ForeignKeyViolationCode)) {
    return new UniAuthError(UniAuthErrorCode.UserNotFound, 'User was not found.')
  }

  if (hasDatabaseCode(error, UniqueViolationCode)) {
    return new UniAuthError(UniAuthErrorCode.IdentityAlreadyLinked, 'Identity cannot be linked.')
  }

  return toError(error)
}

export function mapCredentialWriteError(error: unknown): Error {
  if (hasDatabaseCode(error, ForeignKeyViolationCode)) {
    return new UniAuthError(UniAuthErrorCode.UserNotFound, 'User was not found.')
  }

  if (hasDatabaseCode(error, UniqueViolationCode)) {
    return new UniAuthError(UniAuthErrorCode.CredentialAlreadyExists, 'Credential already exists.')
  }

  return toError(error)
}

export function mapSessionWriteError(error: unknown): Error {
  if (hasDatabaseCode(error, ForeignKeyViolationCode)) {
    return new UniAuthError(UniAuthErrorCode.UserNotFound, 'User was not found.')
  }

  if (hasDatabaseCode(error, UniqueViolationCode)) {
    return new UniAuthError(UniAuthErrorCode.InvalidInput, 'Session token already exists.')
  }

  return toError(error)
}

function hasDatabaseCode(error: unknown, code: string): boolean {
  if (typeof error !== 'object' || error === null) {
    return false
  }

  const candidate = error as { readonly code?: unknown; readonly cause?: unknown }

  if (candidate.code === code) {
    return true
  }

  return candidate.cause ? hasDatabaseCode(candidate.cause, code) : false
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Unknown Drizzle error.')
}
