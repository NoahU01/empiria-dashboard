/* Steuerung – die zentrale Startseite. Zuarbeit wie von einer Referentin.
     Auf deinem Tisch – Vorlagen von Claude (Tabelle vorlagen): Frist, Thema, Kern, Vorschlag, Ja · Anders · Später.
                        Karten im Raster mit Subgrid – gleichartige Teile stehen auf gleicher Höhe, Knöpfe immer unten.
     Sparring        – sechs Arten zu reden; Klick legt die Anfrage ab und kopiert den Startsatz für den Chat.
     Sechs Wochen    – kompakte Leiste: Fristen, Termine, Meilensteine.
   Keine Zähler, kein Fließtext. */
(function () {
  "use strict";
  var db = window.empiriaDb, wurzel = document.querySelector("[data-steuerung]");
  if (!db || !wurzel) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  // Links in Karten anklickbar machen (Daniel: bei Ausarbeitungen immer die URL zeigen, um live nachzusehen)
  function mitLinks(t) { return esc(t).replace(/(https?:\/\/[^\s<)]+)/g, function (u) { var kurz = u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""); return '<a href="' + u + '" target="_blank" rel="noopener">' + (kurz.length > 42 ? kurz.slice(0, 40) + "…" : kurz) + "</a>"; }); }
  var HEUTE = new Date(new Date().toDateString());
  function frist(f) {
    if (!f) return '<span class="st4-frist st4-frist--leer"></span>';
    var d = new Date(f.slice(0, 10) + "T12:00:00"), t = Math.floor((d - HEUTE) / 864e5);
    var txt = t < 0 ? "überfällig" : t === 0 ? "heute" : t === 1 ? "morgen" : d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
    return '<span class="st4-frist' + (t <= 1 ? " st4-frist--jetzt" : "") + '">' + txt + "</span>";
  }
  var SPARRING = [
    { k: "sprint", n: "Entscheidungssprint", z: "15 Min", s: "Mehrere Entscheidungen am Stück.", r: "Kein Abschweifen. Was nicht entschieden werden kann, wird notiert und verlässt den Sprint." },
    { k: "deep", n: "Deep Dive", z: "60–90 Min", s: "Volle Tiefe zu einem Thema.", r: "Keine Randthemen. Was auftaucht und nicht dazugehört, wandert auf eine Liste für später." },
    { k: "360", n: "360°-Blick", z: "45 Min", s: "Ein Thema, alle Zusammenhänge.", r: "Keine Tiefe. Wer hier anfängt zu lösen, verliert die Übersicht." },
    { k: "ideen", n: "Ideen-Modus", z: "offen", s: "Sammeln ohne Ergebnisdruck.", r: "Kein Entscheidungsdruck. Nichts wird bewertet, solange gesammelt wird." },
    { k: "status", n: "Status-Check", z: "10 Min", s: "Abgleich über alle drei Marken.", r: "Keine Lösungen. Es wird festgestellt, nicht gearbeitet." },
    { k: "review", n: "Review", z: "20–30 Min", s: "Bewerten, was fertig ist.", r: "Keine neuen Wünsche. Beurteilt wird, was da ist, nicht was fehlt." }
  ];
  var D = {};

  db.auth.getSession().then(function (s) {
    if (!s.data.session) { wurzel.innerHTML = '<div class="kb-hinweis"><p>Bitte einmal auf der <a href="/strategie/kontakte.html?zurueck=' + encodeURIComponent(location.pathname) + '">Kontaktseite</a> anmelden – dann erscheint hier die Steuerung.</p></div>'; return; }
    laden();
  });

  function laden() {
    Promise.all([
      db.from("vorlagen").select("id, titel, kern, vorschlag, knopf_ja, frist, projekt_id, link, rang, status, entscheidung, entscheidung_text, art, punkte, optionen, ablage, auftrag_am, marke").in("status", ["offen", "entschieden"]).order("rang"),
      db.from("projekte").select("id, name, marke, typ, status"),
      db.from("aufgaben").select("id, status, faellig_am, projekt_id, titel, marke").eq("status", "offen"),
      db.from("projekt_ereignisse").select("id, projekt_id, datum, art, titel").gte("datum", HEUTE.toISOString()),
      db.from("belege_eingang").select("id, postfach, absender, absender_name, betreff, pdf_link, status, zuordnung, begruendung, titel, lieferant, belegdatum, betrag, kategorie, ust, pk_belegnr, fehler, hochgeladen_am")
        .or("status.in.(vorschlag,freigegeben,lädt,fehler),hochgeladen_am.gte." + HEUTE.toISOString()).order("belegdatum")
    ]).then(function (r) {
      D = { vorlagen: r[0].data || [], projekte: r[1].data || [], aufgaben: r[2].data || [], ereignisse: r[3].data || [], belege: r[4].data || [] };
      zeichnen();
    });
  }
  function projekt(id) { return D.projekte.filter(function (p) { return p.id === id; })[0]; }

  /* ---------- Vorlagen ---------- */
  // Zwei Arten auf dem Tisch: Vorschlag von Claude (Ja · Anders · Später) und Rückmeldung zu einem Auftrag
  // (Ergebnis in Stichpunkten, „Was ich von dir brauche“, Auswahlknöpfe oder Gelesen · Anders)
  function karte(v) {
    var p = projekt(v.projekt_id), rm = v.art === "rueckmeldung";
    var tag = rm ? '<span class="st4-art st4-art--rm"' + (v.auftrag_am ? ' title="Auftrag vom ' + new Date(v.auftrag_am + "T12:00:00").toLocaleDateString("de-DE") + '"' : "") + ">Rückmeldung</span>"
      : '<span class="st4-art">Vorschlag</span>';
    var punkte = String(v.punkte || "").split("\n").filter(Boolean);
    var opt = Array.isArray(v.optionen) ? v.optionen : [];
    var knoepfe = opt.length
      ? opt.map(function (o, i) { return '<button type="button"' + (i === 0 ? ' class="st4-ja"' : "") + ' data-opt="' + esc(o) + '">' + esc(o) + "</button>"; }).join("") + '<button type="button" data-anders>Anders …</button>'
      : rm ? '<button type="button" class="st4-ja" data-e="' + (!v.knopf_ja || v.knopf_ja === "Gelesen" ? "gelesen" : "ja") + '">' + esc(v.knopf_ja || "Gelesen") + '</button><button type="button" data-anders>Anders …</button>'
      : '<button type="button" class="st4-ja" data-e="ja">Ja</button><button type="button" data-anders>Anders</button><button type="button" data-e="spaeter">Später</button>';
    return '<article class="st4-karte' + (rm ? " st4-karte--rm" : "") + '" data-v="' + v.id + '">' +
      '<div class="st4-kopf">' + tag + frist(v.frist) + '<span class="st4-wo">' + esc(p ? p.name : "Operativ") + "</span></div>" +
      '<h3><a href="' + esc(v.link || "#") + '">' + esc(v.titel) + "</a></h3>" +
      '<div class="st4-mitte">' + (v.kern ? '<p class="st4-kern">' + mitLinks(v.kern) + "</p>" : "") +
      (punkte.length ? '<ul class="st4-punkte">' + punkte.map(function (x) { return "<li>" + mitLinks(x) + "</li>"; }).join("") + "</ul>" : "") + "</div>" +
      '<div class="st4-unten"><p class="st4-vorschlag"><span>' + (rm ? "Was ich von dir brauche" : "Mein Vorschlag") + "</span>" + mitLinks(v.vorschlag) + "</p>" +
      (v.ablage ? '<p class="st4-ablage">Ablage: ' + esc(v.ablage) + "</p>" : "") +
      '<div class="st4-knoepfe">' + knoepfe + "</div></div>" +
      '<form class="st4-anders" hidden><textarea rows="4" placeholder="Was soll stattdessen passieren? – sprechen oder tippen"></textarea><div><button type="submit">An Claude geben</button><button type="button" data-zu>Abbrechen</button></div></form>' +
      "</article>";
  }

  /* ---------- Belege freigeben ----------
     Claude erkennt Rechnungen in allen Postfächern und schlägt Titel, Zuordnung und Kategorie vor.
     Daniel prüft den Titel und gibt frei; der Mac legt den Beleg dann binnen einer Minute in Papierkram an (Daniel, 09.10.2026). */
  var ZUORDNUNG = { gmbh: "empiria GmbH", privat: "privat?", unklar: "unklar" };
  function euro(b) { return b == null ? "–" : Number(b).toLocaleString("de-DE", { style: "currency", currency: "EUR" }); }
  function datum(d) { return d ? new Date(d + "T12:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–"; }
  function belegZeile(b) {
    var fertig = b.status === "hochgeladen", laeuft = b.status === "freigegeben" || b.status === "lädt";
    var rechts = fertig ? '<span class="bf-ok">In Papierkram · ' + esc(b.pk_belegnr || "") + "</span>"
      : laeuft ? '<span class="bf-laeuft">Wird angelegt …</span>'
      : '<button type="button" class="st4-ja" data-bf="hoch">Hochladen</button><button type="button" data-bf="privat">Privat</button><button type="button" data-bf="nein">Nicht hochladen</button>';
    return '<li class="bf-zeile bf--' + esc(b.status) + '" data-b="' + b.id + '">' +
      '<div class="bf-titel">' + (fertig || laeuft ? "<b>" + esc(b.titel) + "</b>" : '<input type="text" value="' + esc(b.titel || "") + '" aria-label="Titel in Papierkram">') +
        '<span class="bf-meta">' + esc(b.lieferant || b.absender_name || b.absender) + " · " + datum(b.belegdatum) + " · " + esc(b.kategorie || "") + (b.ust ? " · " + esc(b.ust) : "") +
        (b.pdf_link ? ' · <a class="bf-pdf" href="' + esc(b.pdf_link) + '" target="_blank" rel="noopener"><i aria-hidden="true">▶</i>PDF</a>' : "") + "</span></div>" +
      '<div class="bf-betrag">' + euro(b.betrag) + "</div>" +
      '<div class="bf-zu"><span class="bf-tag bf-tag--' + esc(b.zuordnung || "unklar") + '">' + esc(ZUORDNUNG[b.zuordnung] || "unklar") + "</span>" +
        (b.begruendung ? '<span class="bf-grund">' + esc(b.begruendung) + "</span>" : "") +
        (b.status === "fehler" ? '<span class="bf-fehler">Fehler: ' + esc(b.fehler || "") + "</span>" : "") + "</div>" +
      '<div class="bf-knoepfe">' + rechts + "</div></li>";
  }
  function belegBlock() {
    if (!D.belege || !D.belege.length) return "";
    return '<section class="st4-block"><h2 class="st4-h">Belege freigeben</h2><ul class="bf-liste">' + D.belege.map(belegZeile).join("") + "</ul></section>";
  }
  var bfTimer = null;
  function belegeVerdrahten() {
    wurzel.querySelectorAll(".bf-zeile [data-bf]").forEach(function (btn) {
      btn.onclick = function () {
        var li = btn.closest(".bf-zeile"), id = +li.getAttribute("data-b"), art = btn.getAttribute("data-bf");
        var inp = li.querySelector("input"), titel = inp ? inp.value.trim() : null;
        if (art === "hoch" && !titel) { inp.focus(); return; }
        var upd = art === "hoch" ? { status: "freigegeben", titel: titel, entschieden_am: new Date().toISOString() }
          : { status: art === "privat" ? "privat" : "abgelehnt", entschieden_am: new Date().toISOString() };
        li.classList.add("laedt");
        db.from("belege_eingang").update(upd).eq("id", id).then(function (r) {
          if (r.error) { li.classList.remove("laedt"); alert(r.error.message); return; }
          var b = D.belege.filter(function (x) { return x.id === id; })[0];
          if (art === "hoch") { b.status = "freigegeben"; b.titel = titel; li.outerHTML = belegZeile(b); belegeNachladen(); }
          else { D.belege = D.belege.filter(function (x) { return x.id !== id; }); li.remove(); if (!D.belege.length) zeichnen(); }
        });
      };
    });
  }
  // Nach der Freigabe alle 15 Sekunden nachsehen, bis der Mac den Beleg angelegt hat
  function belegeNachladen() {
    clearTimeout(bfTimer);
    if (!D.belege.some(function (b) { return b.status === "freigegeben" || b.status === "lädt"; })) return;
    bfTimer = setTimeout(function () {
      var ids = D.belege.map(function (b) { return b.id; });
      db.from("belege_eingang").select("id, status, pk_belegnr, fehler").in("id", ids).then(function (r) {
        (r.data || []).forEach(function (n) {
          var b = D.belege.filter(function (x) { return x.id === n.id; })[0]; if (!b || b.status === n.status) return;
          b.status = n.status; b.pk_belegnr = n.pk_belegnr; b.fehler = n.fehler;
          var li = wurzel.querySelector('.bf-zeile[data-b="' + n.id + '"]'); if (li) li.outerHTML = belegZeile(b);
        });
        belegeVerdrahten(); belegeNachladen();
      });
    }, 15000);
  }

  /* ---------- Sparring ---------- */
  function sparring() {
    return SPARRING.map(function (s) {
      return '<button type="button" class="st4-spar" data-spar="' + s.k + '" title="Regel: ' + esc(s.r) + '"><span class="st4-spar-z">' + s.z + '</span><b>' + esc(s.n).replace("Entscheidungssprint", "Entscheidungs&shy;sprint") + '</b><span class="st4-spar-s">' + esc(s.s) + '</span><span class="st4-spar-los">Starten <i aria-hidden="true">→</i></span></button>';
    }).join("");
  }

  var TISCH = "alle";
  try { TISCH = localStorage.getItem("st-tisch") || "alle"; } catch (x) {}
  function gezeigt(l) { return l.filter(function (v) { return TISCH === "alle" || (TISCH === "rm") === (v.art === "rueckmeldung"); }); }
  function mf(m) { return !window.MarkeFokus || MarkeFokus.passt(m); }
  function tischFilter(l) {
    var rm = l.filter(function (v) { return v.art === "rueckmeldung"; }).length;
    if (!rm || rm === l.length) return "";
    return '<div class="st4-tisch">' + [["alle", "Alle"], ["rm", "Rückmeldungen"], ["vs", "Vorschläge"]].map(function (f) {
      return '<button type="button" data-tisch="' + f[0] + '" aria-pressed="' + (TISCH === f[0]) + '">' + f[1] + "</button>"; }).join("") + "</div>";
  }

  function zeichnen() {
    var alleV = D.vorlagen.filter(function (v) { return mf(v.marke); });
    var offen = alleV.filter(function (v) { return v.status === "offen" && v.entscheidung !== "spaeter"; });
    var weg = alleV.filter(function (v) { return v.status === "entschieden" || v.entscheidung === "spaeter"; });
    wurzel.innerHTML = belegBlock() +
      '<section class="st4-block"><h2 class="st4-h">Auf deinem Tisch</h2>' + tischFilter(offen) +
        (gezeigt(offen).length ? '<div class="st4-karten">' + gezeigt(offen).map(karte).join("") + "</div>" : '<p class="st4-leer">' + (window.MarkeFokus && MarkeFokus.wert() !== "alle" ? "Für " + esc(MarkeFokus.wert()) + " liegt gerade nichts auf dem Tisch." : "Nichts zu entscheiden.") + "</p>") +
        (weg.length ? '<p class="st4-entschieden">' + weg.map(function (v) {
          return "<span>" + esc(v.titel) + " · " + (v.entscheidung === "ja" ? "freigegeben" : v.entscheidung === "anders" ? "anders" : v.entscheidung === "option" ? esc(v.entscheidung_text) : v.entscheidung === "gelesen" ? "gelesen" : "später") + "</span>"; }).join("") + "</p>" : "") +
      "</section>" +
      '<section class="st4-block"><h2 class="st4-h">Sparring starten</h2><div class="st4-sparring">' + sparring() + '</div></section>';
    verdrahten(); belegeVerdrahten(); belegeNachladen();
    // Weißer Teil der Karte hat eine Maximalhöhe; ist mehr Inhalt da, deutet ein Verlauf unten an, dass man scrollen kann
    wurzel.querySelectorAll(".st4-mitte").forEach(function (m) {
      function pruefe() { m.classList.toggle("st4-mehr", m.scrollHeight - m.scrollTop - m.clientHeight > 4); }
      m.addEventListener("scroll", pruefe, { passive: true }); pruefe();
    });
  }

  function bestaetigen(b) {
    wurzel.querySelectorAll(".st4-spar--an").forEach(function (x) { if (x !== b) { x.classList.remove("st4-spar--an"); x.querySelector(".st4-spar-los").innerHTML = 'Starten <i aria-hidden="true">→</i>'; } });
    b.classList.add("st4-spar--an");
    b.querySelector(".st4-spar-los").textContent = "✓ Angefragt – Startsatz ist kopiert, im Chat mit Claude einfügen.";
  }

  document.addEventListener("markefokus", function () { if (D.vorlagen) zeichnen(); });

  function speichern(id, felder, karte) {
    karte.classList.add("laedt");
    felder.entschieden_am = new Date().toISOString();
    db.from("vorlagen").update(felder).eq("id", id).then(function (r) {
      if (r.error) { karte.classList.remove("laedt"); alert("Nicht gespeichert: " + r.error.message); return; }
      var v = D.vorlagen.filter(function (x) { return x.id === id; })[0]; for (var k in felder) v[k] = felder[k];
      karte.classList.add("st4-weg"); setTimeout(zeichnen, 300);
    });
  }
  function verdrahten() {
    wurzel.querySelectorAll(".st4-karte").forEach(function (k) {
      var id = +k.getAttribute("data-v"), form = k.querySelector(".st4-anders");
      k.querySelectorAll("[data-e]").forEach(function (b) {
        var e = b.getAttribute("data-e");
        b.onclick = function () { speichern(id, e === "spaeter" ? { entscheidung: "spaeter" } : e === "gelesen" ? { status: "erledigt", entscheidung: "gelesen" } : { status: "entschieden", entscheidung: "ja" }, k); };
      });
      k.querySelectorAll("[data-opt]").forEach(function (b) {
        b.onclick = function () { speichern(id, { status: "entschieden", entscheidung: "option", entscheidung_text: b.getAttribute("data-opt") }, k); };
      });
      // „Anders“ legt sich über die Karte – nichts verschiebt sich
      k.querySelector("[data-anders]").onclick = function () { form.hidden = false; form.querySelector("textarea").focus(); };
      form.querySelector("[data-zu]").onclick = function () { form.hidden = true; };
      form.onsubmit = function (ev) {
        ev.preventDefault(); var t = form.querySelector("textarea").value.trim(); if (!t) return;
        speichern(id, { status: "entschieden", entscheidung: "anders", entscheidung_text: t }, k);
      };
    });
    wurzel.querySelectorAll("[data-tisch]").forEach(function (b) {
      b.onclick = function () { TISCH = b.getAttribute("data-tisch"); try { localStorage.setItem("st-tisch", TISCH); } catch (x) {} zeichnen(); };
    });
    wurzel.querySelectorAll("[data-spar]").forEach(function (b) {
      b.onclick = function () {
        var s = SPARRING.filter(function (x) { return x.k === b.getAttribute("data-spar"); })[0];
        var satz = s.n + " starten – Regel: " + s.r;
        db.from("sparring").insert({ modus: s.n }).then(function () {});
        // Bestätigung direkt im angeklickten Kasten – auf dem iPhone stehen die Kästen untereinander
        var fertig = function () { bestaetigen(b); };
        if (navigator.clipboard) navigator.clipboard.writeText(satz).then(fertig, fertig); else fertig();
      };
    });
  }
})();
