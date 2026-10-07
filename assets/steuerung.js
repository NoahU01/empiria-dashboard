/* Steuerung – Zuarbeit wie von einer Referentin.
     Auf deinem Tisch – Vorlagen von Claude (Tabelle vorlagen): Thema, worum es geht, Vorschlag, Knopf.
                         Entscheidung wird gespeichert, Claude setzt um.
     Projekte          – ein Punkt je Projekt: braucht dich · läuft · steht. Klick ins Projekt.
     Sechs Wochen      – kompakte Leiste: Fristen, Termine, Meilensteine.
   Keine Zähler, kein Fließtext. */
(function () {
  "use strict";
  var db = window.empiriaDb, wurzel = document.querySelector("[data-steuerung]");
  if (!db || !wurzel) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  var HEUTE = new Date(new Date().toDateString());
  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function frist(f) {
    if (!f) return "";
    var d = new Date(f.slice(0, 10) + "T12:00:00"), t = Math.floor((d - HEUTE) / 864e5);
    var txt = t < 0 ? "überfällig" : t === 0 ? "heute" : t === 1 ? "morgen" : d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
    return '<span class="st3-frist' + (t <= 1 ? " st3-frist--jetzt" : "") + '">' + txt + "</span>";
  }
  var D = {};

  db.auth.getSession().then(function (s) {
    if (!s.data.session) { wurzel.innerHTML = '<div class="kb-hinweis"><p>Bitte einmal auf der <a href="/strategie/kontakte.html">Kontaktseite</a> anmelden – dann erscheint hier die Steuerung.</p></div>'; return; }
    laden();
  });

  function laden() {
    var vor30 = new Date(Date.now() - 30 * 864e5).toISOString();
    Promise.all([
      db.from("vorlagen").select("id, titel, kern, vorschlag, knopf_ja, frist, projekt_id, link, rang, status, entscheidung, entscheidung_text, entschieden_am").in("status", ["offen", "entschieden"]).order("rang"),
      db.from("projekte").select("id, name, marke, status, angelegt_am"),
      db.from("aufgaben").select("id, status, faellig_am, erledigt_am, projekt_id, antwort_am, titel").or("status.eq.offen,and(status.eq.erledigt,erledigt_am.gte." + vor30 + ")"),
      db.from("projekt_ereignisse").select("id, projekt_id, datum, art, titel").gte("datum", vor30)
    ]).then(function (r) {
      D = { vorlagen: r[0].data || [], projekte: r[1].data || [], aufgaben: r[2].data || [], ereignisse: r[3].data || [] };
      zeichnen();
    });
  }
  function projekt(id) { return D.projekte.filter(function (p) { return p.id === id; })[0]; }

  /* ---------- Vorlagen ---------- */
  function karte(v) {
    var p = projekt(v.projekt_id);
    return '<article class="st3-karte" data-v="' + v.id + '"><header>' + frist(v.frist) + '<span class="st3-wo">' + esc(p ? p.name : "Operativ") + "</span></header>" +
      '<h3><a href="' + esc(v.link || "#") + '">' + esc(v.titel) + "</a></h3>" +
      '<p class="st3-kern">' + esc(v.kern) + "</p>" +
      '<p class="st3-vorschlag"><span>Vorschlag</span>' + esc(v.vorschlag) + "</p>" +
      '<div class="st3-knoepfe"><button type="button" class="st3-ja" data-e="ja">' + esc(v.knopf_ja) + '</button><button type="button" data-anders>Anders …</button><button type="button" data-e="spaeter">Später</button></div>' +
      '<form class="st3-anders" hidden><textarea rows="2" placeholder="Was soll stattdessen passieren?"></textarea><button type="submit">An Claude geben</button></form></article>';
  }
  function entschieden(v) {
    var was = v.entscheidung === "ja" ? "freigegeben – Claude ist dran" : v.entscheidung === "anders" ? "„" + esc(v.entscheidung_text || "") + "“" : "später";
    return "<li><b>" + esc(v.titel) + "</b><span>" + was + "</span></li>";
  }

  /* ---------- Projekte als Statuspunkte ---------- */
  function projektPunkte() {
    var MARKEN = ["empiria", "sofortsichtbar", "Müller&Ströbel."], jetzt = Date.now();
    var offeneVorlagen = D.vorlagen.filter(function (v) { return v.status === "offen"; });
    var morgen = iso(new Date(+HEUTE + 864e5));
    return MARKEN.map(function (m) {
      var l = D.projekte.filter(function (p) { return (p.marke || "empiria") === m && p.status !== "abgeschlossen"; });
      if (!l.length) return "";
      return '<div class="st3-marke"><span class="st3-marke-name">' + esc(m) + "</span><div>" + l.sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (p) {
        var dich = offeneVorlagen.some(function (v) { return v.projekt_id === p.id; }) ||
          D.aufgaben.some(function (a) { return a.projekt_id === p.id && a.status === "offen" && (a.antwort_am || (a.faellig_am && a.faellig_am.slice(0, 10) <= morgen)); });
        var bewegt = D.ereignisse.some(function (e) { return e.projekt_id === p.id && Math.abs(jetzt - new Date(e.datum)) < 14 * 864e5; }) ||
          D.aufgaben.some(function (a) { return a.projekt_id === p.id && a.erledigt_am && jetzt - new Date(a.erledigt_am) < 14 * 864e5; }) ||
          (p.angelegt_am && jetzt - new Date(p.angelegt_am) < 14 * 864e5);
        var z = p.status === "pausiert" ? "pause" : dich ? "dich" : bewegt ? "laeuft" : "steht";
        var tip = { pause: "pausiert", dich: "braucht dich", laeuft: "läuft", steht: "keine Bewegung seit zwei Wochen" }[z];
        return '<a class="st3-punkt st3-punkt--' + z + '" href="/strategie/projekte.html#p=' + p.id + '" title="' + tip + '"><i></i>' + esc(p.name) + "</a>";
      }).join("") + "</div></div>";
    }).join("");
  }

  /* ---------- Sechs Wochen als Leiste ---------- */
  function wochen() {
    var mo = new Date(HEUTE); mo.setDate(mo.getDate() - ((mo.getDay() + 6) % 7));
    var spalten = [];
    for (var w = 0; w < 6; w++) {
      var von = new Date(+mo + w * 7 * 864e5), bis = new Date(+von + 7 * 864e5);
      var punkte = D.ereignisse.filter(function (e) { var d = new Date(e.datum); return d >= von && d < bis && d >= HEUTE; })
        .map(function (e) { return { d: new Date(e.datum), art: e.art === "Meilenstein" ? "ziel" : "termin", t: e.titel, p: e.projekt_id }; })
        .concat(D.aufgaben.filter(function (a) { if (a.status !== "offen" || !a.faellig_am) return false; var d = new Date(a.faellig_am.slice(0, 10) + "T12:00:00"); return d >= von && d < bis && d >= HEUTE; })
          .map(function (a) { return { d: new Date(a.faellig_am.slice(0, 10) + "T12:00:00"), art: "frist", t: a.titel, p: a.projekt_id }; }))
        .sort(function (a, b) { return a.d - b.d; });
      spalten.push('<div class="st3-woche"><h4>' + von.toLocaleDateString("de-DE", { day: "numeric", month: "short" }) + "</h4>" + punkte.map(function (x) {
        var p = projekt(x.p);
        return '<a class="st3-ereignis st3-e-' + x.art + '" href="' + (x.p ? "/strategie/projekte.html#p=" + x.p : "/strategie/aufgaben.html") + '" title="' + esc(x.t + (p ? " · " + p.name : "")) + '">' +
          '<span class="st3-tag">' + x.d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric" }) + '</span><span class="st3-titel">' + esc(x.t) + "</span></a>";
      }).join("") + "</div>");
    }
    return spalten.join("");
  }

  function zeichnen() {
    var offen = D.vorlagen.filter(function (v) { return v.status === "offen" && v.entscheidung !== "spaeter"; });
    var erledigt = D.vorlagen.filter(function (v) { return v.status === "entschieden" || v.entscheidung === "spaeter"; });
    wurzel.innerHTML =
      '<section class="st3-tisch"><h2 class="st3-h">Auf deinem Tisch</h2>' +
        (offen.length ? '<div class="st3-karten">' + offen.map(karte).join("") + "</div>" : '<p class="st3-leer">Nichts zu entscheiden – alles ist vorbereitet oder läuft.</p>') +
        (erledigt.length ? '<ul class="st3-entschieden">' + erledigt.map(entschieden).join("") + "</ul>" : "") +
      "</section>" +
      '<section class="st3-projekte"><h2 class="st3-h">Projekte</h2><p class="st3-legende"><span class="st3-punkt--dich"><i></i>braucht dich</span><span class="st3-punkt--laeuft"><i></i>läuft</span><span class="st3-punkt--steht"><i></i>steht</span><span class="st3-punkt--pause"><i></i>pausiert</span></p>' + projektPunkte() + "</section>" +
      '<section class="st3-zeit"><h2 class="st3-h">Sechs Wochen</h2><p class="st3-legende"><span class="st3-l-frist">Frist</span><span class="st3-l-termin">Termin</span><span class="st3-l-ziel">Meilenstein</span></p><div class="st3-wochen">' + wochen() + "</div></section>";
    verdrahten();
  }

  function speichern(id, felder, karte) {
    karte.classList.add("laedt");
    felder.entschieden_am = new Date().toISOString();
    db.from("vorlagen").update(felder).eq("id", id).then(function (r) {
      if (r.error) { karte.classList.remove("laedt"); alert("Nicht gespeichert: " + r.error.message); return; }
      var v = D.vorlagen.filter(function (x) { return x.id === id; })[0]; for (var k in felder) v[k] = felder[k];
      karte.classList.add("st3-weg"); setTimeout(zeichnen, 350);
    });
  }
  function verdrahten() {
    wurzel.querySelectorAll(".st3-karte").forEach(function (k) {
      var id = +k.getAttribute("data-v"), form = k.querySelector(".st3-anders");
      k.querySelectorAll("[data-e]").forEach(function (b) {
        b.onclick = function () { var e = b.getAttribute("data-e"); speichern(id, e === "ja" ? { status: "entschieden", entscheidung: "ja" } : { entscheidung: "spaeter" }, k); };
      });
      k.querySelector("[data-anders]").onclick = function () { form.hidden = !form.hidden; if (!form.hidden) form.querySelector("textarea").focus(); };
      form.onsubmit = function (ev) {
        ev.preventDefault(); var t = form.querySelector("textarea").value.trim(); if (!t) return;
        speichern(id, { status: "entschieden", entscheidung: "anders", entscheidung_text: t }, k);
      };
    });
  }
})();
