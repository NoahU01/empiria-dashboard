/* Projekte – Steckbrief je Projekt: Thema und Überlegungen, Claude-Impuls, Entscheidungen, Aufgaben
   (mit Zuständigkeit), Timeline aus Terminen und Ereignissen mit Protokoll/Entscheidungen/Aufgaben,
   Beteiligte. Übersicht #, Projekt #p=ID. Anmeldung wie auf der Kontaktseite (Login-Link). */
(function () {
  "use strict";
  var db = window.empiriaDb, wurzel = document.querySelector("[data-projekte]");
  if (!db || !wurzel) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function datum(d) { return d ? new Date(d).toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" }) : ""; }
  function kurz(d) { return d ? new Date(d).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" }) : ""; }
  function name(k) { return k ? [k.vorname, k.nachname].filter(Boolean).join(" ") : ""; }
  var STATUS = { "läuft": "st-laeuft", "wartet auf dich": "st-dich", "blockiert": "st-blockiert", "pausiert": "st-pause", "abgeschlossen": "st-pause" };

  db.auth.getSession().then(function (s) {
    if (!s.data.session) { wurzel.innerHTML = '<div class="kb-hinweis"><p>Bitte einmal auf der <a href="/strategie/kontakte.html">Kontaktseite</a> anmelden – dann erscheinen hier die Projekte.</p></div>'; return; }
    route();
  });
  window.addEventListener("hashchange", function () { route(); window.scrollTo(0, 0); });
  // Darstellung der Projektansicht: weiß (Standard), grau, schwarz – zur Auswahl
  function lookWert() { try { return localStorage.getItem("pr-look") || "weiss"; } catch (x) { return "weiss"; } }
  function look(an) {
    var m = document.querySelector("main"); if (!m) return;
    m.classList.remove("pr-look-grau", "pr-look-schwarz", "pr-look-sva");
    if (an && lookWert() !== "weiss") m.classList.add("pr-look-" + lookWert());
  }
  function route() {
    var h = location.hash.replace("#", "");
    document.body.classList.toggle("kt3-detail", /^p=\d+$/.test(h));
    look(/^p=\d+$/.test(h));
    if (/^p=\d+$/.test(h)) projekt(+h.slice(2)); else liste();
  }

  /* ---------- Übersicht ---------- */
  function liste() {
    wurzel.innerHTML = '<div class="kb-laedt"><span></span><span></span></div>';
    Promise.all([
      db.from("projekte").select("id, name, typ, marke, status, naechstes_gate, gate_datum, organisationen(id, name)").order("name"),
      db.from("projekt_ereignisse").select("projekt_id, datum, titel").gte("datum", new Date().toISOString()).order("datum")
    ]).then(function (r) {
      var p = r[0].data || [], nae = {};
      (r[1].data || []).forEach(function (e) { if (!nae[e.projekt_id]) nae[e.projekt_id] = e; });
      var MARKEN = ["empiria", "sofortsichtbar", "Müller&Ströbel."];
      var kunde = p.filter(function (x) { return x.typ !== "intern"; }), intern = p.filter(function (x) { return x.typ === "intern"; });
      function name_(x) { return '<a class="kt3-p" href="#p=' + x.id + '">' + esc(x.name) + "</a>" + (x.status !== "läuft" ? ' <span class="pr-st ' + STATUS[x.status] + '">' + esc(x.status) + "</span>" : ""); }
      // Je Marke eine Sektion: links Kundenprojekte, rechts interne Projekte
      wurzel.innerHTML = MARKEN.map(function (m) {
        function von(l) { return l.filter(function (x) { return (x.marke || "empiria") === m; }); }
        var k = von(kunde), i = von(intern);
        return '<section class="pr-marke-sek"><h2 class="pr-h2">' + esc(m) + '</h2><div class="pr-zwei">' +
          '<table class="kt3-tab pr-tab"><colgroup><col style="width:34%"><col style="width:48%"><col style="width:18%"></colgroup>' +
          "<thead><tr><th>Kundenprojekt</th><th>Kunde</th><th>Nächster Termin</th></tr></thead><tbody>" + (k.length ? k.map(function (x) {
            var n = nae[x.id];
            return '<tr data-href="#p=' + x.id + '"><td>' + name_(x) + "</td><td>" + esc(x.organisationen ? x.organisationen.name : "") + "</td><td>" +
              (n ? kurz(n.datum) : '<span class="kt3-leise">–</span>') + "</td></tr>";
          }).join("") : '<tr><td colspan="3" class="kt3-leise">Keine Kundenprojekte.</td></tr>') + "</tbody></table>" +
          '<table class="kt3-tab pr-tab"><thead><tr><th>Internes Projekt</th></tr></thead><tbody>' + (i.length ? i.map(function (x) {
            return '<tr data-href="#p=' + x.id + '"><td>' + name_(x) + "</td></tr>";
          }).join("") : '<tr><td class="kt3-leise">Keine internen Projekte.</td></tr>') + "</tbody></table></div></section>";
      }).join("");
      wurzel.querySelectorAll("tr[data-href]").forEach(function (tr) { tr.onclick = function (e) { if (!e.target.closest("a")) location.hash = tr.getAttribute("data-href"); }; });
    });
  }

  /* ---------- Projekt ---------- */
  function projekt(id) {
    wurzel.innerHTML = '<div class="kb-laedt"><span></span><span></span></div>';
    Promise.all([
      db.from("projekte").select("*, organisationen(id, name)").eq("id", id).single(),
      db.from("projekt_beteiligte").select("id, seite, rolle, name, kontakte(id, vorname, nachname, position)").eq("projekt_id", id),
      db.from("projekt_ereignisse").select("id, datum, art, titel, quelle, format, ort, teilnehmer, kontakte(id, vorname, nachname)").eq("projekt_id", id).order("datum", { ascending: false }),
      db.from("projekt_punkte").select("id, ereignis_id, art, text, angelegt_am, kontakte(id, vorname, nachname)").eq("projekt_id", id).order("angelegt_am", { ascending: false }),
      db.from("aufgaben").select("id, titel, beschreibung, status, spalte, faellig_am, erledigt_am, ereignis_id, weg, vorgaenger, warten_auf, hinweis, zeitblock_vorschlag, mail_entwurf_id, mail_gesendet_am, antwort_am, antwort_von, unterlagen, person:kontakt_id(id, vorname, nachname), organisationen(id, name), zustaendig_name, kontakte:zustaendig_kontakt_id(id, vorname, nachname)").eq("projekt_id", id).order("angelegt_am")
    ]).then(function (r) {
      if (r[0].error) { wurzel.innerHTML = '<p class="kb-leer">Fehler: ' + esc(r[0].error.message) + "</p>"; return; }
      var auf = r[4].data || [];
      var weiter = function () { zeichnen(r[0].data, r[1].data || [], r[2].data || [], r[3].data || [], auf); };
      if (window.AufgabenDetails) AufgabenDetails.vorlagenAnhaengen(db, auf).then(weiter); else weiter();
    });
  }

  function wer(a) { return a.zustaendig_name || name(a.kontakte) || ""; }
  function format(e) { return e.format === "vor Ort" ? "vor Ort" + (e.ort ? ": " + e.ort : "") : e.format === "offen" ? e.art + " · Ort offen" : e.art + (e.format ? " · " + e.format : ""); }
  function personen(e) { return (e.teilnehmer || []).length ? e.teilnehmer.join(", ") : (e.kontakte ? name(e.kontakte) : ""); }
  function teiln(e) { return (e.teilnehmer || []).length ? "mit " + e.teilnehmer.join(", ") : (e.kontakte ? "mit " + name(e.kontakte) : ""); }
  /* Ohne bekannte Uhrzeit (00:00) wird keine angezeigt */
  function zeit(d, vor) { var t = new Date(d); return t.getHours() || t.getMinutes() ? vor + t.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : ""; }
  var STAND = {};
  function detailEreignis(id) {
    var ziel = wurzel.querySelector('[data-ev-detail="' + id + '"]') || wurzel.querySelector('[data-ev-detail=""]');
    var e = STAND.ere.filter(function (x) { return x.id === id; })[0];
    if (!e || !ziel) return;
    var p2 = STAND.pkt.filter(function (x) { return x.ereignis_id === id; }), a2 = STAND.auf.filter(function (x) { return x.ereignis_id === id; });
    function block(t, l) { return l.length ? '<h4>' + t + '</h4><ul>' + l.join("") + "</ul>" : ""; }
    ziel.innerHTML = '<p class="pr-d">' + datum(e.datum) + zeit(e.datum, " · ") + '</p><h3 class="pr-det-titel">' + esc(e.titel) + "</h3>" +
      '<p class="pr-det-meta">' + esc(format(e)) + (teiln(e) ? "<br>" + esc(teiln(e)) : "") + "</p>" +
      (p2.length || a2.length ?
        block("Notizen", p2.filter(function (x) { return x.art === "Protokoll"; }).map(function (x) { return "<li>" + esc(x.text) + "</li>"; })) +
        block("Entscheidungen", p2.filter(function (x) { return x.art === "Entscheidung"; }).map(function (x) { return "<li>" + esc(x.text) + "</li>"; })) +
        block("Aufgaben", a2.map(function (x) { return "<li>" + esc(x.titel) + ' <span class="kt3-leise">· ' + esc(wer(x)) + (x.faellig_am ? ", bis " + kurz(x.faellig_am) : "") + "</span>" + (x.status === "erledigt" ? " ✓" : "") + "</li>"; }))
        : '<p class="kt3-leise">Noch kein Protokoll. Diktiere mir einfach, was besprochen wurde.</p>');
  }
  function zeichnen(p, bet, ere, pkt, auf) {
    STAND = { ere: ere, pkt: pkt, auf: auf };
    var h = '<a class="kb-zurueck" href="#"><span aria-hidden="true">&larr;</span> Projekte</a>';
    h += '<div class="kt3-kopf"><div><h2 class="kt3-name">' + esc(p.name) + '</h2><p class="kt3-sub">' +
      (p.organisationen ? '<a href="/strategie/kontakte.html#f=' + p.organisationen.id + '">' + esc(p.organisationen.name) + "</a>" : esc(p.marke || "")) + "</p>" +
      (p.thema ? '<p class="pr-thema">' + esc(p.thema) + "</p>" : "") +
      (p.typ === "intern" && p.naechstes_gate ? '<p class="pr-gate"><span>Nächstes Gate</span>' + esc(p.naechstes_gate) + (p.gate_datum ? " · bis " + kurz(p.gate_datum) : "") + "</p>" : "") + "</div><span class=\"pr-tl-wahl pr-look-wahl\">" + [["weiss", "Weiß"], ["grau", "Grau"], ["schwarz", "Schwarz"], ["sva", "SV Akademie"]].map(function (v) {
        return '<button type="button" data-look="' + v[0] + '" aria-pressed="' + (v[0] === lookWert()) + '">' + v[1] + "</button>"; }).join("") + "</span></div>";
    h += '<div class="kt3-raster">';
    // Links: Stoßrichtung (Gesamtblick über alle Termine) – rechts: Aufgaben
    var punkte = (p.ueberlegungen || "").split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
    h += '<section class="kt3-box kt3-breit pr-kurs pr-kurs-breit"><h3>Stoßrichtung</h3>' + (punkte.length ? '<ul data-ueb-text>' + punkte.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"
        : '<p data-ueb-text><span class="pr-offen">Noch keine Stoßrichtung – bitte diktieren.</span></p>') +
      '<textarea class="pr-ueb" data-ueb hidden placeholder="Ein Punkt pro Zeile">' + esc(p.ueberlegungen || "") + '</textarea><div class="pr-ueb-knoepfe"><button type="button" class="kt3-klapp" data-ueb-bearbeiten>Bearbeiten</button>' +
      '<button type="button" class="pr-speichern" data-ueb-speichern hidden>Speichern</button></div></section>';
    // Aufgaben: immer mit Frist, nach Datum
    var offen = auf.filter(function (a) { return a.status === "offen"; }).sort(function (a, b) { return (a.faellig_am || "9999").localeCompare(b.faellig_am || "9999"); });
    // Aufgaben als Liste oder Kanban-Board (Backlog · To-do · In Arbeit · Review/Prüfung · Erledigt)
    var aav = "liste";
    try { aav = localStorage.getItem("pr-auf-ansicht") === "kanban" ? "kanban" : "liste"; } catch (x) {}
    function frist(a) {
      var ueber = a.status === "offen" && a.faellig_am && new Date(a.faellig_am) < new Date(new Date().toDateString());
      return '<span class="pr-frist' + (ueber ? " pr-ueber" : "") + '">' + (a.faellig_am ? kurz(a.faellig_am) : "ohne Termin") + "</span>";
    }
    // Aufgeklappt: nur die Details als Stichpunkte (assets/aufgaben-details.js)
    function det(a) { if (a._det === undefined) a._det = window.AufgabenDetails ? AufgabenDetails.html(a) : ""; return a._det; }
    function titel(a) {
      return det(a) ? '<button type="button" class="pr-auf-titel" data-auf-auf aria-expanded="false"><span>' + esc(a.titel) + '</span><span class="tl-dreieck" aria-hidden="true"></span></button>'
        : '<span class="pr-auf-titel">' + esc(a.titel) + "</span>";
    }
    function details(a) { return det(a) ? '<div class="pr-auf-details" hidden>' + det(a) + "</div>" : ""; }
    // Immer sichtbar: „Hängt ab von …“ und Hinweise wie „Wartet auf Rückmeldung von …“
    function zusatz(a) { return window.AufgabenDetails ? AufgabenDetails.lage(a, auf) : ""; }
    var wahl = '<span class="pr-tl-wahl">' + [["liste", "Liste"], ["kanban", "Kanban"]].map(function (v) {
      return '<button type="button" data-aav="' + v[0] + '" aria-pressed="' + (v[0] === aav) + '">' + v[1] + "</button>"; }).join("") + "</span>";
    var aufInhalt;
    if (aav === "kanban") {
      var vor14 = Date.now() - 14 * 864e5;
      var SPALTEN = [["backlog", "Backlog"], ["todo", "To-do"], ["arbeit", "In Arbeit"], ["pruefung", "Review / Prüfung"], ["erledigt", "Erledigt"]];
      aufInhalt = '<div class="pr-kanban">' + SPALTEN.map(function (sp) {
        var karten = auf.filter(function (a) {
          if (sp[0] === "erledigt") return a.status === "erledigt" && (!a.erledigt_am || new Date(a.erledigt_am) >= vor14);
          return a.status === "offen" && (a.spalte || "todo") === sp[0];
        }).sort(function (a, b) { return (a.faellig_am || "9999").localeCompare(b.faellig_am || "9999"); });
        return '<div class="pr-kb-spalte" data-spalte="' + sp[0] + '"><p class="pr-kb-kopf">' + sp[1] + "</p>" + karten.map(function (a) {
          return '<div class="pr-kb-karte' + (a.status === "erledigt" ? " pr-kb-fertig" : "") + '" draggable="true" data-a="' + a.id + '">' + titel(a) +
            '<p class="pr-kb-meta">' + frist(a) + '<span class="pr-wer">' + esc(wer(a) || "offen") + "</span></p>" + zusatz(a) + details(a) + "</div>";
        }).join("") + "</div>";
      }).join("") + "</div>";
    } else {
      var offen = auf.filter(function (a) { return a.status === "offen"; }).sort(function (a, b) { return (a.faellig_am || "9999").localeCompare(b.faellig_am || "9999"); });
      aufInhalt = offen.length ? '<ul class="pr-auf2">' + offen.map(function (a) {
        return '<li data-a="' + a.id + '"><div class="pr-auf-zeile"><button type="button" class="st-haken" aria-label="Erledigt"></button>' + frist(a) + titel(a) +
          '<span class="pr-wer">' + esc(wer(a) || "offen") + "</span></div>" + '<div class="pr-auf-zusatz">' + zusatz(a) + "</div>" + details(a) + "</li>";
      }).join("") + "</ul>" : '<p class="kt3-leise">Nichts offen.</p>';
    }
    h += '<section class="kt3-box kt3-breit pr-aufgaben pr-auf-breit' + (aav === "kanban" ? " pr-auf-kanban" : "") + '"><div class="pr-tl-kopf"><h3>Aufgaben</h3>' + wahl + "</div>" + aufInhalt + "</section>";
    // Timeline: drei Darstellungen zum Vergleich – ohne äußeren Kasten, mit viel Luft
    var jetzt = Date.now(), tlv = "seite";
    try { tlv = localStorage.getItem("pr-tl-ansicht") || "seite"; } catch (x) {}
    if (tlv !== "auf") tlv = "seite";
    var start = ere.filter(function (e) { return new Date(e.datum) <= jetzt; })[0] || ere[0];
    function eintrag(e, mitPersonen, dreieck) {
      var zuk = new Date(e.datum) > jetzt, hat = pkt.some(function (x) { return x.ereignis_id === e.id; }) || auf.some(function (x) { return x.ereignis_id === e.id; });
      return '<button type="button" data-ev="' + e.id + '" class="' + (zuk ? "pr-zuk " : "") + (start && e.id === start.id ? "an" : "") + '"><span class="pr-d">' + (zuk ? "geplant · " : "") + kurz(e.datum) +
        zeit(e.datum, " · ") + (hat ? ' <i class="pr-hat-details" title="Protokoll vorhanden"></i>' : "") + "</span><b>" + esc(e.titel) + "</b>" +
        '<small>' + esc(format(e)) + (mitPersonen && personen(e) ? " (" + esc(personen(e)) + ")" : "") + "</small>" +
        (dreieck && hat ? '<span class="tl-dreieck" aria-hidden="true"></span>' : "") + "</button>";
    }
    var tl;
    if (tlv === "auf") tl = '<ol class="tl-auf">' + ere.map(function (e) { return "<li>" + eintrag(e, true, true) + '<div class="tl-auf-det" data-ev-detail="' + e.id + '" hidden></div></li>'; }).join("") + "</ol>";
    else tl = '<div class="tl-seite"><ol class="tl-seite-liste">' + ere.map(function (e) { return "<li>" + eintrag(e) + "</li>"; }).join("") + '</ol><div class="tl-seite-det" data-ev-detail=""></div></div>';
    h += '<section class="kt3-box kt3-breit pr-tl-frei"><div class="pr-tl-kopf"><h3>Timeline</h3><span class="pr-tl-wahl">' +
      [["seite", "Nebeneinander"], ["auf", "Aufklappen"]].map(function (v) {
        return '<button type="button" data-tlv="' + v[0] + '" aria-pressed="' + (v[0] === tlv) + '">' + v[1] + "</button>"; }).join("") + "</span></div><div class='pr-tl-inhalt'>" + tl + "</div></section>";
    // Projektziel: schmal, aufklappbar – Kernsatz immer sichtbar, Details beim Aufklappen
    if (p.ziel || (p.ziel_details || []).length) {
      var zd = p.ziel_details || [];
      h += '<section class="kt3-box kt3-breit pr-ziel"><button type="button" class="pr-ziel-kopf" data-ziel aria-expanded="false"' + (zd.length ? "" : " disabled") + '><h3>Projektziel</h3>' +
        '<span class="pr-ziel-satz">' + esc(p.ziel || "") + "</span>" + (zd.length ? '<span class="tl-dreieck" aria-hidden="true"></span>' : "") + "</button>" +
        '<div class="pr-ziel-det" hidden>' + zd.map(function (z) {
          return "<h4>" + esc(z.titel) + "</h4>" + (z.text ? "<p>" + esc(z.text) + "</p>" : "") +
            ((z.punkte || []).length ? "<ul>" + z.punkte.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "");
        }).join("") + "</div></section>";
    } else {
      // Kein Projektziel: trotzdem zeigen – deutlich als offen markiert
      h += '<section class="kt3-box kt3-breit pr-ziel pr-ziel-leer"><div class="pr-ziel-kopf"><h3>Projektziel</h3>' +
        '<span class="pr-offen">Noch kein Projektziel – bitte diktieren.</span></div></section>';
    }
    // Beteiligte
    function seite(s) {
      var l = bet.filter(function (b) { return b.seite === s; });
      return l.length ? '<ul class="pr-bet">' + l.map(function (b) {
        return "<li>" + (b.kontakte ? '<a class="pr-name" href="/strategie/kontakte.html#k=' + b.kontakte.id + '">' + esc(name(b.kontakte)) + "</a>" : '<span class="pr-name">' + esc(b.name) + "</span>") +
          (b.rolle ? '<span class="pr-themen"> · ' + esc(b.rolle) + "</span>" : "") + "</li>"; }).join("") + "</ul>" : '<p class="kt3-leise">–</p>';
    }
    h += '<section class="kt3-box kt3-breit pr-team"><h3>Projektteam</h3><div class="pr-bet-zeile"><div class="pr-bet-spalte"><h4>Beteiligte beim Kunden</h4>' + seite("Kunde") + '</div><div class="pr-bet-spalte"><h4>Team empiria</h4>' + seite("empiria") + seite("Partner").replace('<p class="kt3-leise">–</p>', "") + "</div></div></section>";
    wurzel.innerHTML = h + "</div>";
    if (lookWert() === "sva") module(p);
    verdrahten(p);
  }

  /* Darstellung „SV Akademie“: aufklappbare Module 01–05 wie auf der Seite Projekt SV Akademie.
     Die fertig gezeichneten Kästen werden in die Module umgehängt (Knöpfe behalten ihre Funktion). */
  var MODUL_OFFEN = { kurs: false, auf: true, tl: true, ziel: false, team: false };
  function module(p) {
    var r = wurzel.querySelector(".kt3-raster"), liste = document.createElement("div"), n = 0;
    liste.className = "fl-ebenen pr-module kt3-breit";
    function modul(key, titel, sub, teile) {
      var nr = ++n < 10 ? "0" + n : String(n), sek = document.createElement("section");
      sek.className = "fl-ebene" + (MODUL_OFFEN[key] ? " is-offen" : "");
      sek.innerHTML = '<button type="button" class="fl-kopf" aria-expanded="' + MODUL_OFFEN[key] + '"><span class="fl-kopf-nr">' + nr + '</span><span class="fl-kopf-text"><b>' + esc(titel) + "</b>" +
        (sub ? "<small>" + esc(sub) + "</small>" : "") + '</span><span class="fl-kopf-pfeil" aria-hidden="true"></span></button><div class="fl-koerper"></div>';
      var k = sek.querySelector(".fl-koerper");
      teile.forEach(function (t) { if (t) k.appendChild(t); });
      sek.querySelector(".fl-kopf").onclick = function () {
        var auf = !sek.classList.contains("is-offen"); sek.classList.toggle("is-offen", auf); this.setAttribute("aria-expanded", String(auf)); MODUL_OFFEN[key] = auf;
      };
      liste.appendChild(sek);
    }
    function ohneTitel(el, sel) { if (el) { var t = el.querySelector(sel); if (t) t.remove(); } return el; }
    var kurs = ohneTitel(r.querySelector(".pr-kurs"), ":scope > h3"), auf = ohneTitel(r.querySelector(".pr-aufgaben"), ".pr-tl-kopf > h3"),
        tl = ohneTitel(r.querySelector(".pr-tl-frei"), ".pr-tl-kopf > h3"), ziel = r.querySelector(".pr-ziel"), team = r.querySelector(".pr-bet-zeile");
    modul("kurs", "Stoßrichtung", "Wohin wir das Projekt steuern.", [kurs]);
    modul("auf", "Aufgaben", "Was als Nächstes ansteht.", [auf]);
    modul("tl", "Timeline", "Termine mit Protokoll, Entscheidungen und Aufgaben.", [tl]);
    var det = ziel && ziel.querySelector(".pr-ziel-det");
    if (det) { det.hidden = false; modul("ziel", "Projektziel", p.ziel || "", [det]); }
    else {
      var leer = document.createElement("p"); leer.innerHTML = '<span class="pr-offen">Noch kein Projektziel – bitte diktieren.</span>';
      modul("ziel", "Projektziel", "Noch nicht definiert", [leer]);
      liste.lastChild.classList.add("pr-modul-offen");
    }
    if (ziel) ziel.remove();
    modul("team", "Projektteam", "Beteiligte beim Kunden und Team empiria.", [team]);
    r.innerHTML = ""; r.appendChild(liste);
  }

  function verdrahten(p) {
    var zk = wurzel.querySelector("[data-ziel]");
    if (zk) zk.onclick = function () { var auf = zk.getAttribute("aria-expanded") !== "true"; zk.setAttribute("aria-expanded", String(auf)); zk.nextElementSibling.hidden = !auf; };
    wurzel.querySelectorAll("[data-look]").forEach(function (b) {
      b.onclick = function () { var vorher = lookWert(); try { localStorage.setItem("pr-look", b.getAttribute("data-look")); } catch (x) {} look(true);
        if (vorher === "sva" || lookWert() === "sva") { projekt(p.id); return; }
        wurzel.querySelectorAll("[data-look]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); };
    });
    wurzel.querySelectorAll("[data-tlv]").forEach(function (b) {
      b.onclick = function () { try { localStorage.setItem("pr-tl-ansicht", b.getAttribute("data-tlv")); } catch (x) {} projekt(p.id); };
    });
    var knoepfe = wurzel.querySelectorAll("[data-ev]"), aufklappen = !!wurzel.querySelector(".tl-auf");
    knoepfe.forEach(function (b) {
      b.onclick = function () {
        var id = +b.getAttribute("data-ev");
        if (aufklappen) {
          var det = wurzel.querySelector('[data-ev-detail="' + id + '"]'), auf = det.hidden;
          det.hidden = !auf; b.classList.toggle("an", auf); if (auf) detailEreignis(id);
          return;
        }
        knoepfe.forEach(function (x) { x.classList.toggle("an", x === b); }); detailEreignis(id);
      };
    });
    if (aufklappen) wurzel.querySelectorAll(".tl-auf [data-ev].an").forEach(function (x) { x.classList.remove("an"); });
    var an = wurzel.querySelector("[data-ev].an"); if (an && !aufklappen) detailEreignis(+an.getAttribute("data-ev"));
    wurzel.querySelectorAll("[data-aav]").forEach(function (b) {
      b.onclick = function () { try { localStorage.setItem("pr-auf-ansicht", b.getAttribute("data-aav")); } catch (x) {} projekt(p.id); };
    });
    // Kanban: Karte in eine andere Spalte ziehen
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
        var ziel = sp.getAttribute("data-spalte"), fertig = ziel === "erledigt";
        sp.appendChild(k); k.classList.toggle("pr-kb-fertig", fertig);
        var neu = fertig ? { status: "erledigt", erledigt_am: new Date().toISOString() } : { status: "offen", erledigt_am: null, spalte: ziel };
        db.from("aufgaben").update(neu).eq("id", +k.getAttribute("data-a")).then(function (r) { if (r.error) { alert("Nicht gespeichert: " + r.error.message); projekt(p.id); } });
      };
    });
    // Aufgaben mit Details: Dreieck wie in der Timeline, klappt ohne Kasten nach unten auf
    wurzel.querySelectorAll("[data-auf-auf]").forEach(function (b) {
      var det = b.closest("[data-a]").querySelector(".pr-auf-details");
      b.onclick = function () { det.hidden = !det.hidden; b.setAttribute("aria-expanded", String(!det.hidden)); };
    });
    var ta = wurzel.querySelector("[data-ueb]"), sp = wurzel.querySelector("[data-ueb-speichern]"), bt = wurzel.querySelector("[data-ueb-bearbeiten]"), tx = wurzel.querySelector("[data-ueb-text]");
    bt.onclick = function () { ta.hidden = false; tx.hidden = true; bt.hidden = true; sp.hidden = false; ta.focus(); };
    sp.onclick = function () { sp.disabled = true; db.from("projekte").update({ ueberlegungen: ta.value }).eq("id", p.id).then(function (r) { sp.disabled = false; if (r.error) alert(r.error.message); else projekt(p.id); }); };
    wurzel.querySelectorAll("[data-a] .st-haken").forEach(function (b) {
      b.onclick = function () { var li = b.closest("li"); li.classList.add("st-weg");
        db.from("aufgaben").update({ status: "erledigt", erledigt_am: new Date().toISOString() }).eq("id", +li.getAttribute("data-a")).then(function (r) { if (r.error) { li.classList.remove("st-weg"); alert(r.error.message); } }); };
    });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-klapp-knopf]"); if (!b || !wurzel.contains(b)) return;
    var auf = b.getAttribute("aria-expanded") !== "true";
    b.closest(".kt3-box").querySelectorAll("[data-mehr]").forEach(function (x) { x.hidden = !auf; });
    b.setAttribute("aria-expanded", String(auf)); b.textContent = auf ? "Weniger zeigen" : "Alle zeigen";
  });
})();
