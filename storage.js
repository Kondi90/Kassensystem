import { initialState, validateState } from './model.js';
import { makePinRecord, matchesPin, validatePinRecord } from './pin.js';

export const LEGACY_KEY = 'montessori-festkasse-v1';
export const DATABASE_NAME = 'montessori-festkasse';
const STORES = ['products', 'sales', 'metadata'];

// No browser dependency is evaluated until initialization; tests can supply their own IDB factory.
export function createStorage({
  indexedDB = globalThis.indexedDB,
  name = DATABASE_NAME,
  readLegacy = () => globalThis.localStorage.getItem(LEGACY_KEY),
  now = () => Date.now()
} = {}) {
  let connection, opening, initializing;

  function open() {
    if (connection) return Promise.resolve(connection);
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      if (!indexedDB) { reject(new Error('Dieser Browser stellt keine lokale Datenbank bereit.')); return; }
      let blocked = false;
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('products', { keyPath: 'id' });
        const sales = db.createObjectStore('sales', { keyPath: 'id' });
        sales.createIndex('timestamp', 'timestamp');
        db.createObjectStore('metadata', { keyPath: 'key' });
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => {
        blocked = true;
        reject(new Error('Bitte andere Kassenfenster schließen und die Kasse neu öffnen.'));
      };
      request.onsuccess = () => {
        const db = request.result;
        if (blocked) { db.close(); return; }
        connection = db;
        db.onversionchange = () => { db.close(); connection = null; opening = null; };
        db.onclose = () => { connection = null; opening = null; initializing = null; };
        resolve(db);
      };
    }).catch(error => { opening = null; throw error; });
    return opening;
  }

  async function transaction(mode, action) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES, mode);
      let result, failure;
      const abort = error => { failure = error; tx.abort(); };
      // Catch exceptions in asynchronous IDB callbacks and roll back the whole write.
      const guard = callback => event => {
        try { callback(event); } catch (error) { abort(error); }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure || tx.error || new Error('Die Datenbank konnte die Änderung nicht speichern.'));
      try { action(tx, value => { result = value; }, guard); }
      catch (error) { abort(error); }
    });
  }

  function putSnapshot(tx, data) {
    const products = tx.objectStore('products'), sales = tx.objectStore('sales');
    products.clear(); sales.clear();
    for (const product of data.products) products.add(product);
    for (const sale of data.sales) sales.add(sale);
    tx.objectStore('metadata').put({ key: 'state', version: 1, initialized: true, productOrder: data.products.map(p => p.id) });
  }

  function initialize() {
    if (!initializing) {
      initializing = transaction('readwrite', (tx, done, guard) => {
        const request = tx.objectStore('metadata').get('state');
        request.onsuccess = guard(() => {
          if (request.result?.initialized) return;
          // Validate legacy data before any clear/write. Keep the old snapshot untouched as a fallback.
          const raw = readLegacy();
          const snapshot = validateState(raw === null ? initialState() : JSON.parse(raw));
          putSnapshot(tx, snapshot);
          done({ migrated: raw !== null });
        });
      }).catch(error => { initializing = null; throw error; });
    }
    return initializing;
  }

  async function read() {
    await initialize();
    return transaction('readonly', (tx, done, guard) => {
      let products, sales, metadata;
      const finish = () => {
        if (!products || !sales || !metadata) return;
        const byId = new Map(products.map(p => [p.id, p]));
        const ordered = metadata.productOrder.map(id => byId.get(id)).filter(Boolean);
        const known = new Set(metadata.productOrder);
        ordered.push(...products.filter(p => !known.has(p.id)));
        done(validateState({ version: 1, products: ordered, sales }));
      };
      const p = tx.objectStore('products').getAll();
      p.onsuccess = guard(() => { products = p.result; finish(); });
      const s = tx.objectStore('sales').index('timestamp').getAll();
      s.onsuccess = guard(() => { sales = s.result; finish(); });
      const m = tx.objectStore('metadata').get('state');
      m.onsuccess = guard(() => {
        metadata = m.result;
        if (!metadata?.initialized || !Array.isArray(metadata.productOrder)) throw new Error('Die Datenbank ist unvollständig. Vorhandene Daten wurden nicht überschrieben.');
        finish();
      });
    });
  }

  async function addSale(sale) {
    validateState({ version: 1, products: [], sales: [sale] });
    const copy = structuredClone(sale);
    await initialize();
    // add (rather than put) prevents booking the same sale ID twice.
    await transaction('readwrite', tx => tx.objectStore('sales').add(copy));
  }

  async function saveProduct(product, { requireExisting = false } = {}) {
    const copy = structuredClone(product);
    validateState({ version: 1, products: [{ ...copy, category: copy.category || 'Sonstiges' }], sales: [] });
    await initialize();
    await transaction('readwrite', (tx, done, guard) => {
      const products = tx.objectStore('products');
      const existing = products.get(copy.id);
      existing.onsuccess = guard(() => {
        if(requireExisting && !existing.result)throw new Error('Dieses Produkt wurde inzwischen gelöscht. Bitte die Produktliste neu öffnen.');
        products.put({ ...existing.result, ...copy, category: existing.result?.category || copy.category || 'Sonstiges' });
        if (!existing.result) {
          const meta = tx.objectStore('metadata').get('state');
          meta.onsuccess = guard(() => {
            meta.result.productOrder.push(copy.id);
            tx.objectStore('metadata').put(meta.result);
          });
        }
      });
    });
  }

  async function moveProduct(id, direction) {
    if(typeof id!=='string'||!id||![-1,1].includes(direction))throw new Error('Ungültige Produktverschiebung.');
    await initialize();
    return transaction('readwrite',(tx,done,guard)=>{
      const metadata=tx.objectStore('metadata'),request=metadata.get('state');
      request.onsuccess=guard(()=>{
        const products=tx.objectStore('products').getAll();
        products.onsuccess=guard(()=>{
          const ids=new Set(products.result.map(product=>product.id));
          const order=request.result.productOrder.filter(productId=>ids.has(productId));
          const known=new Set(order);
          order.push(...products.result.filter(product=>!known.has(product.id)).map(product=>product.id));
          const index=order.indexOf(id),target=index+direction;
          if(index<0)throw new Error('Dieses Produkt wurde inzwischen gelöscht. Bitte die Produktliste neu öffnen.');
          if(target<0||target>=order.length){done(false);return;}
          [order[index],order[target]]=[order[target],order[index]];
          metadata.put({...request.result,productOrder:order});done(true);
        });
      });
    });
  }

  async function deleteProduct(id) {
    if(typeof id!=='string'||!id)throw new Error('Ungültiges Produkt.');
    await initialize();
    await transaction('readwrite',(tx,done,guard)=>{
      tx.objectStore('products').delete(id);
      const request=tx.objectStore('metadata').get('state');
      request.onsuccess=guard(()=>{
        tx.objectStore('metadata').put({...request.result,productOrder:request.result.productOrder.filter(productId=>productId!==id)});
      });
    });
  }

  async function cancelSale(id, timestamp = new Date().toISOString()) {
    if (!Number.isFinite(Date.parse(timestamp))) throw new Error('Ungültiger Stornozeitpunkt.');
    await initialize();
    await transaction('readwrite', (tx, done, guard) => {
      const store = tx.objectStore('sales'), request = store.get(id);
      request.onsuccess = guard(() => {
        if (!request.result) throw new Error('Diese Buchung wurde nicht gefunden. Bitte die Statistik neu öffnen.');
        if (!request.result.cancelledAt) store.put({ ...request.result, cancelledAt: timestamp });
      });
    });
  }

  async function readAdmin() {
    await initialize();
    return transaction('readonly', (tx, done, guard) => {
      const request = tx.objectStore('metadata').get('admin');
      request.onsuccess = guard(() => done(validatePinRecord(request.result)));
    });
  }

  async function adminStatus() {
    const record = await readAdmin();
    return { configured: !!record, lockedUntil: record?.lockedUntil || 0 };
  }

  function lockedMessage(until) {
    return `Zu viele falsche PIN-Eingaben. Bitte in ${Math.max(1, Math.ceil((until - now()) / 1000))} Sekunden erneut versuchen.`;
  }

  async function protectedWrite(pin, action, allowUnconfigured = false) {
    const expected = await readAdmin();
    if (!expected && !allowUnconfigured) throw new Error('Bitte zuerst eine Admin-PIN unter Einstellungen festlegen.');
    if (expected?.lockedUntil > now()) throw new Error(lockedMessage(expected.lockedUntil));
    // Derivation must happen outside an IDB transaction; awaiting crypto would let that transaction expire.
    const matches = expected ? await matchesPin(pin, expected) : true;
    const result = await transaction('readwrite', (tx, done, guard) => {
      const metadata = tx.objectStore('metadata'), request = metadata.get('admin');
      request.onsuccess = guard(() => {
        const current = validatePinRecord(request.result);
        if (!!current !== !!expected || (current && (current.credentialId !== expected.credentialId || current.revision !== expected.revision))) {
          throw new Error('Die PIN-Einstellungen wurden in einem anderen Fenster geändert. Bitte erneut versuchen.');
        }
        if (current?.lockedUntil > now()) throw new Error(lockedMessage(current.lockedUntil));
        if (!matches) {
          const attempts = (current.lockedUntil && current.lockedUntil <= now() ? 0 : current.failedAttempts) + 1;
          const lockedUntil = attempts >= 5 ? now() + 60000 : 0;
          metadata.put({ ...current, revision: current.revision + 1, failedAttempts: attempts, lockedUntil });
          done({ error: lockedUntil ? lockedMessage(lockedUntil) : 'Die Admin-PIN ist falsch.' });
          return; // Commit the attempt counter without changing products or bookings.
        }
        if (current) metadata.put({ ...current, revision: current.revision + 1, failedAttempts: 0, lockedUntil: 0 });
        action(tx);
        done({ success: true });
      });
    });
    if (result.error) throw new Error(result.error);
  }

  async function setAdminPin(newPin, currentPin) {
    const record = await makePinRecord(newPin);
    await protectedWrite(currentPin, tx => tx.objectStore('metadata').put(record), true);
  }

  async function resetBookings(pin) {
    await protectedWrite(pin, tx => tx.objectStore('sales').clear());
  }

  async function resetAll(pin) {
    // putSnapshot only replaces products, sales and their order. The separate admin record remains intact.
    await protectedWrite(pin, tx => putSnapshot(tx, initialState()));
  }

  async function restore(data, pin) {
    const copy = structuredClone(validateState(data));
    await protectedWrite(pin, tx => putSnapshot(tx, copy), true);
  }

  function close() {
    connection?.close(); connection = null; opening = null; initializing = null;
  }

  return { initialize, read, addSale, saveProduct, moveProduct, deleteProduct, cancelSale, restore, adminStatus, setAdminPin, resetBookings, resetAll, close };
}
