/* Termine – Konzept mit Beispieldaten (erfundene Namen). Zeigt, wie die Terminseite
   Arten, Dauer, Projekt, Vorbereitung und ein kurzes Briefing pro Termin bündelt. */
(function () {
  "use strict";
  var wurzel = document.querySelector("[data-termine]");
  if (!wurzel) return;
  var T = [
    { tag: "Mo 12. Okt", von: "09:00", bis: "10:00", art: "Jour fixe", titel: "Jour fixe Team", projekt: "intern", vorb: "keine", mit: ["Noah"] },
    { tag: "Mo 12. Okt", von: "14:00", bis: "15:30", art: "Kundentermin", titel: "Strategie SV Akademie – Zwischenstand", projekt: "SV Akademie", vorb: "noetig", mit: ["Andreas Beispiel", "Michael Muster"],
      briefing: { worum: "Zwischenstand der Strategie vorstellen, Feedback zur KI-Säule einholen.", zuletzt: "Termin am 6. Okt, danach Mail mit Folien der VdV-Konferenz (KI als Handlungsfeld).", offen: ["KI in Personalentwicklung als eigenes Handlungsfeld vorbereiten", "Qualitätssiegel 2027 – auf SharePoint?"], tun: "Folien aktualisieren (KI-Säule ergänzen), 3 Fragen für Feedback vorbereiten." } },
    { tag: "Di 13. Okt", von: "08:30", bis: "16:30", art: "Workshop", titel: "Führungskreis-Workshop Leitbild", projekt: "SV Schadenmanagement", vorb: "noetig", ort: "Wiesbaden", reise: "Anreise 7:00, ca. 1,5 h", mit: ["Matthias Probe", "Saskia Test", "+ 8 weitere"],
      briefing: { worum: "Ganztägiger Workshop: Leitbilder der Abteilungen zusammenführen.", zuletzt: "Leitbilder aller Abteilungen am 25. Sept erhalten.", offen: ["Agenda noch nicht verschickt", "Moderationsmaterial bestellen"], tun: "Agenda bis Freitag verschicken, Leitbilder vorab clustern." } },
    { tag: "Mi 14. Okt", von: "10:00", bis: "11:00", art: "Kundentermin", titel: "MSP – Landingpage Abnahme", projekt: "MSP Landing Page", vorb: "bereit", mit: ["Mark Beispiel", "Kathrin Muster"],
      briefing: { worum: "Landingpage und One-Pager abnehmen.", zuletzt: "Angebot am 7. Okt verschickt, Varianten One-Pager liegen bereit.", offen: [], tun: "Vorschau-Link und PDF sind vorbereitet." } },
    { tag: "Mi 14. Okt", von: "16:00", bis: "16:30", art: "Austausch", titel: "Kurzer Austausch Netzwerk", projekt: "", vorb: "keine", mit: ["Simon Beispiel"] },
    { tag: "Do 15. Okt", von: "11:00", bis: "12:00", art: "Kundentermin", titel: "VVDE Strategie – Status Quo", projekt: "VVDE Strategie", vorb: "noetig", mit: ["Daniel Muster"],
      briefing: { worum: "Stand der Strategiearbeit, nächste Schritte festlegen.", zuletzt: "Letzter Termin am 5. Okt, seitdem kein Kontakt.", offen: ["Zahlen zum Ist-Stand fehlen noch"], tun: "Kurz vorher per Mail die Zahlen anfragen (Entwurf liegt bereit)." } },
    { tag: "Fr 16. Okt", von: "09:30", bis: "12:30", art: "Workshop", titel: "MSP – Vertriebsprozess", projekt: "MSP Digitaler Vertrieb", vorb: "noetig", ort: "Büro MSP", mit: ["Mark Beispiel", "Kathrin Muster"],
      briefing: { worum: "Bausteine im Vertriebsprozess festlegen (Homepage, One-Pager, LinkedIn).", zuletzt: "One-Pager-Varianten abgestimmt, Entscheidung offen.", offen: ["Finale One-Pager-Variante wählen"], tun: "Prozessbild vorbereiten, Entscheidungsvorlage One-Pager mitbringen." } }
  ];
  var ART = { "Workshop": "w", "Kundentermin": "k", "Jour fixe": "j", "Austausch": "a" };

  function min(t) { var p = t.split(":"); return +p[0] * 60 + +p[1]; }
  function dauer(t) { var m = min(t.bis) - min(t.von); return m >= 60 ? (m / 60).toLocaleString("de-DE") + " h" : m + " min"; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }

  var std = T.reduce(function (s, t) { return s + (min(t.bis) - min(t.von)) / 60; }, 0);
  var ws = T.filter(function (t) { return t.art === "Workshop"; });
  var vorb = T.filter(function (t) { return t.vorb === "noetig"; });
  var h = '<div class="tk-woche"><div><b>' + T.length + "</b><span>Termine diese Woche</span></div>" +
    "<div><b>" + std.toLocaleString("de-DE") + " h</b><span>verplant</span></div>" +
    "<div><b>" + ws.length + "</b><span>Workshops (" + ws.reduce(function (s, t) { return s + (min(t.bis) - min(t.von)) / 60; }, 0) + " h)</span></div>" +
    '<div class="tk-achtung"><b>' + vorb.length + "</b><span>brauchen Vorbereitung</span></div></div>";

  var tage = [];
  T.forEach(function (t) { var d = tage.filter(function (x) { return x.tag === t.tag; })[0]; if (!d) { d = { tag: t.tag, t: [] }; tage.push(d); } d.t.push(t); });
  h += tage.map(function (d) {
    var last = d.t.reduce(function (s, t) { return s + (min(t.bis) - min(t.von)); }, 0) / 60;
    return '<section class="tk-tag"><h2>' + d.tag + '<span class="tk-last"><i style="--w:' + Math.min(100, last / 9 * 100) + '%"></i>' + last.toLocaleString("de-DE") + " h</span></h2>" +
      d.t.map(function (t) {
        var b = t.briefing, lang = min(t.bis) - min(t.von) >= 180;
        return '<details class="tk-t tk-' + ART[t.art] + (lang ? " tk-lang" : "") + '"' + (t.vorb === "noetig" && lang ? " open" : "") + "><summary>" +
          '<span class="tk-zeit"><b>' + t.von + "</b>" + t.bis + "<small>" + dauer(t) + "</small></span>" +
          '<span class="tk-mitte"><span class="tk-art">' + esc(t.art) + (t.projekt ? " · " + esc(t.projekt) : "") + "</span><b>" + esc(t.titel) + "</b>" +
          "<small>" + esc(t.mit.join(", ")) + (t.ort ? " · " + esc(t.ort) : "") + "</small></span>" +
          '<span class="tk-vorb tk-vorb--' + t.vorb + '">' + { noetig: "Vorbereitung nötig", bereit: "vorbereitet", keine: "" }[t.vorb] + "</span></summary>" +
          (b ? '<div class="tk-brief">' +
            "<div><h3>Worum es geht</h3><p>" + esc(b.worum) + "</p></div>" +
            "<div><h3>Zuletzt</h3><p>" + esc(b.zuletzt) + "</p></div>" +
            (b.offen.length ? "<div><h3>Offen</h3><ul>" + b.offen.map(function (o) { return "<li>" + esc(o) + "</li>"; }).join("") + "</ul></div>" : "") +
            '<div class="tk-tun"><h3>Vorbereitung</h3><p>' + esc(b.tun) + "</p></div>" +
            (t.reise ? "<div><h3>Reise</h3><p>" + esc(t.reise) + "</p></div>" : "") + "</div>" : "") + "</details>";
      }).join("") + "</section>";
  }).join("");
  wurzel.innerHTML = h;
})();
