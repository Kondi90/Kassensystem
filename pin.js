const ITERATIONS = 600000;
export const validPin = pin => typeof pin === 'string' && /^\d{6,12}$/.test(pin);
const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
const bytes = text => Uint8Array.from(text.match(/../g), pair => parseInt(pair, 16));

function webCrypto() {
  if (!globalThis.crypto?.subtle) throw new Error('Die PIN-Funktion benötigt HTTPS oder die lokale Vorschau auf diesem Rechner.');
  return globalThis.crypto;
}

async function derive(pin, salt) {
  const crypto = webCrypto();
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS, salt }, key, 256));
}

export function validatePinRecord(record) {
  if (!record) return null;
  if (record.version !== 1 || record.iterations !== ITERATIONS || !/^[a-f0-9]{32}$/.test(record.salt) || !/^[a-f0-9]{64}$/.test(record.hash) ||
      typeof record.credentialId !== 'string' || !Number.isSafeInteger(record.revision) || record.revision < 0 ||
      !Number.isSafeInteger(record.failedAttempts) || record.failedAttempts < 0 || !Number.isSafeInteger(record.lockedUntil) || record.lockedUntil < 0) {
    throw new Error('Die PIN-Einstellungen sind beschädigt. Die geschützte Aktion wurde gesperrt.');
  }
  return record;
}

export async function makePinRecord(pin) {
  if (!validPin(pin)) throw new Error('Die Admin-PIN muss aus 6 bis 12 Ziffern bestehen.');
  const crypto = webCrypto(), salt = crypto.getRandomValues(new Uint8Array(16));
  return { key: 'admin', version: 1, iterations: ITERATIONS, salt: hex(salt), hash: hex(await derive(pin, salt)),
    credentialId: crypto.randomUUID(), revision: 0, failedAttempts: 0, lockedUntil: 0 };
}

export async function matchesPin(pin, record) {
  validatePinRecord(record);
  if (!validPin(pin) || !record) return false;
  const actual = await derive(pin, bytes(record.salt)), expected = bytes(record.hash);
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected[i] ^ actual[i];
  return difference === 0;
}
