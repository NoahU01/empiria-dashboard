/* Linienplan „Weg zum Ergebnis“ – übernommen aus dem Kundenprojekt SV Akademie (Repo sv, ziel-ubahn-20.js), Daniel, 23.10.2026.
   Aufruf: UBahnPlan(wurzel, daten, { hash: false }). wurzel enthält [data-ub-stufen], [data-ub-plan] und optional
   [data-zoom-platz] (Größe + Legende) und [data-legende-quelle] (Legende als Liste). daten wie ZIEL_DATEN:
   { zielbild, straenge[{id,kurz,label,frage,verantwortung,farbe}], meilensteine[{id,nr,termin,titel,ergebnis,braucht}],
     schritte[{id,strang,meilenstein,titel,beschreibung,status,braucht,ergebnis,wer,kritisch,termin,monat,von}], termine[] }.
   Die Daten für Projekte baut assets/projekte-crm.js aus projekt_straenge und aufgaben. */
window.UBahnPlan = function (wurzel, D, OPT) {
  "use strict";
  OPT = OPT || {};
  if (!D || !D.meilensteine.length) return;
  var S = {}, STR = {}, MS = {};
  D.schritte.forEach(function (s) { S[s.id] = s; });
  D.straenge.forEach(function (s, i) { s.i = i; STR[s.id] = s; });
  D.meilensteine.forEach(function (m, i) { m.i = i; MS[m.id] = m; });

  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function msName(m) { return m.titel || "Ergebnislevel " + m.nr; }
  function stufeErreicht(mid) { var b = MS[mid].braucht || []; return b.length > 0 && b.every(function (x) { return S[x] && S[x].status === "erreicht"; }); }
  function fertig(id) { return MS[id] ? stufeErreicht(id) : S[id] && S[id].status === "erreicht"; }
  function zustand(s) {
    if (s.status === "erreicht") return "erreicht";
    if (s.status === "aktiv") return "aktiv";
    return (s.braucht || []).every(fertig) ? "frei" : "wartet";
  }
  var ZTEXT = { erreicht: "erledigt", aktiv: "in Arbeit", frei: "kann starten", wartet: "wartet auf Vorarbeit" };
  // dieselbe Linie: gleiche Bahn und – bei Strängen innerhalb einer Stoßrichtung – derselbe Strang (sonst gestrichelte Abhängigkeit)
  function gleich(a, b) { return a.strang === b.strang && (a.sub == null || b.sub == null || a.sub === b.sub); }
  // Text im Fenster: Zeilen mit „•“ oder „-“ am Anfang werden zur Liste, übrige Zeilen zu Absätzen
  function textHtml(t) {
    var h = "", liste = [];
    function zu() { if (liste.length) { h += "<ul>" + liste.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"; liste = []; } }
    String(t).split("\n").forEach(function (z) {
      z = z.trim(); if (!z) return;
      if (/^[•\-–]\s*/.test(z)) liste.push(z.replace(/^[•\-–]\s*/, "")); else { zu(); h += "<p>" + esc(z) + "</p>"; }
    });
    zu();
    return h;
  }
  function vorlauf(ids) {               // alles, was in diese Schritte einfließt – inklusive der Schritte selbst
    var drin = {}, st = ids.slice();
    while (st.length) {
      var id = st.pop();
      if (MS[id]) { (MS[id].braucht || []).forEach(function (b) { st.push(b); }); continue; }   // Stufe als Voraussetzung
      if (drin[id] || !S[id]) continue; drin[id] = true; (S[id].braucht || []).concat(S[id].einfluss || []).forEach(function (b) { st.push(b); });   // was einfließt, gehört dazu (z. B. LEA in die Webseite)
    }
    return drin;
  }

  // „ziel“ = Gesamtplan: alle Stufen bis zum Zielbild, nichts wird blass
  var ZIEL = { id: "ziel", i: D.meilensteine.length - 1, nr: "", titel: (D.zielbild || {}).kurz || "Zielbild", termin: "Ende des Projekts", braucht: null, gesamt: true };
  function msVon(id) { return id === "ziel" ? ZIEL : MS[id]; }
  // aktuelles Level: das erste, das noch nicht erreicht ist – damit öffnet die Seite, solange kein Level gewählt ist
  var AKTUELL = (D.meilensteine.filter(function (x) { return !stufeErreicht(x.id); })[0] || D.meilensteine[D.meilensteine.length - 1]).id;
  var zustandUI = { ms: (function () { var h = OPT.hash === false ? "" : location.hash.replace("#", ""); return MS[h] || h === "ziel" ? h : AKTUELL; })(), station: null };
  var stufenEl = wurzel.querySelector("[data-ub-stufen]"), planEl = wurzel.querySelector("[data-ub-plan]");

  /* ---------- Ergebnisstufen als Reiter, Erklärung und Legende als kleines Fenster ---------- */
  // Ergebnisstufen als Kästen: oben „Stufe n · Datum“, darunter Titel oder Kern des Ergebnisses (höchstens zwei Zeilen).
  // Ein Klick auf den Kasten wechselt die Stufe; das ⓘ im Kasten öffnet „Erreicht, wenn …“ direkt darunter.
  function kastenText(x) { return x.titel || ((x.ergebnis || [])[0] || "Level " + x.nr).split(":")[0].replace(/\.$/, ""); }
  // Kopf mit den Ergebnisleveln als Route: Haltepunkte auf einer Linie, darunter das Ergebnis des gewählten Levels
  function stufenText(id) {
    if (id === "ziel") return "Alle Stoßrichtungen über alle Level bis zum Zielbild.";
    return (MS[id].ergebnis || []).join(" ");
  }
  function stufen() {
    // so viele Spalten wie Halte (mindestens sechs) – bei sechs Leveln plus Gesamtplan bleibt alles in einer Zeile (VVDE)
    var sel = zustandUI.ms, h = '<div class="ub-route" role="tablist" style="--n:' + Math.max(6, D.meilensteine.length + 1) + '">';
    D.meilensteine.map(function (x) { return x.id; }).concat(["ziel"]).forEach(function (id) {
      var z = id === "ziel", x = MS[id], an = id === sel;
      h += '<button type="button" role="tab" class="ub-route-halt' + (an ? " ist-an" : "") + (!z && stufeErreicht(id) ? " ist-erreicht" : "") + (z ? " ist-ziel" : "") + '" data-ms="' + id + '" aria-selected="' + an + '">' +
        '<span class="ub-route-titel">' + esc(z ? "Gesamtplan" : kastenText(x)) + '</span><span class="ub-route-punkt"></span>' +
        '<span class="ub-route-datum">' + esc(z ? "Ziel" : "Level " + x.nr + " · " + x.termin) + "</span>" +
        (id === AKTUELL && !stufeErreicht(id) ? '<span class="ub-route-aktuell">aktuell</span>' : "") + "</button>";   // alles erreicht (abgeschlossen): kein „aktuell“
    });
    stufenEl.innerHTML = h + '</div><p class="ub-kopf-wenn">' + esc(stufenText(sel)) + "</p>";
    stufenEl.querySelectorAll("[data-ms]").forEach(function (k) {
      k.addEventListener("click", function () {
        zustandUI.ms = k.getAttribute("data-ms"); zustandUI.station = null;
        if (OPT.hash !== false) history.replaceState(null, "", location.search + "#" + zustandUI.ms);
        stufen(); plan(); detail();
      });
    });
  }

  /* ---------- Plan: U-Bahn ---------- */
  // Nur waagerecht und senkrecht, Ecken leicht gerundet – wie ein Liniennetzplan.
  // Hauptlinie je Stoßrichtung (Beschriftung darüber), parallele Halte auf Nebenstrecken darunter (Beschriftung darunter).
  // Eine Nebenstrecke zweigt in der Lücke vor ihrem Halt ab und kehrt in der Lücke danach zurück.
  // Endhaltestelle: senkrechter Balken, in den jede beteiligte Linie waagerecht auf ihrer Höhe einläuft.
  // Keine Transparenz: helle Töne sind echte Mischfarben mit Weiß, damit Überlagerungen nicht dunkler werden.
  var MASS = 1;   // Größe des Plans (1 = 100 %), skaliert Linien und Schrift gemeinsam
  var ENDE = 132;   // Platz rechts für Endhalt und Namen der Stufe (Name zweizeilig, 90 px)
  var ABST = 136, ZH = 112, UEBER = 64, UNTER = 58, LUECKE = 40, EINLAUF = 26, SPALTE = 200;
  function hell(hex, t) {   // Farbe mit Weiß mischen, t = Anteil Weiß
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    function m(c) { return Math.round(c + (255 - c) * t); }
    return "rgb(" + m(r) + "," + m(g) + "," + m(b) + ")";
  }
  function rund(pkte) {     // Polylinie mit gerundeten Ecken
    var R = 10, d = "M" + pkte[0][0] + "," + pkte[0][1];
    for (var i = 1; i < pkte.length - 1; i++) {
      var p0 = pkte[i - 1], p1 = pkte[i], p2 = pkte[i + 1];
      var l1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      var r = Math.min(R, l1 / 2, l2 / 2);
      if (!r) { d += " L" + p1[0] + "," + p1[1]; continue; }
      var a = [p1[0] - (p1[0] - p0[0]) / l1 * r, p1[1] - (p1[1] - p0[1]) / l1 * r];
      var b = [p1[0] + (p2[0] - p1[0]) / l2 * r, p1[1] + (p2[1] - p1[1]) / l2 * r];
      d += " L" + a[0] + "," + a[1] + " Q" + p1[0] + "," + p1[1] + " " + b[0] + "," + b[1];
    }
    var e = pkte[pkte.length - 1];
    return d + " L" + e[0] + "," + e[1];
  }
  var MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  function zeitraum(s) { return !!(s.von && s.monat && s.von < s.monat) || !!(s.von && s.von === s.monat && s.zeitraum); }
  function monatsName(mo) { var t = String(mo).split("-"); return MONATE[+t[1] - 1] + " " + t[0]; }
  function plan() {
    var m = msVon(zustandUI.ms);
    // Ausschnitt: eine Stufe zeigt nur ihre eigenen Halte; der Gesamtplan zeigt alle
    var stufenImBlick = D.meilensteine.filter(function (x) { return m.gesamt || x.id === m.id; });
    var imBlick = {}; stufenImBlick.forEach(function (x) { imBlick[x.id] = true; });
    var liste = D.schritte.filter(function (s) { return imBlick[s.meilenstein]; });
    if (!liste.length) {   // Level ohne geplante Schritte (z. B. spätere Ergebnislevel)
      planEl.style.height = "";
      planEl.innerHTML = '<p class="ub-leer">Für dieses Level sind noch keine Schritte geplant.</p>';
      return;
    }
    var imPlan = {}; liste.forEach(function (s) { imPlan[s.id] = true; });
    var vorStufe = m.gesamt ? null : D.meilensteine[m.i - 1] || null;   // Starthalt: die Stufe davor
    var fokus = zustandUI.station ? vorlauf([zustandUI.station]) : m.gesamt ? imPlan : vorlauf(m.braucht || []);
    function blass(id) { return !fokus[id]; }

    var tiefe = {};
    function t(id) {
      if (tiefe[id] != null) return tiefe[id];
      var s = S[id], v = (s.braucht || []).filter(function (b) { return imPlan[b] && S[b].meilenstein === s.meilenstein; });
      return (tiefe[id] = v.length ? 1 + Math.max.apply(null, v.map(t)) : 0);
    }
    liste.forEach(function (s) { t(s.id); });
    // Zeitachse: Haben alle Schritte eines Levels einen geplanten Monat, stehen sie in der Spalte ihres Monats;
    // innerhalb eines Monats bleibt die Reihenfolge der Abhängigkeiten. Monatsblöcke werden als dezente Linien gezeichnet.
    var monatsBloecke = [], tiefeA = {}, bandMin = {};
    stufenImBlick.forEach(function (x) {
      var ss = liste.filter(function (s) { return s.meilenstein === x.id; });
      if (!ss.length || !ss.every(function (s) { return s.monat; })) return;
      var lt = {}, la = {};
      function anfang(s) { return zeitraum(s) ? s.von : s.monat; }
      function la_(id) {   // Spalte des Beginns innerhalb seines Monats
        if (la[id] != null) return la[id];
        var s = S[id], v = (s.braucht || []).filter(function (b) { return imPlan[b] && S[b].meilenstein === s.meilenstein && S[b].monat === anfang(s); });
        return (la[id] = v.length ? 1 + Math.max.apply(null, v.map(l)) : 0);
      }
      function l(id) {     // Spalte des Endes innerhalb seines Monats
        if (lt[id] != null) return lt[id];
        var s = S[id];
        if (zeitraum(s)) return (lt[id] = s.von === s.monat ? la_(id) + 1 : 0);
        return (lt[id] = la_(id));
      }
      var monate = [], breite = {};
      function nimm(mo, sp) { if (monate.indexOf(mo) < 0) monate.push(mo); breite[mo] = Math.max(breite[mo] || 1, sp + 1); }
      ss.forEach(function (s) { nimm(s.monat, l(s.id)); if (zeitraum(s)) nimm(s.von, la_(s.id)); });
      monate.sort();
      // lückenlose Monate (Daniel, 29.10.2026): auch Monate ohne Halt stehen in der Zeitachse – schmal, damit ein Zeitraum
      // wie Mai bis September seine wirkliche Länge zeigt
      if (monate.length) {
        var voll = [], m0 = monate[0];
        while (m0 <= monate[monate.length - 1] && voll.length < 120) { voll.push(m0); var tt = m0.split("-"), mm = +tt[1] + 1, jj = +tt[0]; if (mm > 12) { mm = 1; jj++; } m0 = jj + "-" + ("0" + mm).slice(-2); }
        voll.forEach(function (mo) { if (!breite[mo]) breite[mo] = 0.6; });
        monate = voll;
      }
      // Datumstreue Zeiträume: Haben Halte ein Tagesdatum (tag), dienen die datierten Halte eines Monats als Stützpunkte –
      // Beginn und Ende eines Zeitraums liegen zwischen ihnen nach Datum (z. B. Webseite 09.–27.11. um die AL/GL-Runde am 11.11. herum)
      var stuetzen = {};
      monate.forEach(function (mo) {
        var pk = ss.filter(function (s) { return !zeitraum(s) && s.monat === mo && s.tag; }).map(function (s) { return [s.tag, l(s.id)]; })
          .sort(function (a, b) { return a[0] - b[0] || b[1] - a[1]; });
        var mono = [];
        pk.forEach(function (p) { var v = mono[mono.length - 1]; if (!v || (p[0] > v[0] && p[1] > v[1])) mono.push(p); });   // nur steigende Stützpunkte
        stuetzen[mo] = mono;
        var letzte = mono[mono.length - 1];   // endet ein Zeitraum nach dem letzten datierten Halt, bekommt der Monat eine halbe Spalte Auslauf
        if (letzte && ss.some(function (s) { return zeitraum(s) && s.monat === mo && s.tag > letzte[0]; })) breite[mo] = Math.max(breite[mo], letzte[1] + 1.5);
      });
      function lage(mo, tag) {
        var t = String(mo).split("-"), tage = new Date(+t[0], +t[1], 0).getDate();
        var p = [[0, -0.5]].concat(stuetzen[mo] || [], [[tage + 1, breite[mo] - 0.5]]);
        for (var i = 1; i < p.length; i++) if (tag <= p[i][0]) return p[i - 1][1] + (tag - p[i - 1][0]) / (p[i][0] - p[i - 1][0]) * (p[i][1] - p[i - 1][1]);
        return breite[mo] - 0.5;
      }
      var off = 0, ab = {};
      monate.forEach(function (mo) { ab[mo] = off; monatsBloecke.push({ ms: x.id, monat: mo, ab: off, breite: breite[mo] }); off += breite[mo]; });
      ss.forEach(function (s) { tiefe[s.id] = ab[s.monat] + l(s.id); if (zeitraum(s)) tiefeA[s.id] = ab[s.von] + la_(s.id); });
      ss.forEach(function (s) {
        // datierter Halt, der in seinem Monat allein auf seiner Linie steht: an sein Datum rücken (gleiche Termine stehen übereinander)
        if (!zeitraum(s) && s.tag && stuetzen[s.monat] && stuetzen[s.monat].length && ss.filter(function (n) { return n.strang === s.strang && (n.monat === s.monat || n.von === s.monat); }).length === 1)
          tiefe[s.id] = ab[s.monat] + Math.max(0, lage(s.monat, s.tag));
        if (!zeitraum(s) || !s.tag) return;
        if (s.tagVon) tiefeA[s.id] = ab[s.von] + Math.max(0, lage(s.von, s.tagVon));
        // nie vor dem Vorgänger auf der eigenen Linie beginnen, nie vor dem eigenen Beginn enden
        // nur Vorgänger im selben Level zählen – die Spalten jedes Levels zählen für sich
        (s.braucht || []).forEach(function (b) { if (imPlan[b] && gleich(S[b], s) && S[b].meilenstein === s.meilenstein && tiefe[b] != null) tiefeA[s.id] = Math.max(tiefeA[s.id], tiefe[b] + 0.7); });
        tiefe[s.id] = Math.max(ab[s.monat] + lage(s.monat, s.tag), tiefeA[s.id] + 0.8);
      });
      bandMin[x.id] = off;
    });
    var bandStart = {}, bandBreite = {}, lauf = 0, nr = 0, bandNr = {};
    stufenImBlick.forEach(function (x) {
      var w = Math.max(stufenImBlick.length > 1 ? 2 : 1, bandMin[x.id] || 0);   // im Gesamtplan auch leere Level breit genug für ihren Namen liste.forEach(function (s) { if (s.meilenstein === x.id) w = Math.max(w, tiefe[s.id] + 1); });
      bandStart[x.id] = lauf; bandBreite[x.id] = w; bandNr[x.id] = nr++; lauf += w;
    });
    var HALT = 64;                               // Platz für einen Stufenhalt zwischen zwei Bändern
    var START = vorStufe ? 70 : EINLAUF;         // links: Starthalt der Stufe davor
    var verfuegbar = planEl.clientWidth / MASS - SPALTE;   // Breite in Plan-Einheiten (MASS = gewählte Größe)
    ABST = Math.max(73, Math.min(140, (verfuegbar - 14 - START - HALT * (nr - 1) - ENDE) / lauf));
    function xVon(s) { var x = MS[s.meilenstein]; return START + (bandStart[x.id] + tiefe[s.id]) * ABST + bandNr[x.id] * HALT + ABST / 2; }
    function xStart(s) { if (tiefeA[s.id] == null) return xVon(s); var x = MS[s.meilenstein]; return START + (bandStart[x.id] + tiefeA[s.id]) * ABST + bandNr[x.id] * HALT + ABST / 2; }
    function xHalt(mid) { return START + (bandStart[mid] + bandBreite[mid]) * ABST + bandNr[mid] * HALT + 14; }   // Stufenhalt nach dem Band

    var unter = {}, gruppen = {}, tiefsteZeile = {};
    // Zeile je Halt: die oberste Zeile seiner Linie, in der er keinen anderen Halt überdeckt – so rücken
    // Schritte in derselben Spalte und eigenständig startende Zeiträume (z. B. Webseite neben Lea) eine Zeile tiefer
    var belegt = {}, bedarf = {}, zOff = {};
    function freiZ(s) { return (s.braucht || []).every(function (b) { return !imPlan[b] || !gleich(S[b], s); }); }
    // erst die Halte der durchgehenden Linie, dann die frei startenden – so bleibt die Hauptlinie oben
    liste.filter(function (s) { return !freiZ(s); }).concat(liste.filter(freiZ)).forEach(function (s) {
      // Zeilen zählen je Strang der Stoßrichtung (zi); welche Zeile der Bahn das ist, ergibt sich danach aus dem Bedarf der Stränge davor
      var zi = s.zeile || 0, k = s.strang + "|" + s.meilenstein + "|" + zi, a = tiefeA[s.id] != null ? tiefeA[s.id] : tiefe[s.id], e = tiefe[s.id], z = 0;
      var frei = (s.braucht || []).every(function (b) { return !imPlan[b] || !gleich(S[b], s); });
      belegt[k] = belegt[k] || [];
      while (belegt[k].some(function (x) { return x.z === z && x.a <= e && a <= x.e && (frei || x.a === a || x.e === e || a === e); })) z++;
      belegt[k].push({ z: z, a: a, e: e }); unter[s.id] = z;
      bedarf[s.strang] = bedarf[s.strang] || {}; bedarf[s.strang][zi] = Math.max(bedarf[s.strang][zi] || 1, z + 1);
    });
    // Stoßrichtungen mit Strängen stehen immer im Plan, auch wenn noch nichts darin geplant ist (Daniel, 29.10.2026):
    // jeder Strang ist eine eigene, beschriftete Linie; leere Linien bleiben hellgrau
    var bahnen = D.straenge.filter(function (st) { return (st.unter || []).length || liste.some(function (s) { return s.strang === st.id; }); });
    // je Strang so viele Zeilen, wie er braucht (z. B. Abzweigung Kfz-Produkt neben Weiterentwicklung) – die nächsten Stränge rücken nach unten
    bahnen.forEach(function (st) {
      var b = bedarf[st.id] || {}, n = Math.max((st.unter || []).length, Object.keys(b).length ? 1 + Math.max.apply(null, Object.keys(b).map(Number)) : 1), off = 0;
      zOff[st.id] = [];
      for (var i = 0; i < n; i++) { zOff[st.id][i] = off; off += b[i] || 1; }
      tiefsteZeile[st.id] = off - 1;
    });
    liste.forEach(function (s) { unter[s.id] = (zOff[s.strang] ? zOff[s.strang][s.zeile || 0] || 0 : 0) + unter[s.id]; });
    // Termine (Klausur, Workshops): eigene Zeile unter den Monaten; Termine, die zugleich ein Schritt sind, stehen dort als Halt
    var termineImPlan = (D.termine || []).filter(function (t) { return !t.schritt && monatsBloecke.some(function (b) { return b.monat === t.monat; }); });
    var linieY = {}, y0 = (nr > 1 ? 70 : 16) + (monatsBloecke.length ? 44 : 0) + (termineImPlan.length ? 30 : 0);   // oben eine Zeile für die Namen der Stufenhalte (nur im Gesamtplan)
    bahnen.forEach(function (st) { var ext = (st.unter || []).length ? 28 : 0; linieY[st.id] = y0 + UEBER + ext; y0 += ext + UEBER + tiefsteZeile[st.id] * ZH + (tiefsteZeile[st.id] ? UNTER + 56 : UNTER); });
    var hoehe = y0 + 6 + (vorStufe ? 22 : 0);   // unten Platz für „Voraussetzung: …“
    function yVon(s) { return linieY[s.strang] + unter[s.id] * ZH; }
    var letzte = stufenImBlick[stufenImBlick.length - 1];
    var breite = xHalt(letzte.id) + ENDE;
    var obenAlle = Math.min.apply(null, bahnen.map(function (st) { return linieY[st.id]; })) - 18;
    var untenAlle = Math.max.apply(null, bahnen.map(function (st) { return linieY[st.id] + (tiefsteZeile[st.id] || 0) * ZH; })) + 18;   // auch die Nebenzeilen der letzten Bahn

    var svg = '<svg width="' + breite + '" height="' + hoehe + '" class="ub-svg" aria-hidden="true">';
    var monatsNamen = "";
    monatsBloecke.forEach(function (b) {
      var xa = START + (bandStart[b.ms] + b.ab) * ABST + bandNr[b.ms] * HALT, yo = nr > 1 ? 70 : 8;
      // schmaler Monat (eine Spalte): kurzer Name, damit sich die Monatsnamen nicht überlagern
      var kurzM = ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."][+String(b.monat).split("-")[1] - 1];
      var mn = b.breite * ABST < 64 ? kurzM : b.breite * ABST < 120 ? kurzM + " " + String(b.monat).slice(0, 4) : monatsName(b.monat);
      monatsNamen += '<div class="ub-monat" style="left:' + (xa + b.breite * ABST / 2) + "px;top:" + yo + 'px">' + mn + "</div>";
      if (!b.ab) return;   // keine Linie vor dem ersten Monat: links steht schon die Grenze der Spalte
      svg += '<line x1="' + xa + '" y1="' + (yo + 26) + '" x2="' + xa + '" y2="' + hoehe + '" stroke="#ebe7e1" stroke-width="1"/>';
    });
    termineImPlan.forEach(function (t) {
      var b = monatsBloecke.filter(function (x) { return x.monat === t.monat; })[0];
      var xa = START + (bandStart[b.ms] + b.ab) * ABST + bandNr[b.ms] * HALT, bw = b.breite * ABST;
      var tx = xa + Math.max(10, Math.min(bw - 10, bw * ((t.tag || 15) - 0.5) / 31)), ty = (nr > 1 ? 70 : 8) + 44;
      svg += '<rect x="' + (tx - 5) + '" y="' + (ty - 5) + '" width="10" height="10" fill="#111" transform="rotate(45 ' + tx + " " + ty + ')"/>';
      monatsNamen += '<button type="button" class="ub-termin" data-termin="' + esc(t.id) + '" style="left:' + (tx - 9) + "px;top:" + (ty - 11) + 'px"><span>' + esc(t.titel) + " &middot; " + esc(t.wann.replace(/\.20\d\d$/, ".")) + "</span></button>";
    });
    var duenn = "", dick = "", quer = "", halte = "", namen = "", durch = "";
    function strecke(pkte, farbe, gegangen, schwach) {
      // gleiche Dicke: gefahren in Linienfarbe, noch nicht gefahren hellgrau (blass: noch heller)
      // ist ein Halt angeklickt, wird der offene Weg dorthin dunkler (Grau der offenen Halte), alles andere tritt hell zurück
      var f = gegangen ? (schwach ? hell(farbe, 0.8) : farbe) : (schwach ? "#f0ede9" : zustandUI.station ? "#a39e96" : "#dedad4");
      var html = '<path d="' + rund(pkte) + '" stroke="' + f + '" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="8"/>';
      if (gegangen) dick += html; else duenn += html;
    }
    function weg(x1, y1, x2, y2, rueck) {
      if (Math.abs(y1 - y2) < 1) return [[x1, y1], [x2, y2]];
      var xs = rueck ? x1 + ABST / 2 : x2 - ABST / 2;
      return [[x1, y1], [xs, y1], [xs, y2], [x2, y2]];
    }
    function freiStart(v) {   // ohne Zuführung: keine Stufe, keine frühere Vorarbeit, kein Vorgänger auf der eigenen Linie
      return !(v.braucht || []).some(function (b) { return MS[b] || !imPlan[b] || gleich(S[b], v); });
    }
    // Woher kommt eine Strecke in den Halt? aus der eigenen Linie, aus einem Stufenhalt – oder frei
    liste.forEach(function (s) {
      var f = STR[s.strang].farbe, x2 = xStart(s), y2 = yVon(s), linieRein = false, abHier = null;
      (s.braucht || []).forEach(function (b) {
        if (MS[b]) {                                             // startet, sobald eine Stufe erreicht ist
          var hx = imBlick[b] ? xHalt(b) + 13 : vorStufe ? 34 : 0;   // aus dem Stufenhalt – nie links daran vorbei
          strecke(weg(hx, linieY[s.strang], x2, y2, false), f, s.status !== "offen", blass(s.id)); linieRein = true; return;
        }
        if (!imPlan[b]) {                                        // Vorarbeit aus einer früheren Stufe: kommt aus dem Starthalt
          if (!linieRein) strecke(weg(vorStufe ? 34 : 0, linieY[s.strang], x2, y2, false), f, s.status !== "offen", blass(s.id));
          linieRein = true; return;
        }
        var v = S[b], x1 = xVon(v), y1 = yVon(v);
        if (gleich(v, s)) {
          // frei beginnender Strang auf einer Nebenstrecke bleibt auf seiner Strecke und mündet erst kurz vor dem Halt ein
          var pk = weg(x1, y1, x2, y2, unter[b] > unter[s.id] && !freiStart(v));
          var nachMain = function (id) { return liste.some(function (n) { return n.strang === s.strang && unter[n.id] === 0 && (n.braucht || []).indexOf(id) > -1; }); };
          var vorMain = function (n) { return (n.braucht || []).some(function (x) { return imPlan[x] && S[x].strang === n.strang && unter[x] === 0; }); };
          if (pk.length === 4 && unter[b] === 0 && unter[s.id] > 0 && nachMain(b)) pk = pk.slice(1);
          else if (pk.length === 4 && unter[b] > 0 && unter[s.id] === 0 && vorMain(s)) pk = pk.slice(0, 3);
          // läuft über eine Stufengrenze hinweg: direkte Verbindung – wird über dem Stufenhalt gezeichnet
          // läuft ein Halt schon, sein Vorgänger aber noch nicht: grau bis zur Zusammenführung, ab dort in Linienfarbe
          if (s.status !== "offen" && S[b].status === "offen") {
            strecke(pk, f, false, blass(s.id) || blass(b));
            var auf = pk.filter(function (q) { return Math.abs(q[1] - y2) < 1; })[0];   // wo dieser Weg die Strecke des Halts erreicht
            if (auf) abHier = abHier == null ? auf[0] : Math.max(abHier, auf[0]);
          } else strecke(pk, f, s.status !== "offen", blass(s.id) || blass(b));
          linieRein = true;
        } else {
          var dir = y2 > y1 ? 1 : -1, yk = y2 - dir * 26, pq = [[x1, y1], [x1, yk], [x2, yk], [x2, y2]];
          // steht ein anderer Halt genau auf der senkrechten Strecke, weicht die Abhängigkeit in die Lücke davor aus
          var imWeg = liste.some(function (n) { var nx = xVon(n), ny = yVon(n); return n.id !== s.id && n.id !== b && Math.abs(nx - x1) < 2 && (ny - y1) * dir > 0 && (yk - ny) * dir > 0; });
          if (imWeg && x2 - x1 > ABST / 2) { var xm = x2 - ABST / 2, ya = y1 + dir * 13; pq = [[x1, y1], [x1, ya], [xm, ya], [xm, yk], [x2, yk], [x2, y2]]; }
          quer += '<path d="' + rund(pq) + '" stroke="' + (blass(s.id) ? "#dedad4" : "#8a857d") + '" stroke-width="2" fill="none" stroke-dasharray="3 5"/>';
        }
      });
      if (abHier != null && abHier < x2) strecke([[abHier, y2], [x2, y2]], f, true, blass(s.id));   // ab der Zusammenführung in Linienfarbe
      // fließt ein (gestrichelt): z. B. LEA in die Webseite – vom Ende des Zulieferers senkrecht auf den Zeitraum
      (s.einfluss || []).forEach(function (b) {
        if (!imPlan[b]) return;
        var v = S[b], x1 = xVon(v), y1 = yVon(v), xz = Math.max(x2, Math.min(xVon(s), x1)), ym = (y1 + y2) / 2;
        var pq = Math.abs(xz - x1) < 1 ? [[x1, y1], [x1, y2]] : [[x1, y1], [x1, ym], [xz, ym], [xz, y2]];
        quer += '<path d="' + rund(pq) + '" stroke="' + (blass(s.id) ? "#dedad4" : "#8a857d") + '" stroke-width="2" fill="none" stroke-dasharray="3 5"/>';
      });
      // frei startend: eigene kurze Strecke mit Kopfbahnhof (Querstrich) – „kann sofort los“
      if (!linieRein) {
        var xa = x2 - ABST * 0.42, geg = s.status !== "offen";
        strecke([[xa, y2], [x2, y2]], f, geg, blass(s.id));
        strecke([[xa, y2 - 9], [xa, y2 + 9]], f, geg, blass(s.id));
      }
      // Auslauf: Halt ohne Nachfolger auf der eigenen Linie endet im Stufenhalt seiner Stufe, wenn er einfließt
      var weiter = D.schritte.some(function (n) { return gleich(n, s) && imPlan[n.id] && (n.braucht || []).indexOf(s.id) > -1; });
      if (!weiter) {
        var ms = MS[s.meilenstein], rein = fokus[s.id] && vorlauf(ms.braucht || [])[s.id] && !zustandUI.station;
        var ende = rein ? xHalt(ms.id) : xVon(s) + ABST / 2;
        // eigenständig startender Nebenstrang (eigene Zeile, kein Nachfolger): läuft auf seiner Zeile bis zum Stufenhalt
        var eigeneZeile = unter[s.id] > 0 && (freiStart(s) || s.zeile > 0);   // Unterstrang einer Stoßrichtung bleibt bis zum Ende auf seiner Linie
        strecke(weg(xVon(s), y2, ende, eigeneZeile ? y2 : linieY[s.strang], true), f, false, !rein && (blass(s.id) || !!zustandUI.station));
      }
    });
    // Stufenhalte: Balken über alle Linien; der gewählte bzw. letzte kräftig, Zwischenhalte etwas schmaler
    function balken(x, stark, grau) {
      return '<rect x="' + x + '" y="' + obenAlle + '" width="26" height="' + (untenAlle - obenAlle) + '" rx="13" fill="#fff" stroke="' + (grau ? "#a39e96" : "#111") + '" stroke-width="' + (stark ? 6 : 4) + '"/>';
    }
    stufenImBlick.forEach(function (x) {
      var hx = xHalt(x.id), letzter = x.id === letzte.id;
      halte += balken(hx, letzter, false);
      namen += '<div class="ub-halt-name' + (letzter ? " ub-halt-name--ende" : "") + '" style="left:' + (letzter ? hx + 36 : hx + 13) + "px;top:" + (letzter ? (obenAlle + untenAlle) / 2 : 4) + 'px"><b>' +
        esc(msName(x)) + "</b><small>" + (stufeErreicht(x.id) ? "erreicht" : "Level " + x.nr + " &middot; " + esc(x.termin)) + "</small></div>";
    });
    if (vorStufe) {
      halte += balken(8, false, true);
      namen += '<div class="ub-halt-name ub-halt-name--start" style="left:8px;top:' + (hoehe - 24) + 'px"><small>Voraussetzung: ' + esc(msName(vorStufe)) + (stufeErreicht(vorStufe.id) ? " (erreicht)" : " (noch offen)") + "</small></div>";
    }
    bahnen.forEach(function (st) {
      (st.unter || []).forEach(function (u, i) {
        // leerer Strang im gewählten Abschnitt: keine Linie (Daniel, 29.10.2026) – nur der Name bleibt als Gliederung stehen
        return;
      });
    });
    svg += quer + duenn + dick;
    var punkte = "";   // Halte zuletzt, damit keine Linie sie überdeckt
    // Namen dürfen so breit werden, wie links und rechts auf ihrer Linie Platz ist (Daniel, 29.10.2026) – erst dann umbrechen
    var mitten = {};
    liste.forEach(function (s) { var y = Math.round(yVon(s)); (mitten[y] = mitten[y] || []).push((xStart(s) + xVon(s)) / 2); });
    var xEnde = xHalt(letzte.id);
    liste.forEach(function (s) {
      var z = zustand(s), f = STR[s.strang].farbe, cx = xVon(s), cy = yVon(s), schwach = blass(s.id), sel = zustandUI.station === s.id;
      var xs = xStart(s), lang = cx - xs;   // Zeitraum: Kapsel vom Beginn bis zum Ende
      var umstieg = (s.braucht || []).some(function (b) { return imPlan[b] && !gleich(S[b], s); });
      var r = z === "aktiv" ? 11 : z === "erreicht" ? 6 : (umstieg ? 10 : 8);
      if (sel) r += 2;
      // Halte weiß wie im Liniennetzplan: erledigt klein mit Rand in Linienfarbe, in Arbeit groß mit schwarzem Rand, kommt noch grau
      var rand = z === "erreicht" ? [schwach ? hell(f, 0.8) : f, 2.5] : z === "aktiv" ? [schwach ? "#c9c5bf" : "#111", 4.5] : [schwach ? "#e8e5e0" : "#a39e96", umstieg ? 3.5 : 3];
      // erledigt wie in Sicht 1.1: klein und vollflächig in der Linienfarbe, mit weißem Rand
      var fuell = "#fff";
      if (z === "erreicht") { fuell = schwach ? hell(f, 0.8) : f; rand = ["#fff", 2]; }
      punkte += lang > 1
        ? '<rect x="' + (xs - r) + '" y="' + (cy - r) + '" width="' + (lang + 2 * r) + '" height="' + (2 * r) + '" rx="' + r + '" fill="' + fuell + '" stroke="' + rand[0] + '" stroke-width="' + rand[1] + '"/>'
        : '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + fuell + '" stroke="' + rand[0] + '" stroke-width="' + rand[1] + '"/>';
      if (s.kritisch) punkte += '<circle cx="' + (cx + r + 3) + '" cy="' + (cy - r - 3) + '" r="7" fill="' + (schwach ? "#f6c9bf" : "#E8553A") + '"/><text x="' + (cx + r + 3) + '" y="' + (cy - r + 0.6) + '" text-anchor="middle" class="ub-ausruf">!</text>';
      var vonOben = (s.braucht || []).some(function (b) { return imPlan[b] && !gleich(S[b], s) && yVon(S[b]) < cy; });
      var obenL = unter[s.id] === 0 && !vonOben;
      var mitte = (xs + cx) / 2, bn = Math.max(ABST - 6, lang + 2 * r);   // Namen fast spaltenbreit – bei engen Monaten bleiben sie lesbar
      // zum Nachbarn auf derselben Linie höchstens die halbe Strecke (er braucht die andere Hälfte), zum Rand die ganze
      var li = null, re = null;
      (mitten[Math.round(cy)] || []).forEach(function (m) { if (m < mitte - 1) li = li == null ? m : Math.max(li, m); else if (m > mitte + 1) re = re == null ? m : Math.min(re, m); });
      var links = li == null ? mitte : (mitte - li) / 2, rechts = re == null ? xEnde - mitte : (re - mitte) / 2;
      var grenze = 2 * Math.min(links, rechts) - 8;   // nie über die Hälfte zum Nachbarn – auch nicht bei langen Kapseln
      bn = Math.max(40, Math.min(Math.max(bn, Math.min(grenze, 210)), grenze));
      // letzter Halt der Linie mit engem linken Nachbarn: der Name darf nach rechts in den freien Raum reichen (links weiter nur bis zur Hälfte)
      var nl = mitte - bn / 2, rechtsBuendig = false;
      if (re == null && li != null && links < 105 && rechts > links) { var bw = Math.min(210, links + rechts - 12); if (bw > bn) { bn = bw; nl = mitte - links + 4; rechtsBuendig = true; } }
      namen += '<button type="button" class="ub-name ub-name--' + z + (obenL ? " ub-name--oben" : "") + (schwach ? " ub-name--blass" : "") +
        '" data-station="' + s.id + '" style="left:' + nl + "px;" + (rechtsBuendig ? "text-align:left;" : "") + "top:" + (obenL ? cy - r - 8 : cy + r + 8) + "px;width:" + bn + 'px">' + esc(s.titel) + "</button>";
      namen += '<button type="button" class="ub-treffer" data-station="' + s.id + '" aria-label="' + esc(s.titel) + '" style="left:' + (mitte - 16) + "px;top:" + (cy - 16) + "px" + (lang > 1 ? ";width:" + (lang + 32) + "px;margin-left:" + (-lang / 2) + "px" : "") + '"></button>';
    });
    svg += halte + durch + punkte + "</svg>";
    var treffer = "";
    bahnen.forEach(function (st) {
      var ys = {}; liste.forEach(function (s) { if (s.strang === st.id) ys[yVon(s)] = true; });
      Object.keys(ys).forEach(function (y) {
        treffer += '<button type="button" class="ub-strang-treffer" data-strang="' + st.id + '" tabindex="-1" aria-hidden="true" style="top:' + (+y - 9) + 'px;width:' + breite + 'px"></button>';
      });
    });
    namen = treffer + namen;
    var spalte = bahnen.map(function (st) {
      var mitU = (st.unter || []).length;
      // mit Strängen: Titel der Stoßrichtung über der ersten Linie (wächst nach oben), Strangnamen auf Höhe ihrer Linie
      return (mitU ? st.unter.map(function (u, i) { return '<button type="button" class="ub-unterstrang" data-unter="' + st.id + "|" + i + '" style="top:' + (linieY[st.id] + zOff[st.id][i] * ZH) + 'px">' + esc(u) + "</button>"; }).join("") : "") +
        '<button type="button" class="ub-bahn' + (mitU ? " ub-bahn--oben" : "") + '" data-strang="' + st.id + '" aria-label="' + esc(st.label) + ': worum es in dieser Stoßrichtung geht" style="top:' + (linieY[st.id] - (mitU ? 22 : 15)) + 'px"><span class="ub-linie" style="background:' + st.farbe + '">' + esc(st.kurz) + "</span><span><b>" + esc(st.label) + '</b><small>' + esc(st.verantwortung) + "</small></span></button>";
    }).join("");
    // Scrollstand merken: Klick auf einen Halt zeichnet neu – der Plan bleibt dort stehen, wo man hingeschoben hat
    var altSc = planEl.querySelector(".ub-scroll"), altLinks = altSc && altSc.clientWidth && planEl.ubBlick === zustandUI.ms ? altSc.scrollLeft : null;   // nur, wenn der Plan schon sichtbar war
    planEl.ubBlick = zustandUI.ms;
    planEl.innerHTML = '<div class="ub-rahmen" style="width:' + (planEl.clientWidth / MASS) + "px;transform:scale(" + MASS + ');transform-origin:0 0"><div class="ub-spalte" style="height:' + hoehe + 'px">' + spalte + '</div><div class="ub-scroll"><div class="ub-flaeche" style="width:' + breite + "px;height:" + hoehe + 'px">' + svg + monatsNamen + namen + "</div></div></div>";
    planEl.style.height = Math.ceil(planEl.firstChild.offsetHeight * MASS) + "px";   // transform nimmt keinen Platz ein: Höhe nachführen
    planEl.querySelectorAll("[data-station]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-station");
        zustandUI.station = zustandUI.station === id ? null : id;
        plan(); detail();
      });
    });
    planEl.querySelectorAll("[data-termin]").forEach(function (b) {
      b.addEventListener("click", function (e) { e.stopPropagation(); terminInfo(b.getAttribute("data-termin") === terminOffen ? null : b.getAttribute("data-termin")); });
    });
    terminInfo(terminOffen);
    planEl.querySelectorAll("[data-strang]").forEach(function (b) {
      b.addEventListener("click", function (e) { e.stopPropagation(); strangInfo(b.getAttribute("data-strang") === strangOffen ? null : b.getAttribute("data-strang")); });
    });
    planEl.querySelectorAll(".ub-unterstrang").forEach(function (b) {
      b.addEventListener("click", function (e) { e.stopPropagation(); strangInfo(b.getAttribute("data-unter") === strangOffen ? null : b.getAttribute("data-unter")); });
    });
    strangInfo(strangOffen);
    var sc = planEl.querySelector(".ub-scroll");
    if (sc && altLinks != null) sc.scrollLeft = altLinks;
    else if (sc && !zustandUI.station && sc.scrollWidth > sc.clientWidth) {
      var offen = liste.filter(function (s) { return fokus[s.id] && s.status !== "erreicht"; }).map(xVon);
      sc.scrollLeft = offen.length ? Math.max(0, Math.min.apply(null, offen) - 2 * ABST) : 0;
    }
    ziehen(sc);
  }

  // Plan mit gedrückter Maus nach links und rechts ziehen (Touch scrollt ohnehin)
  var zug = { sc: null, start: null, bewegt: false };
  window.addEventListener("mousemove", function (e) {
    if (!zug.start || !zug.sc) return;
    var dx = e.clientX - zug.start.x;
    if (Math.abs(dx) > 4) { zug.bewegt = true; zug.sc.classList.add("ub-zieht"); }
    zug.sc.scrollLeft = zug.start.l - dx;
  });
  window.addEventListener("mouseup", function () { zug.start = null; if (zug.sc) zug.sc.classList.remove("ub-zieht"); });
  function ziehen(sc) {
    if (!sc) return;
    zug.sc = sc;
    // Ist der Plan breiter als der Platz, blendet der Rand aus – so ist klar, dass rechts/links noch etwas kommt
    function rand() { sc.classList.toggle("ub-mehr-r", sc.scrollLeft + sc.clientWidth < sc.scrollWidth - 2); sc.classList.toggle("ub-mehr-l", sc.scrollLeft > 2); }
    sc.addEventListener("scroll", rand); rand();
    sc.addEventListener("mousedown", function (e) { if (e.button !== 0) return; zug.start = { x: e.clientX, l: sc.scrollLeft }; zug.bewegt = false; });
    sc.addEventListener("click", function (e) { if (zug.bewegt) { e.stopPropagation(); e.preventDefault(); zug.bewegt = false; } }, true);
  }

  /* ---------- Fenster am Termin: was, wann, wo – und der Weg zur Terminübersicht ---------- */
  var terminOffen = null;
  function terminInfo(id) {
    var alt = planEl.querySelector(".ub-pop--termin"); if (alt) alt.remove();
    terminOffen = id;
    if (!id) return;
    var t = (D.termine || []).filter(function (x) { return x.id === id; })[0], knopf = planEl.querySelector('.ub-termin[data-termin="' + id + '"]'), fl = planEl.querySelector(".ub-flaeche");
    if (!t || !knopf || !fl) return;
    var pop = document.createElement("div");
    pop.className = "ub-pop ub-pop--termin";
    pop.innerHTML = '<p class="ub-pop-titel">' + esc(t.titel) + '</p><p class="ub-pop-meta">' + [t.wann, t.zusatz, t.info].filter(Boolean).map(esc).join(" &middot; ") + "</p>" +
      (OPT.terminLink ? '<p><a href="' + OPT.terminLink + '">Zur Terminübersicht &#8594;</a></p>' : '');
    fl.appendChild(pop);
    pop.style.left = Math.min(Math.max(4, parseFloat(knopf.style.left) - 120), fl.offsetWidth - pop.offsetWidth - 4) + "px";
    pop.style.top = (parseFloat(knopf.style.top) + 28) + "px";
  }

  /* ---------- Fenster am Strang: worum es geht, wer verantwortet ---------- */
  var strangOffen = null;
  function strangInfo(id) {
    var alt = planEl.querySelector(".ub-pop--strang"); if (alt) alt.remove();
    planEl.querySelectorAll(".ub-bahn").forEach(function (b) { b.setAttribute("aria-expanded", b.getAttribute("data-strang") === id ? "true" : "false"); });
    strangOffen = id;
    if (!id) return;
    var sp = planEl.querySelector(".ub-spalte");
    if (String(id).indexOf("|") > -1) {   // Strang innerhalb einer Stoßrichtung: Name und Erläuterung des Strangs
      var t = id.split("|"), b = STR[t[0]], k = planEl.querySelector('.ub-unterstrang[data-unter="' + id + '"]');
      if (!b || !k || !sp) return;
      var pu = document.createElement("div");
      pu.className = "ub-pop ub-pop--strang";
      pu.innerHTML = '<p class="ub-pop-titel">' + esc(b.unter[+t[1]]) + '</p><p class="ub-pop-meta">Strang in ' + esc(b.label) + "</p><p>" + (b.unterText && b.unterText[+t[1]] ? esc(b.unterText[+t[1]]) : "Die Erläuterung folgt.") + "</p>";
      sp.appendChild(pu);
      pu.style.top = (parseFloat(k.style.top) + 14) + "px";
      return;
    }
    var st = STR[id], knopf = planEl.querySelector('.ub-bahn[data-strang="' + id + '"]');
    if (!knopf || !sp) return;
    var text = st.beschreibung || st.frage;
    var pop = document.createElement("div");
    pop.className = "ub-pop ub-pop--strang";
    // ohne Verantwortliche kein leeres „verantwortlich:“; die Erklärung steht für sich (Daniel, 29.10.2026)
    pop.innerHTML = '<p class="ub-pop-titel">' + esc(st.label) + '</p><p class="ub-pop-meta">' + (/projektmanagement|innovation/i.test(st.label) ? "Linie" : "Stoßrichtung") + (st.verantwortung ? " &middot; verantwortlich: " + esc(st.verantwortung) : "") + "</p>" +
      "<p>" + (text ? esc(text) : "Die Beschreibung folgt.") + "</p>";
    sp.appendChild(pop);
    pop.style.top = (parseFloat(knopf.style.top) - 6) + "px";
  }

  /* ---------- Fenster an der Station: knapp, eine Schrift, zwei Größen, zwei Farben ---------- */
  function detail() {
    var alt = planEl.querySelector(".ub-pop"); if (alt) alt.remove();
    var id = zustandUI.station;
    if (!id) return;
    var s = S[id], st = STR[s.strang], z = zustand(s);
    var punkt = planEl.querySelector('.ub-treffer[data-station="' + id + '"]'), flaeche = planEl.querySelector(".ub-flaeche");
    if (!punkt || !flaeche) return;
    var vor = (s.braucht || []).filter(function (b) { return S[b] && S[b].status !== "erreicht"; }).map(function (b) { return S[b].titel; });
    var meta = [st.verantwortung + (s.wer ? " (" + s.wer + ")" : ""), ZTEXT[z]].concat(s.termin ? [s.termin] : zeitraum(s) ? [monatsName(s.von).split(" ")[0] + " bis " + monatsName(s.monat)] : s.monat ? [monatsName(s.monat)] : []);
    var h = '<p class="ub-pop-titel">' + esc(s.titel) + '</p><p class="ub-pop-meta">' + meta.map(esc).join(" &middot; ") + "</p>";
    if (s.beschreibung) h += textHtml(s.beschreibung);
    if (s.ergebnis) h += "<p>" + esc(s.ergebnis) + "</p>";
    if (s.kritisch) h += "<p>Kritisch: " + esc(s.kritisch.grund) + "</p>";
    if (vor.length) h += '<p class="ub-pop-meta">Braucht vorher: ' + vor.map(esc).join(", ") + "</p>";
    var ein = (s.einfluss || []).filter(function (b) { return S[b]; }).map(function (b) { return S[b].titel; });
    if (ein.length) h += '<p class="ub-pop-meta">Fließt ein: ' + ein.map(esc).join(", ") + "</p>";
    // Arbeitspaket: seine Aufgaben zum Abhaken
    if (s.aufgaben) h += '<p class="ub-pop-meta ub-pop-auf-kopf">Aufgaben</p>' + (s.aufgaben.length ? '<ul class="ub-pop-auf">' + s.aufgaben.map(function (x) {
      return '<li><label><input type="checkbox" data-ub-auf="' + x.id + '"' + (x.erledigt ? " checked" : "") + "><span" + (x.erledigt ? ' class="ub-pop-auf-fertig"' : "") + ">" + esc(x.titel) +
        (x.termin && !x.erledigt ? '<small> · fällig ' + esc(x.termin) + "</small>" : "") + "</span></label></li>"; }).join("") + "</ul>" : '<p class="ub-pop-meta">Noch keine Aufgaben.</p>');
    var pop = document.createElement("div");
    pop.className = "ub-pop"; pop.innerHTML = h;
    flaeche.appendChild(pop);
    pop.querySelectorAll("[data-ub-auf]").forEach(function (c) {   // Abhaken meldet die Seite, die speichert und neu zeichnet
      c.addEventListener("change", function () { wurzel.dispatchEvent(new CustomEvent("ub-abhaken", { detail: { id: +c.getAttribute("data-ub-auf"), erledigt: c.checked } })); });
    });
    var px = parseFloat(punkt.style.left) + 16, py = parseFloat(punkt.style.top) + 16;
    // Position wählen, die keinen Halt auf dem Weg dorthin verdeckt (Reihenfolge: rechts, unten, oben, links)
    var W = pop.offsetWidth, H = pop.offsetHeight, FW = flaeche.offsetWidth, FH = flaeche.offsetHeight;
    var weg = vorlauf([id]), halte = [];
    planEl.querySelectorAll(".ub-treffer").forEach(function (t) {
      if (t.getAttribute("data-station") === id) return;
      halte.push({ x: parseFloat(t.style.left) + 16, y: parseFloat(t.style.top) + 16, wichtig: !!weg[t.getAttribute("data-station")] });
    });
    var kandidaten = [[px + 70, py - 24], [px - W / 2, py + 64], [px - W / 2, py - H - 64], [px - 70 - W, py - 24]];
    var best = null;
    kandidaten.forEach(function (k, i) {
      var x = Math.min(Math.max(4, k[0]), FW - W - 4), y = Math.min(Math.max(4, k[1]), FH - H - 4), wert = i * 0.1;
      halte.forEach(function (h) {   // Halt samt Namen: etwas Rand um den Punkt
        if (h.x > x - 50 && h.x < x + W + 50 && h.y > y - 50 && h.y < y + H + 40) wert += h.wichtig ? 10 : 1;
      });
      if (!best || wert < best.w) best = { x: x, y: y, w: wert };
    });
    pop.style.left = best.x + "px";
    pop.style.top = best.y + "px";
  }
  // Klick irgendwo daneben löst die Auswahl
  document.addEventListener("click", function (e) {
    if (strangOffen && !e.target.closest(".ub-pop--strang, .ub-bahn, .ub-unterstrang, .ub-strang-treffer")) strangInfo(null);
    if (terminOffen && !e.target.closest(".ub-pop--termin, .ub-termin")) terminInfo(null);
    if (!zustandUI.station) return;
    if (e.target.closest(".ub-name, .ub-treffer, .ub-pop")) return;
    zustandUI.station = null; plan(); detail();
  });

  // Größe des Plans: kleiner, um mehr auf einmal zu sehen – in Stufen zwischen 60 und 120 Prozent, je Gerät gemerkt.
  var STUFEN = [60, 70, 80, 90, 100, 110, 120], groesse = 100;
  try { var gm = +localStorage.getItem("sv-plan-groesse"); if (STUFEN.indexOf(gm) > -1) groesse = gm; } catch (e) {}
  var karte = planEl.parentNode;
  var zoomEl = document.createElement("div");
  var platz = wurzel.querySelector("[data-zoom-platz]") || karte;   // Leiste oben rechts im Kopf
  var quelle = wurzel.querySelector("[data-legende-quelle]");
  zoomEl.className = "ub-zoom";
  zoomEl.innerHTML = '<button type="button" data-z="-1" aria-label="Plan kleiner">&minus;</button><output aria-live="polite"></output>' +
    '<button type="button" data-z="1" aria-label="Plan größer">+</button>' +
    (quelle ? '<span class="ub-zoom-trenner" aria-hidden="true"></span><button type="button" class="ub-leg-knopf" data-leg aria-expanded="false">Legende</button>' : "");
  platz.appendChild(zoomEl);
  if (quelle) {
    var legPop = document.createElement("div");
    legPop.className = "ub-pop ub-pop--legende"; legPop.hidden = true;
    legPop.innerHTML = '<p class="ub-pop-titel">Legende</p>' + quelle.innerHTML;
    zoomEl.appendChild(legPop);
    var legKnopf = zoomEl.querySelector("[data-leg]");
    var legZu = function () { legPop.hidden = true; legKnopf.setAttribute("aria-expanded", "false"); };
    legKnopf.addEventListener("click", function (e) { e.stopPropagation(); var auf = legPop.hidden; legPop.hidden = !auf; legKnopf.setAttribute("aria-expanded", auf ? "true" : "false"); });
    document.addEventListener("click", function (e) { if (!legPop.hidden && !e.target.closest(".ub-pop--legende")) legZu(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") legZu(); });
  }
  function setzeGroesse(g) {
    groesse = g;
    MASS = g / 100;
    zoomEl.querySelector("output").textContent = g + " %";
    zoomEl.querySelector('[data-z="-1"]').disabled = g === STUFEN[0];
    zoomEl.querySelector('[data-z="1"]').disabled = g === STUFEN[STUFEN.length - 1];
    try { localStorage.setItem("sv-plan-groesse", String(g)); } catch (e) {}
  }
  function neu(g) { if (g === groesse) return; setzeGroesse(g); plan(); detail(); }   // neu zeichnen: kleiner heißt auch mehr Breite für die Spalten
  zoomEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-z]"); if (!b) return;
    var i = STUFEN.indexOf(groesse) + (+b.getAttribute("data-z"));
    if (i >= 0 && i < STUFEN.length) neu(STUFEN[i]);
  });
  setzeGroesse(groesse);
  // Der Plan kennt seine Breite erst, wenn er sichtbar ist (zugeklappter Kasten, gedrehtes Gerät):
  // ändert sich die Breite, wird er neu gezeichnet – sonst stand er gestaucht und lief über den Kasten hinaus.
  var letzteBreite = -1;
  function breitePruefen() {
    var w = planEl.clientWidth;
    if (w && Math.abs(w - letzteBreite) > 4) { letzteBreite = w; plan(); detail(); }
  }
  if (window.ResizeObserver) new ResizeObserver(breitePruefen).observe(planEl);
  wurzel.addEventListener("ub-zeigen", breitePruefen);   // beim Aufklappen des Kastens sofort richtig zeichnen
  stufen(); plan(); detail();
};
