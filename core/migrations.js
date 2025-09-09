// Hook for file imports so future schema changes don’t break you.
export function migrateImported(obj) {
  // example: bump version or fix missing fields
  const v = obj.version || 1;
  const out = { ...obj };

  if (v < 12) {
    // add missing fiber/salt fields, etc.
    out.library?.items?.forEach(it=>{
      it.per100.fiber ??= 0;
      it.per100.salt ??= 0;
    });
    out.version = 12;
  }

  return out;
}
