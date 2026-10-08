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
    if (!s.data.session) { wurzel.innerHTML = '<div class="kb-hinweis"><p>Bitte einmal auf der <a href="/strategie/kontakte.html">Kontaktseite</a> anmelden – dann erscheint hier die Steuerung.</p></div>'; return; }
    laden();
  });

  function laden() {
    Promise.all([
      db.from("vorlagen").select("id, titel, kern, vorschlag, frist, projekt_id, link, rang, status, entscheidung, entscheidung_text").in("status", ["offen", "entschieden"]).order("rang"),
      db.from("projekte").select("id, name, marke, typ, status"),
      db.from("aufgaben").select("id, status, faellig_am, projekt_id, titel").eq("status", "offen"),
      db.from("projekt_ereignisse").select("id, projekt_id, datum, art, titel").gte("datum", HEUTE.toISOString())
    ]).then(function (r) {
      D = { vorlagen: r[0].data || [], projekte: r[1].data || [], aufgaben: r[2].data || [], ereignisse: r[3].data || [] };
      zeichnen();
    });
  }
  function projekt(id) { return D.projekte.filter(function (p) { return p.id === id; })[0]; }

  /* ---------- Vorlagen ---------- */
  function karte(v) {
    var p = projekt(v.projekt_id);
    return '<article class="st4-karte" data-v="' + v.id + '">' +
      '<div class="st4-kopf">' + frist(v.frist) + '<span class="st4-wo">' + esc(p ? p.name : "Operativ") + "</span></div>" +
      '<h3><a href="' + esc(v.link || "#") + '">' + esc(v.titel) + "</a></h3>" +
      '<p class="st4-kern">' + esc(v.kern) + "</p>" +
      '<div class="st4-unten"><p class="st4-vorschlag"><span>Mein Vorschlag</span>' + esc(v.vorschlag) + "</p>" +
      '<div class="st4-knoepfe"><button type="button" class="st4-ja" data-e="ja">Ja</button><button type="button" data-anders>Anders</button><button type="button" data-e="spaeter">Später</button></div></div>' +
      '<form class="st4-anders" hidden><textarea rows="4" placeholder="Was soll stattdessen passieren?"></textarea><div><button type="submit">An Claude geben</button><button type="button" data-zu>Abbrechen</button></div></form>' +
      "</article>";
  }

  /* ---------- Sparring ---------- */
  function sparring() {
    return SPARRING.map(function (s) {
      return '<button type="button" class="st4-spar" data-spar="' + s.k + '" title="Regel: ' + esc(s.r) + '"><span class="st4-spar-z">' + s.z + '</span><b>' + esc(s.n).replace("Entscheidungssprint", "Entscheidungs&shy;sprint") + '</b><span class="st4-spar-s">' + esc(s.s) + '</span><span class="st4-spar-los">Starten <i aria-hidden="true">→</i></span></button>';
    }).join("");
  }

  /* ---------- Sechs Wochen ---------- */
  function wochen() {
    var mo = new Date(HEUTE); mo.setDate(mo.getDate() - ((mo.getDay() + 6) % 7));
    var h = "";
    for (var w = 0; w < 8; w++) {
      var von = new Date(+mo + w * 7 * 864e5), bis = new Date(+von + 7 * 864e5);
      var punkte = D.ereignisse.filter(function (e) { var d = new Date(e.datum); return d >= von && d < bis; })
        .map(function (e) { return { d: new Date(e.datum), art: e.art === "Meilenstein" ? "ziel" : "termin", t: e.titel, p: e.projekt_id }; })
        .concat(D.aufgaben.filter(function (a) { if (!a.faellig_am) return false; var d = new Date(a.faellig_am.slice(0, 10) + "T12:00:00"); return d >= von && d < bis && d >= HEUTE; })
          .map(function (a) { return { d: new Date(a.faellig_am.slice(0, 10) + "T12:00:00"), art: "frist", t: a.titel, p: a.projekt_id }; }))
        .sort(function (a, b) { return a.d - b.d; });
      h += '<div class="st4-woche"><h4>' + von.toLocaleDateString("de-DE", { day: "numeric", month: "short" }) + "</h4>" + punkte.map(function (x) {
        var p = projekt(x.p);
        return '<a class="st4-e st4-e--' + x.art + '" href="' + (x.p ? "/strategie/projekte.html#p=" + x.p : "/strategie/aufgaben.html") + '" title="' + esc(x.t + (p ? " · " + p.name : "")) + '">' +
          '<span class="st4-e-tag">' + x.d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric" }) + '</span><span class="st4-e-titel">' + esc(x.t) + "</span></a>";
      }).join("") + "</div>";
    }
    return h;
  }

  function zeichnen() {
    var offen = D.vorlagen.filter(function (v) { return v.status === "offen" && v.entscheidung !== "spaeter"; });
    var weg = D.vorlagen.filter(function (v) { return v.status === "entschieden" || v.entscheidung === "spaeter"; });
    wurzel.innerHTML =
      '<section class="st4-block"><h2 class="st4-h">Auf deinem Tisch</h2>' +
        (offen.length ? '<div class="st4-karten">' + offen.map(karte).join("") + "</div>" : '<p class="st4-leer">Nichts zu entscheiden.</p>') +
        (weg.length ? '<p class="st4-entschieden">' + weg.map(function (v) {
          return "<span>" + esc(v.titel) + " · " + (v.entscheidung === "ja" ? "freigegeben" : v.entscheidung === "anders" ? "anders" : "später") + "</span>"; }).join("") + "</p>" : "") +
      "</section>" +
      '<section class="st4-block"><h2 class="st4-h">Sparring starten</h2><div class="st4-sparring">' + sparring() + '</div><p class="st4-hinweis" data-spar-hinweis hidden></p></section>' +
      '<section class="st4-block"><h2 class="st4-h">Die nächsten Wochen</h2><div class="st4-wochen" tabindex="0" aria-label="Wochen – seitlich wischen">' + wochen() + "</div></section>";
    verdrahten();
  }

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
        b.onclick = function () { speichern(id, b.getAttribute("data-e") === "ja" ? { status: "entschieden", entscheidung: "ja" } : { entscheidung: "spaeter" }, k); };
      });
      // „Anders“ legt sich über die Karte – nichts verschiebt sich
      k.querySelector("[data-anders]").onclick = function () { form.hidden = false; form.querySelector("textarea").focus(); };
      form.querySelector("[data-zu]").onclick = function () { form.hidden = true; };
      form.onsubmit = function (ev) {
        ev.preventDefault(); var t = form.querySelector("textarea").value.trim(); if (!t) return;
        speichern(id, { status: "entschieden", entscheidung: "anders", entscheidung_text: t }, k);
      };
    });
    var hinweis = wurzel.querySelector("[data-spar-hinweis]");
    wurzel.querySelectorAll("[data-spar]").forEach(function (b) {
      b.onclick = function () {
        var s = SPARRING.filter(function (x) { return x.k === b.getAttribute("data-spar"); })[0];
        var satz = s.n + " starten – Regel: " + s.r;
        db.from("sparring").insert({ modus: s.n }).then(function () {});
        var fertig = function () { hinweis.hidden = false; hinweis.textContent = "„" + s.n + "“ ist angefragt – der Startsatz liegt in der Zwischenablage, einfach im Chat mit Claude einfügen."; };
        if (navigator.clipboard) navigator.clipboard.writeText(satz).then(fertig, fertig); else fertig();
      };
    });
  }
})();
