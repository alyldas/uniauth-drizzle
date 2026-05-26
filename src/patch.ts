export function buildPatch<Patch extends object>(
  patch: Patch,
  columns: Record<Extract<keyof Patch, string>, string>,
): Record<string, unknown> | undefined {
  const update: Record<string, unknown> = {}
  const patchRecord = patch as Record<string, unknown>

  for (const [patchKey, columnKey] of Object.entries(columns) as Array<[string, string]>) {
    if (Object.prototype.hasOwnProperty.call(patch, patchKey)) {
      update[columnKey] = patchRecord[patchKey] ?? null
    }
  }

  return Object.keys(update).length > 0 ? update : undefined
}
