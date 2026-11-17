import {statistics,localDay,money} from './model.js';

const dateLabel=day=>new Date(day+'T12:00:00').toLocaleDateString('de-DE');
export function reportData(state,day='',productId='',createdAt=new Date()) {
  const stats=statistics(state.sales,day,productId);
  const matching=state.sales.filter(s=>!s.cancelledAt&&(!day||localDay(s.timestamp)===day)&&(!productId||s.items.some(i=>i.id===productId)));
  const days=[...new Set(matching.map(s=>localDay(s.timestamp)))].sort();
  const name=state.products.find(p=>p.id===productId)?.name || state.sales.flatMap(s=>s.items).find(i=>i.id===productId)?.name || 'Ausgewähltes Produkt';
  const peak=Math.max(...stats.hours.map(h=>h.transactions));
  return {stats,day,productId,createdAt,
    period:day?dateLabel(day):days.length?`Alle Tage (${dateLabel(days[0])} bis ${dateLabel(days.at(-1))})`:'Alle Tage',
    product:productId?name:'Alle Produkte',
    timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone || 'Gerätezeit',
    peak,peakHours:peak?stats.hours.filter(h=>h.transactions===peak).map(h=>h.hour):[],
    filename:`festkasse-bericht-${day||'gesamt'}${productId?'-produkt':''}.pdf`};
}

let assetPromise;
export function loadReportAssets() {
  if(!assetPromise)assetPromise=Promise.all(['./fonts/NotoSans-Regular.ttf','./fonts/NotoSans-Bold.ttf','./logo.png'].map(async path=>{
    const response=await fetch(new URL(path,import.meta.url));
    if(!response.ok)throw new Error('PDF-Dateien sind noch nicht vollständig verfügbar. Bitte die Kasse einmal mit Internet laden.');
    return new Uint8Array(await response.arrayBuffer());
  })).then(([regular,bold,logo])=>({regular,bold,logo})).catch(error=>{assetPromise=null;throw error;});
  return assetPromise;
}

export async function createReportPdf(report,{PDFLib=globalThis.PDFLib,fontkit=globalThis.fontkit,assets}={}) {
  if(!PDFLib?.PDFDocument || !fontkit)throw new Error('Die PDF-Funktion ist noch nicht vollständig geladen. Bitte die Kasse erneut öffnen.');
  assets ||= await loadReportAssets();
  const {PDFDocument,rgb}=PDFLib;
  const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
  const regular=await doc.embedFont(assets.regular,{subset:true}),bold=await doc.embedFont(assets.bold,{subset:true});
  const logo=await doc.embedPng(assets.logo);
  doc.setTitle('Montessori Festkasse - Verkaufsbericht');doc.setAuthor('Montessori Festkasse');doc.setCreator('Montessori Festkasse');doc.setCreationDate(report.createdAt);
  const W=595.28,H=841.89,M=44,C=W-2*M,LIMIT=H-64;
  const color=hex=>rgb(...hex.match(/\w\w/g).map(v=>parseInt(v,16)/255));
  const green=color('168544'),ink=color('203d36'),muted=color('697b72'),line=color('dfe6dc'),light=color('f2f6ee'),red=color('be6b56'),grey=color('9aa7a0');
  const supported=new Set(regular.getCharacterSet()),replaced=new Set();
  const clean=value=>Array.from(String(value).normalize('NFC').replace(/[\u0000-\u001f\u007f\ufe0f\u200d]/g,' ')).map(ch=>{
    if(supported.has(ch.codePointAt(0)))return ch;replaced.add(ch);return '?';
  }).join('');
  let page=doc.addPage([W,H]);
  function text(value,x,top,size=10,font=regular,fill=ink,align='left') {
    const label=clean(value),width=font.widthOfTextAtSize(label,size);
    page.drawText(label,{x:align==='right'?x-width:align==='center'?x-width/2:x,y:H-top-size,size,font,color:fill});
  }
  function rule(x1,top,x2,fill=line,width=.7){page.drawLine({start:{x:x1,y:H-top},end:{x:x2,y:H-top},thickness:width,color:fill});}
  function rect(x,top,width,height,fill,border){page.drawRectangle({x,y:H-top-height,width,height,color:fill,...(border?{borderColor:border,borderWidth:.7}:{})});}
  function wrap(value,maxWidth,size=10,font=regular) {
    const words=clean(value).trim().split(/\s+/),lines=[];let current='';
    for(const word of words){
      const candidate=current?current+' '+word:word;
      if(font.widthOfTextAtSize(candidate,size)<=maxWidth){current=candidate;continue;}
      if(current){lines.push(current);current='';}
      for(const ch of word){if(current&&font.widthOfTextAtSize(current+ch,size)>maxWidth){lines.push(current);current='';}current+=ch;}
    }
    if(current)lines.push(current);return lines.length?lines:[''];
  }
  function paragraph(value,x,top,width,size=9,fill=muted,font=regular){const lines=wrap(value,width,size,font);lines.forEach((s,i)=>text(s,x,top+i*(size+4),size,font,fill));return top+lines.length*(size+4);}
  function fit(value,width,start=18){let size=start;while(size>8&&bold.widthOfTextAtSize(clean(value),size)>width)size-=.5;return size;}
  page.drawImage(logo,{x:M,y:H-34-50,width:44,height:50});
  text('Montessori Festkasse',M+60,36,21,bold,green);text(report.sample?'Verkaufsbericht (Beispieldaten)':'Verkaufsbericht',M+60,66,12,regular,muted);
  let y=96;
  y=paragraph('Zeitraum: '+report.period,M,y,C,10,ink);
  y=paragraph('Produktfilter: '+report.product,M,y+3,C,10,ink)+12;
  const metricWidth=(C-24)/3;
  [['Einnahmen',report.stats.income,green],['Auszahlungen',report.stats.payouts,red],['Saldo',report.stats.revenue,ink]].forEach(([label,amount,tone],i)=>{
    const x=M+i*(metricWidth+12);rect(x,y,metricWidth,60,light,line);rect(x,y,metricWidth,3,tone);
    text(label,x+12,y+12,9,regular,muted);text(money(amount),x+12,y+31,fit(money(amount),metricWidth-24),bold,tone);
  });
  y+=72;
  text(`${report.stats.transactions} Buchungen  |  ${report.stats.quantity} gebuchte Artikel  |  Stornos nicht enthalten`,M,y,9,regular,muted);
  y+=27;text('Wann war am meisten los?',M,y,14,bold);y+=22;
  let legendX=M;
  [[green,'Positive Buchungen'],[red,'Rückzahlungen'],[grey,'0-Euro-Buchungen']].forEach(([tone,label])=>{
    rect(legendX,y+3,8,8,tone);text(label,legendX+13,y,8,regular,muted);legendX+=regular.widthOfTextAtSize(label,8)+30;
  });
  y+=23;
  const chartTop=y,chartHeight=106,left=M+30,plotWidth=C-34,step=Math.max(1,Math.ceil(report.peak/4)),maxY=Math.max(1,Math.ceil(report.peak/step)*step);
  for(let tick=0;tick<=maxY;tick+=step){const top=chartTop+chartHeight-(tick/maxY)*chartHeight;rule(left,top,M+C,line,.5);text(tick,left-8,top-5,8,regular,muted,'right');}
  report.stats.hours.forEach((bucket,i)=>{
    const slot=plotWidth/24,x=left+i*slot+slot*.2,barWidth=slot*.6;let bottom=chartTop+chartHeight;
    [[bucket.positive,green],[bucket.negative,red],[bucket.zero,grey]].forEach(([count,tone])=>{
      if(count){const h=count/maxY*chartHeight;rect(x,bottom-h,barWidth,h,tone);bottom-=h;}
    });
    if(bucket.transactions)text(bucket.transactions,x+barWidth/2,bottom-12,7,regular,ink,'center');
    if(i%2===0)text(String(i).padStart(2,'0'),x+barWidth/2,chartTop+chartHeight+7,8,regular,muted,'center');
  });
  if(!report.peak)text('Keine Buchungen für diese Auswahl',left+plotWidth/2,chartTop+52,10,regular,muted,'center');
  y=chartTop+chartHeight+27;
  const peaks=report.peakHours.map(h=>String(h).padStart(2,'0')+' Uhr');
  const peakText=report.peak?`Höchste Aktivität: ${report.peak} Buchungen pro Stunde (${peaks.length>6?peaks.slice(0,6).join(', ')+` und ${peaks.length-6} weitere Stunden`:peaks.join(', ')}).`:'Es gibt noch keine Spitzenstunde für diese Auswahl.';
  y=paragraph(peakText,M,y,C,9,ink);
  y=paragraph(`Uhrzeiten in ${report.timeZone}. ${report.day?'Buchungen am gewählten Tag.':'Gleiche Uhrzeiten werden über alle ausgewählten Tage zusammengefasst.'}`,M,y+3,C,8)+18;
  function nextPage(){page=doc.addPage([W,H]);text('Verkaufsbericht - Produkte',M,35,15,bold,green);let top=paragraph(report.period+' | '+report.product,M,62,C,9);return top+20;}
  function tableHeader(top){rect(M,top,C,23,light);text('Produkt',M+8,top+6,9,bold);text('Stück',M+C-117,top+6,9,bold,ink,'right');text('Betrag',M+C-8,top+6,9,bold,ink,'right');return top+23;}
  if(y+95>LIMIT)y=nextPage();
  text('Produkte im Überblick',M,y,14,bold);y+=22;
  y=tableHeader(y);
  const note='Mengen und Beträge enthalten auch Pfand und Rückgaben. Bei einem Produktfilter zählen nur dessen Positionen je Buchung; sonst zählt der gesamte Warenkorb.';
  const summaryHeight=9+24+wrap(note,C,8).length*12;
  for(const [index,row] of report.stats.rows.entries()){
    const names=wrap(row.name,C-165,10),height=Math.max(26,names.length*14+12);
    const reserve=index===report.stats.rows.length-1?summaryHeight:0;
    if(y+height+reserve>LIMIT){y=nextPage();y=tableHeader(y);}
    names.forEach((name,i)=>text(name,M+8,y+7+i*14,10));
    text(row.quantity,M+C-117,y+7,10,regular,ink,'right');
    text(money(row.revenue),M+C-8,y+7,fit(money(row.revenue),100,10),regular,row.revenue<0?red:ink,'right');
    y+=height;rule(M,y,M+C);
  }
  if(!report.stats.rows.length){text('Keine passenden Produkte gebucht.',M+8,y+10,10,regular,muted);y+=34;}
  if(y+summaryHeight>LIMIT){y=nextPage();}
  y+=9;text('Saldo der Auswahl',M+8,y,10,bold);text(money(report.stats.revenue),M+C-8,y,12,bold,green,'right');y+=24;
  y=paragraph(note,M,y,C,8);
  if(replaced.size){if(y+28>LIMIT)y=nextPage();paragraph('Nicht unterstützte Sonderzeichen in Namen werden als ? dargestellt.',M,y+6,C,8);}
  const pages=doc.getPages(),created=report.createdAt.toLocaleString('de-DE');
  pages.forEach((p,index)=>{page=p;rule(M,H-49,W-M);text('Montessori Festkasse | Erstellt: '+created,M,H-38,7,regular,muted);text(`Seite ${index+1} / ${pages.length}`,W-M,H-38,7,regular,muted,'right');});
  return doc.save();
}
