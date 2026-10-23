process.env.TZ='Europe/Prague';
const M = require('./gas-mock.js');
const files=[]; 
const folder={ getUrl:()=> 'https://drive/zalohy', getFiles(){ const a=files.filter(f=>!f.t); let i=0; return {hasNext:()=>i<a.length,next:()=>a[i++]}; },
  getFilesByName(n){ const a=files.filter(f=>!f.t&&f.n===n); let i=0; return {hasNext:()=>i<a.length,next:()=>a[i++]}; } };
global.DriveApp={ getFileById:()=>({ makeCopy:(n,f)=>{ const x={n, t:false, getName(){return this.n}, setTrashed(v){this.t=v}, getUrl:()=>'u'}; files.push(x); return x; } }), getFolderById:()=>folder, getRootFolder:()=>folder };
require('./nacti-kod.js')();
log_=()=>{}; console.log=(o=>(...a)=>{ if(!String(a[0]).startsWith('Hotovo')) o(...a)})(console.log);
nastavTabulku(); nastavHodnotu_('slozka_zalohy','https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz012345');
const RealDate=Date; let den=new RealDate(2026,8,1,2,0);
for (let i=0;i<70;i++){ global.Date = class extends RealDate { constructor(...a){ if(a.length) super(...a); else super(den.getTime()); } static now(){ return den.getTime(); } }; zalohujTabulku(); den=new RealDate(den.getTime()+86400000); }
global.Date=RealDate;
const live=files.filter(f=>!f.t).map(f=>f.n);
console.log('denní:', live.filter(n=>n.includes('– denní')).length, live.filter(n=>n.includes('– denní')).slice(0,2));
console.log('týdenní:', live.filter(n=>n.includes('týdenní')).length, live.filter(n=>n.includes('týdenní')).slice(-2));
