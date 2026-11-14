/* Fotky papírových výkazů hodin – sdílená součást dashboardu a portálu (později i portálu organizace).
 *
 * FotkaVykazu.zmensi(soubor)  → Promise<dataUrl>   zmenší na cca 1600 px a převede na JPEG
 * FotkaVykazu.mount(el, volby) → { nastav(fotky) }
 *   fotky         [{id, nahrano}] fotky tohoto dobrovolníka, organizace a měsíce
 *   muzePridat    smí se nahrávat (měsíc není zamčený apod.)
 *   muzeSmazat    smí se mazat
 *   kamera        ukázat tlačítko „Vyfotit“ (telefon)
 *   nacti(id)     → Promise<dataUrl>
 *   nahraj(dataUrl) → Promise<nový seznam fotek>
 *   smaz(id)      → Promise<nový seznam fotek>
 *   potvrdit(text)→ Promise<boolean> (výchozí window.confirm)
 * Fotky se zobrazují přes API s ověřením; v tabulce ani v kódu stránky nejsou žádné veřejné odkazy.
 */
(function (global) {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function nactiObrazek(soubor) {
    return new Promise(function (ok, ne) {
      var url = URL.createObjectURL(soubor), img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); ok(img); };
      img.onerror = function () { URL.revokeObjectURL(url); ne(new Error('Soubor se nepodařilo přečíst jako obrázek.')); };
      img.src = url;
    });
  }

  // Delší strana nejvýše 1600 px, JPEG; je-li výsledek příliš velký, sníží se kvalita
  function zmensi(soubor) {
    return nactiObrazek(soubor).then(function (img) {
      var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, k = Math.min(1, 1600 / Math.max(w, h));
      var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      var q = 0.8, d = c.toDataURL('image/jpeg', q);
      while (d.length > 4000000 && q > 0.35) { q -= 0.15; d = c.toDataURL('image/jpeg', q); }
      return d;
    });
  }

  var CSS =
    '.fv-grid{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}' +
    '.fv-it{position:relative;width:96px;height:96px;border:1px solid var(--border,#e6d6d5);border-radius:10px;overflow:hidden;background:#f3eeee;display:flex;align-items:center;justify-content:center;color:var(--muted,#6e6262);font-size:12px;cursor:zoom-in}' +
    '.fv-it img{width:100%;height:100%;object-fit:cover}' +
    '.fv-x{position:absolute;top:3px;right:3px;border:0;border-radius:50%;width:24px;height:24px;background:rgba(0,0,0,.6);color:#fff;cursor:pointer;line-height:1;font-size:15px}' +
    '.fv-btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}' +
    '.fv-btn{border:1px solid var(--border,#e6d6d5);background:#fff;border-radius:10px;padding:9px 14px;font:inherit;font-size:14px;font-weight:600;cursor:pointer;color:inherit}' +
    '.fv-btn.p{background:var(--primary,#c4524e);border-color:var(--primary,#c4524e);color:#fff}' +
    '.fv-btn:disabled{opacity:.6;cursor:wait}' +
    '.fv-chyba{background:var(--error-bg,#fdecea);color:var(--error,#b42318);padding:8px 10px;border-radius:8px;margin-top:8px;font-size:14px}' +
    '.fv-muted{color:var(--muted,#6e6262);font-size:13px}' +
    '.fv-box{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:200;display:flex;align-items:center;justify-content:center;padding:12px;cursor:zoom-out}' +
    '.fv-box img{max-width:100%;max-height:100%;object-fit:contain;background:#fff}';

  function pridejStyl() {
    if (document.getElementById('fv-css')) return;
    var s = document.createElement('style'); s.id = 'fv-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  function mount(el, o) {
    pridejStyl();
    var fotky = o.fotky || [], nahrava = false, chyba = '', nahledy = {};
    // na telefonu a tabletu vždy nabídnout přímé vyfocení (capture otevře foťák), jinak jen výběr souboru
    var mobil = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
    function kamera() { return o.kamera === true || (o.kamera !== false && mobil); }

    function potvrdit(t) { return o.potvrdit ? o.potvrdit(t) : Promise.resolve(window.confirm(t)); }

    function kresli() {
      el.innerHTML = '<div class="fv">' +
        (fotky.length ? '<div class="fv-grid">' + fotky.map(function (f) {
          return '<div class="fv-it" data-id="' + esc(f.id) + '" title="Zvětšit">' + (nahledy[f.id] ? '<img alt="Fotka výkazu" src="' + nahledy[f.id] + '">' : 'Načítám…') +
            (o.muzeSmazat ? '<button type="button" class="fv-x" data-smaz="' + esc(f.id) + '" title="Smazat fotku" aria-label="Smazat fotku">×</button>' : '') + '</div>';
        }).join('') + '</div>' : '<p class="fv-muted" style="margin:6px 0">Zatím žádná fotka.</p>') +
        (o.muzePridat ? '<div class="fv-btns">' +
          (kamera() ? '<button type="button" class="fv-btn p" data-pridat="kamera"' + (nahrava ? ' disabled' : '') + '>📷 Vyfotit</button>' : '') +
          '<button type="button" class="fv-btn' + (kamera() ? '' : ' p') + '" data-pridat="soubor"' + (nahrava ? ' disabled' : '') + '>' + (nahrava ? 'Nahrávám…' : (kamera() ? 'Vybrat z galerie' : '+ Přidat fotku')) + '</button>' +
          '<input type="file" accept="image/*" capture="environment" data-vstup="kamera" hidden><input type="file" accept="image/*" data-vstup="soubor" hidden></div>' : '') +
        (chyba ? '<div class="fv-chyba">' + esc(chyba) + '</div>' : '') + '</div>';
      napoj(); nactiNahledy();
    }

    function nactiNahledy() {
      fotky.forEach(function (f) {
        if (nahledy[f.id] || !o.nacti) return;
        nahledy[f.id] = '';   // už se načítá
        o.nacti(f.id).then(function (d) { nahledy[f.id] = d; kresli(); }, function () { nahledy[f.id] = ''; });
      });
    }

    function napoj() {
      Array.prototype.forEach.call(el.querySelectorAll('[data-pridat]'), function (b) {
        b.onclick = function () { el.querySelector('[data-vstup="' + b.dataset.pridat + '"]').click(); };
      });
      Array.prototype.forEach.call(el.querySelectorAll('[data-vstup]'), function (inp) {
        inp.onchange = function () {
          var f = inp.files && inp.files[0]; if (!f) return;
          nahrava = true; chyba = ''; kresli();
          zmensi(f).then(function (d) { return o.nahraj(d); }).then(function (n) { fotky = n; }, function (e) { chyba = e.message || 'Fotku se nepodařilo nahrát.'; })
            .then(function () { nahrava = false; kresli(); });
        };
      });
      Array.prototype.forEach.call(el.querySelectorAll('.fv-x'), function (b) {
        b.onclick = function (e) {
          e.stopPropagation();
          potvrdit('Opravdu smazat tuto fotku?').then(function (ano) {
            if (!ano) return;
            o.smaz(b.dataset.smaz).then(function (n) { fotky = n; chyba = ''; kresli(); }, function (er) { chyba = er.message || 'Fotku se nepodařilo smazat.'; kresli(); });
          });
        };
      });
      Array.prototype.forEach.call(el.querySelectorAll('.fv-it'), function (it) {
        it.onclick = function () {
          var d = nahledy[it.dataset.id]; if (!d) return;
          var box = document.createElement('div'); box.className = 'fv-box'; box.innerHTML = '<img alt="Fotka výkazu" src="' + d + '">';
          box.onclick = function () { box.remove(); }; document.body.appendChild(box);
        };
      });
    }

    kresli();
    return { nastav: function (n, volby) { fotky = n; if (volby) { Object.keys(volby).forEach(function (k) { o[k] = volby[k]; }); } kresli(); } };
  }

  global.FotkaVykazu = { zmensi: zmensi, mount: mount };
})(window);
