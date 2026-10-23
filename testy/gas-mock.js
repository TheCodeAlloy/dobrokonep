// Jednoduchá napodobenina služeb Google Apps Script pro testy
const crypto = require('crypto');
function pad(n, l=2){ return String(n).padStart(l,'0'); }
const Utilities = {
  formatDate(d, tz, f) {
    const map = { yyyy: d.getFullYear(), yy: pad(d.getFullYear()%100), MM: pad(d.getMonth()+1), dd: pad(d.getDate()), HH: pad(d.getHours()), mm: pad(d.getMinutes()), ss: pad(d.getSeconds()) };
    let out = f.replace(/'([^']*)'/g, '\u0001$1\u0001');
    out = out.replace(/yyyy|yy|MM|dd|HH|mm|ss|M|d|H|u/g, t => t==='M'? d.getMonth()+1 : t==='d'? d.getDate() : t==='H'? d.getHours() : t==='u'? ((d.getDay()+6)%7+1) : map[t]);
    return out.replace(/\u0001/g,'');
  },
  getUuid(){ return crypto.randomUUID(); },
  computeDigest(a, t){ return [...crypto.createHash('sha256').update(t).digest()]; },
  base64EncodeWebSafe(b){ return Buffer.from(b).toString('base64url'); },
  DigestAlgorithm: { SHA_256: 1 },
  parseDate(s){ const m=s.match(/(\d+)-(\d+)-(\d+)T(\d+):(\d+)/); return new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5]); }
};
class Range {
  constructor(sh, r, c, nr, nc){ Object.assign(this,{sh,r,c,nr,nc}); }
  getValues(){ const o=[]; for(let i=0;i<this.nr;i++){ const row=[]; for(let j=0;j<this.nc;j++){ const v=(this.sh.d[this.r-1+i]||[])[this.c-1+j]; row.push(v===undefined?'':v);} o.push(row);} return o; }
  getValue(){ return this.getValues()[0][0]; }
  setValues(v){ v.forEach((row,i)=>row.forEach((x,j)=>this.sh.set(this.r+i,this.c+j,x))); return this; }
  setValue(x){ return this.setValues([[x]]); }
  setNumberFormat(){return this;} setDataValidation(){return this;} setFontWeight(){return this;} setBackground(){return this;} setFontColor(){return this;}
  setVerticalAlignment(){return this;} setWrap(){return this;}
}
class Sheet {
  constructor(name){ this.name=name; this.d=[]; this.maxCols=26; }
  set(r,c,x){ while(this.d.length<r) this.d.push([]); this.d[r-1][c-1]=x; if (c>this.maxCols) this.maxCols=c; }
  getName(){ return this.name; }
  getLastRow(){ for(let i=this.d.length;i>0;i--){ if((this.d[i-1]||[]).some(v=>v!==''&&v!==undefined&&v!==null)) return i;} return 0; }
  getLastColumn(){ let m=0; this.d.forEach(r=>r.forEach((v,j)=>{ if(v!==''&&v!==undefined) m=Math.max(m,j+1);})); return m; }
  getMaxRows(){ return Math.max(1000, this.d.length); } getMaxColumns(){ return this.maxCols; }
  insertColumnsAfter(a,n){ this.maxCols+=n; }
  getDataRange(){ return new Range(this,1,1,Math.max(1,this.getLastRow()),Math.max(1,this.getLastColumn())); }
  getRange(r,c,nr,nc){ if (typeof r==='string') return new Range(this,1,1,1,1); return new Range(this,r,c,nr||1,nc||1); }
  appendRow(row){ const r=this.getLastRow()+1; row.forEach((x,j)=>this.set(r,j+1,x)); }
  deleteRow(r){ this.d.splice(r-1,1); }
  setFrozenRows(){return this;} setFrozenColumns(){return this;} setColumnWidth(){return this;}
  getConditionalFormatRules(){return [1];} setConditionalFormatRules(){} getSheetId(){return 1;}
}
const sheets = {};
const SS = { getSheetByName:n=>sheets[n]||null, insertSheet:n=>(sheets[n]=new Sheet(n)), getSheets:()=>Object.values(sheets), getId:()=>'X', getUrl:()=>'https://sheet',
  setSpreadsheetTimeZone(){}, setActiveSheet(){}, moveActiveSheet(){}, deleteSheet(){} };
const chain = new Proxy({}, { get:(t,p)=> p==='build' ? ()=>({}) : ()=>chain });
const store = {};
const props = { getProperty:k=>store[k]??null, setProperty:(k,v)=>{store[k]=v}, deleteProperty:k=>{delete store[k]}, getProperties:()=>({...store}) };
global.Utilities=Utilities;
global.SpreadsheetApp={ openById:()=>SS, getActive:()=>SS, newDataValidation:()=>chain, newConditionalFormatRule:()=>chain, getUi:()=>{throw new Error('no ui')} };
global.PropertiesService={ getScriptProperties:()=>props };
global.LockService={ getScriptLock:()=>({waitLock(){},releaseLock(){}}) };
const cstore={}; global.CacheService={ getScriptCache:()=>({get:k=>cstore[k]??null,put:(k,v)=>{cstore[k]=v},remove:k=>{delete cstore[k]}}) };
global.Session={ getEffectiveUser:()=>({getEmail:()=>'admin@konep.cz'}), getActiveUser:()=>({getEmail:()=>''}) };
global.MAILS=[]; global.MailApp={ sendEmail(m){ MAILS.push(m); }, getRemainingDailyQuota:()=>100 };
global.ContentService={ createTextOutput:t=>({setMimeType(){return t;}}), MimeType:{JSON:1} };
global.MimeType={};
module.exports={sheets, SS, store};
