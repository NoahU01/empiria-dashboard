/* Skizzen zu den Methoden in der Workshop-Agenda (Daniel, 09.11.2026).
   Stil wie die Icons der empiria-Homepage: schwarze Kontur, runde Linienenden, keine Füllung.
   Farbe nur, wo sie eine Funktion hat (Klebepunkte grün, blau, rot). Aufruf: WorkshopBilder[schluessel] → SVG-Text. */
(function () {
  var S = 'fill="none" stroke="#1a1817" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"';
  function svg(inhalt, label) { return '<svg viewBox="0 0 160 112" role="img" aria-label="' + label + '"><g ' + S + ">" + inhalt + "</g></svg>"; }
  function karte(x, y, b, h) { return '<rect x="' + x + '" y="' + y + '" width="' + (b || 22) + '" height="' + (h || 12) + '" rx="1.5"/>'; }
  function punkt(x, y, farbe) { return '<circle cx="' + x + '" cy="' + y + '" r="3.4" fill="' + farbe + '" stroke="none"/>'; }
  // Metaplanwand: Tafel auf zwei Beinen mit Füßen
  function wand(x, y, b, h) {
    var l1 = x + b * 0.18, l2 = x + b * 0.82, u = y + h, f = 104;
    return '<rect x="' + x + '" y="' + y + '" width="' + b + '" height="' + h + '" rx="3"/>' +
      '<path d="M' + l1 + " " + u + "V" + f + "M" + (l1 - 7) + " " + f + "H" + (l1 + 7) + "M" + l2 + " " + u + "V" + f + "M" + (l2 - 7) + " " + f + "H" + (l2 + 7) + '"/>';
  }
  // Tabelle mit drei Spalten (Daniel, 09.11.2026): vorne die Kategorien nach unten, Ecke oben links leer, zwei Spalten nach rechts
  function tabelle(x, y, b, h, zeilen) {
    var k = b * 0.34, s = (b - k) / 2, kopf = h * 0.18, z = (h - kopf) / zeilen, d = "";
    d += '<rect x="' + x + '" y="' + y + '" width="' + b + '" height="' + h + '" rx="3"/>';
    var lin = "M" + (x + k) + " " + y + "V" + (y + h);
    for (var i = 1; i < 2; i++) lin += "M" + (x + k + s * i) + " " + y + "V" + (y + h);
    lin += "M" + x + " " + (y + kopf) + "H" + (x + b);
    for (var j = 1; j < zeilen; j++) lin += "M" + x + " " + (y + kopf + z * j) + "H" + (x + b);
    d += '<path d="' + lin + '"/>';
    var kp = "";   // Spaltenköpfe als kurze Striche, Ecke oben links bleibt leer
    for (var c = 0; c < 2; c++) { var cx = x + k + s * c + s / 2; kp += "M" + (cx - s * 0.28) + " " + (y + kopf / 2) + "H" + (cx + s * 0.28); }
    d += '<path d="' + kp + '" stroke-width="3"/>';
    for (var r = 0; r < zeilen; r++) d += karte(x + k * 0.16, y + kopf + z * r + z * 0.22, k * 0.68, z * 0.56);
    return d;
  }
  window.WorkshopBilder = {
    // Intro: Wand, links „beibehalten“ (Haken), rechts „ändern“ (Pfeile)
    intro: svg(wand(8, 6, 144, 80) +
      '<path d="M80 14V78" stroke-dasharray="3 5"/>' +
      '<path d="M37 21l4 4 8-9"/>' + '<path d="M106 17h18l-4-4M124 25h-18l4 4"/>' +
      karte(16, 34) + karte(44, 34) + karte(16, 52) + karte(44, 52) + karte(30, 68) +
      karte(94, 34) + karte(122, 34) + karte(94, 52) + karte(108, 68), "Metaplanwand: links beibehalten, rechts ändern"),
    // Stakeholder Map: Wand mit Achsenkreuz, Kärtchen mit grünen, blauen und roten Punkten
    stakeholder: svg(wand(8, 6, 144, 80) +
      '<path d="M80 80V14M76 18l4-4 4 4M16 47H146M142 43l4 4-4 4"/>' +
      karte(26, 20) + karte(98, 18) + karte(112, 58) + karte(30, 60) + karte(52, 30) + karte(84, 64),
      "Stakeholder Map mit Achsenkreuz und Klebepunkten").replace("</g></svg>",
      "</g>" + punkt(48, 21, "#059669") + punkt(120, 19, "#059669") + punkt(134, 59, "#2563eb") + punkt(52, 61, "#dc2626") + punkt(74, 31, "#2563eb") + punkt(106, 65, "#059669") + "</svg>"),
    // Problem und Lösung: Tabelle 1
    tabelle: svg(tabelle(8, 10, 144, 92, 3), "Tabelle mit drei Spalten: Kategorien nach unten, zwei Spalten nach rechts"),
    // Aufbauorganisation: Wand mit Organigramm
    organigramm: svg(wand(8, 6, 144, 80) +
      karte(66, 14, 28, 12) + '<path d="M80 26V34M34 34H126M34 34V42M80 34V42M126 34V42M34 54V62M126 54V62"/>' +
      karte(20, 42, 28, 12) + karte(66, 42, 28, 12) + karte(112, 42, 28, 12) + karte(20, 62, 28, 12) + karte(112, 62, 28, 12),
      "Metaplanwand mit Organigramm"),
    // Scheitern in drei Jahren: Wand mit geclusterten Kärtchen, Pfeil, Tabelle 2
    cluster: svg(wand(4, 8, 74, 70) +
      '<ellipse cx="24" cy="30" rx="15" ry="13" stroke-dasharray="3 4"/><ellipse cx="57" cy="32" rx="15" ry="13" stroke-dasharray="3 4"/><ellipse cx="40" cy="61" rx="17" ry="11" stroke-dasharray="3 4"/>' +
      karte(14, 22, 14, 8) + karte(20, 32, 14, 8) + karte(47, 24, 14, 8) + karte(53, 33, 14, 8) + karte(28, 56, 14, 8) + karte(40, 61, 14, 8) +
      '<path d="M82 43H92M88 39l4 4-4 4"/>' + tabelle(96, 14, 60, 64, 3), "Metaplanwand mit Clustern und Tabelle"),
    // Wrap-up: Sprechen – eine Sprechblase
    sprechen: svg('<g transform="translate(0 -12)"><path d="M44 26a8 8 0 0 1 8-8h56a8 8 0 0 1 8 8v32a8 8 0 0 1-8 8H72l-16 14V66h-4a8 8 0 0 1-8-8z"/>' +
      '<path d="M58 36H102M58 48H88"/></g>', "Gespräch: Feedback und weiteres Vorgehen")
  };
})();
