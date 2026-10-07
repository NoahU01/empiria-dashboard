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

  var html = "";

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
      return '<div class="tk2-tag"><p>' + tag + "</p><div class=\"tk2-spalte\" style=\"height:" + (ENDE - START) * H + 'px">' + ts.map(function (t) {
        var top = (m(t.von) / 60 - START) * H, hoehe = Math.max(std(t) * H - 3, 20);
        return '<div class="tk2-block tk2-' + t.art + (t.vorb ? " tk2-offen" : "") + '" style="top:' + top + "px;height:" + hoehe + 'px" title="' + esc(t.titel + " – " + t.mit) + '">' +
          "<b>" + esc(t.titel) + "</b>" + (hoehe > 40 ? "<small>" + t.von + "–" + t.bis + (t.ort ? " · " + esc(t.ort) : "") + "</small>" : "") + "</div>";
      }).join("") + "</div></div>";
    }).join("") + "</div>" +
    '<p class="tk2-legende"><span class="tk2-l tk2-workshop"></span>Workshop <span class="tk2-l tk2-kunde"></span>Kunde <span class="tk2-l tk2-intern"></span>Intern <span class="tk2-l tk2-offenp"></span>Vorbereitung offen</p></section></div>';

  wurzel.innerHTML = html;
})();
