import { money, localDay, parsePrice, total, makeSale, statistics, validateState, calculateChange, addTender, productColors, getProductColor } from './model.js';
import { createStorage, LEGACY_KEY } from './storage.js';
import { formatBytes, summarizeData, estimateStorage } from './usage.js';
import {reportData,createReportPdf} from './report.js';

const database = createStorage();
let dataChannel;
try { dataChannel = new BroadcastChannel('montessori-festkasse-database'); } catch { /* Focus refresh supports browsers without BroadcastChannel. */ }
const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function symbol(value) {
  if(value==='none')return '';
  if(/^nummer-[123]$/.test(value))return `<svg viewBox="0 0 64 64" class="wine-symbol" aria-hidden="true"><rect x="5" y="5" width="54" height="54" rx="15" fill="${{'nummer-1':'#3989b5','nummer-2':'#25885b','nummer-3':'#9b68a3'}[value]}"/><text x="32" y="46" text-anchor="middle" font-family="Arial,sans-serif" font-size="40" font-weight="bold" fill="white">${value.slice(-1)}</text></svg>`;
  const drawings = {
    pfand: '<path d="M10 28A23 23 0 0 1 50 17M54 37A23 23 0 0 1 14 48" fill="none" stroke="#268965" stroke-width="5" stroke-linecap="round"/><path d="m40 18 12 3-1-12M24 47l-12-3 1 12" fill="none" stroke="#268965" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="33" r="13" fill="#f3cb61" stroke="#c58e29" stroke-width="2"/><text x="32" y="41" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="bold" fill="#9b6a1e">€</text>',
    plaetzchen: '<ellipse cx="32" cy="45" rx="28" ry="14" fill="#e7edf2"/><ellipse cx="32" cy="43" rx="23" ry="10" fill="#fffaf0"/><path d="m20 14 4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1Z" fill="#d99d52" stroke="#b97a35" stroke-width="2"/><circle cx="43" cy="35" r="12" fill="#e9b86f" stroke="#be8644" stroke-width="2"/><circle cx="43" cy="35" r="5" fill="#ba4c43"/><circle cx="30" cy="45" r="10" fill="#dcaa65" stroke="#b7803e" stroke-width="2"/><path d="m25 43 3 3m5-6 2 3m-3 6 2 1" stroke="#825537" stroke-width="2.5" stroke-linecap="round"/>',
    flasche: '<path d="M26 8h12v12c0 6 10 9 10 17v19q0 5-5 5H21q-5 0-5-5V37c0-8 10-11 10-17Z" fill="#bee0cf" stroke="#4e9379" stroke-width="2"/><path d="M20 38h24v17q0 2-2 2H22q-2 0-2-2Z" fill="#e9b64b"/><rect x="16" y="33" width="32" height="15" rx="2" fill="#fff6de"/><circle cx="32" cy="40" r="4" fill="#e1a437"/><rect x="24" y="3" width="16" height="9" rx="3" fill="#4e9379"/><path d="M22 28v7" stroke="#f5fff8" stroke-width="3" stroke-linecap="round"/>',
    kiachl: '<ellipse cx="32" cy="49" rx="29" ry="11" fill="#e8e7dd"/><path d="M5 34C3 18 16 9 31 10c17-2 30 7 28 24 2 15-11 24-27 23C16 59 3 49 5 34Z" fill="#d99639" stroke="#b77326" stroke-width="2"/><path d="M13 32c0-9 8-15 19-15s20 6 19 16c1 10-9 16-19 16s-20-6-19-17Z" fill="#f1c879"/><ellipse cx="32" cy="32" rx="13" ry="10" fill="#e5ab55"/><path d="m14 26 3 1m7-10 2 2m14-1 2 1m9 12 2 1m-9 14 2-1m-21 3 2 1m-13-9 2 1m13-12 2 1m6 5 2-1" stroke="#fff8e8" stroke-width="3" stroke-linecap="round"/>',
    stockbrot: '<g transform="rotate(35 32 32)"><path d="M32 8v52" stroke="#946338" stroke-width="5" stroke-linecap="round"/><path d="M26 11q-8 3-6 11l3 18q1 8 10 7l6-1q7-2 5-10l-4-19q-2-9-14-6Z" fill="#e8b669" stroke="#b77836" stroke-width="2"/><path d="m22 20 19-4M23 28l19-5M24 36l19-5M27 43l17-5" stroke="#bd7e3d" stroke-width="4" stroke-linecap="round"/><path d="m25 16 6-2" stroke="#ffe2a5" stroke-width="3" stroke-linecap="round"/></g>',
    stock: '<path d="m13 57 37-47M34 31l-2-14M40 24l15-4" fill="none" stroke="#946338" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="m16 53 14-18" stroke="#c69460" stroke-width="2" stroke-linecap="round"/>',
    bratwurstsemmel: '<g transform="rotate(-24 32 32)"><rect x="6" y="16" width="52" height="34" rx="17" fill="#e5ac58" stroke="#c78b39" stroke-width="2"/><path d="M18 19q-8 5-7 13M45 43l5-4" fill="none" stroke="#ffe1a1" stroke-width="3" stroke-linecap="round"/><rect x="8" y="27" width="48" height="13" rx="6.5" fill="#9e4d29" stroke="#7b3e24" stroke-width="2"/><path d="m19 29 3 7m7-7 3 7m7-7 3 7" stroke="#c57943" stroke-width="2"/><path d="m14 32 7-2 6 5 7-5 6 5 9-3" fill="none" stroke="#f8d452" stroke-width="2.5" stroke-linecap="round"/></g>',
    bier: '<path d="M43 24h8c12 0 12 25 0 25h-8" fill="none" stroke="#d99a32" stroke-width="5"/><path d="M13 18h32v36q0 5-5 5H18q-5 0-5-5Z" fill="#f2bc3f" stroke="#d99a32" stroke-width="2"/><path d="M20 30v20m9-20v20m9-20v20" stroke="#ffe399" stroke-width="4" stroke-linecap="round"/><path d="M11 23c-6-6-1-14 6-13 2-8 13-9 17-3 8-3 15 2 14 9 6 6 1 13-5 12H19c-4 5-11 1-8-5Z" fill="#fff9e9" stroke="#ded9c7" stroke-width="1.5"/>'
  };
  if (drawings[value]) return `<svg viewBox="0 0 64 64" class="wine-symbol" aria-hidden="true">${drawings[value]}</svg>`;
  const colors={'gluehwein-hell':'#e4b949','gluehwein-rose':'#d97f88','gluehwein-dunkel':'#8c2945'};
  if(!colors[value]) return esc(value);
  return `<svg viewBox="0 0 64 64" class="wine-symbol" aria-hidden="true"><path d="M22 17c-7-7 6-7 0-14M34 17c-7-7 6-7 0-14" fill="none" stroke="#a9b4b0" stroke-width="3" stroke-linecap="round"/><path d="M45 27h5c15 0 14 24 0 24h-6" fill="none" stroke="#7b9ca4" stroke-width="5"/><path d="M12 23h34v27q0 10-10 10H22q-10 0-10-10Z" fill="#dcecf0" stroke="#7b9ca4" stroke-width="2"/><path d="M16 31h26v19q0 6-6 6H22q-6 0-6-6Z" fill="${colors[value]}"/><ellipse cx="29" cy="31" rx="13" ry="3" fill="${colors[value]}"/><path d="M20 36v12" stroke="#fff" opacity=".5" stroke-width="3" stroke-linecap="round"/></svg>`;
}
const productSymbols = [
  ['🍰','Kuchen'],['🥨','Brezel'],['🧇','Waffel'],['☕','Kaffee'],['🧃','Saft'],['💧','Wasser'],
  ['🌭','Würstchen'],['bratwurstsemmel','Bratwurstsemmel'],['stockbrot','Stockbrot'],['stock','Stock / Stockpfand'],['bier','Bier'],['flasche','Getränkeflasche'],['kiachl','Kiachl'],['🍕','Pizza'],['🍟','Pommes'],['plaetzchen','Plätzchen'],['🍪','Keks'],['pfand','Pfand'],['🥤','Becherpfand'],['↩️','Pfand zurück'],
  ['gluehwein-hell','Glühwein hell'],['gluehwein-rose','Glühwein rosé'],['gluehwein-dunkel','Glühwein dunkel'],
  ['🍦','Eis'],['🥗','Salat'],['🎟️','Eintritt'],['🎁','Geschenk'],['🍽️','Essen'],['⭐','Stern'],['❤️','Herz'],['🔵','Kreis'],['nummer-1','Nummer 1'],['nummer-2','Nummer 2'],['nummer-3','Nummer 3'],['none','Kein Symbol']
];
function renderSymbolPicker() {
  const selected = $('#product-form').elements.emoji.value;
  const choices = productSymbols.some(([value])=>value===selected) ? productSymbols : [...productSymbols,[selected,'Eigenes Symbol']];
  $('#symbol-picker').innerHTML = choices.map(([value,label])=>`<button type="button" class="symbol-choice" data-symbol="${esc(value)}" aria-label="${esc(label)}" aria-pressed="${value===selected}" title="${esc(label)}">${value==='none'?'<span class="no-symbol-choice">Ohne</span>':symbol(value)}</button>`).join('');
}
function renderColorPicker() {
  const selected=$('#product-form').elements.color.value;
  $('#color-picker').innerHTML=productColors.map(color=>`<button type="button" class="color-choice" style="--product-color:${color.background}" data-color="${color.id}" aria-label="Buttonfarbe ${color.label}" aria-pressed="${color.id===selected}"><span class="color-check" aria-hidden="true">${color.id===selected?'✓':''}</span>${color.label}</button>`).join('');
}
let state, page = 'kasse', cart = [], dayFilter = localDay(new Date()), productFilter = '', busy = false, toastTimer;
let admin = { configured: false }, resetMode = 'bookings', resetSubmitting = false, pinSubmitting = false;
let usageRequest = 0;
let givenText = '', changeOpen = false;
let reportBusy=false;
function clearCurrentSale() { cart=[];givenText='';changeOpen=false; }
function confirmAction(message) {
  return new Promise(resolve=>{
    const dialog=$('#confirm-dialog'); $('#confirm-message').textContent=message;
    const finish=value=>{dialog.close();dialog.oncancel=null;resolve(value);};
    $('#confirm-yes').onclick=()=>finish(true);$('#confirm-no').onclick=()=>finish(false);
    dialog.oncancel=event=>{event.preventDefault();finish(false);};dialog.showModal();
  });
}
const dateFormat = new Intl.DateTimeFormat('de-DE', {day:'numeric',month:'long',year:'numeric'});
const timeFormat = new Intl.DateTimeFormat('de-DE', {hour:'2-digit',minute:'2-digit'});
function notify(message, error = false) {
  $('#toast').textContent = message; $('#toast').className = `visible${error ? ' error' : ''}`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').className = '', error ? 9000 : 4000);
}
async function save(operation) {
  await operation();
  try { dataChannel?.postMessage('changed'); } catch { /* A failed notification must never make a committed booking look unsuccessful. */ }
}
async function refresh() {
  const result = await Promise.all([database.read(), database.adminStatus()]);
  [state, admin] = result;
  const available=new Set(state.products.map(product=>product.id));
  const remaining=cart.filter(line=>available.has(line.id));
  if(remaining.length!==cart.length){
    cart=remaining;if(!cart.length||total(cart)<=0){givenText='';changeOpen=false;}
    notify('Gelöschte Produkte wurden aus dem offenen Warenkorb entfernt.');
  }
  render(); checkOffline();
}
async function refreshAfterSave() {
  try { await refresh(); return true; }
  catch { notify('Die Änderung ist gespeichert. Die Ansicht konnte nicht aktualisiert werden; bitte die Kasse neu öffnen.',true); return false; }
}
function render() {
  document.querySelectorAll('[data-page]').forEach(b => { b.classList.toggle('active', b.dataset.page === page); if (b.dataset.page === page) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
  $('#main').innerHTML = page === 'kasse' ? cashPage() : page === 'statistik' ? statsPage() : settingsPage();
  if(page==='einstellungen')updateStorageUsage();else usageRequest++;
}
async function updateStorageUsage() {
  const request=++usageRequest;
  const estimate=await estimateStorage();
  if(request!==usageRequest || page!=='einstellungen')return;
  const target=$('#device-storage');if(!target)return;
  target.innerHTML=`<span class="usage-label">Belegter Website-Speicher</span><strong>${estimate.usage===null?'Nicht verfügbar':'ca. '+formatBytes(estimate.usage)}</strong><small>${estimate.usage===null?'Dieser Browser stellt keine Speicherschätzung bereit. Die Sicherungsgröße wird daneben angezeigt.':'Browser-Schätzung inklusive Datenbank und Offline-Dateien.'}</small>${estimate.quota===null?'':`<small>Geschätztes Speicherbudget: ${formatBytes(estimate.quota)}</small>`}`;
}
function cashPage() {
  const products = state.products.filter(p => p.active);
  const amount = total(cart), count = cart.reduce((sum,l) => sum+l.quantity,0);
  const change = calculateChange(amount,givenText);
  return `
  <div class="cash-layout"><section aria-label="Produkte">
    <div class="products">${products.map(p => {
      const n = cart.find(l => l.id===p.id)?.quantity || 0;
      return `<button class="product ${p.category==='Getränke'?'drink':''} ${p.emoji==='none'?'no-symbol':''}" style="--product-color:${getProductColor(p.color).background}" data-add="${esc(p.id)}" aria-label="${esc(p.name)}, ${money(p.price)}, hinzufügen">${p.emoji==='none'?'':`<span class="product-symbol" aria-hidden="true">${symbol(p.emoji)}</span>`}${n ? `<span class="count-badge">${n}</span>`:''}<span class="product-name">${esc(p.name)}</span><span class="product-price">${money(p.price)}</span><span class="product-add" aria-hidden="true">+</span></button>`;
    }).join('')}</div>${!products.length ? '<div class="panel empty">Noch keine aktiven Produkte. Lege sie unter Einstellungen an.</div>' : ''}
  </section><aside class="cart" aria-label="Aktueller Verkauf"><div class="cart-heading"><h2>Aktueller Verkauf</h2><span class="tag">${count} Artikel</span></div>
    <div class="cart-lines">${cart.length ? cart.map(l => `<div class="cart-line"><div><div class="cart-line-name">${esc(l.name)}</div><div class="line-price">${money(l.price)} / Stück · ${money(l.price*l.quantity)}</div></div><div class="quantity"><button data-minus="${esc(l.id)}" aria-label="Ein ${esc(l.name)} entfernen">−</button><span>${l.quantity}</span><button data-plus="${esc(l.id)}" aria-label="Ein ${esc(l.name)} hinzufügen">+</button></div></div>`).join('') : '<div class="empty"><span class="empty-symbol" aria-hidden="true">♧</span>Hier ist Platz für Leckeres.<br>Wähle links die ersten Artikel aus.</div>'}</div>
    <div class="cart-bottom"><div class="total"><span>${amount<0?'Auszuzahlen':'Gesamtbetrag'}</span><strong aria-live="polite">${money(amount<0?-amount:amount)}</strong></div>${amount>0&&cart.length?cashCalculator(change):''}<button class="primary" id="book" ${!cart.length||busy||!change.canBook?'disabled':''}>${busy?'Wird gespeichert …':amount<0?'↩ &nbsp; Rückzahlung buchen':'✓ &nbsp; Verkauf buchen'}</button><button class="text-button" id="clear-cart" ${!cart.length||busy?'disabled':''}>Warenkorb leeren</button><div class="cart-note">${amount<0?'Erst nach Auszahlung buchen.':'Erst nach Zahlung buchen.'}<br>Danach beginnt automatisch der nächste Verkauf.</div></div>
  </aside></div>`;
}
function changeFeedback(change) {
  if(change.status==='invalid')return '<p class="calc-message danger">Bitte einen gültigen Betrag eingeben, zum Beispiel 10,00.</p>';
  if(change.status==='short')return `<div class="change-result short"><span>Es fehlen noch</span><strong>${money(change.missing)}</strong></div>`;
  if(change.status==='ready')return `<div class="change-result"><span>Wechselgeld</span><strong>${money(change.change)}</strong></div>`;
  return '<p class="calc-message">Optional: Gesamtbetrag eintippen oder Schnellbeträge addieren. Ohne Eingabe kannst du direkt buchen.</p>';
}
function cashCalculator(change) {
  return `<section class="cash-calculator" aria-label="Optionaler Wechselgeldrechner"><button type="button" class="calculator-toggle" id="toggle-change" aria-expanded="${changeOpen}" ${changeOpen?'aria-controls="calculator-body"':''} ${busy?'disabled':''}><span>${changeOpen?'Wechselgeldrechner schließen':'Wechselgeld berechnen'}</span><span class="calc-optional">optional ${changeOpen?'−':'+'}</span></button>${changeOpen?`<div id="calculator-body"><label for="cash-given">Gegeben in € <span class="muted">(optional)</span></label><input id="cash-given" type="text" inputmode="decimal" autocomplete="off" maxlength="12" value="${esc(givenText)}" placeholder="z. B. 10,00" aria-describedby="change-feedback" aria-invalid="${change.status==='invalid'}" ${busy?'disabled':''}><div class="cash-shortcuts">${[100,200,500,1000,2000,5000].map(cents=>`<button type="button" data-tender="${cents}" aria-label="${cents/100} Euro hinzufügen" ${busy?'disabled':''}>+${cents/100} €</button>`).join('')}</div><p class="cash-add-note">Jeder Tipp addiert den Betrag.</p><div id="change-feedback" role="status" aria-live="polite">${changeFeedback(change)}</div><button type="button" class="calculator-clear" id="clear-given" ${busy?'disabled':''}>Eingabe leeren</button></div>`:''}</section>`;
}
function updateChangeCalculator() {
  const change=calculateChange(total(cart),givenText);
  const feedback=$('#change-feedback');if(feedback)feedback.innerHTML=changeFeedback(change);
  const input=$('#cash-given');if(input)input.setAttribute('aria-invalid',String(change.status==='invalid'));
  const book=$('#book');if(book)book.disabled=!cart.length||busy||!change.canBook;
}
function allProductOptions() {
  const products = new Map(state.products.map(p => [p.id,p.name]));
  for (const s of state.sales) for (const i of s.items) if (!products.has(i.id)) products.set(i.id,i.name);
  return [...products].map(([id,name]) => `<option value="${esc(id)}" ${productFilter===id?'selected':''}>${esc(name)}</option>`).join('');
}
function statsPage() {
  const stats = statistics(state.sales,dayFilter,productFilter);
  const relevant = state.sales.filter(s => (!dayFilter || localDay(s.timestamp)===dayFilter) && (!productFilter || s.items.some(i => i.id===productFilter))).slice().reverse();
  return `
    <div class="panel stat-filters"><label>Zeitraum<select id="period"><option value="day" ${dayFilter?'selected':''}>Einzelner Tag</option><option value="all" ${!dayFilter?'selected':''}>Alle Tage · Gesamt</option></select></label><label>Tag<input type="date" id="day-filter" value="${dayFilter}" ${!dayFilter?'disabled':''}></label><label>Produkt<select id="product-filter"><option value="">Alle Produkte</option>${allProductOptions()}</select></label><div class="export-actions"><button class="secondary" id="export-csv">↓ CSV exportieren</button><button class="secondary" id="export-pdf" ${reportBusy?'disabled':''}>${reportBusy?'PDF wird erstellt …':'↓ PDF-Bericht'}</button></div></div>
    <div class="stats-cards"><div class="metric"><span class="metric-label">Einnahmen</span><strong>${money(stats.income)}</strong><small>${stats.positiveTransactions} positive Buchungen</small></div><div class="metric payout"><span class="metric-label">Auszahlungen</span><strong>${money(stats.payouts)}</strong><small>${stats.negativeTransactions} negative Buchungen</small></div><div class="metric"><span class="metric-label">${productFilter?'Produktsaldo':'Saldo'}</span><strong>${money(stats.revenue)}</strong><small>Einnahmen abzüglich Auszahlungen</small></div></div>
    <div class="stats-cards count-cards"><div class="metric"><span class="metric-label">Gebuchte Artikel</span><strong>${stats.quantity}</strong><small>Stück inkl. Pfand und Rückgaben</small></div><div class="metric"><span class="metric-label">Buchungen insgesamt</span><strong>${stats.transactions}</strong><small>${productFilter?'Mit diesem Produkt':'Inklusive Rückzahlungen'} · davon ${stats.zeroTransactions} mit 0,00 €</small></div></div>
    <p class="sub payment-note">${productFilter?'Beim Produktfilter werden nur die ausgewählten Positionen je Buchung zusammengerechnet.':'Bei gemischten Warenkörben zählt der Gesamtbetrag der Buchung.'} Auszahlungen werden als positiver ausgezahlter Betrag angezeigt. Stornos zählen nicht mit.</p>
    <section class="panel"><div class="section-heading"><h2>Produkte im Überblick</h2><span class="tag">${stats.rows.length} Produkte</span></div>${stats.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Produkt</th><th class="right">Stück</th><th class="right">Betrag</th></tr></thead><tbody>${stats.rows.map(r => `<tr><td><div class="table-product"><span class="tiny-symbol">${symbol(r.emoji)}</span>${esc(r.name)}</div></td><td class="right">${r.quantity}</td><td class="right"><strong>${money(r.revenue)}</strong></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Für diese Auswahl sind noch keine Buchungen vorhanden.<br>Probiere einen anderen Tag oder buche deinen ersten Verkauf.</div>'}</section>
    <section class="panel"><div class="section-heading"><h2>Letzte Verkäufe</h2><span class="muted" style="font-size:12px">Bis zu 30 · Stornos bleiben sichtbar</span></div>${relevant.length ? relevant.slice(0,30).map(s => `<div class="receipt ${s.cancelledAt?'cancelled':''}"><div><strong>${timeFormat.format(new Date(s.timestamp))} Uhr</strong><span class="muted"> · ${dateFormat.format(new Date(s.timestamp))}</span><div class="receipt-details">${s.items.map(i => `${i.quantity} × ${esc(i.name)}`).join(' · ')}</div>${s.cancelledAt ? '<span class="danger">Storniert · nicht im Umsatz enthalten</span>':''}</div><div class="right"><strong>${money(s.total)}</strong><br>${s.cancelledAt ? '' : `<button class="text-button danger" data-cancel="${esc(s.id)}">Stornieren</button>`}</div></div>`).join('') : '<p class="sub">Noch keine passenden Verkäufe.</p>'}<p class="sub" style="margin-top:16px">${productFilter?'Die Beträge der einzelnen Verkäufe zeigen den ganzen Warenkorb. Die Kennzahlen oben zählen nur das gewählte Produkt.':'Stornierte Verkäufe zählen nicht in den Kennzahlen.'}</p></section>`;
}
function settingsPage() {
  const usage=summarizeData(state);
  return `
    <div class="notice">Die Startprodukte und Preise sind Beispiele. Für Pfand zwei Produkte anlegen, z. B. „Becherpfand“ mit 2,00 € und „Pfand zurück“ mit −2,00 €. Negative Preise werden vom Gesamtbetrag abgezogen. Preisänderungen verändern bereits gebuchte Verkäufe nicht.</div>
    <section class="panel"><div class="section-heading"><h2>Eure Produkte <span class="tag">${state.products.filter(p=>p.active).length} aktiv</span></h2><button class="primary" id="new-product">+ Produkt anlegen</button></div><div class="table-wrap"><table class="product-table"><thead><tr><th>Produkt</th><th>Preis</th><th>Status</th><th></th></tr></thead><tbody>${state.products.map(p => `<tr style="--product-color:${getProductColor(p.color).background}"><td><div class="table-product"><span class="tiny-symbol">${symbol(p.emoji)}</span>${esc(p.name)}</div></td><td>${money(p.price)}</td><td><span class="status-dot ${p.active?'':'inactive'}">${p.active?'Aktiv':'Pausiert'}</span></td><td class="right"><button class="secondary" data-edit="${esc(p.id)}" aria-label="${esc(p.name)} bearbeiten">Bearbeiten</button></td></tr>`).join('')}</tbody></table></div></section>
    <section class="panel" aria-label="Daten und Speicher"><div class="section-heading"><h2>Daten & Speicher</h2><button class="text-button" id="refresh-storage">↻ Aktualisieren</button></div><div class="usage-grid"><div class="usage-card"><span class="usage-label">Gespeicherte Buchungen</span><strong>${usage.bookings.toLocaleString('de-DE')}</strong><small>${usage.active.toLocaleString('de-DE')} nicht storniert · ${usage.cancelled.toLocaleString('de-DE')} storniert</small><small>Alle Tage, inklusive Rückzahlungen</small></div><div class="usage-card"><span class="usage-label">Größe der Kassensicherung</span><strong>${formatBytes(usage.backupBytes)}</strong><small>Produkte und Buchungen als JSON, ohne PIN und Offline-Dateien.</small><small class="${usage.backupBytes>20_000_000?'danger':''}">${usage.backupBytes>20_000_000?'Diese Sicherung überschreitet die aktuelle Importgrenze von 20 MB.':'Aktuelle Importgrenze: 20 MB'}</small></div><div class="usage-card" id="device-storage" aria-live="polite"><span class="usage-label">Belegter Website-Speicher</span><strong>Wird ermittelt …</strong></div></div><p class="sub usage-note">Die Sicherungsgröße entspricht der heruntergeladenen JSON-Datei. Der Website-Speicher enthält zusätzlich technische Daten; andere Apps unter derselben Domain können mitgezählt werden. Das Speicherbudget ist keine Garantie für tatsächlich freien Gerätespeicher.</p></section>
    <div class="settings-grid"><section class="panel"><h2>Daten sichern</h2><p>Produkte und Buchungen liegen in einer lokalen IndexedDB-Datenbank auf diesem Gerät. Eine Sicherung schützt vor Datenverlust, etwa beim Löschen der Website-Daten. Die Statistik synchronisiert sich nicht mit anderen Geräten. Auch bisherige JSON-Sicherungen lassen sich wiederherstellen.</p><div class="actions"><button class="secondary" id="backup">↓ Sicherung herunterladen</button><button class="text-button" id="restore">Sicherung wiederherstellen</button><input class="hidden" type="file" id="backup-file" accept="application/json,.json"></div></section>
    <section class="panel"><h2>Als App verwenden</h2><p>Auf dem iPad die Kasse in Safari öffnen, auf „Teilen“ tippen und „Zum Home-Bildschirm“ wählen. Nach dem ersten vollständigen Laden kann die App offline genutzt werden.</p><p id="offline-note">Der Offline-Status wird geprüft …</p><p>Vor dem Fest einmal mit Beispielverkäufen auf dem vorgesehenen iPad testen und eine Sicherung anlegen.</p></section></div>
    <section class="panel admin-panel"><div class="section-heading"><h2>Admin-PIN & Zurücksetzen</h2><button class="secondary" id="configure-pin">${admin.configured?'PIN ändern':'Admin-PIN festlegen'}</button></div><p class="sub">${admin.configured?'Die Admin-PIN ist eingerichtet. Zurücksetzen und Wiederherstellen erfordern die PIN.':'Lege zuerst eine eigene Admin-PIN mit 6 bis 12 Ziffern fest, um die Zurücksetzen-Funktionen freizuschalten.'} Kassieren und Sicherungen herunterladen bleiben ohne PIN möglich.</p><div class="reset-options"><div><h3>Buchungen zurücksetzen</h3><p class="sub">Alle Verkäufe und Stornos entfernen. Die Statistik beginnt bei null; Produkte und Preise bleiben erhalten.</p><button class="secondary danger" data-reset="bookings" ${!admin.configured||busy?'disabled':''}>Buchungen zurücksetzen</button></div><div><h3>Kassendaten zurücksetzen</h3><p class="sub">Alle Produkte und Buchungen entfernen und die drei Startprodukte Kuchen, Brezel und Kaffee anlegen. Die Offline-App und die Admin-PIN bleiben erhalten – du kannst ohne Internet weiter kassieren.</p><button class="secondary danger" data-reset="all" ${!admin.configured||busy?'disabled':''}>Kassendaten zurücksetzen</button></div></div><p class="sub admin-note">Vor beiden Aktionen kannst du eine Sicherung herunterladen. Die lokale Datenbank wird zurückgesetzt; die vorbereiteten Offline-Dateien bleiben gespeichert. Eine erneute Installation oder Internetverbindung ist dafür nicht erforderlich. Die PIN gilt nur auf diesem Gerät und ist nicht Teil der Sicherung. Sie ist ein lokaler Bedienungsschutz und verschlüsselt die Datenbank nicht.</p></section>`;
}
function setFormPending(form, pending) {
  for (const field of form.querySelectorAll('input,button')) field.disabled = pending;
}
async function openPinSettings() {
  admin = await database.adminStatus();
  const form = $('#pin-form');form.reset();$('#pin-error').textContent='';
  $('#pin-title').textContent=admin.configured?'Admin-PIN ändern':'Admin-PIN festlegen';
  $('#current-pin-label').classList.toggle('hidden',!admin.configured);
  form.elements.current.required=admin.configured;
  $('#pin-dialog').showModal();
}
async function openReset(mode) {
  if(busy)throw new Error('Bitte zuerst die laufende Buchung abwarten.');
  await refresh();
  if(!admin.configured)throw new Error('Bitte zuerst eine Admin-PIN festlegen.');
  resetMode=mode;
  $('#reset-form').reset();$('#reset-error').textContent='';$('#reset-backup-status').textContent='';
  $('#reset-title').textContent=mode==='all'?'Kassendaten zurücksetzen':'Buchungen zurücksetzen';
  $('#reset-description').textContent=(mode==='all'?
    'Alle Produkte, Verkäufe und Stornos werden endgültig entfernt. Danach gibt es wieder Kuchen, Brezel und Kaffee. Die Offline-App und die Admin-PIN bleiben erhalten; du kannst danach ohne Internet weiter kassieren.':
    'Alle Verkäufe und Stornos werden endgültig entfernt und die Statistik beginnt bei null. Deine Produkte, Preise, Offline-Dateien und die Admin-PIN bleiben erhalten.')+' Ein offener Warenkorb wird ebenfalls geleert. Die Aktion gilt für alle zum Zeitpunkt des Zurücksetzens gespeicherten Buchungen.';
  $('#reset-submit').textContent=mode==='all'?'Jetzt Kassendaten zurücksetzen':'Jetzt Buchungen löschen';
  $('#reset-dialog').showModal();
}
function requestAdminPin() {
  return new Promise(resolve=>{
    const dialog=$('#authorize-dialog'),form=$('#authorize-form');form.reset();
    const finish=value=>{dialog.close();form.reset();dialog.oncancel=null;form.onsubmit=null;resolve(value);};
    form.onsubmit=event=>{event.preventDefault();finish(form.elements.pin.value);};
    $('#authorize-cancel').onclick=()=>finish(null);
    dialog.oncancel=event=>{event.preventDefault();finish(null);};dialog.showModal();
  });
}
async function downloadBackup() {
  const snapshot=await database.read();
  download(`festkasse-sicherung-${localDay(new Date())}.json`,JSON.stringify(snapshot,null,2),'application/json');
}
function openProduct(id) {
  const form = $('#product-form'); form.reset(); $('#form-error').textContent = '';
  const p = state.products.find(p => p.id===id);
  form.elements.id.value = p?.id || '';
  form.elements.name.value = p?.name || '';
  form.elements.price.value = p ? (p.price/100).toFixed(2).replace('.',',') : '';
  form.elements.emoji.value = p?.emoji || '🍰'; form.elements.active.checked = p?.active ?? true;
  form.elements.color.value=getProductColor(p?.color).id;
  renderColorPicker();
  renderSymbolPicker();
  $('#dialog-title').textContent = p ? 'Produkt bearbeiten' : 'Produkt anlegen';
  $('#delete-product').classList.toggle('hidden',!p);
  $('#delete-product').disabled=false;
  $('#product-dialog').showModal();
}
function download(filename,content,type) {
  const url = URL.createObjectURL(new Blob([content], {type}));
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function csvCell(value) { let s = String(value); if (/^[=+@\-\t\r]/.test(s)) s="'"+s; return '"'+s.replaceAll('"','""')+'"'; }
document.addEventListener('click', async event => {
  const b = event.target.closest('button'); if (!b || b.disabled) return;
  if (!state) return;
  try {
    if (b.dataset.symbol) { $('#product-form').elements.emoji.value=b.dataset.symbol; renderSymbolPicker(); return; }
    if (b.dataset.color) {
      $('#product-form').elements.color.value=b.dataset.color;
      document.querySelectorAll('#color-picker button').forEach(choice=>{
        const selected=choice.dataset.color===b.dataset.color;
        choice.setAttribute('aria-pressed',String(selected));choice.querySelector('.color-check').textContent=selected?'✓':'';
      });
      return;
    }
    if (b.dataset.page) { page=b.dataset.page; location.hash=page; await refresh(); return; }
    if (b.id==='toggle-change' && !busy) {
      changeOpen=!changeOpen;if(!changeOpen)givenText='';render();return;
    }
    if (b.dataset.tender && !busy && total(cart)>0) {
      givenText=addTender(givenText,Number(b.dataset.tender));
      const input=$('#cash-given');if(input)input.value=givenText;updateChangeCalculator();return;
    }
    if (b.id==='clear-given' && !busy) {
      givenText='';const input=$('#cash-given');if(input)input.value='';updateChangeCalculator();return;
    }
    if (busy && (b.dataset.add || b.dataset.minus || b.dataset.plus)) return;
    const id = b.dataset.add || b.dataset.plus || b.dataset.minus;
    if (id) {
      let line = cart.find(l=>l.id===id);
      if (b.dataset.minus) { if (line) line.quantity--; cart=cart.filter(l=>l.quantity>0); }
      else if (line) { if (line.quantity>=999) throw new Error('Maximal 999 Stück pro Produkt.'); line.quantity++; }
      else { const p=state.products.find(p=>p.id===id && p.active); if (!p) return; cart.push({id:p.id,name:p.name,price:p.price,emoji:p.emoji,quantity:1}); }
      if(!cart.length||total(cart)<=0){givenText='';changeOpen=false;}
      render(); return;
    }
    if (b.id==='clear-cart') { if (await confirmAction('Diesen Warenkorb leeren? Es wird kein Verkauf gebucht.')) {clearCurrentSale();render();} }
    if (b.id==='book' && !busy && cart.length) {
      const change=calculateChange(total(cart),givenText);
      if(!change.canBook){notify(change.status==='short'?`Es fehlen noch ${money(change.missing)}. Zum Buchen ohne Rechner die Eingabe leeren.`:'Bitte den erhaltenen Betrag korrigieren oder die Eingabe leeren.',true);return;}
      busy=true;
      const sale=makeSale(cart,crypto.randomUUID(),new Date().toISOString());
      render();
      try { await save(()=>database.addSale(sale)); clearCurrentSale(); if(await refreshAfterSave())notify(`${sale.total<0?'Rückzahlung von '+money(-sale.total):money(sale.total)} gebucht. Bereit für den nächsten Verkauf.`); }
      finally { busy=false; render(); }
    }
    if (b.id==='new-product') openProduct();
    if (b.id==='refresh-storage') await refresh();
    if (b.id==='configure-pin') await openPinSettings();
    if (b.dataset.reset) await openReset(b.dataset.reset);
    if (b.id==='pin-close' && !pinSubmitting) { $('#pin-dialog').close();$('#pin-form').reset(); }
    if (b.id==='reset-close' && !resetSubmitting) { $('#reset-dialog').close();$('#reset-form').reset(); }
    if (b.id==='reset-backup') {
      try { await downloadBackup();$('#reset-backup-status').textContent='Sicherung zum Download erstellt. Bitte prüfen, ob die Datei gespeichert wurde.'; }
      catch(error){$('#reset-error').textContent=`Sicherung fehlgeschlagen: ${error.message}`;}
    }
    if (b.dataset.edit) openProduct(b.dataset.edit);
    if (b.id==='delete-product') {
      const id=$('#product-form').elements.id.value;
      const product=state.products.find(p=>p.id===id);if(!product)return;
      if(await confirmAction(`„${product.name}“ endgültig aus der Produktliste löschen? Bereits gebuchte Verkäufe und die Statistik bleiben erhalten. Das Produkt wird auch aus einem offenen Warenkorb entfernt.`)){
        b.disabled=true;
        try {
          await save(()=>database.deleteProduct(id));$('#product-dialog').close();$('#product-form').reset();
          if(await refreshAfterSave())notify('Produkt gelöscht. Bisherige Verkäufe bleiben erhalten.');
        }finally{b.disabled=false;}
      }
    }
    if (b.id==='close-dialog') $('#product-dialog').close();
    if (b.dataset.cancel) {
      const sale=state.sales.find(s=>s.id===b.dataset.cancel);
      if (sale && await confirmAction(`Verkauf über ${money(sale.total)} stornieren? Er bleibt im Verlauf sichtbar und wird aus dem Umsatz herausgerechnet.`)) {
        await save(()=>database.cancelSale(sale.id)); if(await refreshAfterSave())notify('Verkauf storniert.');
      }
    }
    if (b.id==='backup') { await downloadBackup();notify('Sicherung zum Herunterladen erstellt.'); }
    if (b.id==='restore') $('#backup-file').click();
    if (b.id==='export-csv') {
      state=await database.read(); const s=statistics(state.sales,dayFilter,productFilter);
      const rows=[['Zeitraum','Produkt','Stück','Umsatz EUR'],...s.rows.map(r=>[dayFilter||'Alle Tage',r.name,r.quantity,(r.revenue/100).toFixed(2).replace('.',',')]),[dayFilter||'Alle Tage','Gesamt',s.quantity,(s.revenue/100).toFixed(2).replace('.',',')]];
      download(`festkasse-statistik-${dayFilter||'gesamt'}.csv`,'\ufeff'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n'),'text/csv;charset=utf-8');
    }
    if(b.id==='export-pdf'&&!reportBusy){
      reportBusy=true;b.disabled=true;b.textContent='PDF wird erstellt …';
      const day=dayFilter,productId=productFilter;
      try{
        const snapshot=await database.read(),report=reportData(snapshot,day,productId);
        const bytes=await createReportPdf(report);download(report.filename,bytes,'application/pdf');notify('PDF-Bericht zum Herunterladen erstellt.');
      }catch(error){notify(`PDF konnte nicht erstellt werden: ${error.message}`,true);}
      finally{reportBusy=false;const current=$('#export-pdf');if(current){current.disabled=false;current.textContent='↓ PDF-Bericht';}}
    }
  } catch(error) { notify(`Nicht gespeichert: ${error.message}`,true); }
});
document.addEventListener('input',event=>{
  if(event.target.id==='cash-given' && !busy){givenText=event.target.value;updateChangeCalculator();}
});
document.addEventListener('change', async event => {
  const el=event.target;
  if(el.id==='period') { dayFilter=el.value==='all'?'':localDay(new Date());render(); }
  if(el.id==='day-filter') { if(el.value) dayFilter=el.value;render(); }
  if(el.id==='product-filter') { productFilter=el.value;render(); }
  if(el.id==='backup-file' && el.files[0]) {
    try {
      if(el.files[0].size>20_000_000) throw new Error('Die Datei ist zu groß (maximal 20 MB).');
      const data=validateState(JSON.parse(await el.files[0].text()));
      if(await confirmAction(`Sicherung mit ${data.products.length} Produkten und ${data.sales.length} Verkäufen wiederherstellen? Die aktuellen Daten auf diesem Gerät und der Warenkorb werden ERSETZT. Lade vorher eine Sicherung herunter.`)) {
        let pin;
        if((await database.adminStatus()).configured){pin=await requestAdminPin();if(pin===null){el.value='';return;}}
        await save(()=>database.restore(data,pin));clearCurrentSale();productFilter='';if(await refreshAfterSave())notify('Sicherung wiederhergestellt.');
      }
    }catch(error){notify(`Wiederherstellung fehlgeschlagen: ${error.message}`,true);}
    el.value='';
  }
});
$('#product-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.target;
  const button=form.querySelector('[type=submit]');button.disabled=true;
  try {
    const product={id:form.elements.id.value||crypto.randomUUID(),name:form.elements.name.value.trim(),price:parsePrice(form.elements.price.value),emoji:form.elements.emoji.value,color:form.elements.color.value,active:form.elements.active.checked};
    if(!product.name) throw new Error('Bitte den Produktnamen ausfüllen.');
    await save(()=>database.saveProduct(product,{requireExisting:!!form.elements.id.value}));
    $('#product-dialog').close();if(await refreshAfterSave())notify('Produkt gespeichert.');
  }catch(error){$('#form-error').textContent=`Nicht gespeichert: ${error.message}`;}finally{button.disabled=false;}
});
$('#pin-form').addEventListener('submit',async event=>{
  event.preventDefault();if(pinSubmitting)return;
  const form=event.target;
  if(form.elements.newPin.value!==form.elements.repeatPin.value){$('#pin-error').textContent='Die beiden neuen PIN-Eingaben stimmen nicht überein.';return;}
  pinSubmitting=true;setFormPending(form,true);$('#pin-error').textContent='';
  try {
    await save(()=>database.setAdminPin(form.elements.newPin.value,form.elements.current.value));
    $('#pin-dialog').close();form.reset();if(await refreshAfterSave())notify('Admin-PIN gespeichert.');
  }catch(error){$('#pin-error').textContent=error.message;form.elements.current.value='';}
  finally{pinSubmitting=false;setFormPending(form,false);}
});
$('#reset-form').addEventListener('submit',async event=>{
  event.preventDefault();if(resetSubmitting||busy)return;
  const form=event.target;
  if(!form.elements.acknowledge.checked){$('#reset-error').textContent='Bitte das endgültige Löschen bestätigen.';return;}
  resetSubmitting=true;busy=true;setFormPending(form,true);$('#reset-error').textContent='';
  try {
    const pin=form.elements.pin.value;
    await save(()=>resetMode==='all'?database.resetAll(pin):database.resetBookings(pin));
    clearCurrentSale();productFilter='';dayFilter=localDay(new Date());
    $('#reset-dialog').close();form.reset();
    page=resetMode==='all'?'kasse':'statistik';location.hash=page;
    if(await refreshAfterSave())notify(resetMode==='all'?'Kassendaten zurückgesetzt. Drei Startprodukte sind angelegt; Offline-App und Admin-PIN bleiben erhalten.':'Buchungen entfernt. Deine Produkte bleiben erhalten.');
  }catch(error){$('#reset-error').textContent=error.message;form.elements.pin.value='';}
  finally{resetSubmitting=false;busy=false;setFormPending(form,false);if(!$('#reset-dialog').open)render();}
});
$('#pin-dialog').addEventListener('cancel',event=>{if(pinSubmitting)event.preventDefault();else $('#pin-form').reset();});
$('#reset-dialog').addEventListener('cancel',event=>{if(resetSubmitting)event.preventDefault();else $('#reset-form').reset();});
window.addEventListener('hashchange',()=>{const target=location.hash.slice(1);if(state && ['kasse','statistik','einstellungen'].includes(target)){page=target;render();checkOffline();}});
function syncDatabase() { if(state) refresh().catch(error=>notify(`Datenbank konnte nicht gelesen werden: ${error.message}`,true)); }
if(dataChannel) dataChannel.onmessage=syncDatabase;
window.addEventListener('focus',syncDatabase);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncDatabase();});
window.addEventListener('storage',event=>{if(event.key===LEGACY_KEY)notify('Eine alte Kassenversion hat den bisherigen Speicher geändert. Bitte alte Kassenfenster schließen. Bei Bedarf deren Daten separat sichern.',true);});
window.addEventListener('beforeunload',event=>{if(cart.length){event.preventDefault();event.returnValue='';}});
function connection(){ $('#connection').textContent=navigator.onLine?'● Auf diesem Gerät':'● Offline'; }
window.addEventListener('online',connection);window.addEventListener('offline',connection);
async function checkOffline(){const note=$('#offline-note');if(!note)return;try{const r=await navigator.serviceWorker?.getRegistration();note.textContent=r?.active?'✓ Offline-Version auf diesem Gerät vorbereitet. Bitte einmal im Flugmodus testen.':'Offline-Version wird beim ersten Öffnen vorbereitet. Zum Abschluss die App erneut öffnen.';}catch{note.textContent='Offline-Vorbereitung konnte nicht geprüft werden.';}}
try {
  $('#main').innerHTML='<section class="panel" role="status">Lokale Datenbank wird geöffnet …</section>';
  const migration=await database.initialize();
  [state,admin]=await Promise.all([database.read(),database.adminStatus()]);
  const target=location.hash.slice(1);if(['kasse','statistik','einstellungen'].includes(target))page=target;
  render();connection();
  if(migration?.migrated)notify('Vorhandene Produkte und Buchungen wurden in die lokale Datenbank übernommen.');
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(checkOffline).catch(()=>notify('Offline-Vorbereitung fehlgeschlagen. Bitte mit Internet erneut öffnen.',true));
  checkOffline();
}catch(error){state=null;$('#main').innerHTML=`<section class="panel"><h1>Datenbank nicht verfügbar</h1><p>Die Kasse konnte die lokale Datenbank nicht sicher öffnen. Bitte verwende einen normalen Browsermodus und prüfe die Speicherberechtigung. Schließe gegebenenfalls andere Kassenfenster.</p><p>Vorhandene Daten wurden nicht überschrieben. Lösche keine Website-Daten, wenn hier schon Buchungen gespeichert waren.</p></section>`;notify(error.message,true);}
