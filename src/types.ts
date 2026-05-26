import type { AuthServiceRepositories, UnitOfWork } from '@alyldas/uniauth-core/contracts'

export interface DrizzleExecutor {
  select(): DrizzleSelectBuilder
  insert(table: unknown): DrizzleInsertBuilder
  update(table: unknown): DrizzleUpdateBuilder
  transaction?<T>(operation: (tx: DrizzleExecutor) => Promise<T>): Promise<T>
}

export interface DrizzleSelectBuilder extends PromiseLike<unknown[]> {
  from(table: unknown): DrizzleSelectBuilder
  where(condition: unknown): DrizzleSelectBuilder
  orderBy(...columns: unknown[]): DrizzleSelectBuilder
  limit(count: number): DrizzleSelectBuilder
  for?(lock: 'update'): DrizzleSelectBuilder
}

export interface DrizzleInsertBuilder extends PromiseLike<unknown[]> {
  values(value: unknown): DrizzleInsertBuilder
  returning(): Promise<unknown[]>
}

export interface DrizzleUpdateBuilder extends PromiseLike<unknown[]> {
  set(value: Record<string, unknown>): DrizzleUpdateBuilder
  where(condition: unknown): DrizzleUpdateBuilder
  returning(): Promise<unknown[]>
}

export interface CreateDrizzleAuthStoreOptions {
  readonly db: DrizzleExecutor
}

export interface DrizzleAuthStoreLike extends AuthServiceRepositories, UnitOfWork {}
