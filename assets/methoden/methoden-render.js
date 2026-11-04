/* Methodenkoffer – baut Kacheln, Fenster und Arbeitsblätter aus window.METHODEN (assets/methoden/methoden.js).
   Dieselbe Datei läuft im Dashboard und auf den Kundenseiten – so sehen die Methoden überall gleich aus.
   Aufruf (vor script.js, damit die Fenster beim Laden erkannt werden):
     MethodenKoffer.einsetzen({ kacheln: Element, fenster: Element, auswahl: [ids] | null,
                                intern: false, dateien: "/assets/methoden/dateien/" }) */
(function () {
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fensterId(m) { return "methode-" + m.id; }
  function icon(m) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + m.icon + "</svg>"; }
  function kachel(m) {
    return '<li><button type="button" class="u3-methode" data-modal-target="' + fensterId(m) + '"><span class="u3-m-ic">' + icon(m) + "</span><b>" +
      esc(m.titel) + "</b><small>" + esc(m.kurz) + "</small></button></li>";
  }
  // Arbeitsblätter: Dokumente zur Methode; intern = nur im Dashboard
  function blaetter(m, opt) {
    var bl = (m.arbeitsblaetter || []).filter(function (b) { return opt.intern || !b.intern; });
    if (!bl.length) return "";
    return '<div class="mk-blaetter"><p class="mk-blaetter__titel">Arbeitsblätter</p><div class="mk-blaetter__liste">' + bl.map(function (b) {
      var url = opt.dateien + encodeURIComponent(b.datei), endung = (String(b.datei).split(".").pop() || "").toUpperCase();
      return '<div class="mk-blatt">' +
        (b.bild ? '<a class="mk-blatt__bild" href="' + url + '" target="_blank" rel="noopener"><img src="' + opt.dateien + encodeURIComponent(b.bild) + '" alt="" loading="lazy"></a>'
                : '<a class="mk-blatt__ohne" href="' + url + '" target="_blank" rel="noopener">' + esc(endung) + "</a>") +
        "<div>" + (b.art ? '<span class="mk-blatt__art">' + esc(b.art) + "</span>" : "") +
        "<b>" + esc(b.titel) + (b.intern ? '<span class="mk-blatt__intern">intern</span>' : "") + "</b>" +
        (b.text ? "<small>" + esc(b.text) + "</small>" : "") +
        '<span class="mk-blatt__knoepfe"><a href="' + url + '" target="_blank" rel="noopener">Öffnen</a><a href="' + url + '" download>Herunterladen</a></span>' +
        "</div></div>";
    }).join("") + "</div></div>";
  }
  function fenster(m, opt) {
    return '<div class="modal-overlay" id="' + fensterId(m) + '" data-generic><div class="' + esc(m.wrapKlasse) + '">' +
      '<button class="modal-close" aria-label="Schließen">&times;</button><div class="' + esc(m.modalKlasse) + '">' +
      '<div class="' + esc(m.kopfKlasse) + '"><h3>' + esc(m.titel) + "</h3><p>" + esc(m.untertitel) + "</p></div>" +
      m.inhalt + blaetter(m, opt) + "</div></div></div>";
  }
  window.MethodenKoffer = {
    einsetzen: function (opt) {
      opt = opt || {};
      opt.dateien = opt.dateien || "/assets/methoden/dateien/";
      var liste = (window.METHODEN || []).filter(function (m) { return !opt.auswahl || opt.auswahl.indexOf(m.id) > -1; });
      if (opt.auswahl) liste.sort(function (a, b) { return opt.auswahl.indexOf(a.id) - opt.auswahl.indexOf(b.id); });
      if (opt.kacheln) opt.kacheln.innerHTML = liste.map(kachel).join("");
      if (opt.fenster) opt.fenster.innerHTML = liste.map(function (m) { return fenster(m, opt); }).join("");
      return liste;
    }
  };
})();
