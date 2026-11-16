import { money, localDay, parsePrice, total, makeSale, statistics, validateState } from './model.js';
import { createStorage, LEGACY_KEY } from './storage.js';

const database = createStorage();
let dataChannel;
try { dataChannel = new BroadcastChannel('montessori-festkasse-database'); } catch { /* Focus refresh supports browsers without BroadcastChannel. */ }
const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function symbol(value) {
  const drawings = {
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
  ['🌭','Würstchen'],['bratwurstsemmel','Bratwurstsemmel'],['stockbrot','Stockbrot'],['stock','Stock / Stockpfand'],['bier','Bier'],['🍕','Pizza'],['🍟','Pommes'],['🍪','Plätzchen'],['🥤','Becherpfand'],['↩️','Pfand zurück'],
  ['gluehwein-hell','Glühwein hell'],['gluehwein-rose','Glühwein rosé'],['gluehwein-dunkel','Glühwein dunkel'],
  ['🍦','Eis'],['🥗','Salat'],['🎟️','Eintritt'],['🎁','Geschenk'],['🍽️','Essen']
];
function renderSymbolPicker() {
  const selected = $('#product-form').elements.emoji.value;
  const choices = productSymbols.some(([value])=>value===selected) ? productSymbols : [...productSymbols,[selected,'Eigenes Symbol']];
  $('#symbol-picker').innerHTML = choices.map(([value,label])=>`<button type="button" class="symbol-choice" data-symbol="${esc(value)}" aria-label="${esc(label)}" aria-pressed="${value===selected}" title="${esc(label)}">${symbol(value)}</button>`).join('');
}
let state, page = 'kasse', cart = [], dayFilter = localDay(new Date()), productFilter = '', busy = false, toastTimer;
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
  state = await database.read();
  render(); checkOffline();
}
async function refreshAfterSave() {
  try { await refresh(); return true; }
  catch { notify('Die Änderung ist gespeichert. Die Ansicht konnte nicht aktualisiert werden; bitte die Kasse neu öffnen.',true); return false; }
}
function render() {
  document.querySelectorAll('[data-page]').forEach(b => { b.classList.toggle('active', b.dataset.page === page); if (b.dataset.page === page) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
  $('#main').innerHTML = page === 'kasse' ? cashPage() : page === 'statistik' ? statsPage() : settingsPage();
}
function cashPage() {
  const products = state.products.filter(p => p.active);
  const amount = total(cart), count = cart.reduce((sum,l) => sum+l.quantity,0);
  return `
  <div class="cash-layout"><section aria-label="Produkte">
    <div class="products">${products.map(p => {
      const n = cart.find(l => l.id===p.id)?.quantity || 0;
      return `<button class="product ${p.category==='Getränke'?'drink':''}" data-add="${esc(p.id)}" aria-label="${esc(p.name)}, ${money(p.price)}, hinzufügen"><span class="product-symbol" aria-hidden="true">${symbol(p.emoji)}</span>${n ? `<span class="count-badge">${n}</span>`:''}<span class="product-name">${esc(p.name)}</span><span class="product-price">${money(p.price)}</span><span class="product-add" aria-hidden="true">+</span></button>`;
    }).join('')}</div>${!products.length ? '<div class="panel empty">Noch keine aktiven Produkte. Lege sie unter Einstellungen an.</div>' : ''}
  </section><aside class="cart" aria-label="Aktueller Verkauf"><div class="cart-heading"><h2>Aktueller Verkauf</h2><span class="tag">${count} Artikel</span></div>
    <div class="cart-lines">${cart.length ? cart.map(l => `<div class="cart-line"><div><div class="cart-line-name">${esc(l.name)}</div><div class="line-price">${money(l.price)} / Stück · ${money(l.price*l.quantity)}</div></div><div class="quantity"><button data-minus="${esc(l.id)}" aria-label="Ein ${esc(l.name)} entfernen">−</button><span>${l.quantity}</span><button data-plus="${esc(l.id)}" aria-label="Ein ${esc(l.name)} hinzufügen">+</button></div></div>`).join('') : '<div class="empty"><span class="empty-symbol" aria-hidden="true">♧</span>Hier ist Platz für Leckeres.<br>Wähle links die ersten Artikel aus.</div>'}</div>
    <div class="cart-bottom"><div class="total"><span>${amount<0?'Auszuzahlen':'Gesamtbetrag'}</span><strong aria-live="polite">${money(amount<0?-amount:amount)}</strong></div><button class="primary" id="book" ${!cart.length||busy?'disabled':''}>${busy?'Wird gespeichert …':amount<0?'↩ &nbsp; Rückzahlung buchen':'✓ &nbsp; Verkauf buchen'}</button><button class="text-button" id="clear-cart" ${!cart.length||busy?'disabled':''}>Warenkorb leeren</button><div class="cart-note">${amount<0?'Erst nach Auszahlung buchen.':'Erst nach Zahlung buchen.'}<br>Danach beginnt automatisch der nächste Verkauf.</div></div>
  </aside></div>`;
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
    <div class="panel stat-filters"><label>Zeitraum<select id="period"><option value="day" ${dayFilter?'selected':''}>Einzelner Tag</option><option value="all" ${!dayFilter?'selected':''}>Alle Tage · Gesamt</option></select></label><label>Tag<input type="date" id="day-filter" value="${dayFilter}" ${!dayFilter?'disabled':''}></label><label>Produkt<select id="product-filter"><option value="">Alle Produkte</option>${allProductOptions()}</select></label><button class="secondary" id="export-csv">↓ CSV exportieren</button></div>
    <div class="stats-cards"><div class="metric"><span class="metric-label">${productFilter?'Produktbetrag':'Saldo'}</span><strong>${money(stats.revenue)}</strong><small>Einnahmen abzüglich Rückzahlungen</small></div><div class="metric"><span class="metric-label">Gebuchte Artikel</span><strong>${stats.quantity}</strong><small>Stück inkl. Pfand und Rückgaben</small></div><div class="metric"><span class="metric-label">Buchungen</span><strong>${stats.transactions}</strong><small>${productFilter?'Mit diesem Produkt':'Inklusive Rückzahlungen'}</small></div></div>
    <section class="panel"><div class="section-heading"><h2>Produkte im Überblick</h2><span class="tag">${stats.rows.length} Produkte</span></div>${stats.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Produkt</th><th class="right">Stück</th><th class="right">Betrag</th></tr></thead><tbody>${stats.rows.map(r => `<tr><td><div class="table-product"><span class="tiny-symbol">${symbol(r.emoji)}</span>${esc(r.name)}</div></td><td class="right">${r.quantity}</td><td class="right"><strong>${money(r.revenue)}</strong></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Für diese Auswahl sind noch keine Buchungen vorhanden.<br>Probiere einen anderen Tag oder buche deinen ersten Verkauf.</div>'}</section>
    <section class="panel"><div class="section-heading"><h2>Letzte Verkäufe</h2><span class="muted" style="font-size:12px">Bis zu 30 · Stornos bleiben sichtbar</span></div>${relevant.length ? relevant.slice(0,30).map(s => `<div class="receipt ${s.cancelledAt?'cancelled':''}"><div><strong>${timeFormat.format(new Date(s.timestamp))} Uhr</strong><span class="muted"> · ${dateFormat.format(new Date(s.timestamp))}</span><div class="receipt-details">${s.items.map(i => `${i.quantity} × ${esc(i.name)}`).join(' · ')}</div>${s.cancelledAt ? '<span class="danger">Storniert · nicht im Umsatz enthalten</span>':''}</div><div class="right"><strong>${money(s.total)}</strong><br>${s.cancelledAt ? '' : `<button class="text-button danger" data-cancel="${esc(s.id)}">Stornieren</button>`}</div></div>`).join('') : '<p class="sub">Noch keine passenden Verkäufe.</p>'}<p class="sub" style="margin-top:16px">${productFilter?'Die Beträge der einzelnen Verkäufe zeigen den ganzen Warenkorb. Die Kennzahlen oben zählen nur das gewählte Produkt.':'Stornierte Verkäufe zählen nicht in den Kennzahlen.'}</p></section>`;
}
function settingsPage() {
  return `
    <div class="notice">Die Startprodukte und Preise sind Beispiele. Für Pfand zwei Produkte anlegen, z. B. „Becherpfand“ mit 2,00 € und „Pfand zurück“ mit −2,00 €. Negative Preise werden vom Gesamtbetrag abgezogen. Preisänderungen verändern bereits gebuchte Verkäufe nicht.</div>
    <section class="panel"><div class="section-heading"><h2>Eure Produkte <span class="tag">${state.products.filter(p=>p.active).length} aktiv</span></h2><button class="primary" id="new-product">+ Produkt anlegen</button></div><div class="table-wrap"><table><thead><tr><th>Produkt</th><th>Preis</th><th>Status</th><th></th></tr></thead><tbody>${state.products.map(p => `<tr><td><div class="table-product"><span class="tiny-symbol">${symbol(p.emoji)}</span>${esc(p.name)}</div></td><td>${money(p.price)}</td><td><span class="status-dot ${p.active?'':'inactive'}">${p.active?'Aktiv':'Pausiert'}</span></td><td class="right"><button class="secondary" data-edit="${esc(p.id)}" aria-label="${esc(p.name)} bearbeiten">Bearbeiten</button></td></tr>`).join('')}</tbody></table></div></section>
    <div class="settings-grid"><section class="panel"><h2>Daten sichern</h2><p>Produkte und Buchungen liegen in einer lokalen IndexedDB-Datenbank auf diesem Gerät. Eine Sicherung schützt vor Datenverlust, etwa beim Löschen der Website-Daten. Die Statistik synchronisiert sich nicht mit anderen Geräten. Auch bisherige JSON-Sicherungen lassen sich wiederherstellen.</p><div class="actions"><button class="secondary" id="backup">↓ Sicherung herunterladen</button><button class="text-button" id="restore">Sicherung wiederherstellen</button><input class="hidden" type="file" id="backup-file" accept="application/json,.json"></div></section>
    <section class="panel"><h2>Als App verwenden</h2><p>Auf dem iPad die Kasse in Safari öffnen, auf „Teilen“ tippen und „Zum Home-Bildschirm“ wählen. Nach dem ersten vollständigen Laden kann die App offline genutzt werden.</p><p id="offline-note">Der Offline-Status wird geprüft …</p><p>Vor dem Fest einmal mit Beispielverkäufen auf dem vorgesehenen iPad testen und eine Sicherung anlegen.</p></section></div>`;
}
function openProduct(id) {
  const form = $('#product-form'); form.reset(); $('#form-error').textContent = '';
  const p = state.products.find(p => p.id===id);
  form.elements.id.value = p?.id || '';
  form.elements.name.value = p?.name || '';
  form.elements.price.value = p ? (p.price/100).toFixed(2).replace('.',',') : '';
  form.elements.emoji.value = p?.emoji || '🍰'; form.elements.active.checked = p?.active ?? true;
  renderSymbolPicker();
  $('#dialog-title').textContent = p ? 'Produkt bearbeiten' : 'Produkt anlegen';
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
    if (b.dataset.page) { page=b.dataset.page; location.hash=page; await refresh(); return; }
    if (busy && (b.dataset.add || b.dataset.minus || b.dataset.plus)) return;
    const id = b.dataset.add || b.dataset.plus || b.dataset.minus;
    if (id) {
      let line = cart.find(l=>l.id===id);
      if (b.dataset.minus) { if (line) line.quantity--; cart=cart.filter(l=>l.quantity>0); }
      else if (line) { if (line.quantity>=999) throw new Error('Maximal 999 Stück pro Produkt.'); line.quantity++; }
      else { const p=state.products.find(p=>p.id===id && p.active); if (!p) return; cart.push({id:p.id,name:p.name,price:p.price,emoji:p.emoji,quantity:1}); }
      render(); return;
    }
    if (b.id==='clear-cart') { if (await confirmAction('Diesen Warenkorb leeren? Es wird kein Verkauf gebucht.')) {cart=[];render();} }
    if (b.id==='book' && !busy && cart.length) {
      busy=true;
      const sale=makeSale(cart,crypto.randomUUID(),new Date().toISOString());
      render();
      try { await save(()=>database.addSale(sale)); cart=[]; if(await refreshAfterSave())notify(`${sale.total<0?'Rückzahlung von '+money(-sale.total):money(sale.total)} gebucht. Bereit für den nächsten Verkauf.`); }
      finally { busy=false; render(); }
    }
    if (b.id==='new-product') openProduct();
    if (b.dataset.edit) openProduct(b.dataset.edit);
    if (b.id==='close-dialog') $('#product-dialog').close();
    if (b.dataset.cancel) {
      const sale=state.sales.find(s=>s.id===b.dataset.cancel);
      if (sale && await confirmAction(`Verkauf über ${money(sale.total)} stornieren? Er bleibt im Verlauf sichtbar und wird aus dem Umsatz herausgerechnet.`)) {
        await save(()=>database.cancelSale(sale.id)); if(await refreshAfterSave())notify('Verkauf storniert.');
      }
    }
    if (b.id==='backup') { state=await database.read(); download(`festkasse-sicherung-${localDay(new Date())}.json`,JSON.stringify(state,null,2),'application/json'); notify('Sicherung zum Herunterladen erstellt.'); }
    if (b.id==='restore') $('#backup-file').click();
    if (b.id==='export-csv') {
      state=await database.read(); const s=statistics(state.sales,dayFilter,productFilter);
      const rows=[['Zeitraum','Produkt','Stück','Umsatz EUR'],...s.rows.map(r=>[dayFilter||'Alle Tage',r.name,r.quantity,(r.revenue/100).toFixed(2).replace('.',',')]),[dayFilter||'Alle Tage','Gesamt',s.quantity,(s.revenue/100).toFixed(2).replace('.',',')]];
      download(`festkasse-statistik-${dayFilter||'gesamt'}.csv`,'\ufeff'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n'),'text/csv;charset=utf-8');
    }
  } catch(error) { notify(`Nicht gespeichert: ${error.message}`,true); }
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
        await save(()=>database.restore(data));cart=[];productFilter='';if(await refreshAfterSave())notify('Sicherung wiederhergestellt.');
      }
    }catch(error){notify(`Wiederherstellung fehlgeschlagen: ${error.message}`,true);}
    el.value='';
  }
});
$('#product-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.target;
  const button=form.querySelector('[type=submit]');button.disabled=true;
  try {
    const product={id:form.elements.id.value||crypto.randomUUID(),name:form.elements.name.value.trim(),price:parsePrice(form.elements.price.value),emoji:form.elements.emoji.value,active:form.elements.active.checked};
    if(!product.name) throw new Error('Bitte den Produktnamen ausfüllen.');
    await save(()=>database.saveProduct(product));
    $('#product-dialog').close();if(await refreshAfterSave())notify('Produkt gespeichert.');
  }catch(error){$('#form-error').textContent=`Nicht gespeichert: ${error.message}`;}finally{button.disabled=false;}
});
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
  state=await database.read();
  const target=location.hash.slice(1);if(['kasse','statistik','einstellungen'].includes(target))page=target;
  render();connection();
  if(migration?.migrated)notify('Vorhandene Produkte und Buchungen wurden in die lokale Datenbank übernommen.');
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(checkOffline).catch(()=>notify('Offline-Vorbereitung fehlgeschlagen. Bitte mit Internet erneut öffnen.',true));
  checkOffline();
}catch(error){state=null;$('#main').innerHTML=`<section class="panel"><h1>Datenbank nicht verfügbar</h1><p>Die Kasse konnte die lokale Datenbank nicht sicher öffnen. Bitte verwende einen normalen Browsermodus und prüfe die Speicherberechtigung. Schließe gegebenenfalls andere Kassenfenster.</p><p>Vorhandene Daten wurden nicht überschrieben. Lösche keine Website-Daten, wenn hier schon Buchungen gespeichert waren.</p></section>`;notify(error.message,true);}
