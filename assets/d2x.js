/* Dashboard 2.0 – Entwürfe D (Widgets), E (Zeitachse), F (Portfolio-Karte). Daniel, 17.11.2026.
   Lädt nach der Anmeldung Projekte, Aufgaben (inkl. Meilensteine), Termine und Briefing aus der Datenbank.
   Gemeinsam: Farbe = wer am Zug ist (du · Claude · andere), Klick auf ein Projekt öffnet das Seitenfenster mit allen Details. */
(function () {
  "use strict";
  var db = window.empiriaDb, el = document.querySelector("[data-d2x]");
  if (!db || !el) return;
  var art = el.getAttribute("data-d2x"), D, HEUTE;
  var MARKEN = ["empiria", "sofortsichtbar", "Müller&Ströbel."];
  var MK = { "empiria": "empiria", "sofortsichtbar": "sofortsichtbar", "Müller&Ströbel.": "ms" };
  var WER = { du: "Du", claude: "Claude", andere: "Andere", offen: "Ohne Zuständigkeit" };

  /* ---------- Hilfen ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function iso(d) { return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }); }
  function tagPlus(s, n) { return iso(new Date(new Date(s + "T12:00:00").getTime() + n * 86400000)); }
  function datum(f) { return f ? f.slice(8, 10) + "." + f.slice(5, 7) + "." : ""; }
  function uhr(ts) { return ts ? new Date(ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }) : ""; }
  function istDaniel(v) { return v === "Daniel" || /^Daniel /.test(v || ""); }
  function wer(a) { return a.v === "Claude" ? "claude" : istDaniel(a.v) ? "du" : (!a.v || a.v === "Zuständigkeit offen") ? "offen" : "andere"; }
  function istGate(a) { return a.art === "gate" || a.art === "projektgate"; }
  function wartetAufDich(a) { return a.v === "Claude" && (a.s === "zur_abnahme" || a.s === "rueckfrage"); }
  function spaet(f) { return f && f < HEUTE; }
  function frist(f) { if (!f) return "ohne Termin"; if (spaet(f)) return '<span class="x-spaet">seit ' + datum(f) + "</span>"; if (f === HEUTE) return "heute"; if (f === tagPlus(HEUTE, 1)) return "morgen"; return "bis " + datum(f); }
  function nachDatum(a, b) { return (a.f || "9") < (b.f || "9") ? -1 : (a.f || "9") > (b.f || "9") ? 1 : 0; }
  function projekt(id) { for (var i = 0; i < D.projekte.length; i++) if (D.projekte[i].id === id) return D.projekte[i]; return null; }
  function pname(id) { var p = projekt(id); return p ? p.name : ""; }
  function mpunkt(marke) { return '<span class="x-m x-m-' + (MK[marke] || "ms") + '" title="' + esc(marke) + '"></span>'; }
  function initialen(n) { return String(n || "?").replace(/&.*$/, "").split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase(); }
  function avaFarbe(n) { var h = 0; for (var i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) % 360; return "hsl(" + h + ",55%,48%)"; }
  function ava(n) { return '<span class="x-ava" style="background:' + avaFarbe(n || "") + '" title="' + esc(n) + '">' + esc(initialen(n)) + "</span>"; }
  function aufgabenVon(pid) { return D.aufgaben.filter(function (a) { return a.p === pid; }); }
  /* nächster Schritt: aktive Aufgabe mit frühester Frist, sonst Backlog-Aufgabe der nächsten 60 Tage */
  function naechster(pid) {
    var l = aufgabenVon(pid).filter(function (a) { return !istGate(a) && a.sp !== "backlog"; }).sort(nachDatum);
    if (!l.length) l = aufgabenVon(pid).filter(function (a) { return !istGate(a) && a.f && a.f <= tagPlus(HEUTE, 60); }).sort(nachDatum);
    return l[0] || null;
  }
  /* Zustand eines Projekts: wer hat den Ball? */
  function zustand(pid) {
    if (aufgabenVon(pid).some(wartetAufDich)) return { k: "du", a: aufgabenVon(pid).filter(wartetAufDich)[0], abnahme: true };
    var n = naechster(pid);
    if (!n) return { k: "leer", a: null };
    var w = wer(n); return { k: w === "offen" ? "leer" : w, a: n };
  }

  /* ---------- Laden ---------- */
  var jetzt = new Date(); HEUTE = iso(jetzt);
  el.innerHTML = '<p class="x-laedt">Lädt …</p>';
  db.auth.getSession().then(function (s) {
    if (!s.data.session) { el.innerHTML = '<div class="x-in"><p class="x-hinweis">Bitte einmal auf der <a href="/strategie/kontakte.html?zurueck=' + encodeURIComponent(location.pathname) + '">Kontaktseite</a> anmelden, dann erscheinen hier deine Daten.</p></div>'; return; }
    var von = new Date(HEUTE + "T00:00:00"), bis = new Date(von.getTime() + 90 * 86400000);
    Promise.all([
      db.from("projekte").select("id, name, marke, typ, phase").eq("status", "läuft"),
      db.from("aufgaben").select("id, projekt_id, titel, verantwortlich, faellig_am, ticket_stand, spalte, art").eq("status", "offen"),
      db.from("termine").select("start, ende, ganztags, betreff, postfach, abgesagt, projekt_id").gte("start", von.toISOString()).lt("start", bis.toISOString()).order("start"),
      db.from("briefing").select("gilt_fuer, rang, titel, kern, knopf, link").gte("gilt_fuer", tagPlus(HEUTE, -1)).lte("gilt_fuer", tagPlus(HEUTE, 1)).order("gilt_fuer", { ascending: false }).order("rang")
    ]).then(function (r) {
      var f = r.filter(function (x) { return x.error; })[0];
      if (f) { el.innerHTML = '<div class="x-in"><p class="x-hinweis">Daten konnten nicht geladen werden: ' + esc(f.error.message) + "</p></div>"; return; }
      var projekte = r[0].data || [], ids = projekte.map(function (p) { return p.id; });
      var br = r[3].data || [], neuester = br.length ? br[0].gilt_fuer : null;
      D = {
        projekte: projekte,
        aufgaben: (r[1].data || []).filter(function (a) { return ids.indexOf(a.projekt_id) >= 0; }).map(function (a) {
          return { id: a.id, p: a.projekt_id, t: a.titel, v: a.verantwortlich, f: a.faellig_am, s: a.ticket_stand, sp: a.spalte, art: a.art };
        }),
        termine: (r[2].data || []).filter(function (t) { return !t.abgesagt; }),
        briefing: br.filter(function (b) { return b.gilt_fuer === neuester; })
      };
      if (art === "d") widgets(); else if (art === "e") zeitachse(); else if (art === "f") portfolio();
      fensterBauen();
    });
  });

  /* ---------- Seitenfenster: alles zu einem Projekt ---------- */
  var schleier, fenster;
  function fensterBauen() {
    schleier = document.createElement("div"); schleier.className = "x-schleier";
    fenster = document.createElement("aside"); fenster.className = "x-fenster"; fenster.setAttribute("aria-label", "Projekt");
    document.body.appendChild(schleier); document.body.appendChild(fenster);
    schleier.addEventListener("click", zu);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") zu(); });
    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-pid]"); if (!t || fenster.contains(t)) return;
      e.preventDefault(); auf(+t.getAttribute("data-pid"));
    });
  }
  function zu() { fenster.classList.remove("is-auf"); schleier.classList.remove("is-auf"); }
  function auf(pid) {
    var p = projekt(pid); if (!p) return;
    var auf_ = aufgabenVon(pid), aktiv = auf_.filter(function (a) { return !istGate(a); }).sort(nachDatum);
    function liste(titel, kl, l) {
      return "<h3><span class=\"x-punkt x-p-" + kl + "\"></span>" + titel + '</h3><ul class="x-fliste">' + (l.length ? l.map(function (a) {
        var zusatz = wartetAufDich(a) ? (a.s === "rueckfrage" ? "Rückfrage an dich" : "Wartet auf deine Abnahme") : (kl === "andere" ? esc(a.v) : "");
        return "<li><span>" + esc(a.t) + (zusatz ? "<small>" + zusatz + "</small>" : "") + '</span><span class="x-rechts">' + frist(a.f) + "</span></li>";
      }).join("") : '<li class="x-leer">Nichts offen</li>') + "</ul>";
    }
    var termine = D.termine.filter(function (t) { return t.projekt_id === pid; });
    var gates = auf_.filter(istGate).sort(nachDatum);
    fenster.innerHTML = '<div class="x-fenster-kopf"><div><p>' + mpunkt(p.marke) + esc(p.marke) + (p.typ ? " · " + esc(p.typ) : "") + (p.phase ? " · " + esc(p.phase) : "") +
      "</p><h2>" + esc(p.name) + '</h2></div><button class="x-zu" type="button" aria-label="Schließen">×</button></div><div class="x-fenster-in">' +
      liste("Bei dir", "du", aktiv.filter(function (a) { return wer(a) === "du" || wartetAufDich(a); })) +
      liste("Bei Claude", "claude", aktiv.filter(function (a) { return wer(a) === "claude" && !wartetAufDich(a); })) +
      liste("Bei anderen", "andere", aktiv.filter(function (a) { return wer(a) === "andere" || wer(a) === "offen"; })) +
      (termine.length ? '<h3>Termine</h3><ul class="x-fliste">' + termine.map(function (t) {
        return "<li><span>" + esc(t.betreff) + '</span><span class="x-rechts">' + datum(iso(new Date(t.start))) + " " + uhr(t.start) + "</span></li>";
      }).join("") + "</ul>" : "") +
      (gates.length ? '<h3>Meilensteine</h3><ul class="x-fliste">' + gates.map(function (a) {
        return "<li><span>" + esc(a.t) + '</span><span class="x-rechts">' + (a.f ? datum(a.f) + a.f.slice(0, 4) : "") + "</span></li>";
      }).join("") + "</ul>" : "") +
      '<a class="x-auf" href="/strategie/projekte.html#p=' + pid + '">Im Projekt öffnen</a></div>';
    fenster.querySelector(".x-zu").addEventListener("click", zu);
    fenster.scrollTop = 0;
    fenster.classList.add("is-auf"); schleier.classList.add("is-auf");
  }

  function kopf(titel, unter) {
    return '<span class="x-entwurf">Entwurf · Live-Daten · Klick auf ein Projekt öffnet alle Details</span><h1 class="x-titel">' + titel + '</h1><p class="x-unter">' + unter + "</p>";
  }
  var IKON = {
    stern: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1l2 4.5 5 .5-3.8 3.3 1.1 4.9L8 11.6 3.7 14.2l1.1-4.9L1 6l5-.5z"/></svg>',
    hand: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/></svg>',
    kal: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="12" height="11" rx="2"/><path d="M2 7h12M5.5 1.5v3M10.5 1.5v3"/></svg>',
    blitz: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M9 1L3 9h4l-1 6 6-8H8z"/></svg>',
    leute: '<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="5.5" cy="5" r="2.5"/><circle cx="11" cy="5.5" r="2"/><path d="M1 13c0-2.5 2-4 4.5-4S10 10.5 10 13zM10.5 13c0-1.6-.5-2.7-1.4-3.4 2.6-.5 5.9.6 5.9 3.4z"/></svg>',
    raster: '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5"/><rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5"/><rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5"/><rect x="9" y="9" width="5.5" height="5.5" rx="1.5"/></svg>'
  };
  function ikon(n, farbe) { return '<span class="x-ikon" style="background:' + farbe + '">' + IKON[n] + "</span>"; }

  /* =============== D · Widgets =============== */
  function widgets() {
    var h = jetzt.getHours(), gruss = h < 11 ? "Guten Morgen" : h < 18 ? "Guten Tag" : "Guten Abend";
    var heuteLang = jetzt.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", timeZone: "Europe/Berlin" });

    var dran = D.aufgaben.filter(wartetAufDich).map(function (a) { return { a: a, typ: a.s === "rueckfrage" ? "Rückfrage" : "Abnahme" }; })
      .concat(D.aufgaben.filter(function (a) { return wer(a) === "du" && !istGate(a) && a.sp !== "backlog" && a.f && a.f <= tagPlus(HEUTE, 7); })
        .sort(nachDatum).map(function (a) { return { a: a, typ: spaet(a.f) ? "überfällig" : "fällig" }; }));
    function dranZeile(x) {
      var kl = x.typ === "Abnahme" ? "x-b-du" : x.typ === "Rückfrage" ? "x-b-andere" : x.typ === "überfällig" ? "x-b-rot" : "x-b-grau";
      return '<li data-pid="' + x.a.p + '"><span class="x-badge ' + kl + '">' + x.typ + '</span><span class="x-txt"><b>' + esc(x.a.t) + "</b><small>" + esc(pname(x.a.p)) +
        '</small></span><span class="x-klein">' + (x.typ === "Abnahme" || x.typ === "Rückfrage" ? "" : frist(x.a.f)) + "</span></li>";
    }

    /* 14 Tage: Fristen, Meilensteine und Termine je Tag */
    var tage = [];
    var mo = tagPlus(HEUTE, -((new Date(HEUTE + "T12:00:00").getDay() + 6) % 7));
    for (var i = 0; i < 14; i++) {
      var t = tagPlus(mo, i), d = new Date(t + "T12:00:00");
      var ein = D.aufgaben.filter(function (a) { return a.f === t; }).sort(function (a, b) { return istGate(b) - istGate(a); }).map(function (a) {
        return '<button type="button" class="x-ein ' + (istGate(a) ? "x-ein-gate" : "x-ein-" + wer(a)) + '" data-pid="' + a.p + '" title="' + esc(a.t + " · " + pname(a.p)) + '">' + esc(a.t) + "</button>";
      }).join("") + D.termine.filter(function (x) { return !x.ganztags && iso(new Date(x.start)) === t; }).map(function (x) {
        return '<span class="x-ein x-ein-termin" title="' + esc(x.betreff) + '"><i>' + uhr(x.start) + "</i>" + esc(x.betreff) + "</span>";
      }).join("");
      tage.push('<div class="x-tag' + (t === HEUTE ? " is-heute" : t < HEUTE ? " is-vorbei" : "") + (d.getDay() % 6 === 0 ? " is-we" : "") + '"><div class="x-tag-kopf"><b>' + d.getDate() + "</b><span>" +
        d.toLocaleDateString("de-DE", { weekday: "short" }).replace(".", "") + "</span></div>" + ein + "</div>");
    }

    var laeuft = D.aufgaben.filter(function (a) { return a.v === "Claude" && a.s === "in_arbeit"; });
    var bereit = D.aufgaben.filter(function (a) { return a.v === "Claude" && a.s === "bereit"; }).sort(nachDatum).slice(0, 5 - Math.min(laeuft.length, 2));
    var claudeZ = laeuft.map(function (a) { return '<li data-pid="' + a.p + '"><span class="x-punkt x-p-claude x-laeuft"></span><span class="x-txt"><b>' + esc(a.t) + "</b><small>läuft gerade · " + esc(pname(a.p)) + "</small></span></li>"; })
      .concat(bereit.map(function (a) { return '<li data-pid="' + a.p + '"><span class="x-punkt x-p-claude"></span><span class="x-txt"><b>' + esc(a.t) + "</b><small>" + esc(pname(a.p)) + '</small></span><span class="x-klein">' + frist(a.f) + "</span></li>"; })).join("");

    var andere = {}; D.aufgaben.filter(function (a) { return wer(a) === "andere" && spaet(a.f) && !istGate(a); }).forEach(function (a) { (andere[a.v] = andere[a.v] || []).push(a); });
    var nach = Object.keys(andere).sort().map(function (n) {
      var l = andere[n].sort(nachDatum);
      return '<li data-pid="' + l[0].p + '">' + ava(n) + '<span class="x-txt"><b>' + esc(n) + "</b><small>" + l.map(function (a) { return esc(a.t); }).join(" · ") + '</small></span><span class="x-klein">' + frist(l[0].f) + "</span></li>";
    }).join("");

    var chips = MARKEN.map(function (m) {
      return "<div><h3>" + mpunkt(m) + esc(m) + '</h3><div class="x-chips">' + D.projekte.filter(function (p) { return p.marke === m; }).map(function (p) {
        var z = zustand(p.id);
        return '<button type="button" class="x-chip' + (z.k === "leer" ? " is-leer" : "") + '" data-pid="' + p.id + '">' +
          (z.k !== "leer" ? '<span class="x-punkt x-p-' + z.k + '"></span>' : "") + esc(p.name) + "</button>";
      }).join("") + "</div></div>";
    }).join("");

    el.innerHTML = '<div class="x-in">' +
      '<div class="x-w-kopf"><div>' + kopf(gruss + ", Daniel.", heuteLang) + '</div><label class="x-suche"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7" cy="7" r="5"/><path d="M11 11l3.5 3.5" stroke-linecap="round"/></svg>' +
      '<input type="search" placeholder="Projekt oder Aufgabe suchen" aria-label="Suchen" data-suche></label></div>' +
      '<div class="x-treffer" data-treffer hidden></div>' +
      '<div class="x-raster">' +
      '<section class="x-karte x-s7 x-briefing"><h2>' + ikon("stern", "#af52de") + 'Drei Dinge zuerst<span class="x-klein">Claude als Stabschef</span></h2>' +
      (D.briefing.length ? '<ul class="x-imp">' + D.briefing.map(function (b) {
        return "<li><div><b>" + esc(b.titel) + "</b><span>" + esc(b.kern) + '</span></div><a href="' + esc(b.link || "/strategie/steuerung.html") + '">' + esc(b.knopf || "Ansehen") + "</a></li>";
      }).join("") + "</ul>" : '<p class="x-klein">Für heute liegt noch kein Briefing vor.</p>') + "</section>" +
      '<section class="x-karte x-s5"><h2>' + ikon("hand", "#ff9500") + 'Du bist am Zug<span class="x-klein">diese Woche</span></h2><ul class="x-zeilen" data-dran>' +
      dran.slice(0, 6).map(dranZeile).join("") + "</ul>" + (dran.length > 6 ? '<button type="button" class="x-mehr" data-mehr>Alle anzeigen</button>' : "") + "</section>" +
      '<section class="x-karte"><h2>' + ikon("kal", "#007aff") + 'Diese und nächste Woche<span class="x-klein">Fristen, Meilensteine und Termine</span></h2>' +
      '<div class="x-legende"><span><i class="x-punkt x-p-du"></i>Du</span><span><i class="x-punkt x-p-claude"></i>Claude</span><span><i class="x-punkt x-p-andere"></i>Andere</span><span><i class="x-punkt" style="background:#1d1d1f"></i>Meilenstein</span><span>Uhrzeit = Termin</span></div>' +
      '<div class="x-tage">' + tage.join("") + "</div></section>" +
      '<section class="x-karte x-s6"><h2>' + ikon("blitz", "#af52de") + "Claude arbeitet</h2>" + (claudeZ ? '<ul class="x-zeilen">' + claudeZ + "</ul>" : '<p class="x-klein">Gerade kein Ticket bereit.</p>') + "</section>" +
      '<section class="x-karte x-s6"><h2>' + ikon("leute", "#007aff") + 'Nachhaken<span class="x-klein">überfällig bei anderen</span></h2>' + (nach ? '<ul class="x-zeilen">' + nach + "</ul>" : '<p class="x-klein">Nichts überfällig.</p>') + "</section>" +
      '<section class="x-karte"><h2>' + ikon("raster", "#1d1d1f") + "Alle Projekte</h2>" +
      '<div class="x-legende"><span><i class="x-punkt x-p-du"></i>du bist dran</span><span><i class="x-punkt x-p-claude"></i>Claude</span><span><i class="x-punkt x-p-andere"></i>andere</span><span>ohne Punkt = kein nächster Schritt</span></div>' +
      '<div class="x-gruppen">' + chips + "</div></section>" +
      "</div></div>";

    var mehr = el.querySelector("[data-mehr]");
    if (mehr) mehr.addEventListener("click", function () { el.querySelector("[data-dran]").innerHTML = dran.map(dranZeile).join(""); mehr.remove(); });
    var suche = el.querySelector("[data-suche]"), treffer = el.querySelector("[data-treffer]");
    suche.addEventListener("input", function () {
      var q = suche.value.trim().toLowerCase();
      if (q.length < 2) { treffer.hidden = true; return; }
      var ps = D.projekte.filter(function (p) { return p.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 6);
      var as = D.aufgaben.filter(function (a) { return a.t.toLowerCase().indexOf(q) >= 0; }).sort(nachDatum).slice(0, 10);
      treffer.innerHTML = '<section class="x-karte"><h2>Treffer<span class="x-klein">Klick öffnet das Projekt</span></h2><ul class="x-zeilen">' +
        ps.map(function (p) { return '<li data-pid="' + p.id + '"><span class="x-badge x-b-grau">Projekt</span><span class="x-txt"><b>' + esc(p.name) + "</b><small>" + esc(p.marke) + "</small></span></li>"; }).join("") +
        as.map(function (a) { return '<li data-pid="' + a.p + '"><span class="x-punkt x-p-' + wer(a) + '"></span><span class="x-txt"><b>' + esc(a.t) + "</b><small>" + esc(pname(a.p)) + " · " + esc(a.v) + '</small></span><span class="x-klein">' + frist(a.f) + "</span></li>"; }).join("") +
        (ps.length + as.length ? "" : '<li class="x-klein">Nichts gefunden</li>') + "</ul></section>";
      treffer.hidden = false;
    });
  }

  /* =============== E · Zeitachse =============== */
  function zeitachse() {
    var wochen = 6, filterWer = { du: true, claude: true, andere: true, offen: true }, filterMarke = {};
    MARKEN.forEach(function (m) { filterMarke[m] = true; });
    var tip = document.createElement("div"); tip.className = "x-tip"; tip.hidden = true; document.body.appendChild(tip);

    function montag(s) { var d = new Date(s + "T12:00:00"), w = (d.getDay() + 6) % 7; return tagPlus(s, -w); }
    function kw(s) { var d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7); var j = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d - j) / 86400000 - 3 + (j.getDay() + 6) % 7) / 7); }

    function zeichnen() {
      var start = montag(HEUTE), tage = wochen * 7, ende = tagPlus(start, tage);
      function x(s) { return ((new Date(s + "T12:00:00") - new Date(start + "T00:00:00")) / 86400000) / tage * 100; }
      var raster = "";
      for (var i = 0; i < tage; i++) {
        var t = tagPlus(start, i), wd = new Date(t + "T12:00:00").getDay();
        if (wd === 6) raster += '<div class="x-we" style="left:' + (i / tage * 100) + "%;width:" + (2 / tage * 100) + '%"></div>';
        if (wd === 1) raster += '<div class="x-wo" style="left:' + (i / tage * 100) + '%"></div>';
      }
      raster += '<div class="x-heute" style="left:' + x(HEUTE) + '%"></div>';
      var kopfz = "";
      for (var w = 0; w < wochen; w++) { var ws = tagPlus(start, w * 7); kopfz += '<span class="x-kw" style="left:' + (w * 7 / tage * 100) + '%"><b>KW ' + kw(ws) + "</b>" + datum(ws) + "</span>"; }

      function punkt(a, i, l) {
        if (!filterWer[wer(a)] && !istGate(a)) return "";
        var naechst = l.slice(i + 1).filter(function (b) { return filterWer[wer(b)] || istGate(b); })[0];
        var luecke = naechst ? (new Date(naechst.f) - new Date(a.f)) / 86400000 : (new Date(ende) - new Date(a.f)) / 86400000;
        var label = wochen <= 6 && luecke >= (wochen === 2 ? 2 : 4) ? '<span class="x-zl" style="left:' + x(a.f) + "%;max-width:calc(" + (luecke / tage * 100) + '% - 22px)">' + esc(a.t) + "</span>" : "";
        return label + '<button type="button" class="x-zp x-p-' + wer(a) + (istGate(a) ? " is-gate" : "") + (spaet(a.f) && !istGate(a) ? " is-spaet" : "") + '" style="left:' + x(a.f) + '%" data-pid="' + a.p +
          '" data-tip="' + esc(a.t) + '" data-tip2="' + esc((istGate(a) ? "Meilenstein" : WER[wer(a)] === "Andere" ? a.v : WER[wer(a)]) + " · " + datum(a.f)) + '" aria-label="' + esc(a.t) + '"></button>';
      }
      var zeilen = '<div class="x-zeile x-zeile--kopf"><div>Projekt</div><div class="x-alt" style="font-size:12px;color:var(--text2)">älter</div><div class="x-bahn">' + raster + kopfz + "</div></div>";
      var termine = D.termine.filter(function (t) { return !t.ganztags && iso(new Date(t.start)) < ende; });
      zeilen += '<div class="x-zeile"><div style="cursor:default"><span>Kalender</span></div><div class="x-alt"></div><div class="x-bahn">' + raster +
        termine.map(function (t) { var s = iso(new Date(t.start)); return '<span class="x-zt" style="left:' + x(s) + "%;width:" + (0.8 / tage * 100) + '%" data-tip="' + esc(t.betreff) + '" data-tip2="' + datum(s) + " " + uhr(t.start) + '"></span>'; }).join("") + "</div></div>";
      MARKEN.forEach(function (m) {
        if (!filterMarke[m]) return;
        var reihen = D.projekte.filter(function (p) { return p.marke === m; }).map(function (p) {
          var l = aufgabenVon(p.id).filter(function (a) { return a.f && a.f < ende; });
          return { p: p, alt: l.filter(function (a) { return a.f < start && !istGate(a) && filterWer[wer(a)]; }), drin: l.filter(function (a) { return a.f >= start; }) };
        }).filter(function (r) { return r.alt.length || r.drin.length; });
        if (!reihen.length) return;
        zeilen += '<div class="x-zeile x-zeile--gruppe"><div>' + mpunkt(m) + esc(m) + '</div><div class="x-alt"></div><div class="x-bahn"></div></div>';
        reihen.forEach(function (r) {
          zeilen += '<div class="x-zeile"><div data-pid="' + r.p.id + '"><span>' + esc(r.p.name) + '</span></div><div class="x-alt">' +
            r.alt.map(function (a) { return '<button type="button" class="x-altp" data-pid="' + a.p + '" data-tip="' + esc(a.t) + '" data-tip2="' + esc((wer(a) === "andere" ? a.v : WER[wer(a)]) + " · seit " + datum(a.f)) + '" aria-label="' + esc(a.t) + '"></button>'; }).join("") +
            '</div><div class="x-bahn">' + raster + r.drin.sort(nachDatum).map(punkt).join("") + "</div></div>";
        });
      });
      el.querySelector("[data-plan]").innerHTML = '<div class="x-plan-in">' + zeilen + "</div>";
    }

    el.innerHTML = '<div class="x-in">' + kopf("Was wann <span style=\"color:#ffd60a\">ansteht.</span>", "Alle Projekte auf einer Zeitachse: Fristen, Meilensteine und Termine. Links stehen die Projekte, die überfällige Aufgaben haben.") +
      '<div class="x-z-leiste"><div class="x-seg" data-wochen>' + [2, 6, 12].map(function (w) { return '<button type="button" data-w="' + w + '" aria-pressed="' + (w === 6) + '">' + w + " Wochen</button>"; }).join("") + "</div>" +
      '<div class="x-filter" data-wer>' + ["du", "claude", "andere"].map(function (k) { return '<button type="button" data-k="' + k + '" aria-pressed="true"><span class="x-punkt x-p-' + k + '"></span>' + WER[k] + "</button>"; }).join("") + "</div>" +
      '<div class="x-filter" data-marke>' + MARKEN.map(function (m) { return '<button type="button" data-m="' + esc(m) + '" aria-pressed="true">' + mpunkt(m) + esc(m) + "</button>"; }).join("") + "</div></div>" +
      '<div class="x-plan" data-plan></div>' +
      '<div class="x-legende"><span><i class="x-punkt x-p-du"></i>Frist bei dir</span><span><i class="x-punkt x-p-claude"></i>bei Claude</span><span><i class="x-punkt x-p-andere"></i>bei anderen</span>' +
      '<span><i class="x-punkt" style="background:#fff;border-radius:2px;transform:rotate(45deg)"></i>Meilenstein</span><span><i class="x-punkt" style="background:#64d2ff"></i>Termin</span><span><i class="x-punkt" style="background:#ffd60a;border-radius:1px;width:2px;height:12px"></i>heute</span><span><i class="x-punkt" style="background:#ff453a"></i>überfällig</span></div></div>';

    el.querySelector("[data-wochen]").addEventListener("click", function (e) {
      var b = e.target.closest("[data-w]"); if (!b) return; wochen = +b.getAttribute("data-w");
      el.querySelectorAll("[data-w]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); zeichnen();
    });
    el.querySelector("[data-wer]").addEventListener("click", function (e) {
      var b = e.target.closest("[data-k]"); if (!b) return; var k = b.getAttribute("data-k"); filterWer[k] = !filterWer[k];
      if (k === "andere") filterWer.offen = filterWer[k]; b.setAttribute("aria-pressed", String(filterWer[k])); zeichnen();
    });
    el.querySelector("[data-marke]").addEventListener("click", function (e) {
      var b = e.target.closest("[data-m]"); if (!b) return; var m = b.getAttribute("data-m"); filterMarke[m] = !filterMarke[m];
      b.setAttribute("aria-pressed", String(filterMarke[m])); zeichnen();
    });
    el.addEventListener("mousemove", function (e) {
      var t = e.target.closest("[data-tip]"); if (!t) { tip.hidden = true; return; }
      tip.innerHTML = esc(t.getAttribute("data-tip")) + "<small>" + esc(t.getAttribute("data-tip2") || "") + (t.getAttribute("data-pid") ? " · " + esc(pname(+t.getAttribute("data-pid"))) : "") + "</small>";
      tip.hidden = false; tip.style.left = Math.min(e.clientX + 14, window.innerWidth - 320) + "px"; tip.style.top = (e.clientY + 16) + "px";
    });
    el.addEventListener("mouseleave", function () { tip.hidden = true; });
    zeichnen();
  }

  /* =============== F · Portfolio-Karte =============== */
  function portfolio() {
    var ZUST = [["du", "Du bist dran", "var(--du)"], ["claude", "Claude arbeitet", "var(--cl)"], ["andere", "Bei anderen", "var(--an)"], ["leer", "Ohne nächsten Schritt", "#fff"]];
    var aktivZ = null, typ = "alle";
    function zeichnen() {
      el.querySelector("[data-marken]").innerHTML = MARKEN.map(function (m) {
        var ks = D.projekte.filter(function (p) { return p.marke === m && (typ === "alle" || (typ === "Kunde" ? p.typ === "Kunde" : p.typ !== "Kunde")); }).map(function (p) {
          return { p: p, z: zustand(p.id) };
        }).filter(function (x) { return !aktivZ || x.z.k === aktivZ; })
          .sort(function (a, b) { var o = { du: 0, claude: 1, andere: 2, leer: 3 }; return o[a.z.k] - o[b.z.k] || nachDatum(a.z.a || {}, b.z.a || {}); });
        return '<section><div class="x-marke-kopf x-mk-' + MK[m] + '"><h2>' + esc(m) + "</h2></div>" + '<div class="x-kacheln">' + (ks.length ? ks.map(function (x) {
          var a = x.z.a, z = x.z.k;
          var bei = z === "leer" ? "" : z === "du" ? (x.z.abnahme ? "Deine Abnahme" : "Du") : z === "claude" ? "Claude" : a.v;
          return '<button type="button" class="x-kachel x-k-' + z + '" data-pid="' + x.p.id + '"><div class="x-k-oben">' + esc(x.p.typ || "") + (x.p.phase ? " · " + esc(x.p.phase) : "") +
            (a && spaet(a.f) ? '<span class="x-badge x-b-rot">überfällig</span>' : "") + "</div><h3>" + esc(x.p.name) + "</h3><p>" + (a ? esc(a.t) : "Kein nächster Schritt festgelegt") + "</p>" +
            (a ? '<div class="x-k-unten">' + (z === "andere" ? ava(a.v) : '<span class="x-punkt x-p-' + z + '"></span>') + "<span>" + esc(bei) + '</span><span class="x-rechts">' + frist(a.f) + "</span></div>" : "") + "</button>";
        }).join("") : '<p class="x-klein">Nichts in dieser Auswahl</p>') + "</div></section>";
      }).join("");
    }
    el.innerHTML = '<div class="x-in">' + kopf("Wer ist <span style=\"color:#ff9500\">am Zug?</span>", "Jedes laufende Projekt als Kachel, nach Marke. Die Farbe zeigt, bei wem der nächste Schritt liegt. Ein Klick auf die Legende filtert.") +
      '<div class="x-f-filter" data-zust>' + ZUST.map(function (z) {
        return '<button type="button" data-z="' + z[0] + '" aria-pressed="false"><span class="x-sw" style="background:' + z[2] + (z[0] === "leer" ? ";box-shadow:inset 0 0 0 1.5px #c7c7cc" : "") + '"></span>' + z[1] + "</button>";
      }).join("") + '<span style="width:12px"></span>' + ["alle", "Kunde", "intern"].map(function (t) {
        return '<button type="button" data-t="' + t + '" aria-pressed="' + (t === "alle") + '">' + (t === "alle" ? "Alle Projekte" : t === "Kunde" ? "Kundenprojekte" : "Eigene Projekte") + "</button>";
      }).join("") + "</div>" + '<div class="x-marken" data-marken></div></div>';
    el.querySelector("[data-zust]").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.hasAttribute("data-z")) {
        var z = b.getAttribute("data-z"); aktivZ = aktivZ === z ? null : z;
        el.querySelectorAll("[data-z]").forEach(function (x) { x.setAttribute("aria-pressed", String(x.getAttribute("data-z") === aktivZ)); });
      } else {
        typ = b.getAttribute("data-t");
        el.querySelectorAll("[data-t]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      }
      zeichnen();
    });
    zeichnen();
  }
})();
