// ============================================================
//  NASTAVENÍ WEBU – DOBROVOLNICKÉ CENTRUM
//  Sem vložte adresu webové aplikace z Apps Scriptu
//  (Nasadit → Spravovat nasazení → Adresa URL, končí na /exec).
// ============================================================
const API_URL = 'https://script.google.com/macros/s/AKfycbzAblbVuDHZNpNZybrtbGnbyVkViUUVtsjfIYtsNO_O0ytW_aqDsa39wKfkz7Ob95v6/exec';

// Společná funkce pro komunikaci se skriptem Google (neměňte)
async function volejApi(akce, args, token) {
  if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(API_URL)) {
    throw new Error('Web není nastavený: v souboru config.js chybí adresa API.');
  }
  let odpoved;
  try {
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ akce: akce, args: args || [], token: token || '' })
    });
    odpoved = await r.json();
  } catch (e) {
    throw new Error('Nepodařilo se spojit se serverem. Zkontrolujte připojení a zkuste to znovu.');
  }
  if (!odpoved.ok) throw new Error(odpoved.chyba || 'Neznámá chyba.');
  return odpoved.data;
}
