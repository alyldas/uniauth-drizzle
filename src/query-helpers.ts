import type { DrizzleSelectBuilder } from './types.js'

export function first(result: unknown[]): Option {
  return {
    map: <Row, Result>(mapper: (row: Row) => Result) => {
      const row = result[0]
      return row ? mapper(row as Row) : undefined
    },
  }
}

interface Option {
  // The mapper owns the row shape because some Drizzle query builders erase rows to unknown[].
  map<Row, Result>(mapper: (row: Row) => Result): Result | undefined
}

export function rows<Row, Result>(
  result: unknown[],
  mapper: (row: Row) => Result,
): readonly Result[] {
  return result.map((row) => mapper(row as Row))
}

export function required<Row, Result>(result: unknown[], mapper: (row: Row) => Result): Result {
  const row = result[0]

  if (!row) {
    throw new Error('Expected a database row to be returned.')
  }

  return mapper(row as Row)
}

export async function forUpdate(query: DrizzleSelectBuilder): Promise<unknown[]> {
  const lockableQuery = typeof query.for === 'function' ? query.for('update') : query
  return lockableQuery as unknown as Promise<unknown[]>
}
