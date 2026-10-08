/* Aufgaben – Kanban-Board über alle Projekte und die operativen Aufgaben ohne Projekt.
   Oben ein Filter: Alle, Operativ, ganze Marken oder einzelne/mehrere Projekte (merkt sich die Auswahl).
   Spalten: Backlog · To-do · In Arbeit · Review/Prüfung · Erledigt (letzte 14 Tage). Karten zum Ziehen.
   Umschaltbar auf „Liste“: offene Aufgaben nach Frist – Überfällig, je Tag, ohne Frist (Haken = erledigt).
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
  // Ansicht: Kanban oder Liste nach Frist (wie die Termine auf der Analyse) – wird gemerkt
  var ANSICHT = "kanban";
  try { ANSICHT = localStorage.getItem("ab-ansicht") === "liste" ? "liste" : "kanban"; } catch (x) {}

  db.auth.getSession().then(function (s) {
    if (!s.data.session) { wurzel.innerHTML = '<div class="kb-hinweis"><p>Bitte einmal auf der <a href="/strategie/kontakte.html?zurueck=' + encodeURIComponent(location.pathname) + '">Kontaktseite</a> anmelden – dann erscheinen hier die Aufgaben.</p></div>'; return; }
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
      if (window.AufgabenDetails) AufgabenDetails.vorlagenAnhaengen(db, aufgaben).then(zeichnen); else zeichnen();
    });
  }

  function projektVon(a) { return projekte.filter(function (p) { return p.id === a.projekt_id; })[0]; }
  // Aus Analyse „Rückmeldungen eingegangen“ (#rueckmeldungen): nur Aufgaben zeigen, auf die eine Antwort gekommen ist
  var nurRueck = location.hash === "#rueckmeldungen";
  function rueck(a) { return a.status === "offen" && !!a.antwort_am; }
  function sichtbar(a) {
    if (nurRueck) return rueck(a);
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
    // Zeile 1: Alle · Operativ · Marken – Zeile 2: alle laufenden Projekte (bei gewählter Marke nur deren Projekte). Eine Ebene, keine Farben.
    var marken = MARKEN.filter(function (m) { return wahl.indexOf("m:" + m) > -1; });
    // Ist oben etwas gewählt (Operativ oder Marke), stehen unten nur die passenden Projekte – Operativ hat keine, die Zeile entfällt dann.
    var oben = marken.length || wahl.indexOf("op") > -1;
    var l = projekte.filter(function (p) { return p.status !== "abgeschlossen" && (!oben || marken.indexOf(p.marke || "empiria") > -1 || wahl.indexOf(p.id) > -1); });
    var h = '<div class="ab-filter"><div class="ab-filter-zeile ab-filter-haupt">' + knopf("alle", "Alle", !wahl.length) + knopf("op", "Operativ", wahl.indexOf("op") > -1) +
      MARKEN.map(function (m) { return knopf("m:" + m, m, wahl.indexOf("m:" + m) > -1); }).join("") + umschalter() + "</div>" +
      '<div class="ab-filter-zeile ab-filter-projekte' + (l.length ? "" : " ab-filter-ohne") + '">' + l.map(function (p) {
        return knopf(p.id, p.name, wahl.indexOf(p.id) > -1).replace("<button", mitAufgaben[p.id] ? "<button" : '<button class="ab-leer"');
      }).join("") + "</div>" +
      // unsichtbare Messzeile mit allen Projekten: hält auf großen Bildschirmen den Abstand zum Board fest, egal was oben gewählt ist
      '<div class="ab-filter-zeile ab-filter-projekte ab-filter-mass" aria-hidden="true">' + projekte.filter(function (p) { return p.status !== "abgeschlossen"; }).map(function (p) {
        return '<button type="button" tabindex="-1">' + esc(p.name) + "</button>";
      }).join("") + "</div>";
    if (nurRueck) h = '<div class="ab-filter"><div class="ab-filter-zeile ab-filter-haupt"><button type="button" class="ab-rueck" aria-pressed="true" data-rueck-aus>Neue Rückmeldungen (' + aufgaben.filter(rueck).length + ') <span aria-hidden="true">×</span></button>' +
      '<span class="ab-rueck-hinweis">Nur Aufgaben, auf die eine Antwort eingegangen ist</span></div><div class="ab-filter-zeile ab-filter-projekte ab-filter-ohne"></div>';
    return h + "</div>";
  }

  function umschalter() {
    return '<span class="ab-ansicht" role="group" aria-label="Ansicht">' + [["liste", "Liste"], ["kanban", "Kanban"]].map(function (v) {
      return '<button type="button" data-ansicht="' + v[0] + '" aria-pressed="' + (ANSICHT === v[0]) + '">' + v[1] + "</button>"; }).join("") + "</span>";
  }

  /* ---------- Liste nach Frist: Überfällig · je Tag · ohne Frist ---------- */
  var SP_NAME = { backlog: "Backlog", todo: "To-do", arbeit: "In Arbeit", pruefung: "Review" };
  function tagKey(d) { return d ? String(d).slice(0, 10) : ""; }
  function heuteKey(off) { var d = new Date(); d.setDate(d.getDate() + (off || 0)); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function tagTitel(k) {
    var d = new Date(k + "T12:00:00"), lang = d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
    return k === heuteKey(0) ? "Heute · " + lang : k === heuteKey(1) ? "Morgen · " + lang : lang;
  }
  function zeileListe(a) {
    var p = projektVon(a), herkunft = p ? '<a href="/strategie/projekte.html#p=' + p.id + '">' + esc(p.name) + "</a>" : esc(a.organisationen ? a.organisationen.name : "Operativ");
    return '<li class="al-z" data-a="' + a.id + '"><input type="checkbox" class="al-haken" data-fertig aria-label="Erledigt"' + (a.status === "erledigt" ? " checked" : "") + ">" +
      '<div class="al-was">' + (det(a) ? '<button type="button" class="pr-auf-titel" data-auf-auf aria-expanded="false"><span>' + esc(a.titel) + '</span><span class="tl-dreieck" aria-hidden="true"></span></button>' : '<span class="pr-auf-titel">' + esc(a.titel) + "</span>") +
      '<small>' + herkunft + " · " + esc(wer(a) || "offen") + "</small>" + zusatz(a) + (det(a) ? '<div class="pr-auf-details" hidden>' + det(a) + "</div>" : "") + "</div>" +
      '<span class="al-sp al-sp--' + (a.spalte || "todo") + '">' + (SP_NAME[a.spalte || "todo"] || "") + "</span></li>";
  }
  function liste(l) {
    var offen = l.filter(function (a) { return a.status === "offen"; }), heute = heuteKey(0), g = {}, ohne = [], ueber = [];
    offen.forEach(function (a) { var k = tagKey(a.faellig_am); if (!k) ohne.push(a); else if (k < heute) ueber.push(a); else (g[k] = g[k] || []).push(a); });
    var h = "";
    if (ueber.length) h += '<section class="al-tag al-tag--ueber"><h4>Überfällig</h4><ul>' + ueber.map(zeileListe).join("") + "</ul></section>";
    Object.keys(g).sort().forEach(function (k) { h += '<section class="al-tag' + (k === heute ? " al-tag--heute" : "") + '"><h4>' + tagTitel(k) + "</h4><ul>" + g[k].map(zeileListe).join("") + "</ul></section>"; });
    if (ohne.length) h += '<section class="al-tag al-tag--ohne"><h4>Ohne Frist</h4><ul>' + ohne.map(zeileListe).join("") + "</ul></section>";
    return '<div class="ab-liste">' + (h || '<p class="kb-leer">Keine offenen Aufgaben in dieser Auswahl.</p>') + "</div>";
  }

  function karte(a) {
    var p = projektVon(a), ueber = a.status === "offen" && a.faellig_am && new Date(a.faellig_am) < new Date(new Date().toDateString());
    var herkunft = p ? p.name : a.organisationen ? a.organisationen.name : "Operativ";
    return '<div class="pr-kb-karte' + (a.status === "erledigt" ? " pr-kb-fertig" : "") + '" draggable="true" data-a="' + a.id + '">' +
      '<p class="ab-herkunft">' + (p ? '<a href="/strategie/projekte.html#p=' + p.id + '">' + esc(herkunft) + "</a>" : esc(herkunft)) + "</p>" +
      (det(a) ? '<button type="button" class="pr-auf-titel" data-auf-auf aria-expanded="false"><span>' + esc(a.titel) + '</span><span class="tl-dreieck" aria-hidden="true"></span></button>'
        : '<span class="pr-auf-titel">' + esc(a.titel) + "</span>") +
      '<p class="pr-kb-meta"><span class="pr-frist' + (a.faellig_am ? " mk mk--frist" : "") + (ueber ? " pr-ueber" : "") + '">' + (a.faellig_am ? kurz(a.faellig_am) : "ohne Termin") + '</span><span class="pr-wer">' + esc(wer(a) || "offen") + "</span></p>" +
      zusatz(a) + (det(a) ? '<div class="pr-auf-details" hidden>' + det(a) + "</div>" : "") + "</div>";
  }

  function det(a) { if (a._det === undefined) a._det = window.AufgabenDetails ? AufgabenDetails.html(a) : ""; return a._det; }
  // Immer sichtbar: „Hängt ab von …“ und Hinweise wie „Wartet auf Rückmeldung von …“
  function zusatz(a) { return window.AufgabenDetails ? AufgabenDetails.lage(a, aufgaben) : ""; }

  function zeichnen() {
    var l = aufgaben.filter(sichtbar).sort(function (a, b) { return (a.faellig_am || "9999").localeCompare(b.faellig_am || "9999"); });
    if (ANSICHT === "liste") { wurzel.innerHTML = filter() + liste(l); verdrahten(); abstand(); return; }
    wurzel.innerHTML = filter() + '<div class="pr-kanban ab-kanban">' + SPALTEN.map(function (sp) {
      var karten = l.filter(function (a) { return sp[0] === "erledigt" ? a.status === "erledigt" : a.status === "offen" && (a.spalte || "todo") === sp[0]; });
      return '<div class="pr-kb-spalte' + (karten.length ? "" : " ab-spalte-leer") + '" data-spalte="' + sp[0] + '"><p class="pr-kb-kopf">' + sp[1] + "</p>" + karten.map(karte).join("") + "</div>";
    }).join("") + "</div>";
    verdrahten(); abstand();
  }
  // Projektzeile auf großen Bildschirmen immer so hoch wie mit allen Projekten – das Board springt nicht; am Handy darf es nachrücken
  function abstand() {
    var z = wurzel.querySelector(".ab-filter-projekte:not(.ab-filter-mass)"), m = wurzel.querySelector(".ab-filter-mass");
    if (z && m) z.style.minHeight = window.innerWidth > 700 ? m.offsetHeight + "px" : "";
  }
  window.addEventListener("resize", abstand);

  function verdrahten() {
    var ra = wurzel.querySelector("[data-rueck-aus]");
    if (ra) ra.onclick = function () { nurRueck = false; history.replaceState(null, "", location.pathname); zeichnen(); };
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
    wurzel.querySelectorAll("[data-ansicht]").forEach(function (b) {
      b.onclick = function () { ANSICHT = b.getAttribute("data-ansicht"); try { localStorage.setItem("ab-ansicht", ANSICHT); } catch (x) {} zeichnen(); };
    });
    wurzel.querySelectorAll("[data-fertig]").forEach(function (c) {
      c.onchange = function () {
        var li = c.closest("[data-a]"), id = +li.getAttribute("data-a"), a = aufgaben.filter(function (x) { return x.id === id; })[0];
        var neu = c.checked ? { status: "erledigt", erledigt_am: new Date().toISOString() } : { status: "offen", erledigt_am: null };
        for (var k in neu) a[k] = neu[k];
        li.classList.toggle("al-z--fertig", c.checked);
        db.from("aufgaben").update(neu).eq("id", id).then(function (r) { if (r.error) { alert("Nicht gespeichert: " + r.error.message); laden(); } });
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
