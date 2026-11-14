/* Roční stránka hodin dobrovolníka – sdílená součást dashboardu, portálu dobrovolníka (a později portálu organizace).
 *
 * Použití:  var r = RocniHodiny.mount(element, volby);   r.nastav(noveZaznamy);
 *
 * volby:
 *   zaznamy       pole zápisů {id, datum, orgId, org, od, do, minut, cinnost, poznamka, stav}
 *   organizace    [{id, nazev}] – ouška organizací (ouška se ukážou jen při víc než jedné organizaci)
 *   dnes          'RRRR-MM-DD'
 *   minDatum      nejstarší datum, které lze zapsat/upravit ('' = bez omezení)
 *   jeCteni(rok)  true = rok je jen ke čtení (bez přidávání a úprav)
 *   lzePridat     false = bez tlačítka „+ Přidat řádek“
 *   lzeUpravit(z) true = zápis lze upravit/smazat
 *   orgProDatum(datum)  → [{id, nazev}] organizace, pro které lze k datu zapisovat
 *   cinnostiOrg(orgId)  → [činnosti]
 *   ulozit(data)  → Promise<nová pole zápisů>; data = {id, datum, orgId, od, do, cinnost, poznamka}
 *   smazat(id)    → Promise<nová pole zápisů>
 *   potvrdit(text)→ Promise<boolean> (výchozí: window.confirm)
 *
 * Chyby uložení vyhazuje host jako Error se srozumitelnou českou zprávou; komponenta je ukáže u řádku.
 * Server pravidla vždy ověřuje znovu – tato stránka je jen pohodlí.
 */
(function (global) {
  'use strict';
  var MESICE = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
  var DNY = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtMin(m) { m = Math.round(+m || 0); var h = Math.floor(m / 60), r = m % 60; return !h ? r + ' min' : h + ' h' + (r ? ' ' + r + ' min' : ''); }
  function suma(a) { return a.reduce(function (s, x) { return s + (x.minut || 0); }, 0); }
  function hm(t) { var m = String(t || '').match(/^(\d{1,2}):(\d{2})/); return m ? +m[1] + ':' + m[2] : ''; }
  function minutOdDo(od, doo) {
    var a = String(od).match(/^(\d{1,2}):(\d{2})/), b = String(doo).match(/^(\d{1,2}):(\d{2})/);
    if (!a || !b) return 0;
    var m = (+b[1] * 60 + +b[2]) - (+a[1] * 60 + +a[2]);
    return m > 0 ? m : 0;
  }
  function denText(datum) {
    var p = String(datum).split('-').map(Number);
    return DNY[new Date(p[0], p[1] - 1, p[2]).getDay()] + ' ' + p[2] + '. ' + p[1] + '.';
  }
  function datumCz(datum) { return String(datum).split('-').reverse().map(Number).join('. '); }
  function stavHtml(s) {
    var t = s === 'Schváleno' ? 'ok' : s === 'Zamítnuto' ? 'no' : 'wait';
    return '<span class="rh-st rh-' + t + '">' + esc(s) + '</span>';
  }
  function casVyber(id, hodnota, popisek) {
    var m = String(hodnota || '').match(/^(\d{1,2}):(\d{2})/);
    var h = m ? +m[1] : '', mi = m ? +m[2] : 0, i, hOpt = '<option value="">—</option>', mOpt = '';
    for (i = 0; i <= 24; i++) hOpt += '<option value="' + i + '"' + (i === h ? ' selected' : '') + '>' + i + '</option>';
    for (i = 0; i < 60; i += 5) mOpt += '<option value="' + i + '"' + (i === mi ? ' selected' : '') + '>' + (i < 10 ? '0' : '') + i + '</option>';
    return '<span class="rh-cv"><select data-k="' + id + 'H" aria-label="' + popisek + ' – hodiny">' + hOpt + '</select><b>:</b><select data-k="' + id + 'M" aria-label="' + popisek + ' – minuty">' + mOpt + '</select></span>';
  }

  var CSS =
    '.rh-roky,.rh-orgs{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}' +
    '.rh-orgs{margin-top:-2px}' +
    '.rh-tab{border:1px solid var(--border,#e6d6d5);background:#fff;border-radius:999px;padding:7px 14px;font:inherit;font-size:14px;cursor:pointer;color:inherit}' +
    '.rh-tab.on{background:var(--accent,#fbe9e8);border-color:var(--primary,#c4524e);color:var(--primary,#c4524e);font-weight:600}' +
    '.rh-orgs .rh-tab{font-size:13px;padding:5px 11px}' +
    '.rh-souhrn{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin:4px 2px 8px;font-size:14px}' +
    '.rh-souhrn .rh-muted{color:var(--muted,#6e6262);font-size:13px}' +
    '.rh-add{border:1px dashed var(--primary,#c4524e);background:#fff;color:var(--primary,#c4524e);border-radius:10px;padding:9px 14px;font:inherit;font-size:14px;font-weight:600;cursor:pointer;width:100%;margin-bottom:6px}' +
    '.rh-mesic{display:flex;justify-content:space-between;align-items:baseline;margin:16px 4px 6px}' +
    '.rh-mesic h3{margin:0;font-size:15px;font-weight:600;text-transform:capitalize}' +
    '.rh-mesic span{color:var(--muted,#6e6262);font-size:13px}' +
    '.rh-row{background:#fff;border:1px solid var(--border,#e6d6d5);border-radius:10px;padding:9px 12px;margin-bottom:6px}' +
    '.rh-r1{display:flex;gap:10px;align-items:baseline}' +
    '.rh-d{font-weight:600;min-width:70px}' +
    '.rh-t{flex:1;color:var(--muted,#6e6262);font-size:14px}' +
    '.rh-h{font-weight:600;white-space:nowrap}' +
    '.rh-r2{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:2px;font-size:14px}' +
    '.rh-c{flex:1;min-width:0}' +
    '.rh-o{color:var(--muted,#6e6262);font-size:13px}' +
    '.rh-st{display:inline-block;font-size:12px;font-weight:600;padding:1px 8px;border-radius:999px}' +
    '.rh-ok{background:var(--ok-bg,#dff3e7);color:var(--ok,#1f7a4d)}.rh-wait{background:var(--wait-bg,#fff3d6);color:var(--wait,#8a5a00)}.rh-no{background:var(--error-bg,#fdecea);color:var(--error,#b42318)}' +
    '.rh-ik{border:1px solid var(--border,#e6d6d5);background:#fff;border-radius:8px;padding:3px 9px;font:inherit;font-size:14px;cursor:pointer;color:inherit}' +
    '.rh-ik:hover{border-color:var(--primary,#c4524e)}' +
    '.rh-edit{background:var(--accent,#fbe9e8);border:1px solid var(--primary,#c4524e);border-radius:10px;padding:12px;margin-bottom:8px}' +
    '.rh-edit label{display:block;font-weight:600;font-size:13px;margin:10px 0 4px}' +
    '.rh-edit label:first-child{margin-top:0}' +
    '.rh-edit input[type=date],.rh-edit input[type=text],.rh-edit select{width:100%;padding:9px 10px;border:1px solid var(--border,#e6d6d5);border-radius:8px;background:#fff;font:inherit;font-size:15px}' +
    '.rh-cas{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px}' +
    '.rh-cv{display:inline-flex;align-items:center;gap:3px}.rh-cv select{width:auto;min-width:62px}' +
    '.rh-vysl{color:var(--primary,#c4524e);font-weight:600;margin-left:auto}' +
    '.rh-btns{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}' +
    '.rh-btns button{border-radius:10px;padding:9px 16px;font:inherit;font-weight:600;cursor:pointer;border:1px solid var(--border,#e6d6d5);background:#fff;color:inherit}' +
    '.rh-btns button.p{background:var(--primary,#c4524e);border-color:var(--primary,#c4524e);color:#fff}' +
    '.rh-btns button:disabled{opacity:.6;cursor:wait}' +
    '.rh-chyba{background:var(--error-bg,#fdecea);color:var(--error,#b42318);padding:8px 10px;border-radius:8px;margin-top:10px;font-size:14px}' +
    '.rh-info{background:var(--accent,#fbe9e8);padding:8px 12px;border-radius:10px;font-size:13px;margin-bottom:8px}' +
    '.rh-prazdno{text-align:center;color:var(--muted,#6e6262);padding:16px 0}';

  function pridejStyl() {
    if (document.getElementById('rh-css')) return;
    var s = document.createElement('style'); s.id = 'rh-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  function mount(el, o) {
    pridejStyl();
    var zaznamy = o.zaznamy || [], dnes = o.dnes;
    var rok = dnes.slice(0, 4), org = '';
    var pridavani = false, upravovane = '';

    function q(s, k) { return (k || el).querySelector(s); }
    function qa(s, k) { return Array.prototype.slice.call((k || el).querySelectorAll(s)); }
    function jeCteni(r) { return o.jeCteni ? !!o.jeCteni(r) : false; }
    function potvrdit(t) { return o.potvrdit ? o.potvrdit(t) : Promise.resolve(window.confirm(t)); }

    function roky() {
      var r = zaznamy.map(function (x) { return x.datum.slice(0, 4); }); r.push(dnes.slice(0, 4));
      return r.filter(function (x, i, a) { return a.indexOf(x) === i; }).sort().reverse();
    }
    function orgTabs() {
      var m = {}, vys = [];
      (o.organizace || []).forEach(function (x) { if (!m[x.id]) { m[x.id] = 1; vys.push({ id: x.id, nazev: x.nazev }); } });
      zaznamy.forEach(function (x) { if (x.orgId && !m[x.orgId]) { m[x.orgId] = 1; vys.push({ id: x.orgId, nazev: x.org || x.orgId }); } });
      return vys;
    }

    function kresli() {
      var rr = roky(); if (rr.indexOf(rok) < 0) rok = rr[0];
      var tabs = orgTabs(); if (tabs.length < 2) org = ''; else if (org && !tabs.some(function (t) { return t.id === org; })) org = '';
      var vRoce = zaznamy.filter(function (x) { return x.datum.slice(0, 4) === rok && (!org || x.orgId === org); });
      var cteni = jeCteni(rok);
      var html = '<div class="rh-roky">' + rr.map(function (r) { return '<button type="button" class="rh-tab' + (r === rok ? ' on' : '') + '" data-rok="' + r + '">' + r + '</button>'; }).join('') + '</div>';
      if (tabs.length > 1) {
        html += '<div class="rh-orgs">' + [{ id: '', nazev: 'Všechny' }].concat(tabs).map(function (t) { return '<button type="button" class="rh-tab' + (t.id === org ? ' on' : '') + '" data-org="' + esc(t.id) + '">' + esc(t.nazev) + '</button>'; }).join('') + '</div>';
      }
      var platne = vRoce.filter(function (x) { return x.stav !== 'Zamítnuto'; });
      var schv = vRoce.filter(function (x) { return x.stav === 'Schváleno'; });
      html += '<div class="rh-souhrn"><span><strong>' + esc(rok) + ': ' + esc(fmtMin(suma(platne))) + '</strong>' +
        (suma(schv) !== suma(platne) ? ' <span class="rh-muted">· schváleno ' + esc(fmtMin(suma(schv))) + '</span>' : '') + '</span>' +
        (cteni ? '<span class="rh-muted">rok je jen ke čtení</span>' : '') + '</div>';
      if (!cteni && o.lzePridat !== false) {
        html += pridavani ? editor({}, true) : '<button type="button" class="rh-add" data-a="pridat">+ Přidat řádek</button>';
      }
      if (!vRoce.length) {
        html += '<div class="rh-prazdno">V roce ' + esc(rok) + ' zatím nejsou žádné hodiny.</div>';
      } else {
        var mesice = {};
        vRoce.forEach(function (x) { (mesice[x.datum.slice(0, 7)] = mesice[x.datum.slice(0, 7)] || []).push(x); });
        Object.keys(mesice).sort().reverse().forEach(function (k) {
          var a = mesice[k].slice().sort(function (x, y) { return (y.datum + (y.od || '')).localeCompare(x.datum + (x.od || '')); });
          var p = a.filter(function (x) { return x.stav !== 'Zamítnuto'; });
          html += '<div class="rh-mesic"><h3>' + MESICE[+k.slice(5) - 1] + ' ' + esc(k.slice(0, 4)) + '</h3><span>' + esc(fmtMin(suma(p))) + '</span></div>';
          a.forEach(function (x) { html += x.id === upravovane ? editor(x, false) : radek(x, cteni, !org && tabs.length > 1); });
        });
      }
      el.innerHTML = '<div class="rh">' + html + '</div>';
      napoj();
    }

    function radek(x, cteni, ukazOrg) {
      var lze = !cteni && o.lzeUpravit && o.lzeUpravit(x);
      return '<div class="rh-row" data-id="' + esc(x.id) + '"><div class="rh-r1"><span class="rh-d">' + esc(denText(x.datum)) + '</span>' +
        '<span class="rh-t">' + (x.od ? esc(hm(x.od) + '–' + hm(x.do)) : 'bez času od–do') + '</span><span class="rh-h">' + esc(fmtMin(x.minut)) + '</span></div>' +
        '<div class="rh-r2"><span class="rh-c">' + esc(x.cinnost) + (ukazOrg ? ' <span class="rh-o">· ' + esc(x.org) + '</span>' : '') + '</span>' +
        (x.stav !== 'Schváleno' ? stavHtml(x.stav) : '') +
        (lze ? '<button type="button" class="rh-ik" data-a="upravit" title="Upravit" aria-label="Upravit">✎</button>' : '') + '</div></div>';
    }

    function editor(x, novy) {
      var datum = x.datum || (dnes.slice(0, 4) === rok ? dnes : rok + '-12-31');
      var max = dnes, min = o.minDatum || '';
      return '<div class="rh-edit" data-edit="' + esc(novy ? '' : x.id) + '">' +
        '<label>Datum</label><input type="date" data-k="datum" value="' + esc(datum) + '" max="' + esc(max) + '"' + (min ? ' min="' + esc(min) + '"' : '') + '>' +
        '<label>Čas <span class="rh-vysl" data-k="vysl"></span></label><div class="rh-cas"><span>od</span>' + casVyber('od', x.od, 'Od') + '<span>do</span>' + casVyber('do', x.do, 'Do') + '</div>' +
        (x.minut && !x.od ? '<div class="rh-info" style="margin-top:8px">Původní zápis má jen délku (' + esc(fmtMin(x.minut)) + '). Doplňte prosím čas od–do.</div>' : '') +
        '<label>Organizace</label><select data-k="org"></select>' +
        '<label>Činnost</label><select data-k="cin"></select><input type="text" data-k="cinText" maxlength="200" placeholder="Napište, co se dělalo" hidden style="margin-top:6px">' +
        '<label>Poznámka <span style="font-weight:400">(nepovinné)</span></label><input type="text" data-k="pozn" maxlength="1000" value="' + esc(x.poznamka || '') + '">' +
        '<div class="rh-chyba" data-k="chyba" hidden></div>' +
        '<div class="rh-btns"><button type="button" class="p" data-a="ulozit">Uložit</button><button type="button" data-a="zrusit">Zrušit</button>' +
        (novy ? '' : '<button type="button" data-a="smazat" style="margin-left:auto;color:var(--error,#b42318)">Smazat</button>') + '</div></div>';
    }

    function napoj() {
      var ed = q('.rh-edit');
      if (!ed) return;
      var x = upravovane ? (zaznamy.filter(function (z) { return z.id === upravovane; })[0] || {}) : {};
      var orgId = x.orgId || (org || '');
      function k(n) { return q('[data-k="' + n + '"]', ed); }
      function cti(id) { var h = k(id + 'H').value; return h === '' ? '' : (h.length < 2 ? '0' : '') + h + ':' + ('0' + k(id + 'M').value).slice(-2); }
      function cas() {
        var od = cti('od'), doo = cti('do'), m = od && doo ? minutOdDo(od, doo) : 0;
        return { od: od, do: doo, minut: m, chyba: !od || !doo ? 'Zadejte čas od i do.' : !m ? 'Čas „do“ musí být později než „od“ téhož dne (konec dne je 24:00).' : '' };
      }
      function prepocet() {
        ['od', 'do'].forEach(function (id) {
          var h = k(id + 'H'), m = k(id + 'M');
          if (h.value === '24') m.value = '0';
          m.disabled = h.value === '24';
        });
        var m = cas().minut; k('vysl').textContent = m ? '= ' + fmtMin(m) : '';
      }
      function orgs() { return o.orgProDatum ? o.orgProDatum(k('datum').value || dnes) : []; }
      function obnovOrg() {
        var os = orgs();
        if (!os.some(function (z) { return z.id === orgId; })) orgId = os.length === 1 ? os[0].id : '';
        k('org').innerHTML = (os.length > 1 && !orgId ? '<option value="">— vyberte organizaci —</option>' : '') +
          (os.length ? os.map(function (z) { return '<option value="' + esc(z.id) + '"' + (z.id === orgId ? ' selected' : '') + '>' + esc(z.nazev) + '</option>'; }).join('') : '<option value="">— k tomuto dni není přiřazení —</option>');
        obnovCin();
      }
      var cinPuv = x.cinnost || '';
      function obnovCin() {
        var c = (orgId && o.cinnostiOrg ? o.cinnostiOrg(orgId) : []) || [];
        var jina = cinPuv && c.indexOf(cinPuv) < 0;
        k('cin').innerHTML = '<option value="">— vyberte činnost —</option>' + c.map(function (z) { return '<option' + (z === cinPuv ? ' selected' : '') + '>' + esc(z) + '</option>'; }).join('') +
          '<option value="__jina"' + (jina ? ' selected' : '') + '>Jiné…</option>';
        k('cinText').hidden = k('cin').value !== '__jina';
        if (jina) k('cinText').value = cinPuv;
      }
      k('datum').addEventListener('change', obnovOrg);
      k('org').addEventListener('change', function () { orgId = k('org').value; obnovCin(); });
      k('cin').addEventListener('change', function () {
        cinPuv = k('cin').value === '__jina' ? (k('cinText').value || '') : k('cin').value;
        k('cinText').hidden = k('cin').value !== '__jina'; if (!k('cinText').hidden) k('cinText').focus();
      });
      k('cinText').addEventListener('input', function () { cinPuv = k('cinText').value; });
      ['odH', 'odM', 'doH', 'doM'].forEach(function (n) { k(n).addEventListener('change', prepocet); });
      obnovOrg(); prepocet();

      ed.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-a]'); if (!b) return;
        var a = b.dataset.a;
        if (a === 'zrusit') { pridavani = false; upravovane = ''; kresli(); return; }
        var ch = k('chyba');
        function chyba(t) { ch.textContent = t; ch.hidden = !t; }
        if (a === 'smazat') {
          potvrdit('Opravdu smazat tento zápis?').then(function (ano) {
            if (!ano) return;
            b.disabled = true;
            o.smazat(x.id).then(function (n) { zaznamy = n; upravovane = ''; kresli(); }, function (er) { chyba(er.message || 'Nepodařilo se smazat.'); b.disabled = false; });
          });
          return;
        }
        if (a !== 'ulozit') return;
        var c = cas(), datum = k('datum').value, cin = k('cin').value === '__jina' ? k('cinText').value.trim() : k('cin').value;
        var t = !datum ? 'Zadejte datum.' : datum > dnes ? 'Hodiny nelze zapsat do budoucnosti.' : (o.minDatum && datum < o.minDatum) ? 'Zapsat lze jen dny od ' + datumCz(o.minDatum) + '.' :
          !orgId ? (orgs().length ? 'Vyberte, pro kterou organizaci hodiny zapisujete.' : 'K tomuto dni není přiřazení k žádné organizaci.') : c.chyba ? c.chyba : !cin ? 'Vyberte činnost.' : '';
        if (t) { chyba(t); return; }
        chyba(''); b.disabled = true; b.textContent = 'Ukládám…';
        o.ulozit({ id: x.id || '', datum: datum, orgId: orgId, od: c.od, do: c.do, cinnost: cin, poznamka: k('pozn').value }).then(function (n) {
          zaznamy = n; pridavani = false; upravovane = ''; rok = datum.slice(0, 4); kresli();
        }, function (er) { chyba(er.message || 'Nepodařilo se uložit.'); b.disabled = false; b.textContent = 'Uložit'; });
      });
    }

    el.addEventListener('click', function (e) {
      var t = e.target.closest('button[data-rok],button[data-org],button[data-a]');
      if (!t || t.closest('.rh-edit')) return;
      if (t.dataset.rok) { rok = t.dataset.rok; pridavani = false; upravovane = ''; kresli(); }
      else if (t.dataset.org !== undefined && t.classList.contains('rh-tab')) { org = t.dataset.org; kresli(); }
      else if (t.dataset.a === 'pridat') { pridavani = true; upravovane = ''; kresli(); var ed = q('.rh-edit'); if (ed && ed.scrollIntoView) ed.scrollIntoView({ block: 'nearest' }); }
      else if (t.dataset.a === 'upravit') { upravovane = t.closest('.rh-row').dataset.id; pridavani = false; kresli(); }
    });

    kresli();
    return { nastav: function (n) {
      zaznamy = n;
      if (upravovane && !n.some(function (z) { return z.id === upravovane; })) upravovane = '';
      if (!pridavani && !upravovane) kresli();
    } };
  }

  global.RocniHodiny = { mount: mount };
})(window);
