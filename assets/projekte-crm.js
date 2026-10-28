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
  var STATUS = { "läuft": "st-laeuft", "projektidee": "st-pause", "abgeschlossen": "st-pause" };
  /* Priorität und Status (Daniel, 10.10.2026): bewusst einfach – drei Stufen, drei Zustände. Marker = drei kleine Balken. */
  var PRIO = [["hoch", "Hoch"], ["mittel", "Mittel"], ["niedrig", "Niedrig"]], PRIO_RANG = { hoch: 0, mittel: 1, niedrig: 2 };
  var STATI = [["projektidee", "Projektidee"], ["läuft", "Läuft"], ["abgeschlossen", "Abgeschlossen"]], STATUS_RANG = { "läuft": 0, projektidee: 1, abgeschlossen: 2 };
  var STATUS_NAME = { projektidee: "Projektidee", "läuft": "Läuft", abgeschlossen: "Abgeschlossen" };
  function prioMarker(pr) {
    var n = { hoch: 3, mittel: 2, niedrig: 1 }[pr] || 0;
    return '<span class="pz-prio pz-prio--' + (pr || "ohne") + '" title="Priorität: ' + (pr ? pr.charAt(0).toUpperCase() + pr.slice(1) : "nicht gesetzt") + '" aria-label="Priorität ' + (pr || "nicht gesetzt") + '">' +
      [1, 2, 3].map(function (i) { return '<i class="' + (i <= n ? "an" : "") + '"></i>'; }).join("") + "</span>";
  }

  db.auth.getSession().then(function (s) {
    if (!s.data.session) { wurzel.innerHTML = '<div class="kb-hinweis"><p>Bitte einmal auf der <a href="/strategie/kontakte.html?zurueck=' + encodeURIComponent(location.pathname) + '">Kontaktseite</a> anmelden – dann erscheinen hier die Projekte.</p></div>'; return; }
    route();
  });
  window.addEventListener("hashchange", function () { route(); window.scrollTo(0, 0); });
  // Darstellung der Projektansicht: weiß (Standard), grau, schwarz – zur Auswahl
  function lookWert() { return "weiss"; }   // Darstellung fest auf Weiß (Daniel, 08.10.2026) – Auswahl Grau/Schwarz/SV Akademie entfernt
  function look(an) {
    var m = document.querySelector("main"); if (!m) return;
    m.classList.remove("pr-look-grau", "pr-look-schwarz", "pr-look-sva");
    if (an && lookWert() !== "weiss") m.classList.add("pr-look-" + lookWert());
  }
  // Kopf der Seite: in der Detailansicht (Darstellung Weiß) wie alle anderen Seiten – Rücksprung als Kicker, Projektname gelb hinterlegt
  var KOPF = null;
  function kopf(p) {
    var k = document.querySelector(".db-kopf .kicker"), t = document.querySelector(".db-kopf h1");
    if (!k || !t) return;
    if (!KOPF) KOPF = { k: k.innerHTML, t: t.innerHTML };
    if (!p) { k.innerHTML = KOPF.k; t.innerHTML = KOPF.t; return; }
    k.innerHTML = '<a class="pr-kopf-zurueck" href="#"><span aria-hidden="true">&larr;</span> Projekte</a><span class="pr-kopf-marke">' +
      (p.organisationen ? esc(p.organisationen.name) : esc(p.marke || "")) + "</span>";
    t.innerHTML = esc(p.name) + ".";   // ohne gelbes Highlight (Daniel, 11.10.2026)
  }
  function route() {
    var h = location.hash.replace("#", "");
    document.body.classList.toggle("kt3-detail", /^p=\d+$/.test(h));
    if (!/^p=\d+$/.test(h)) kopf(null);
    look(/^p=\d+$/.test(h));
    if (/^p=\d+$/.test(h)) { if (+h.slice(2) !== KLAPP.id) KLAPP = { id: null, z: {} }; projekt(+h.slice(2)); }
    else { KLAPP = { id: null, z: {} }; liste(); }
  }

  /* ---------- Übersicht ---------- */
  function liste() {
    wurzel.innerHTML = '<div class="kb-laedt"><span></span><span></span></div>';
    Promise.all([
      db.from("projekte").select("id, name, typ, marke, status, prioritaet, naechstes_gate, gate_datum, organisationen(id, name)").order("reihenfolge", { nullsFirst: false }).order("name"),
      db.from("projekt_ereignisse").select("projekt_id, datum, titel").gte("datum", new Date().toISOString()).order("datum")
    ]).then(function (r) {
      // Strategie je Marke ist kein Projekt – sie steht im Bereich Strategie (Daniel, 20.10.2026)
      var p = (r[0].data || []).filter(function (x) { return x.typ !== "strategie"; }), nae = {};
      (r[1].data || []).forEach(function (e) { if (!nae[e.projekt_id]) nae[e.projekt_id] = e; });
      var MARKEN = ["empiria", "sofortsichtbar", "Müller&Ströbel."];
      var kunde = p.filter(function (x) { return x.typ !== "intern"; }), intern = p.filter(function (x) { return x.typ === "intern"; });
      function name_(x) { return '<a class="kt3-p" href="#p=' + x.id + '">' + esc(x.name) + "</a>" + (x.status !== "läuft" ? ' <span class="pr-st ' + STATUS[x.status] + '">' + esc(STATUS_NAME[x.status] || x.status) + "</span>" : ""); }
      // Umschaltung Überblick (je Marke) · Priorisierung (zwei Spalten, nach Priorität) – Daniel, 10.10.2026
      var ansicht = "ueberblick";
      try { ansicht = localStorage.getItem("pr-ansicht") === "prio" ? "prio" : "ueberblick"; } catch (x) {}
      var wahl = '<div class="pz-wahl pr-tl-wahl">' + [["ueberblick", "Überblick"], ["prio", "Priorisierung"]].map(function (v) {
        return '<button type="button" data-pr-ansicht="' + v[0] + '" aria-pressed="' + (v[0] === ansicht) + '">' + v[1] + "</button>"; }).join("") + "</div>";
      function verdrahtenWahl() {
        wurzel.querySelectorAll("[data-pr-ansicht]").forEach(function (b) { b.onclick = function () {
          try { localStorage.setItem("pr-ansicht", b.getAttribute("data-pr-ansicht")); } catch (x) {} liste(); }; });
      }
      if (ansicht === "prio") {
        function sortiert(l) { return l.slice().sort(function (a, b) {
          return (STATUS_RANG[a.status] || 0) - (STATUS_RANG[b.status] || 0) || (a.prioritaet ? PRIO_RANG[a.prioritaet] : 3) - (b.prioritaet ? PRIO_RANG[b.prioritaet] : 3) || a.name.localeCompare(b.name, "de"); }); }
        function spalte(titel, l, mitKunde) {
          return '<section class="pz-spalte"><h2 class="pz-h">' + titel + '</h2><ul class="pz-liste">' + (l.length ? sortiert(l).map(function (x) {
            return '<li class="pz-z' + (x.status === "abgeschlossen" ? " pz-z--fertig" : "") + '"><a href="#p=' + x.id + '">' + prioMarker(x.prioritaet) +
              '<span class="pz-name">' + esc(x.name) + "</span>" +
              '<span class="pz-meta">' + esc([mitKunde && x.organisationen ? x.organisationen.name : null, x.status !== "läuft" ? STATUS_NAME[x.status] : null].filter(Boolean).join(" · ")) + "</span></a></li>";
          }).join("") : '<li class="kt3-leise">Keine.</li>') + "</ul></section>";
        }
        wurzel.innerHTML = wahl + '<div class="pz-zwei">' + spalte("Kundenprojekte", kunde, true) + spalte("Interne Projekte", intern, false) + "</div>";
        verdrahtenWahl();
        return;
      }
      // Je Marke eine Sektion: links Kundenprojekte, rechts interne Projekte
      wurzel.innerHTML = wahl + MARKEN.map(function (m) {
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
      verdrahtenWahl();
    });
  }

  /* ---------- Projekt ---------- */
  var STRAENGE = [], EXTERN = [];
  /* ---------- Linienplan: Daten aus projekt_straenge und aufgaben (Daniel, 23.10.2026) ----------
     Stoßrichtungen = Stränge ohne Unterstränge (Reihenfolge wie im Projekt; Unterstränge eines Oberstrangs stehen an seiner Stelle).
     Ergebnislevel = Projekt-Gates (aufgaben.art = 'projektgate'). Aufgaben ohne Projekt-Gate (z. B. Innovation, Projektmanagement)
     kommen in das Level, vor dessen Datum sie fällig sind – ohne Datum in das erste offene Level. */
  var UB_FARBEN = ["#C51F5D", "#8613A1", "#0B9FBD", "#B08D57", "#6b665f", "#3d7a5c", "#a05a2c"];
  var UB_GERUEST = '<div class="ub-dash" data-ub-wurzel><div class="ub-dash-kopf"><div data-zoom-platz></div><div data-legende-quelle hidden><ul class="ub-leg"><li><span class="ub-leg-ic"><svg width="22" height="22" viewBox="0 0 22 22"><circle cx="11" cy="11" r="8.75" fill="#fff" stroke="#111" stroke-width="4.5"/></svg></span>in Arbeit</li><li><span class="ub-leg-ic"><svg width="14" height="22" viewBox="0 0 14 22"><circle cx="7" cy="11" r="6" fill="#111"/></svg></span>erledigt</li><li><span class="ub-leg-ic"><svg width="20" height="22" viewBox="0 0 20 22"><circle cx="10" cy="11" r="8.5" fill="#fff" stroke="#a39e96" stroke-width="3"/></svg></span>kommt noch</li><li><span class="ub-leg-ic"><svg width="30" height="10"><line x1="4" y1="5" x2="26" y2="5" stroke="#111" stroke-width="8" stroke-linecap="round"/></svg></span>Strecke erledigt</li><li><span class="ub-leg-ic"><svg width="30" height="10"><line x1="4" y1="5" x2="26" y2="5" stroke="#dedad4" stroke-width="8" stroke-linecap="round"/></svg></span>Strecke offen</li><li><span class="ub-leg-ic"><svg width="30" height="10"><line x1="2" y1="5" x2="28" y2="5" stroke="#8a857d" stroke-width="2" stroke-dasharray="3 5"/></svg></span>Abh&auml;ngigkeit</li><li><span class="ub-leg-ic"><svg width="26" height="20"><line x1="3" y1="3" x2="3" y2="17" stroke="#111" stroke-width="4" stroke-linecap="round"/><line x1="3" y1="10" x2="24" y2="10" stroke="#111" stroke-width="4" stroke-linecap="round"/></svg></span>beginnt eigenst&auml;ndig</li><li><span class="ub-leg-ic"><svg width="16" height="24"><rect x="3" y="3" width="10" height="18" rx="5" fill="#fff" stroke="#111" stroke-width="3"/></svg></span>Ergebnislevel</li></ul></div></div>' +
    '<div data-ub-stufen></div><div data-ub-plan></div></div>';
  function ubKurz(t) {
    if (/projektmanagement/i.test(t)) return "PM";
    var w = t.replace(/&/g, " ").split(/\s+/).filter(Boolean), rom = { I: "1", II: "2", III: "3", IV: "4", V: "5" };
    if (w.length > 1 && rom[w[w.length - 1]]) return w[0][0].toUpperCase() + rom[w[w.length - 1]];
    if (w.length > 1) return (w[0][0] + w[1][0]).toUpperCase();
    return w[0].slice(0, 2).toUpperCase();
  }
  // opt.termine (neuer Aufbau): Plan ohne To-dos – die Linie „Projektmanagement“ zeigt die Projekttermine
  // (Regeltermine, Abstimmungen, Runden) der letzten vier Wochen und alle kommenden; Aufgaben ohne Strang bleiben in der Liste.
  // Kurzer Name im Plan (höchstens drei Wörter): mit Teilnehmenden „Austausch Nachname“, sonst Titel ohne Klammerzusatz und „der SV Akademie“
  function kurzTermin(e) {
    var tn = (e.teilnehmer || []).map(function (n) { return String(n).trim().split(/\s+/).pop(); });
    if (tn.length) return "Austausch " + tn.slice(0, 2).join(", ");
    return String(e.titel || "").replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+der\s+SV[\s-]Akademie\b/i, "").trim();
  }
  function ubahnDaten(straenge, auf, opt) {
    opt = opt || {};
    var kinder = {}, oben = [];
    straenge.forEach(function (s) { if (s.eltern_id) (kinder[s.eltern_id] = kinder[s.eltern_id] || []).push(s); else oben.push(s); });
    function reihe(a, b) { return (a.reihenfolge || 0) - (b.reihenfolge || 0) || a.id - b.id; }
    var blaetter = [];
    oben.sort(reihe).forEach(function (s) { if (kinder[s.id]) kinder[s.id].sort(reihe).forEach(function (k) { blaetter.push(k); }); else blaetter.push(s); });
    var gates = auf.filter(function (a) { return a.art === "projektgate"; })
      .sort(function (a, b) { return String(a.faellig_am || "9999").localeCompare(String(b.faellig_am || "9999")) || (a.reihenfolge || 0) - (b.reihenfolge || 0); });
    var imStrang = {}; blaetter.forEach(function (s) { imStrang[s.id] = true; });
    var pm = opt.termine ? blaetter.filter(function (s) { return /projektmanagement/i.test(s.titel || ""); })[0] : null;
    if (opt.termine) auf = auf.filter(function (a) { return a.strang_id && imStrang[a.strang_id] && !(pm && a.strang_id === pm.id) || a.art === "projektgate"; });
    if (opt.termine && !pm && opt.termine.length) { pm = { id: -1, titel: "Termine", erklaerung: "", verantwortlich: [] }; blaetter.push(pm); imStrang[-1] = true; }
    // Aufgaben ohne (bekannten) Strang laufen auf einer eigenen Linie „Weitere Aufgaben“
    var ohne = auf.filter(function (a) { return a.art !== "projektgate" && !(a.strang_id && imStrang[a.strang_id]); });
    if (ohne.length) { blaetter.push({ id: 0, titel: blaetter.length ? "Weitere Aufgaben" : "Aufgaben", erklaerung: "", verantwortlich: [] }); imStrang[0] = true; }
    if (!blaetter.length) return null;
    var liste = auf.filter(function (a) { return a.art !== "projektgate"; }).map(function (a) { return a.strang_id && imStrang[a.strang_id] ? a : Object.assign({}, a, { strang_id: 0 }); });
    // Projekt ohne Projekt-Gates: ein Ergebnislevel „Projektziel“ über alle Aufgaben, fällig mit der letzten Aufgabe
    if (!gates.length) {
      var letzte = liste.map(function (a) { return a.faellig_am; }).filter(Boolean).sort().pop() || null;
      gates = [{ id: 0, titel: "Projektziel", faellig_am: letzte, status: "offen", beschreibung: "" }];
    }
    var ids = {}; liste.forEach(function (a) { ids[a.id] = true; });
    // Reihenfolge im Strang ist die Abfolge: hat eine Aufgabe keinen Vorgänger im eigenen Strang, hängt sie an der vorigen –
    // so wird jeder Strang eine Linie statt vieler paralleler Nebenstrecken
    // Begleitende Stränge (eigener Oberstrang ohne Unterstränge, z. B. Innovation, Projektmanagement): nur die Reihenfolge zählt,
    // damit sie als eine ruhige Linie neben den Stoßrichtungen laufen
    var gruppen = oben.some(function (s) { return kinder[s.id]; });
    var begleitend = {}; if (gruppen) oben.forEach(function (s) { if (!kinder[s.id]) begleitend[s.id] = true; });
    var vorher = {};
    blaetter.forEach(function (st) {
      var reihe2 = liste.filter(function (a) { return a.strang_id === st.id; })
        .sort(function (x, y) { return (x.reihenfolge == null ? 999 : x.reihenfolge) - (y.reihenfolge == null ? 999 : y.reihenfolge) || x.id - y.id; });
      reihe2.forEach(function (a, i) {
        var eigene = !begleitend[st.id] && (a.vorgaenger || []).some(function (v) { return reihe2.some(function (b) { return String(b.id) === String(v); }); });
        if (!eigene && i > 0) vorher[a.id] = reihe2[i - 1].id;
      });
    });
    var erstesOffen = (gates.filter(function (g) { return g.status !== "erledigt"; })[0] || gates[gates.length - 1]).id;
    function level(a) {
      if (a.projektgate_id && gates.some(function (g) { return g.id === a.projektgate_id; })) return a.projektgate_id;
      if (a.faellig_am) { var g = gates.filter(function (x) { return x.faellig_am && x.faellig_am >= a.faellig_am; })[0]; if (g) return g.id; }
      return erstesOffen;
    }
    function datum(d) { var t = String(d || "").slice(0, 10).split("-"); return t.length === 3 ? t[2] + "." + t[1] + "." + t[0] : "offen"; }
    // Termine als Halte auf der Linie Projektmanagement: vergangene erledigt, in zeitlicher Folge
    var termHalte = [];
    if (pm && opt.termine) {
      var grenze = Date.now() - 28 * 864e5, jetzt = Date.now();
      var tl = opt.termine.filter(function (e) { return new Date(e.datum).getTime() >= grenze; }).sort(function (a, b) { return new Date(a.datum) - new Date(b.datum); });
      tl.forEach(function (e, i) {
        var d = new Date(e.datum), tag = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2), mitZeit = d.getHours() || d.getMinutes();
        var g = gates.filter(function (x) { return x.faellig_am && x.faellig_am >= tag; })[0] || gates[gates.length - 1];
        termHalte.push({ id: "e" + e.id, strang: "s" + pm.id, meilenstein: "g" + g.id, titel: kurzTermin(e),
          beschreibung: [e.titel, e.format === "vor Ort" ? "vor Ort" + (e.ort ? ": " + e.ort : "") : e.format, (e.teilnehmer || []).length ? "mit " + e.teilnehmer.join(", ") : ""].filter(Boolean).join(" · "),
          status: d.getTime() < jetzt ? "erreicht" : "offen", braucht: i ? ["e" + tl[i - 1].id] : [],
          termin: "am " + d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) + (mitZeit ? ", " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr" : "") });
      });
    }
    var erg = {
      zielbild: { kurz: "Gesamtplan" },
      straenge: blaetter.map(function (s, i) {
        var label = String(s.titel || "").replace(/^\d+\s+/, "");
        return { id: "s" + s.id, kurz: ubKurz(label), label: label, frage: s.erklaerung || "", beschreibung: "", verantwortung: (s.verantwortlich || []).join(", "), farbe: UB_FARBEN[i % UB_FARBEN.length] };
      }),
      meilensteine: gates.map(function (g, i) {
        return { id: "g" + g.id, nr: i + 1, termin: datum(g.faellig_am), titel: g.titel, ergebnis: g.beschreibung ? [g.beschreibung] : [],
          braucht: liste.filter(function (a) { return level(a) === g.id; }).map(function (a) { return "a" + a.id; }) };
      }),
      schritte: liste.map(function (a) {
        return { id: "a" + a.id, strang: "s" + a.strang_id, meilenstein: "g" + level(a), titel: a.titel, beschreibung: a.beschreibung || "",
          status: a.status === "erledigt" ? "erreicht" : (a.spalte === "arbeit" || a.spalte === "pruefung") ? "aktiv" : "offen",
          braucht: (a.vorgaenger || []).filter(function (v) { return ids[v] && !(begleitend[a.strang_id] && liste.some(function (b) { return String(b.id) === String(v) && b.strang_id === a.strang_id; })); })
            .map(function (v) { return "a" + v; }).concat(vorher[a.id] ? ["a" + vorher[a.id]] : []),
          termin: a.faellig_am ? "fällig " + datum(a.faellig_am) : "" };
      }).concat(termHalte)
    };
    // Der letzte Termin eines Levels gehört zu dessen Weg – sonst stünde die Terminlinie im Level-Ausschnitt blass
    erg.meilensteine.forEach(function (m) {
      var im = termHalte.filter(function (t) { return t.meilenstein === m.id; });
      if (im.length) m.braucht.push(im[im.length - 1].id);
    });
    return erg;
  }   // Planungsmodus: Stränge des Projekts (assets/projekt-plan.js)
  function projekt(id) {
    wurzel.innerHTML = '<div class="kb-laedt"><span></span><span></span></div>';
    Promise.all([
      db.from("projekte").select("*, organisationen(id, name)").eq("id", id).single(),
      db.from("projekt_beteiligte").select("id, seite, rolle, name, kontakte(id, vorname, nachname, position)").eq("projekt_id", id),
      db.from("projekt_ereignisse").select("id, datum, art, titel, quelle, format, ort, teilnehmer, kontakte(id, vorname, nachname)").eq("projekt_id", id).order("datum", { ascending: false }),
      db.from("projekt_punkte").select("id, ereignis_id, art, text, angelegt_am, kontakte(id, vorname, nachname)").eq("projekt_id", id).order("angelegt_am", { ascending: false }),
      db.from("aufgaben").select("id, paket_id, strang_id, reihenfolge, art, projektgate_id, titel, beschreibung, prompt, status, spalte, faellig_am, erledigt_am, ereignis_id, weg, vorgaenger, warten_auf, hinweis, zeitblock_vorschlag, mail_entwurf_id, mail_gesendet_am, antwort_am, antwort_von, unterlagen, person:kontakt_id(id, vorname, nachname), organisationen(id, name), zustaendig_name, kontakte:zustaendig_kontakt_id(id, vorname, nachname)").eq("projekt_id", id).order("angelegt_am")
      ,db.from("projekt_pakete").select("id, nr, titel, ziel, stand, status").eq("projekt_id", id).order("nr")
      ,db.from("projekt_straenge").select("id, titel, reihenfolge, eltern_id, erklaerung, verantwortlich, verantwortlich_kontakte").eq("projekt_id", id).order("reihenfolge")
      ,db.from("projekt_verlauf").select("id, datum, art, titel, inhalt").eq("projekt_id", id).order("datum", { ascending: false })
    ]).then(function (r) {
      VERLAUF = (r[7] && r[7].data) || [];
      STRAENGE = (r[6] && r[6].data) || [];
      if (r[0].error) { wurzel.innerHTML = '<p class="kb-leer">Fehler: ' + esc(r[0].error.message) + "</p>"; return; }
      var auf = r[4].data || [];
      // Abhängigkeiten aus anderen Projekten mitladen (z. B. Release 3.0 wartet auf eine Aufgabe aus „Corporate Design“)
      var eigene = {}; auf.forEach(function (a) { eigene[a.id] = 1; });
      var fremd = []; auf.forEach(function (a) { (a.vorgaenger || []).forEach(function (v) { v = +v; if (!eigene[v] && fremd.indexOf(v) < 0) fremd.push(v); }); });
      var extern = fremd.length ? db.from("aufgaben").select("id, titel, status, projekt_id").in("id", fremd).then(function (x) { EXTERN = x.data || []; }) : Promise.resolve(EXTERN = []);
      PAKETE = (r[5] && r[5].data) || [];
      var weiter = function () { zeichnen(r[0].data, r[1].data || [], r[2].data || [], r[3].data || [], auf); };
      extern.then(function () { if (window.AufgabenDetails) AufgabenDetails.vorlagenAnhaengen(db, auf).then(weiter); else weiter(); });
    });
  }

  function wer(a) { return a.zustaendig_name || name(a.kontakte) || ""; }
  function format(e) { return e.format === "vor Ort" ? "vor Ort" + (e.ort ? ": " + e.ort : "") : e.format === "offen" ? e.art + " · Ort offen" : e.art + (e.format ? " · " + e.format : ""); }
  function personen(e) { return (e.teilnehmer || []).length ? e.teilnehmer.join(", ") : (e.kontakte ? name(e.kontakte) : ""); }
  function teiln(e) { return (e.teilnehmer || []).length ? "mit " + e.teilnehmer.join(", ") : (e.kontakte ? "mit " + name(e.kontakte) : ""); }
  /* Ohne bekannte Uhrzeit (00:00) wird keine angezeigt */
  function zeit(d, vor) { var t = new Date(d); return t.getHours() || t.getMinutes() ? vor + t.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : ""; }
  var STAND = {}, VERLAUF = [];
  // Aufgabe bearbeitet (aufgaben-details.js): Projekt neu laden
  document.addEventListener("aufgabe-geaendert", function () { var m = location.hash.match(/p=(\d+)/); if (m) projekt(+m[1]); });
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
  /* Absprung zur eigenen Projekt-Website (Tabelle projekte.projektseite: titel, url, repo, zweig, teile[]) –
     schmale Leiste direkt unter dem Kopf: sichtbar, aber nicht dominant */
  function projektseite(s) {
    if (!s || !s.url) return "";
    var raus = ' target="_blank" rel="noopener"', intern = s.url.charAt(0) === "/"; // Seiten im Dashboard im selben Fenster
    return '<nav class="pr-seite" aria-label="Projektseite"><span class="pr-seite-marke">Projektseite</span>' +
      '<a class="pr-seite-titel" href="' + esc(s.url) + '"' + (intern ? "" : raus) + ">" + esc(s.titel || "Website") + (intern ? " <i aria-hidden=\"true\">→</i>" : ' <i aria-hidden="true">↗</i>') + "</a>" +
      ((s.teile || []).length ? '<span class="pr-seite-teile">' + s.teile.map(function (t) {
        return '<a href="' + esc(t.url) + '"' + raus + ">" + esc(t.titel) + "</a>"; }).join("") + "</span>" : "") +
      (s.repo ? '<a class="pr-seite-repo" href="https://github.com/' + esc(s.repo) + (s.zweig ? "/tree/" + esc(s.zweig) : "") + '"' + raus + ' title="Repository auf GitHub">' +
        esc(s.repo.split("/").pop()) + (s.zweig ? " · " + esc(s.zweig) : "") + "</a>" : "") + "</nav>";
  }

  /* Arbeitspakete (Tabelle projekt_pakete) – nur bei umfangreichen Projekten: Thema, Ziel, was steht, offene Aufträge */
  var PAKETE = [];
  function nr2(n) { return n < 10 ? "0" + n : String(n); }
  function paketLabel(a) {
    var pk = a.paket_id && PAKETE.filter(function (x) { return x.id === a.paket_id; })[0];
    return pk ? ' <span class="pk-label">· Paket ' + nr2(pk.nr) + " " + esc(pk.titel) + "</span>" : "";
  }
  function pakete(auf) {
    if (!PAKETE.length) return "";
    return '<section class="kt3-box kt3-breit pr-pakete"><div class="pr-tl-kopf"><h3>Arbeitspakete</h3></div><ol class="pk-liste">' + PAKETE.map(function (pk) {
      var offen = auf.filter(function (a) { return a.paket_id === pk.id && a.status === "offen"; })
        .sort(function (a, b) { return (a.faellig_am || "9999").localeCompare(b.faellig_am || "9999"); });
      var stand = String(pk.stand || "").split("\n").filter(Boolean);
      return '<li class="pk"><button type="button" class="pk-kopf" aria-expanded="false" data-pk><span class="pk-nr">' + nr2(pk.nr) + '</span><span class="pk-titel">' + esc(pk.titel) + "</span>" +
        '<span class="pk-status pk-status--' + esc(pk.status) + '">' + esc(pk.status) + "</span>" +
        '<span class="pk-anz">' + (offen.length ? offen.length + (offen.length === 1 ? " offener Auftrag" : " offene Aufträge") : "keine offenen Aufträge") + '</span><span class="tl-dreieck" aria-hidden="true"></span></button>' +
        '<div class="pk-koerper" hidden>' + (pk.ziel ? '<p class="pk-ziel">' + esc(pk.ziel) + "</p>" : "") + '<div class="pk-zwei">' +
          '<div><h4>Was steht</h4>' + (stand.length ? "<ul>" + stand.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : '<p class="kt3-leise">Noch nichts.</p>') + "</div>" +
          '<div><h4>Offene Aufträge</h4>' + (offen.length ? "<ul>" + offen.map(function (a) {
            return '<li><button type="button" class="ad-kette" data-zu-aufgabe="' + a.id + '">' + esc(a.titel) + "</button>" + (a.faellig_am ? ' <span class="mk mk--frist pk-frist">' + kurz(a.faellig_am) + "</span>" : "") + "</li>"; }).join("") + "</ul>" : '<p class="kt3-leise">Keine.</p>') + "</div>" +
        "</div></div></li>";
    }).join("") + "</ol></section>";
  }

  function zeichnen(p, bet, ere, pkt, auf) {
    STAND = { ere: ere, pkt: pkt, auf: auf };
    kopf(p);
    var h = '<a class="kb-zurueck" href="#"><span aria-hidden="true">&larr;</span> Projekte</a>';
    h += '<div class="kt3-kopf"><div><h2 class="kt3-name">' + esc(p.name) + '</h2><p class="kt3-sub">' +
      (p.organisationen ? '<a href="/strategie/kontakte.html#f=' + p.organisationen.id + '">' + esc(p.organisationen.name) + "</a>" : esc(p.marke || "")) + "</p>" +
      (p.thema ? '<p class="pr-thema">' + esc(p.thema) + "</p>" : "") +
      (p.typ === "intern" && p.naechstes_gate ? '<p class="pr-gate"><span>Nächstes Gate</span>' + esc(p.naechstes_gate) + (p.gate_datum ? " · bis " + kurz(p.gate_datum) : "") + "</p>" : "") + "</div></div>";
    // Priorität und Status – direkt hier ändern (Daniel, 10.10.2026)
    function wahlZeile(feld, titel, werte, aktuell) {
      return '<div class="pz-feld"><span class="pz-feld-titel">' + titel + '</span><span class="pr-tl-wahl" data-pz-feld="' + feld + '">' + werte.map(function (v) {
        return '<button type="button" data-wert="' + v[0] + '" aria-pressed="' + (v[0] === aktuell) + '">' + (feld === "prioritaet" ? prioMarker(v[0]) : "") + v[1] + "</button>"; }).join("") + "</span></div>";
    }
    h += '<div class="pz-einstellung">' + wahlZeile("prioritaet", "Priorität", PRIO, p.prioritaet) + wahlZeile("status", "Status", STATI, p.status) + "</div>";
    h += projektseite(p.projektseite);
    h += '<div class="kt3-raster">';
    h += statusKasten(p);
    // Links: Stoßrichtung (Gesamtblick über alle Termine) – rechts: Aufgaben
    var punkte = (p.ueberlegungen || "").split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
    h += '<section class="kt3-box kt3-breit pr-kurs pr-kurs-breit"><h3>Stoßrichtung</h3>' + (punkte.length ? '<ul data-ueb-text>' + punkte.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"
        : '<p data-ueb-text><span class="pr-offen">Noch keine Stoßrichtung – bitte diktieren.</span></p>') +
      '<textarea class="pr-ueb" data-ueb hidden placeholder="Ein Punkt pro Zeile">' + esc(p.ueberlegungen || "") + '</textarea><div class="pr-ueb-knoepfe"><button type="button" class="kt3-klapp" data-ueb-bearbeiten>Bearbeiten</button>' +
      '<button type="button" class="pr-speichern" data-ueb-speichern hidden>Speichern</button></div></section>';
    h += pakete(auf);
    // Aufgaben: immer mit Frist, nach Datum
    var offen = auf.filter(function (a) { return a.status === "offen"; }).sort(function (a, b) { return (a.faellig_am || "9999").localeCompare(b.faellig_am || "9999"); });
    // Aufgaben als Liste oder Kanban-Board (Backlog · To-do · In Arbeit · Review/Prüfung · Erledigt)
    var aav = "liste";
    var plan = STRAENGE.length && window.ProjektPlan, linienplan = !!window.UBahnPlan;
    try { aav = localStorage.getItem("pr-auf-ansicht") || "liste"; } catch (x) {}
    if (aav !== "kanban" && !(aav === "plan" && (plan || linienplan))) aav = "liste";
    var neu = !!NEUER_AUFBAU[p.id];
    if (neu && aav === "plan") aav = "liste";
    function frist(a) {
      var ueber = a.status === "offen" && a.faellig_am && new Date(a.faellig_am) < new Date(new Date().toDateString());
      return '<span class="pr-frist' + (a.faellig_am ? " mk mk--frist" : "") + (ueber ? " pr-ueber" : "") + '">' + (a.faellig_am ? kurz(a.faellig_am) : "ohne Termin") + "</span>";
    }
    // Aufgeklappt: nur die Details als Stichpunkte (assets/aufgaben-details.js)
    function det(a) { if (a._det === undefined) a._det = window.AufgabenDetails ? AufgabenDetails.html(a) : ""; return a._det; }
    function titel(a) {
      return det(a) ? '<button type="button" class="pr-auf-titel" data-auf-auf aria-expanded="false"><span>' + esc(a.titel) + '</span><span class="tl-dreieck" aria-hidden="true"></span></button>'
        : '<span class="pr-auf-titel">' + esc(a.titel) + "</span>";
    }
    function details(a) { return det(a) ? '<div class="pr-auf-details" hidden>' + det(a) + "</div>" : ""; }
    // Immer sichtbar: „Hängt ab von …“ und Hinweise wie „Wartet auf Rückmeldung von …“
    function zusatz(a) { return window.AufgabenDetails ? AufgabenDetails.lage(a, auf.concat(EXTERN)) : ""; }
    // Listenansicht: Phase im Kanban schlicht in der grauen Zeile („In Arbeit · Daniel“) – Daniel, 09.10.2026
    var PHASE = { backlog: "Backlog", todo: "To-do", arbeit: "In Arbeit", pruefung: "Prüfung" };
    function phase(a) { return PHASE[a.spalte || "todo"] || "To-do"; }
    var wahl = '<span class="pr-tl-wahl">' + [["liste", "Liste"]].concat((plan || linienplan) && !neu ? [["plan", "Plan"]] : [], [["kanban", "Kanban"]]).map(function (v) {
      return '<button type="button" data-aav="' + v[0] + '" aria-pressed="' + (v[0] === aav) + '">' + v[1] + "</button>"; }).join("") + "</span>";
    var aufInhalt;
    var hilfen = { titel: titel, details: details, zusatz: zusatz, phase: phase, wer: wer, paket: paketLabel, frist: frist };
    // Plan: Linienplan „Weg zum Ergebnis“ wie im Kundenprojekt SV Akademie (assets/ubahn-plan.js) – Daniel, 23.10.2026
    if (aav === "plan") aufInhalt = linienplan && ubahnDaten(STRAENGE, auf) ? UB_GERUEST : plan ? '<div class="pl-rahmen">' + ProjektPlan.bild(STRAENGE, auf, auf.concat(EXTERN)) + "</div>" : '<p class="pr-offen">Noch keine Aufgaben für den Plan.</p>';
    else if (aav === "liste" && plan && !neu) aufInhalt = '<div class="pl-rahmen">' + ProjektPlan.liste(STRAENGE, auf, hilfen, auf.concat(EXTERN)) + "</div>";
    else if (aav === "kanban") {
      var vor14 = Date.now() - 14 * 864e5;
      var SPALTEN = [["backlog", "Backlog"], ["todo", "To-do"], ["arbeit", "In Arbeit"], ["pruefung", "Review / Prüfung"], ["erledigt", "Erledigt"]];
      aufInhalt = '<div class="pr-kanban">' + SPALTEN.map(function (sp) {
        var karten = auf.filter(function (a) {
          if (a.art === "gate" || a.art === "projektgate") return false;
          if (sp[0] === "erledigt") return a.status === "erledigt" && (!a.erledigt_am || new Date(a.erledigt_am) >= vor14);
          return a.status === "offen" && (a.spalte || "todo") === sp[0];
        }).sort(function (a, b) { return (a.faellig_am || "9999").localeCompare(b.faellig_am || "9999"); });
        return '<div class="pr-kb-spalte" data-spalte="' + sp[0] + '"><p class="pr-kb-kopf">' + sp[1] + "</p>" + karten.map(function (a) {
          return '<div class="pr-kb-karte' + (a.status === "erledigt" ? " pr-kb-fertig" : "") + '" draggable="true" data-a="' + a.id + '">' + titel(a) +
            '<p class="pr-kb-meta">' + frist(a) + '<span class="pr-wer">' + esc(wer(a) || "offen") + paketLabel(a) + "</span></p>" + zusatz(a) + details(a) + "</div>";
        }).join("") + "</div>";
      }).join("") + "</div>";
    } else {
      var offen = auf.filter(function (a) { return a.status === "offen" && !(neu && a.art === "projektgate"); }).sort(function (a, b) { return (a.faellig_am || "9999").localeCompare(b.faellig_am || "9999"); });
      // Neuer Aufbau: Ergebnislevel stehen im Plan, nicht in der Liste; Aufgaben ohne Termin erst auf Klick (Daniel, 28.10.2026)
      var ohneT = neu ? offen.filter(function (a) { return !a.faellig_am; }).length : 0;
      aufInhalt = offen.length ? '<ul class="pr-auf2">' + offen.map(function (a) {
        return '<li data-a="' + a.id + '"' + (neu && !a.faellig_am && ohneT < offen.length ? ' data-mehr="ohne" hidden' : "") + '><div class="pr-auf-zeile"><button type="button" class="st-haken" aria-label="Erledigt"></button>' + frist(a) + titel(a) +
          '<span class="pr-wer">' + phase(a) + " · " + esc(wer(a) || "offen") + paketLabel(a) + "</span></div>" + '<div class="pr-auf-zusatz">' + zusatz(a) + "</div>" + details(a) + "</li>";
      }).join("") + "</ul>" + (neu && ohneT && ohneT < offen.length ? '<button type="button" class="kt3-klapp pr-fertig-mehr" data-klapp-knopf="ohne" data-text="Weitere ' + ohneT + ' Aufgaben ohne Termin" aria-expanded="false">Weitere ' + ohneT + " Aufgaben ohne Termin</button>" : "") : '<p class="kt3-leise">Nichts offen.</p>';
      // Erledigte Aufgaben bleiben sichtbar – hellgrau mit Haken unter den offenen, neueste zuerst (Daniel, 10.10.2026)
      var fertig = auf.filter(function (a) { return a.status === "erledigt"; }).sort(function (a, b) { return String(b.erledigt_am || "").localeCompare(String(a.erledigt_am || "")); });
      if (fertig.length && !neu) aufInhalt += '<div class="pr-fertig"><p class="pr-fertig-kopf">Erledigt</p><ul class="pr-auf2 pr-auf-fertig">' + fertig.map(function (a, i) {
        return '<li data-a="' + a.id + '"' + (i >= 5 ? " data-mehr hidden" : "") + '><div class="pr-auf-zeile"><button type="button" class="st-haken an" aria-label="Wieder öffnen" title="Wieder öffnen"></button>' +
          '<span class="pr-frist">' + (a.erledigt_am ? "erledigt " + new Date(a.erledigt_am).toLocaleDateString("de-DE", { day: "numeric", month: "numeric" }) : "erledigt") + "</span>" +
          '<span class="pr-auf-titel">' + esc(a.titel) + '</span><span class="pr-wer">' + esc(wer(a) || "") + "</span></div></li>";
      }).join("") + "</ul>" + (fertig.length > 5 ? '<button type="button" class="kt3-klapp pr-fertig-mehr" data-klapp-knopf aria-expanded="false">Alle zeigen</button>' : "") + "</div>";
    }
    h += '<section class="kt3-box kt3-breit pr-aufgaben pr-auf-breit' + (aav === "kanban" ? " pr-auf-kanban" : "") + (aav === "plan" ? " pr-auf-plan" : "") + '"><div class="pr-tl-kopf"><h3>Aufgaben</h3>' + wahl + "</div>" + aufInhalt + "</section>";
    // Timeline: drei Darstellungen zum Vergleich – ohne äußeren Kasten, mit viel Luft
    var jetzt = Date.now(), tlv = "seite";
    try { tlv = localStorage.getItem("pr-tl-ansicht") || "seite"; } catch (x) {}
    if (tlv !== "auf") tlv = "seite";
    var start = ere.filter(function (e) { return new Date(e.datum) <= jetzt; })[0] || ere[0];
    function eintrag(e, mitPersonen, dreieck) {
      var zuk = new Date(e.datum) > jetzt, hat = pkt.some(function (x) { return x.ereignis_id === e.id; }) || auf.some(function (x) { return x.ereignis_id === e.id; });
      return '<button type="button" data-ev="' + e.id + '" class="' + (zuk ? "pr-zuk " : "") + (start && e.id === start.id ? "an" : "") + '"><span class="pr-d">' + (zuk ? "geplant · " : "") + kurz(e.datum) +
        zeit(e.datum, " · ") + (hat ? ' <i class="pr-hat-details" title="Protokoll vorhanden"></i>' : "") + "</span><b class=\"mk mk--" + (e.art === "Meilenstein" ? "ziel" : "termin") + "\">" + esc(e.titel) + "</b>" +
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
      h += '<section class="kt3-box kt3-breit pr-ziel"><button type="button" class="pr-ziel-kopf" data-ziel aria-expanded="false"><h3>Projektziel</h3>' +
        '<span class="pr-ziel-satz">' + esc(p.ziel || "") + "</span>" + '<span class="tl-dreieck" aria-hidden="true"></span>' + "</button>" +
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
    h += archivKasten();
    wurzel.innerHTML = h + "</div>";
    if (lookWert() === "sva") module(p);
    verdrahten(p);
    if (neu) neuOrdnen(p, ere);
  }

  /* ---------- Neuer Aufbau der Projektseite (Daniel, 28.10.2026) – zuerst bei der SV Akademie ----------
     Reihenfolge wie auf der Kundenseite: 1 Weg zum Ergebnis (Linienplan) · 2 Was jetzt ansteht (nur intern: Lagebericht,
     Aufgaben als Liste oder Kanban, nächste Termine) · 3 Hintergrund, zugeklappt (Ziel, Stoßrichtung, Arbeitspakete, Team,
     Termine mit Protokollen, Verlauf). Die fertig gezeichneten Kästen werden umgehängt – ihre Knöpfe behalten die Funktion. */
  var NEUER_AUFBAU = { 1: true };
  function neuOrdnen(p, ere) {
    var r = wurzel.querySelector(".kt3-raster"); if (!r) return;
    function nimm(sel) { return r.querySelector(":scope > " + sel); }
    function offen(sek, titel) {   // Kasten aufgeklappt zeigen, Überschrift ggf. umbenennen
      if (!sek) return null;
      sek.classList.remove("pr-zu");
      var b = sek.querySelector(".pr-klapp"); if (b) b.setAttribute("aria-expanded", "true");
      if (titel) { var t = sek.querySelector(".pr-klapp > span:first-child") || sek.querySelector("h3"); if (t) t.textContent = titel; }
      return sek;
    }
    // Große Bereiche auf- und zuklappbar (Daniel, 28.10.2026): Kopfzeile mit Titel, Zusatz rechts (z. B. Größe und Legende) und Pfeil.
    // Der Inhalt hängt an b.inhalt; der Zustand gilt bis zum Verlassen des Projekts (wie bei den Kästen).
    function bereich(cls, key, titel, unter, marke, offenStart) {
      var b = document.createElement("section"), g = klappLesen(p.id), auf = key in g ? g[key] : offenStart;
      b.className = "pr-n " + cls + (auf ? "" : " pr-n-zu");
      b.innerHTML = '<div class="pr-n-kopf"><button type="button" class="pr-n-auf" aria-expanded="' + auf + '"><span class="pr-n-titel"><span class="pr-n-h">' + titel + "</span>" +
        (marke ? '<span class="pr-n-marke">' + marke + "</span>" : "") + "</span>" + (unter ? '<span class="pr-n-unter">' + unter + "</span>" : "") + "</button>" +
        '<span class="pr-n-rechts"></span><button type="button" class="pr-n-pfeil-knopf" aria-label="Auf- oder zuklappen" tabindex="-1"><span class="pr-n-pfeil" aria-hidden="true"></span></button></div><div class="pr-n-inhalt"></div>';
      b.inhalt = b.querySelector(".pr-n-inhalt"); b.rechts = b.querySelector(".pr-n-rechts");
      function umschalten() {
        var jetztAuf = b.classList.contains("pr-n-zu");
        b.classList.toggle("pr-n-zu", !jetztAuf); b.querySelector(".pr-n-auf").setAttribute("aria-expanded", String(jetztAuf)); klappSchreiben(p.id, key, jetztAuf);
      }
      b.querySelector(".pr-n-auf").onclick = umschalten; b.querySelector(".pr-n-pfeil-knopf").onclick = umschalten;
      return b;
    }
    var neuR = document.createElement("div"); neuR.className = "pr-n-raster";
    // 1 Weg zum Ergebnis
    var weg = bereich("pr-n-weg", "n-weg", "Weg zum Ergebnis", "", "", true);
    var ub = document.createElement("div"); ub.innerHTML = UB_GERUEST; weg.inhalt.appendChild(ub.firstChild);
    neuR.appendChild(weg);
    // 2 Was jetzt ansteht – nur intern
    var jetzt = bereich("pr-n-jetzt", "n-jetzt", "Was jetzt ansteht", "Lagebericht, Aufgaben und nächste Termine – geht nicht an den Kunden.", "nur intern", true);
    var st = nimm(".pr-status");
    if (st) {
      var stT = st.querySelector(".pr-klapp > span:first-child") || st.querySelector("h3");
      if (stT) stT.textContent = "Lagebericht" + (p.statusbericht && p.statusbericht.stand ? " · Stand " + new Date(p.statusbericht.stand + "T12:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");
      jetzt.inhalt.appendChild(st);
    }
    var au = offen(nimm(".pr-aufgaben"), "Aufgaben"); if (au) jetzt.inhalt.appendChild(au);
    var jetztZeit = Date.now(), komm = ere.filter(function (e) { return new Date(e.datum) > jetztZeit; }).sort(function (a, b) { return new Date(a.datum) - new Date(b.datum); }).slice(0, 4);
    if (komm.length) {
      var te = document.createElement("section"); te.className = "kt3-box kt3-breit pr-n-termine";
      te.innerHTML = "<h3>Nächste Termine</h3><ul>" + komm.map(function (e) {
        return '<li><span class="pr-n-datum">' + kurz(e.datum) + zeit(e.datum, " · ") + "</span><b>" + esc(e.titel) + "</b><small>" + esc(format(e)) + "</small></li>"; }).join("") + "</ul>";
      jetzt.inhalt.appendChild(te);
    }
    neuR.appendChild(jetzt);
    // 3 Hintergrund – zugeklappt
    var hin = bereich("pr-n-hinter", "n-hinter", "Hintergrund", "Ziel, Stoßrichtung, Arbeitspakete, Team, Termine mit Protokollen und Verlauf", "", false);
    var hk = hin.inhalt;
    [[".pr-ziel"], [".pr-kurs"], [".pr-pakete"], [".pr-team"], [".pr-tl-frei", "Termine und Protokolle"], [".pr-archiv", "Verlauf"]].forEach(function (x) {
      var el = nimm(x[0]); if (!el) return;
      if (x[1]) { var t = el.querySelector(".pr-klapp > span:first-child") || el.querySelector("h3"); if (t) t.textContent = x[1]; }
      hk.appendChild(el);
    });
    neuR.appendChild(hin);
    r.replaceWith(neuR);
    var ubw = weg.querySelector("[data-ub-wurzel]"), ubd = ubahnDaten(STRAENGE, STAND.auf, { termine: ere });
    if (ubd && window.UBahnPlan) UBahnPlan(ubw, ubd, { hash: false });
    else ubw.innerHTML = '<p class="pr-offen">Noch keine Aufgaben für den Plan.</p>';
    // Größe und Legende in die Kopfzeile von „Weg zum Ergebnis“ – bleiben auch zugeklappt erreichbar
    var leiste = ubw.querySelector(".ub-dash-kopf"); if (leiste) weg.rechts.appendChild(leiste);
  }

  /* Darstellung „SV Akademie“: aufklappbare Module 01–05 wie auf der Seite Projekt SV Akademie.
     Die fertig gezeichneten Kästen werden in die Module umgehängt (Knöpfe behalten ihre Funktion). */
  // Status (Daniel, 14.10.2026): kurzer Lagebericht mit Datum – projekte.statusbericht {stand, bloecke: [{titel, punkte}]}
  function statusKasten(p) {
    var s = p.statusbericht, b = s && s.bloecke ? s.bloecke : [];
    return '<section class="kt3-box kt3-breit pr-status"><h3>Status</h3>' + (b.length
      ? (s.stand ? '<p class="pr-status-stand">Stand ' + new Date(s.stand + "T12:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) + "</p>" : "") +
        bloeckeHtml(b)
      : '<p><span class="pr-offen">Noch kein Status.</span></p>') + "</section>";
  }
  // Projektablauf und Archiv (Daniel, 14.10.2026): nichts wird weggeworfen – alte Status, erledigte Aufgaben, erreichte Gates, Reportings.
  // Quelle: projekt_verlauf (Einträge entstehen automatisch per Datenbank-Trigger; Reportings legt Claude auf Anforderung an).
  var VERLAUF_ART = { status: "Status", aufgabe: "Erledigt", gate: "Gate erreicht", projektgate: "Projekt-Gate erreicht", reporting: "Projektreporting", notiz: "Notiz" };
  function bloeckeHtml(b) {
    return (b || []).map(function (x) { return '<div class="pr-status-block"><h4>' + esc(x.titel) + "</h4><ul>" + (x.punkte || []).map(function (y) { return "<li>" + esc(y) + "</li>"; }).join("") + "</ul></div>"; }).join("");
  }
  function archivKasten() {
    var monate = {}, folge = [];
    VERLAUF.forEach(function (v) {
      var d = new Date(v.datum), k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      if (!monate[k]) { monate[k] = []; folge.push(k); } monate[k].push(v);
    });
    var inhalt = !VERLAUF.length ? '<p class="kt3-leise">Noch nichts dokumentiert. Erledigte Aufgaben, erreichte Gates und frühere Status landen hier automatisch.</p>' :
      folge.map(function (k) {
        var titel = new Date(k + "-15T12:00:00").toLocaleDateString("de-DE", { month: "long", year: "numeric" });
        return '<div class="pr-archiv-monat"><h4>' + titel + '</h4><ul class="pr-archiv-liste">' + monate[k].map(function (v) {
          var mehr = v.inhalt && v.inhalt.bloecke && v.inhalt.bloecke.length;
          return '<li class="pr-archiv-z pr-archiv-z--' + esc(v.art) + '"><span class="pr-archiv-datum">' + new Date(v.datum).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) + "</span>" +
            '<span class="pr-archiv-art">' + esc(VERLAUF_ART[v.art] || v.art) + "</span>" +
            (mehr ? '<button type="button" class="pr-archiv-titel" data-archiv-auf aria-expanded="false"><span>' + esc(v.titel) + '</span><span class="tl-dreieck" aria-hidden="true"></span></button><div class="pr-archiv-mehr" hidden>' + bloeckeHtml(v.inhalt.bloecke) + "</div>"
              : '<span class="pr-archiv-titel">' + esc(v.titel) + "</span>") + "</li>";
        }).join("") + "</ul></div>";
      }).join("");
    return '<section class="kt3-box kt3-breit pr-archiv"><h3>Projektablauf und Archiv</h3>' + inhalt + "</section>";
  }
  // Reihenfolge der Kästen (Daniel, 14.10.2026): Status · Aufgaben · Timeline · Stoßrichtung · Projektziel · Projektteam
  var KASTEN_FOLGE = [".pr-status", ".pr-aufgaben", ".pr-pakete", ".pr-tl-frei", ".pr-kurs", ".pr-ziel", ".pr-team", ".pr-archiv"];
  function kaestenOrdnen() {
    var r = wurzel.querySelector(".kt3-raster"); if (!r) return;
    KASTEN_FOLGE.forEach(function (s) { var el = r.querySelector(":scope > " + s); if (el) r.appendChild(el); });
  }
  var MODUL_OFFEN = { status: false, kurs: false, pak: false, auf: false, tl: false, ziel: false, team: false, archiv: false };   // Daniel, 14.10.2026: beim Start alles zu
  // Grundeinstellung (Daniel, 08.10.2026): beim Öffnen eines Projekts ist alles zugeklappt, nur die Aufgaben sind offen.
  // Was man während des Besuchs auf-/zuklappt, gilt bis zum Verlassen des Projekts – beim nächsten Öffnen wieder die Grundeinstellung.
  var KLAPP = { id: null, z: {} };
  function klappLesen(id) { if (KLAPP.id !== id) KLAPP = { id: id, z: {} }; return KLAPP.z; }
  function klappSchreiben(id, key, offen) { klappLesen(id)[key] = offen; }

  function module(p) {
    var r = wurzel.querySelector(".kt3-raster"), liste = document.createElement("div"), n = 0;
    liste.className = "fl-ebenen pr-module kt3-breit";
    function modul(key, titel, sub, teile) {
      var nr = ++n < 10 ? "0" + n : String(n), sek = document.createElement("section");
      var gemerkt = klappLesen(p.id), offenJetzt = key in gemerkt ? gemerkt[key] : !!MODUL_OFFEN[key];
      sek.className = "fl-ebene" + (offenJetzt ? " is-offen" : "");
      sek.innerHTML = '<button type="button" class="fl-kopf" aria-expanded="' + offenJetzt + '"><span class="fl-kopf-nr">' + nr + '</span><span class="fl-kopf-text"><b>' + esc(titel) + "</b>" +
        (sub ? "<small>" + esc(sub) + "</small>" : "") + '</span><span class="fl-kopf-pfeil" aria-hidden="true"></span></button><div class="fl-koerper"></div>';
      var k = sek.querySelector(".fl-koerper");
      teile.forEach(function (t) { if (t) k.appendChild(t); });
      sek.querySelector(".fl-kopf").onclick = function () {
        var auf = !sek.classList.contains("is-offen"); sek.classList.toggle("is-offen", auf); this.setAttribute("aria-expanded", String(auf)); klappSchreiben(p.id, key, auf);
      };
      liste.appendChild(sek);
    }
    function ohneTitel(el, sel) { if (el) { var t = el.querySelector(sel); if (t) t.remove(); } return el; }
    var kurs = ohneTitel(r.querySelector(".pr-kurs"), ":scope > h3"), auf = ohneTitel(r.querySelector(".pr-aufgaben"), ".pr-tl-kopf > h3"),
        tl = ohneTitel(r.querySelector(".pr-tl-frei"), ".pr-tl-kopf > h3"), ziel = r.querySelector(".pr-ziel"), team = r.querySelector(".pr-bet-zeile");
    var st = ohneTitel(r.querySelector(".pr-status"), ":scope > h3");
    modul("status", "Status", p.statusbericht && p.statusbericht.stand ? "Stand " + new Date(p.statusbericht.stand + "T12:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "Noch kein Status.", [st]);
    modul("auf", "Aufgaben", "Was als Nächstes ansteht.", [auf]);
    var pak = ohneTitel(r.querySelector(".pr-pakete"), ".pr-tl-kopf");
    if (pak) modul("pak", "Arbeitspakete", "Themen des Projekts mit Stand und offenen Aufträgen.", [pak]);
    modul("tl", "Timeline", "Termine mit Protokoll, Entscheidungen und Aufgaben.", [tl]);
    modul("kurs", "Stoßrichtung", "Wohin wir das Projekt steuern.", [kurs]);
    var det = ziel && ziel.querySelector(".pr-ziel-det");
    if (det) { det.hidden = false; if (!det.children.length) det.innerHTML = '<p class="pr-ziel-voll">' + esc(p.ziel || "") + "</p>"; modul("ziel", "Projektziel", p.ziel || "", [det]); }
    else {
      var leer = document.createElement("p"); leer.innerHTML = '<span class="pr-offen">Noch kein Projektziel – bitte diktieren.</span>';
      modul("ziel", "Projektziel", "Noch nicht definiert", [leer]);
      liste.lastChild.classList.add("pr-modul-offen");
    }
    if (ziel) ziel.remove();
    modul("team", "Projektteam", "Beteiligte beim Kunden und Team empiria.", [team]);
    r.innerHTML = ""; r.appendChild(liste);
  }

  function klappbar(p) {
    if (lookWert() === "sva") return;
    kaestenOrdnen();
    var gemerkt = klappLesen(p.id);
    [[".pr-status", "status"], [".pr-kurs", "kurs"], [".pr-pakete", "pak"], [".pr-aufgaben", "auf"], [".pr-tl-frei", "tl"], [".pr-team", "team"], [".pr-archiv", "archiv"]].forEach(function (x) {
      var sek = wurzel.querySelector(x[0]); if (!sek) return;
      var kopf = sek.querySelector(":scope > .pr-tl-kopf") || sek.querySelector(":scope > h3"); if (!kopf) return;
      var h = kopf.tagName === "H3" ? kopf : kopf.querySelector("h3");
      var b = document.createElement("button"); b.type = "button"; b.className = "pr-klapp";
      b.innerHTML = '<span>' + h.innerHTML + '</span><span class="tl-dreieck" aria-hidden="true"></span>';
      h.innerHTML = ""; h.appendChild(b);
      function setzen(offen) { sek.classList.toggle("pr-zu", !offen); b.setAttribute("aria-expanded", String(offen)); }
      setzen(x[1] in gemerkt ? gemerkt[x[1]] : !!MODUL_OFFEN[x[1]]);
      b.onclick = function () { var offen = sek.classList.contains("pr-zu"); setzen(offen); klappSchreiben(p.id, x[1], offen); };
    });
  }

  function verdrahten(p) {
    klappbar(p);
    wurzel.querySelectorAll("[data-archiv-auf]").forEach(function (b) {
      b.onclick = function () { var m = b.nextElementSibling; m.hidden = !m.hidden; b.setAttribute("aria-expanded", String(!m.hidden)); };
    });
    if (STRAENGE.length && window.ProjektPlan) ProjektPlan.verdrahten(wurzel, db, STRAENGE, STAND.auf, function () { projekt(p.id); });
    var ub = wurzel.querySelector("[data-ub-wurzel]"), ubd = ub && window.UBahnPlan ? ubahnDaten(STRAENGE, STAND.auf) : null;
    if (ubd) UBahnPlan(ub, ubd, { hash: false });
    wurzel.querySelectorAll("[data-pz-feld]").forEach(function (gr) {
      var feld = gr.getAttribute("data-pz-feld");
      gr.querySelectorAll("button").forEach(function (b) { b.onclick = function () {
        var w = b.getAttribute("data-wert"), neu = {};
        if (feld === "prioritaet" && p.prioritaet === w) w = null;   // erneuter Klick nimmt die Priorität wieder weg
        neu[feld] = w; gr.classList.add("laedt");
        db.from("projekte").update(neu).eq("id", p.id).then(function (r) {
          gr.classList.remove("laedt");
          if (r.error) { alert("Nicht gespeichert: " + r.error.message); return; }
          p[feld] = w; gr.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x.getAttribute("data-wert") === w)); });
        });
      }; });
    });
    wurzel.querySelectorAll("[data-pk]").forEach(function (b) {
      b.onclick = function () { var auf = b.getAttribute("aria-expanded") !== "true"; b.setAttribute("aria-expanded", String(auf)); b.nextElementSibling.hidden = !auf; };
    });
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
    // Haken: offene Aufgabe erledigen bzw. erledigte wieder öffnen – danach steht sie im jeweils anderen Block
    wurzel.querySelectorAll("[data-a] .st-haken").forEach(function (b) {
      b.onclick = function () { var li = b.closest("li"), zu = !b.classList.contains("an"); li.classList.add("st-weg");
        db.from("aufgaben").update(zu ? { status: "erledigt", erledigt_am: new Date().toISOString() } : { status: "offen", erledigt_am: null }).eq("id", +li.getAttribute("data-a"))
          .then(function (r) { if (r.error) { li.classList.remove("st-weg"); alert(r.error.message); return; } setTimeout(function () { projekt(p.id); }, zu ? 500 : 0); }); };
    });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-klapp-knopf]"); if (!b || !wurzel.contains(b)) return;
    var auf = b.getAttribute("aria-expanded") !== "true", g = b.getAttribute("data-klapp-knopf");
    b.closest(".kt3-box").querySelectorAll(g ? '[data-mehr="' + g + '"]' : '[data-mehr]:not([data-mehr="ohne"])').forEach(function (x) { x.hidden = !auf; });
    b.setAttribute("aria-expanded", String(auf)); b.textContent = auf ? "Weniger zeigen" : (b.getAttribute("data-text") || "Alle zeigen");
  });
})();
