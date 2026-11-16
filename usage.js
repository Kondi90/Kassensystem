const validBytes = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function formatBytes(value) {
  if (!validBytes(value)) return 'Nicht verfügbar';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let amount = value, unit = 0;
  while (amount >= 1000 && unit < units.length - 1) { amount /= 1000; unit++; }
  return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: unit ? 2 : 0 }).format(amount)} ${units[unit]}`;
}

export function summarizeData(state) {
  const cancelled = state.sales.filter(sale => sale.cancelledAt).length;
  return {
    bookings: state.sales.length,
    cancelled,
    active: state.sales.length - cancelled,
    // Same serialization as the actual backup download; not a claim about IDB's on-disk overhead.
    backupBytes: new TextEncoder().encode(JSON.stringify(state, null, 2)).byteLength
  };
}

export async function estimateStorage(storage) {
  try {
    if(storage===undefined)storage=globalThis.navigator?.storage;
    if (typeof storage?.estimate !== 'function') return { usage: null, quota: null };
    const result = await storage.estimate();
    return { usage: validBytes(result?.usage) ? result.usage : null,
      quota: validBytes(result?.quota) && result.quota > 0 ? result.quota : null };
  } catch { return { usage: null, quota: null }; }
}
