/* Aufgaben – Kanban-Board über alle Projekte und die operativen Aufgaben ohne Projekt.
   Oben ein Filter: Alle, Operativ, ganze Marken oder einzelne/mehrere Projekte (merkt sich die Auswahl).
   Spalten: Backlog · To-do · In Arbeit · Review/Prüfung · Erledigt (letzte 14 Tage). Karten zum Ziehen.
   Anmeldung wie auf der Kontaktseite (Login-Link). */
(function () {
  "use strict";
  var db = window.empiriaDb, wurzel = document.querySelector("[data-aufgaben-board]");
  if (!db || !wurzel) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function kurz(d) { return d ? new Date(d).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" }) : ""; }
  function name(k) { return k ? [k.vorname, k.nachname].filter(Boolean).join(" ") : ""; }
  var MARKEN = ["empiria", "sofortsichtbar", "Müller&Ströbel."];
  var SPALTEN = [["backlog", "Backlog"], ["todo", "To-do"], ["arbeit", "In Arbeit"], ["pruefung", "Review / Prüfung"], ["erledigt", "Erledigt"]];
  var projekte = [], aufgaben = [], wahl = [];   // wahl: leer = alle; sonst Projekt-IDs und/oder "op"
  try { wahl = JSON.parse(localStorage.getItem("ab-filter") || "[]"); } catch (x) { wahl = []; }

  db.auth.getSession().then(function (s) {
    if (!s.data.session) { wurzel.innerHTML = '<div class="kb-hinweis"><p>Bitte einmal auf der <a href="/strategie/kontakte.html">Kontaktseite</a> anmelden – dann erscheinen hier die Aufgaben.</p></div>'; return; }
    laden();
  });

  function laden() {
    var vor14 = new Date(Date.now() - 14 * 864e5).toISOString();
    Promise.all([
      db.from("projekte").select("id, name, typ, marke, status").order("name"),
      db.from("aufgaben").select("id, titel, beschreibung, status, spalte, faellig_am, erledigt_am, projekt_id, weg, vorgaenger, warten_auf, hinweis, zustaendig_name, verantwortlich, kontakte:zustaendig_kontakt_id(vorname, nachname), organisationen(id, name), person:kontakt_id(id, vorname, nachname), ereignis:ereignis_id(id, titel, datum, projekt_id), mail_entwurf_id, mail_gesendet_am, antwort_am, antwort_von, zeitblock_vorschlag, unterlagen")
        .or("status.eq.offen,and(status.eq.erledigt,erledigt_am.gte." + vor14 + ")")
    ]).then(function (r) {
      if (r[1].error) { wurzel.innerHTML = '<p class="kb-leer">Fehler: ' + esc(r[1].error.message) + "</p>"; return; }
      projekte = r[0].data || []; aufgaben = r[1].data || [];
      var ids = projekte.map(function (p) { return p.id; });
      wahl = wahl.filter(function (w) { return w === "op" || ids.indexOf(w) > -1 || (typeof w === "string" && MARKEN.indexOf(w.slice(2)) > -1); });
      zeichnen();
    });
  }

  function projektVon(a) { return projekte.filter(function (p) { return p.id === a.projekt_id; })[0]; }
  function sichtbar(a) {
    if (!wahl.length) return true;
    if (!a.projekt_id) return wahl.indexOf("op") > -1;
    var p = projektVon(a);
    return wahl.indexOf(a.projekt_id) > -1 || (!!p && wahl.indexOf("m:" + (p.marke || "empiria")) > -1);
  }
  function wer(a) { return a.zustaendig_name || name(a.kontakte) || a.verantwortlich || ""; }

  function filter() {
    function knopf(wert, text, an) { return '<button type="button" data-f="' + wert + '" aria-pressed="' + an + '">' + esc(text) + "</button>"; }
    var mitAufgaben = {};
    aufgaben.forEach(function (a) { if (a.projekt_id) mitAufgaben[a.projekt_id] = 1; });
    var h = '<div class="ab-filter"><div class="ab-filter-zeile"><span class="ab-marke"></span>' + knopf("alle", "Alle", !wahl.length) + knopf("op", "Operativ", wahl.indexOf("op") > -1) + "</div>";
    MARKEN.forEach(function (m) {
      var l = projekte.filter(function (p) { return (p.marke || "empiria") === m && p.status !== "abgeschlossen"; });
      if (!l.length) return;
      // Marke selbst ist auch auswählbar (alle Projekte dieser Marke)
      h += '<div class="ab-filter-zeile">' + knopf("m:" + m, m, wahl.indexOf("m:" + m) > -1).replace("<button", '<button class="ab-marke-knopf"') + l.map(function (p) {
        return knopf(p.id, p.name, wahl.indexOf(p.id) > -1).replace("<button", mitAufgaben[p.id] ? "<button" : '<button class="ab-leer"');
      }).join("") + "</div>";
    });
    return h + "</div>";
  }

  function karte(a) {
    var p = projektVon(a), ueber = a.status === "offen" && a.faellig_am && new Date(a.faellig_am) < new Date(new Date().toDateString());
    var herkunft = p ? p.name : a.organisationen ? a.organisationen.name : "Operativ";
    return '<div class="pr-kb-karte' + (a.status === "erledigt" ? " pr-kb-fertig" : "") + '" draggable="true" data-a="' + a.id + '">' +
      '<p class="ab-herkunft">' + (p ? '<a href="/strategie/projekte.html#p=' + p.id + '">' + esc(herkunft) + "</a>" : esc(herkunft)) + "</p>" +
      (det(a) ? '<button type="button" class="pr-auf-titel" data-auf-auf aria-expanded="false"><span>' + esc(a.titel) + '</span><span class="tl-dreieck" aria-hidden="true"></span></button>'
        : '<span class="pr-auf-titel">' + esc(a.titel) + "</span>") +
      '<p class="pr-kb-meta"><span class="pr-frist' + (ueber ? " pr-ueber" : "") + '">' + (a.faellig_am ? kurz(a.faellig_am) : "ohne Termin") + '</span><span class="pr-wer">' + esc(wer(a) || "offen") + "</span></p>" +
      zusatz(a) + (det(a) ? '<div class="pr-auf-details" hidden>' + det(a) + "</div>" : "") + "</div>";
  }

  function det(a) { if (a._det === undefined) a._det = window.AufgabenDetails ? AufgabenDetails.html(a) : ""; return a._det; }
  // Immer sichtbar: „Hängt ab von …“ und Hinweise wie „Wartet auf Rückmeldung von …“
  function zusatz(a) { return window.AufgabenDetails ? AufgabenDetails.lage(a, aufgaben) : ""; }

  function zeichnen() {
    var l = aufgaben.filter(sichtbar).sort(function (a, b) { return (a.faellig_am || "9999").localeCompare(b.faellig_am || "9999"); });
    wurzel.innerHTML = filter() + '<div class="pr-kanban ab-kanban">' + SPALTEN.map(function (sp) {
      var karten = l.filter(function (a) { return sp[0] === "erledigt" ? a.status === "erledigt" : a.status === "offen" && (a.spalte || "todo") === sp[0]; });
      return '<div class="pr-kb-spalte" data-spalte="' + sp[0] + '"><p class="pr-kb-kopf">' + sp[1] + "</p>" + karten.map(karte).join("") + "</div>";
    }).join("") + "</div>";
    verdrahten();
  }

  function verdrahten() {
    wurzel.querySelectorAll("[data-f]").forEach(function (b) {
      b.onclick = function () {
        var f = b.getAttribute("data-f");
        if (f === "alle") wahl = [];
        else {
          var w = f === "op" || f.indexOf("m:") === 0 ? f : +f, i = wahl.indexOf(w);
          if (i > -1) wahl.splice(i, 1); else wahl.push(w);
        }
        try { localStorage.setItem("ab-filter", JSON.stringify(wahl)); } catch (x) {}
        zeichnen();
      };
    });
    wurzel.querySelectorAll("[data-auf-auf]").forEach(function (b) {
      var det = b.closest("[data-a]").querySelector(".pr-auf-details");
      b.onclick = function () { det.hidden = !det.hidden; b.setAttribute("aria-expanded", String(!det.hidden)); };
    });
    var gezogen = null;
    wurzel.querySelectorAll(".pr-kb-karte").forEach(function (k) {
      k.ondragstart = function (e) { gezogen = k; k.classList.add("zieht"); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", k.getAttribute("data-a")); } catch (x) {} };
      k.ondragend = function () { k.classList.remove("zieht"); wurzel.querySelectorAll(".pr-kb-spalte").forEach(function (s) { s.classList.remove("ziel"); }); };
    });
    wurzel.querySelectorAll(".pr-kb-spalte").forEach(function (sp) {
      sp.ondragover = function (e) { if (!gezogen) return; e.preventDefault(); sp.classList.add("ziel"); };
      sp.ondragleave = function (e) { if (!sp.contains(e.relatedTarget)) sp.classList.remove("ziel"); };
      sp.ondrop = function (e) {
        e.preventDefault(); sp.classList.remove("ziel");
        var k = gezogen; gezogen = null; if (!k || k.parentNode === sp) return;
        var ziel = sp.getAttribute("data-spalte"), fertig = ziel === "erledigt", id = +k.getAttribute("data-a");
        var a = aufgaben.filter(function (x) { return x.id === id; })[0];
        var neu = fertig ? { status: "erledigt", erledigt_am: new Date().toISOString() } : { status: "offen", erledigt_am: null, spalte: ziel };
        for (var key in neu) a[key] = neu[key];
        sp.appendChild(k); k.classList.toggle("pr-kb-fertig", fertig);
        db.from("aufgaben").update(neu).eq("id", id).then(function (r) { if (r.error) { alert("Nicht gespeichert: " + r.error.message); laden(); } });
      };
    });
  }
})();
