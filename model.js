export const money = cents => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
export const localDay = value => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
export function parsePrice(value) {
  if (!/^-?\d{1,5}([.,]\d{1,2})?$/.test(value.trim())) throw new Error('Bitte einen gültigen Preis eingeben, z. B. 2,50 oder -2,00 für Pfandrückgaben.');
  const cents = Math.round(Number(value.replace(',', '.')) * 100);
  if (cents === 0) throw new Error('Der Preis darf nicht 0 sein.');
  return cents;
}
export function initialState() {
  return { version: 1, products: [
    ['cake','Kuchen','Essen',250,'🍰'], ['pretzel','Brezel','Essen',150,'🥨'],
    ['coffee','Kaffee','Getränke',200,'☕']
  ].map(([id,name,category,price,emoji]) => ({ id,name,category,price,emoji,active:true })), sales: [] };
}
export function total(lines) { return lines.reduce((sum, line) => sum + line.price * line.quantity, 0); }
export function makeSale(lines, id, timestamp) {
  if (!lines.length || lines.some(l => !Number.isInteger(l.quantity) || l.quantity < 1 || !Number.isInteger(l.price) || l.price === 0)) throw new Error('Der Warenkorb ist leer oder ungültig.');
  const items = lines.map(l => ({ ...l }));
  return { id, timestamp, items, total: total(items), cancelledAt: null };
}
export function statistics(sales, day = '', productId = '') {
  const matchingSales = sales.filter(s => !s.cancelledAt && (!day || localDay(s.timestamp) === day));
  const rows = new Map();
  let revenue = 0, quantity = 0, transactions = 0, income = 0, payouts = 0;
  let positiveTransactions = 0, negativeTransactions = 0, zeroTransactions = 0;
  for (const sale of matchingSales) {
    const items = sale.items.filter(i => !productId || i.id === productId);
    if (!items.length) continue;
    transactions++;
    const amount = total(items);
    if(amount>0){income+=amount;positiveTransactions++;}
    else if(amount<0){payouts-=amount;negativeTransactions++;}
    else zeroTransactions++;
    for (const item of items) {
      const row = rows.get(item.id) || { id: item.id, name: item.name, emoji: item.emoji, quantity: 0, revenue: 0 };
      row.quantity += item.quantity; row.revenue += item.quantity * item.price;
      revenue += item.quantity * item.price; quantity += item.quantity;
      rows.set(item.id, row);
    }
  }
  return { revenue, quantity, transactions, income, payouts, positiveTransactions, negativeTransactions, zeroTransactions,
    rows: [...rows.values()].sort((a,b) => b.revenue-a.revenue) };
}
export function validateState(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.products) || !Array.isArray(data.sales)) throw new Error('Das ist keine gültige Festkassen-Sicherung.');
  const validString = s => typeof s === 'string' && s.length > 0 && s.length <= 200;
  const validPrice = p => Number.isInteger(p) && p !== 0 && Math.abs(p) <= 9999999;
  const ids = new Set();
  for (const p of data.products) {
    if (!validString(p.id) || ids.has(p.id) || !validString(p.name) || !validString(p.category) || typeof p.emoji !== 'string' || !validPrice(p.price) || typeof p.active !== 'boolean') throw new Error('Ungültige Produkte in der Sicherung.');
    ids.add(p.id);
  }
  const saleIds = new Set();
  for (const s of data.sales) {
    if (!validString(s.id) || saleIds.has(s.id) || !Number.isFinite(Date.parse(s.timestamp)) || !Array.isArray(s.items) || !s.items.length || (s.cancelledAt !== null && !Number.isFinite(Date.parse(s.cancelledAt)))) throw new Error('Ungültige Verkäufe in der Sicherung.');
    saleIds.add(s.id);
    for (const i of s.items) if (!validString(i.id) || !validString(i.name) || typeof i.emoji !== 'string' || !validPrice(i.price) || !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 999) throw new Error('Ungültige Verkaufsposition.');
    if (s.total !== total(s.items)) throw new Error('Ungültiger Gesamtbetrag in der Sicherung.');
  }
  return data;
}
