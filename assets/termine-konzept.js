/* Termine – Konzept II (Beispieldaten, erfundene Namen).
   Ordnung nach Management-Fragen: Was braucht mich? (Vorbereitung) · Wie sieht die Woche aus? (Raster)
   · Wohin geht meine Zeit? (Projekte). Vorbilder: Tufte (Dichte ohne Klicks), Müller-Brockmann
   (Raster), Entwürfe II „Du bereitest vor“. Nichts muss aufgeklappt werden, um zu verstehen. */
(function () {
  "use strict";
  var wurzel = document.querySelector("[data-termine]");
  if (!wurzel) return;
  var TAGE = ["Mo 12.", "Di 13.", "Mi 14.", "Do 15.", "Fr 16."];
  var T = [
    { d: 0, von: "09:00", bis: "10:00", art: "intern", titel: "Jour fixe Team", projekt: "intern", mit: "Noah" },
    { d: 0, von: "14:00", bis: "15:30", art: "kunde", titel: "SV Akademie – Zwischenstand", projekt: "SV Akademie", mit: "A. Beispiel, M. Muster",
      vorb: "Folien um KI-Säule ergänzen, 3 Feedback-Fragen", bis_wann: "Mo 12:00", warum: "Sauerbrunn erwartet KI als Handlungsfeld" },
    { d: 1, von: "08:30", bis: "16:30", art: "workshop", titel: "Führungskreis-Workshop Leitbild", projekt: "SV Schadenmanagement", mit: "M. Probe + 9", ort: "Wiesbaden",
      vorb: "Agenda verschicken, Leitbilder clustern, Material bestellen", bis_wann: "heute", warum: "Agenda noch nicht raus – Workshop in 3 Tagen", dringend: true },
    { d: 2, von: "10:00", bis: "11:00", art: "kunde", titel: "MSP – Abnahme Landingpage", projekt: "MSP Landing Page", mit: "M. Beispiel, K. Muster", ok: true },
    { d: 2, von: "16:00", bis: "16:30", art: "intern", titel: "Austausch Netzwerk", projekt: "Netzwerk", mit: "S. Beispiel" },
    { d: 3, von: "11:00", bis: "12:00", art: "kunde", titel: "VVDE – Status Quo", projekt: "VVDE Strategie", mit: "D. Muster",
      vorb: "Ist-Zahlen anfragen (Mail-Entwurf liegt bereit)", bis_wann: "Di", warum: "seit 5. Okt kein Kontakt, Zahlen fehlen" },
    { d: 4, von: "09:30", bis: "12:30", art: "workshop", titel: "MSP – Vertriebsprozess", projekt: "MSP Digitaler Vertrieb", mit: "M. Beispiel, K. Muster", ort: "Büro MSP",
      vorb: "Prozessbild + Entscheidungsvorlage One-Pager", bis_wann: "Do", warum: "One-Pager-Variante noch offen" }
  ];
  function m(t) { var p = t.split(":"); return +p[0] * 60 + +p[1]; }
  function h(x) { return (Math.round(x * 10) / 10).toLocaleString("de-DE"); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  var std = function (t) { return (m(t.bis) - m(t.von)) / 60; };
  var gesamt = T.reduce(function (s, t) { return s + std(t); }, 0);
  var ws = T.filter(function (t) { return t.art === "workshop"; });
  var vorb = T.filter(function (t) { return t.vorb; });

  // 1 Lage in einem Satz
  var html = '<p class="tk2-lage">' + T.length + " Termine, " + h(gesamt) + " Stunden. Zwei Workshops binden <b>Dienstag</b> (ganztägig, Wiesbaden) und <b>Freitagvormittag</b>. " +
    "<b>" + vorb.length + " Termine brauchen Vorbereitung</b> – einer davon heute.</p>";

  // 2 Du bereitest vor  |  3 Wochenraster
  html += '<div class="tk2-zwei"><section><h2>Du bereitest vor</h2><ol class="tk2-vorb">' + vorb.sort(function (a, b) { return (b.dringend ? 1 : 0) - (a.dringend ? 1 : 0) || a.d - b.d; }).map(function (t) {
    return '<li' + (t.dringend ? ' class="dringend"' : "") + '><span class="tk2-bis">bis ' + esc(t.bis_wann) + "</span><div><b>" + esc(t.vorb) + "</b><small>" + esc(t.titel) + " · " + TAGE[t.d] + " " + t.von + "</small>" +
      '<small class="tk2-warum">' + esc(t.warum) + "</small></div>" +
      '<span class="tk2-akt"><button type="button">Claude bereitet vor</button><button type="button">Erledigt</button></span></li>';
  }).join("") + "</ol></section>";

  var START = 8, ENDE = 18, H = 44; // Pixel je Stunde
  html += '<section><h2>Woche 42</h2><div class="tk2-raster"><div class="tk2-achse">' +
    Array.from({ length: ENDE - START + 1 }, function (_, i) { return "<span style=\"top:" + i * H + 'px">' + (START + i) + "</span>"; }).join("") + "</div>" +
    TAGE.map(function (tag, d) {
      var ts = T.filter(function (t) { return t.d === d; });
      var last = ts.reduce(function (s, t) { return s + std(t); }, 0);
      return '<div class="tk2-tag"><p>' + tag + "<small>" + h(last) + " h</small></p><div class=\"tk2-spalte\" style=\"height:" + (ENDE - START) * H + 'px">' + ts.map(function (t) {
        var top = (m(t.von) / 60 - START) * H, hoehe = Math.max(std(t) * H - 3, 20);
        return '<div class="tk2-block tk2-' + t.art + (t.vorb ? " tk2-offen" : "") + '" style="top:' + top + "px;height:" + hoehe + 'px" title="' + esc(t.titel + " – " + t.mit) + '">' +
          "<b>" + esc(t.titel) + "</b>" + (hoehe > 40 ? "<small>" + t.von + "–" + t.bis + (t.ort ? " · " + esc(t.ort) : "") + "</small>" : "") + "</div>";
      }).join("") + "</div></div>";
    }).join("") + "</div>" +
    '<p class="tk2-legende"><span class="tk2-l tk2-workshop"></span>Workshop <span class="tk2-l tk2-kunde"></span>Kunde <span class="tk2-l tk2-intern"></span>Intern <span class="tk2-l tk2-offenp"></span>Vorbereitung offen</p></section></div>';

  // 4 Wohin geht die Zeit – nach Projekt
  var proj = {};
  T.forEach(function (t) { var p = proj[t.projekt] = proj[t.projekt] || { n: 0, h: 0, offen: 0, next: null }; p.n++; p.h += std(t); if (t.vorb) p.offen++; if (!p.next) p.next = TAGE[t.d] + " " + t.von; });
  html += '<section class="tk2-proj"><h2>Zeit nach Projekt</h2><table><thead><tr><th>Projekt</th><th>Termine</th><th>Stunden</th><th></th><th>Nächster</th><th>Vorbereitung</th></tr></thead><tbody>' +
    Object.keys(proj).sort(function (a, b) { return proj[b].h - proj[a].h; }).map(function (k) {
      var p = proj[k];
      return "<tr><td>" + esc(k) + "</td><td>" + p.n + "</td><td>" + h(p.h) + ' h</td><td class="tk2-balken"><i style="width:' + Math.round(p.h / gesamt * 100) + '%"></i></td><td>' + p.next + "</td><td>" +
        (p.offen ? '<b class="tk2-rot">' + p.offen + " offen</b>" : "–") + "</td></tr>";
    }).join("") + "</tbody></table></section>";
  wurzel.innerHTML = html;
})();
