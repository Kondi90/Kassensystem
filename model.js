export const money = cents => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
export const productColors = [
  {id:'default',label:'Weiß',background:'#ffffff'},
  {id:'grey',label:'Silber',background:'#c9cfd7'},
  {id:'gold',label:'Gold',background:'#edc264'},
  {id:'yellow',label:'Gelb',background:'#ffe07a'},
  {id:'orange',label:'Orange',background:'#ffc58a'},
  {id:'coral',label:'Koralle',background:'#f5a37d'},
  {id:'red',label:'Rot',background:'#f5aca7'},
  {id:'pink',label:'Rosa',background:'#f2b5cf'},
  {id:'green',label:'Grün',background:'#b9dc98'},
  {id:'lime',label:'Limette',background:'#d3e875'},
  {id:'mint',label:'Mint',background:'#a6ddaf'},
  {id:'teal',label:'Türkis',background:'#98dcd0'},
  {id:'blue',label:'Blau',background:'#afcef8'},
  {id:'sky',label:'Hellblau',background:'#93dbe9'},
  {id:'purple',label:'Lila',background:'#d1b6ed'},
  {id:'berry',label:'Beere',background:'#dca4c4'}
];
export const getProductColor = id => productColors.find(color=>color.id===id) || productColors[0];
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
function parseTendered(given) {
  if(typeof given!=='string')throw new Error('Bitte den erhaltenen Betrag korrigieren oder die Eingabe leeren.');
  const text=given.trim();
  if(!text)return null;
  if(!/^\d{1,9}([.,]\d{0,2})?$/.test(text))throw new Error('Bitte den erhaltenen Betrag korrigieren oder die Eingabe leeren.');
  const [euros,fraction='']=text.replace(',','.').split('.');
  return Number(euros)*100+Number(fraction.padEnd(2,'0'));
}
export function addTender(given, cents) {
  if(!Number.isSafeInteger(cents)||cents<=0)throw new Error('Ungültiger Schnellbetrag.');
  const sum=(parseTendered(given)??0)+cents;
  if(sum>99999999999)throw new Error('Der erhaltene Betrag ist zu groß.');
  return `${Math.floor(sum/100)},${String(sum%100).padStart(2,'0')}`;
}
export function calculateChange(amount, given = '') {
  // Blank input leaves the original booking flow available. Refunds need no tendered cash.
  if(amount<=0)return { status:'not-required', canBook:true };
  let tendered;
  try{tendered=parseTendered(given);}catch{return { status:'invalid',canBook:false };}
  if(tendered===null)return { status:'unused', canBook:true };
  if(tendered<amount)return { status:'short', canBook:false, tendered, missing:amount-tendered };
  return { status:'ready', canBook:true, tendered, change:tendered-amount };
}
export function makeSale(lines, id, timestamp) {
  if (!lines.length || lines.some(l => !Number.isInteger(l.quantity) || l.quantity < 1 || !Number.isInteger(l.price) || l.price === 0)) throw new Error('Der Warenkorb ist leer oder ungültig.');
  const items = lines.map(l => ({ ...l }));
  return { id, timestamp, items, total: total(items), cancelledAt: null };
}
export function statistics(sales, day = '', productId = '') {
  const matchingSales = sales.filter(s => !s.cancelledAt && (!day || localDay(s.timestamp) === day));
  const rows = new Map();
  const hours=Array.from({length:24},(_,hour)=>({hour,transactions:0,positive:0,negative:0,zero:0}));
  let revenue = 0, quantity = 0, transactions = 0, income = 0, payouts = 0;
  let positiveTransactions = 0, negativeTransactions = 0, zeroTransactions = 0;
  for (const sale of matchingSales) {
    const items = sale.items.filter(i => !productId || i.id === productId);
    if (!items.length) continue;
    transactions++;
    const amount = total(items);
    const activity=hours[new Date(sale.timestamp).getHours()];activity.transactions++;
    if(amount>0){income+=amount;positiveTransactions++;activity.positive++;}
    else if(amount<0){payouts-=amount;negativeTransactions++;activity.negative++;}
    else{zeroTransactions++;activity.zero++;}
    for (const item of items) {
      const row = rows.get(item.id) || { id: item.id, name: item.name, emoji: item.emoji, quantity: 0, revenue: 0 };
      row.quantity += item.quantity; row.revenue += item.quantity * item.price;
      revenue += item.quantity * item.price; quantity += item.quantity;
      rows.set(item.id, row);
    }
  }
  return { revenue, quantity, transactions, income, payouts, positiveTransactions, negativeTransactions, zeroTransactions,hours,
    rows: [...rows.values()].sort((a,b) => b.revenue-a.revenue) };
}
export function validateState(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.products) || !Array.isArray(data.sales)) throw new Error('Das ist keine gültige Festkassen-Sicherung.');
  const validString = s => typeof s === 'string' && s.length > 0 && s.length <= 200;
  const validPrice = p => Number.isInteger(p) && p !== 0 && Math.abs(p) <= 9999999;
  const ids = new Set();
  for (const p of data.products) {
    if (!validString(p.id) || ids.has(p.id) || !validString(p.name) || !validString(p.category) || typeof p.emoji !== 'string' || !validPrice(p.price) || typeof p.active !== 'boolean') throw new Error('Ungültige Produkte in der Sicherung.');
    if(p.color!==undefined && !productColors.some(color=>color.id===p.color))throw new Error('Ungültige Produktfarbe in der Sicherung.');
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
