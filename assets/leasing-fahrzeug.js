/* Leasing Fahrzeug – Modelle zum Ansehen: je Modell ein großes Bild und drei Ansichten zum Umschalten, Klick aufs Bild öffnet die Großansicht.
   Daten: assets/leasing-fahrzeug.json (Fotos von Wikimedia Commons, Nachweis unten auf der Seite). */
(function () {
  var ziel = document.querySelector("[data-lf-modelle]");
  var nachweis = document.querySelector("[data-lf-nachweis]");
  if (!ziel) return;
  var esc = function (s) { return String(s || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var ANTRIEB = { E: "Elektro", PHEV: "Plug-in-Hybrid" };
  var euro = function (n) { return Math.round(n).toLocaleString("de-DE") + "\u00a0€"; };
  var fak = function (n) { return n == null ? "–" : n.toFixed(2).replace(".", ","); };
  // Budget: bis 250 € netto im Rahmen, bis 300 € zweite Stufe, darüber außerhalb
  function budget(r) {
    if (r <= 250) return '<span class="lf-budget lf-budget--1">bis 250 €</span>';
    if (r <= 300) return '<span class="lf-budget lf-budget--2">bis 300 €</span>';
    return '<span class="lf-budget lf-budget--3">über 300 €</span>';
  }
  /* Kosten aus privater Sicht (Daniels Logik, 15.10.2026):
     privat je Monat = Firmenkosten × 50 % (so viel bliebe nach Körperschaft- und Kapitalertragsteuer privat übrig)
                     + Listenpreis × 0,25 / 0,5 / 1 % × 35 % Einkommensteuer.
     Firmenkosten netto je Monat = Leasingrate + Überführung ÷ Laufzeit + Energie bei 10.000 km. Ohne Versicherung, Kfz-Steuer, Reparaturen. */
  var A = {};
  var SATZ = { E: 0.0025, PHEV: 0.005 };
  function satz(antrieb) { return SATZ[antrieb] || 0.01; }
  function energie(antrieb, v) {
    v = v || {};
    var km = A.km_jahr / 12 / 100, strom = A.strom_kwh, sprit = (antrieb === "Diesel" ? A.diesel_brutto : A.benzin_brutto) / 1.19;
    var kwh = v.real_kwh_100 || (v.kwh_100 ? v.kwh_100 * A.e_aufschlag : null);
    if (antrieb === "E") return kwh ? { betrag: km * kwh * strom, text: fz(kwh) + " kWh/100 km × " + fz(A.strom_kwh * 100, 0) + " ct" } : null;
    var l = A.verbrenner_l_100;
    if (antrieb === "PHEV") {
      var el = A.phev_kwh_100, anteil = A.phev_anteil_elektrisch;
      if (!el || !sprit) return null;
      return { betrag: km * (anteil * el * strom + (1 - anteil) * l * sprit),
        text: Math.round(anteil * 100) + " % elektrisch (" + fz(el, 0) + " kWh), " + Math.round((1 - anteil) * 100) + " % Benzin (" + fz(l, 0) + " l)" };
    }
    return sprit ? { betrag: km * l * sprit, text: fz(l, 0) + " l/100 km × " + fz(sprit, 2) + " € netto" } : null;
  }
  function rechne(a, antrieb, verbrauch) {
    var ueb = (a.ueberfuehrung_netto || 0) / (a.laufzeit || A.monate);
    var en = energie(antrieb, verbrauch);
    var firma = a.rate_netto + ueb + (en ? en.betrag : 0);
    var blp = Math.floor(a.blp_brutto / 100) * 100, gwv = blp * satz(antrieb);
    var privat = firma * A.anteil_privat_firmenkosten + gwv * A.steuersatz;
    return { ueb: ueb, en: en, firma: firma, gwv: gwv, blp: blp, steuer: gwv * A.steuersatz, privat: privat };
  }
  var fz = function (n, st) { st = st == null ? 1 : st; return Number(n).toLocaleString("de-DE", { minimumFractionDigits: st, maximumFractionDigits: st }); };
  var pz = function (x) { var v = Math.round(x * 10000) / 100; return (v % 1 ? fz(v, 2).replace(/0$/, "") : fz(v, 0)) + "\u00a0%"; };
  function kalkulation(a, antrieb, r) {
    var mo = A.monate;
    return '<details class="lf-kalk"><summary>Kalkulation ansehen</summary><table>' +
      '<tr class="lf-kalk-kopf"><th colspan="2">Firma, netto je Monat</th></tr>' +
      "<tr><td>Leasingrate</td><td>" + euro2(a.rate_netto) + "</td></tr>" +
      "<tr><td>Überführung " + euro(a.ueberfuehrung_netto || 0) + " ÷ " + (a.laufzeit || mo) + " Monate</td><td>" + euro2(r.ueb) + "</td></tr>" +
      "<tr><td>Energie, " + fz(A.km_jahr, 0) + " km im Jahr" + (r.en ? "<small>" + r.en.text + "</small>" : "<small>Verbrauch fehlt noch</small>") + "</td><td>" + (r.en ? euro2(r.en.betrag) : "–") + "</td></tr>" +
      '<tr class="lf-kalk-summe"><td>Firmenkosten</td><td>' + euro2(r.firma) + "</td></tr>" +
      '<tr class="lf-kalk-kopf"><th colspan="2">Privat je Monat</th></tr>' +
      "<tr><td>" + pz(A.anteil_privat_firmenkosten) + " der Firmenkosten<small>so viel bliebe sonst nach Steuern privat übrig</small></td><td>" + euro2(r.firma * A.anteil_privat_firmenkosten) + "</td></tr>" +
      "<tr><td>Versteuerung " + pz(satz(antrieb)) + " von " + euro(r.blp) + "<small>" + euro2(r.gwv) + " geldwerter Vorteil × " + pz(A.steuersatz) + "</small></td><td>" + euro2(r.steuer) + "</td></tr>" +
      '<tr class="lf-kalk-summe"><td>Kostet euch privat</td><td>' + euro2(r.privat) + "</td></tr>" +
      "<tr><td>über " + mo + " Monate</td><td>" + euro(r.privat * mo) + "</td></tr>" +
      "</table></details>";
  }
  var euro2 = function (n) { return fz(n, 2) + "\u00a0€"; };
  var DEZ = { ja: ["ja", "Bis 20.12. lieferbar"], knapp: ["knapp", "Lieferung knapp"], nein: ["nein", "Nicht bis 20.12."] };
  function angebot(a, antrieb, verbrauch) {
    var dz = DEZ[a.dezember] || DEZ.nein, r = rechne(a, antrieb, verbrauch);
    return '<div class="lf-angebot">' +
      '<p class="lf-privat"><b>' + euro(r.privat) + '</b> im Monat privat' + (r.en ? "" : " <small>(ohne Energie)</small>") + "</p>" +
      '<p class="lf-rate">Leasing ' + euro(a.rate_netto) + " netto · Faktor " + fak(a.leasingfaktor) + " · Versteuerung\u00a0" + pz(satz(antrieb)) + "</p>" +
      '<p class="lf-zeile lf-dez lf-dez--' + dz[0] + '">' + dz[1] + ": " + esc(a.lieferung) + "</p>" +
      kalkulation(a, antrieb, r) +
      '<p class="lf-zeile lf-version">' + esc(a.version_ausstattung) + " · " + a.laufzeit + "\u00a0Monate · " + fz((a.km_jahr || 10000), 0) + "\u00a0km im Jahr · Liste " + euro(a.blp_brutto) + (a.pflicht_erfuellt && a.pflicht_erfuellt !== "ja" ? " · Pflichtausstattung " + esc(a.pflicht_erfuellt) : "") + "</p>" +
      '<a class="lf-link" href="' + esc(a.url) + '" target="_blank" rel="noopener">' + esc(a.anbieter) + " ↗</a>" +
      // leasingmarkt.de startet immer mit 5.000 km – per Link nicht vorwählbar (geprüft 15.10.2026)
      (/leasingmarkt\.de/.test(a.url || "") ? '<p class="lf-zeile lf-km-hinweis">Auf der Seite oben 10.000\u00a0km/Jahr wählen – sie startet mit 5.000\u00a0km.</p>' : "") + "</div>";
  }
  function deal(x, i) {
    var r = rechne(x, x.antrieb, x.verbrauch);
    return '<article class="lf-deal" id="lf-deal-' + i + '">' +
      '<p class="lf-deal-kopf">' + esc(x.marke) + " · " + esc(x.antrieb_text || ANTRIEB[x.antrieb]) + (x.in_liste ? "" : " · nicht auf unserer Liste") + "</p>" +
      "<h3>" + esc(x.modell) + "</h3>" +
      '<p class="lf-deal-rate"><b>' + euro(r.privat) + "</b> im Monat privat</p>" +
      '<p class="lf-deal-faktor">Leasing ' + euro(x.rate_netto) + " netto · Faktor <b>" + fak(x.leasingfaktor) + "</b> · Versteuerung " + pz(satz(x.antrieb)) + " · " + x.laufzeit + "\u00a0Monate · Liste " + euro(x.blp_brutto) + "</p>" +
      "<dl><div><dt>Lieferung</dt><dd>" + esc(x.lieferung) + "</dd></div>" +
      "<div><dt>Warum so günstig</dt><dd>" + esc(x.warum_so_gut) + (x.beleg_url ? ' <a href="' + esc(x.beleg_url) + '" target="_blank" rel="noopener">Beleg ↗</a>' : "") + "</dd></div>" +
      "<div><dt>Haken</dt><dd>" + esc(x.haken) + "</dd></div>" +
      (x.hinweis ? "<div><dt>Hinweis</dt><dd>" + esc(x.hinweis) + "</dd></div>" : "") + "</dl>" +
      kalkulation(x, x.antrieb, r) +
      '<a class="lf-link" href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.anbieter) + " ↗</a></article>";
  }

  fetch("/assets/leasing-fahrzeug.json?v=202610151800").then(function (r) { return r.json(); }).then(function (d) {
    A = d.annahmen || {};
    var vergleich = document.querySelector("[data-lf-vergleich]");
    if (vergleich) {
      var zeilen = [], gesehen = {};
      d.modelle.forEach(function (m) {
        if (!m.angebot) return;
        gesehen[m.angebot.url] = 1;
        zeilen.push({ name: m.marke + " " + m.modell, ziel: "#lf-" + m.id, a: m.angebot, antrieb: m.antrieb, r: rechne(m.angebot, m.antrieb, m.verbrauch) });
      });
      (d.deals || []).forEach(function (x, i) {
        if (gesehen[x.url]) return;
        zeilen.push({ name: x.marke + " " + x.kurzname, ziel: "#lf-deal-" + i, a: x, antrieb: x.antrieb, r: rechne(x, x.antrieb, x.verbrauch), deal: true });
      });
      zeilen.sort(function (p, q) { return p.r.privat - q.r.privat; });
      vergleich.innerHTML = '<table class="lf-vgl"><thead><tr><th>Modell</th><th>Privat im Monat</th><th>Leasing netto</th><th class="lf-vgl-mehr">Faktor</th><th class="lf-vgl-mehr">Versteuerung</th><th class="lf-vgl-mehr">Bis 20.12.</th></tr></thead><tbody>' +
        zeilen.map(function (z) {
          return '<tr><td><a href="' + z.ziel + '">' + esc(z.name) + "</a>" + (z.deal ? " <small>Deal</small>" : "") + (z.r.en ? "" : " <small>ohne Energie</small>") + "</td>" +
            "<td><b>" + euro(z.r.privat) + "</b></td><td>" + euro(z.a.rate_netto) + "</td>" +
            '<td class="lf-vgl-mehr">' + fak(z.a.leasingfaktor) + '</td><td class="lf-vgl-mehr">' + pz(satz(z.antrieb)) + "</td>" +
            '<td class="lf-vgl-mehr">' + (z.a.dezember === "ja" ? "✓" : z.a.dezember === "knapp" ? "knapp" : "–") + "</td></tr>";
        }).join("") + "</tbody></table>" +
        '<details class="lf-annahmen"><summary>So rechnen wir</summary><ul>' +
        "<li><b>Privat je Monat</b> = " + pz(A.anteil_privat_firmenkosten) + " der Firmenkosten + Versteuerung der Privatnutzung. Die " + pz(A.anteil_privat_firmenkosten) + " stehen für das, was von jedem Firmen-Euro nach Körperschaft- und Kapitalertragsteuer privat ankäme.</li>" +
        "<li><b>Firmenkosten netto</b> = Leasingrate + Überführung ÷ Laufzeit + Energie bei " + fz(A.km_jahr, 0) + " km im Jahr.</li>" +
        "<li><b>Versteuerung</b>: Listenpreis (abgerundet auf volle 100 €) × 0,25 % Elektro, 0,5 % Plug-in-Hybrid, 1 % Benzin/Diesel/Hybrid, davon " + pz(A.steuersatz) + " Einkommensteuer. Kein Arbeitsweg, also kein Zuschlag.</li>" +
        "<li><b>Energie</b>: Strom " + fz(A.strom_kwh * 100, 0) + " ct/kWh (ohne Vorsteuer, weil zu Hause geladen). Elektroautos: Verbrauch aus dem <a href=\"" + esc(A.verbrauch_quelle) + "\" target=\"_blank\" rel=\"noopener\">ADAC Ecotest</a>, wo vorhanden, sonst WLTP plus " + Math.round((A.e_aufschlag - 1) * 100) + " % (so weit lagen die getesteten Modelle über WLTP). Plug-in-Hybrid: " + Math.round(A.phev_anteil_elektrisch * 100) + " % der Strecke elektrisch mit " + fz(A.phev_kwh_100, 0) + " kWh/100 km, der Rest mit Benzin. Benzin/Diesel " + fz(A.verbrenner_l_100, 0) + " l/100 km" + (A.benzin_brutto ? " zu " + fz(A.benzin_brutto, 2) + " € (Super E10) bzw. " + fz(A.diesel_brutto, 2) + " € (Diesel) brutto, <a href=\"" + esc(A.kraftstoff_quelle) + "\" target=\"_blank\" rel=\"noopener\">Stand " + esc(A.kraftstoff_datum) + "</a>, in der Firma netto" : "") + ".</li>" +
        "<li><b>Nicht enthalten</b>: Versicherung, Kfz-Steuer, Reparaturen, Sozialversicherung auf den geldwerten Vorteil, Umsatzsteuer auf die Privatnutzung.</li>" +
        "<li>Betrachtet werden " + A.monate + " Monate; Angebote mit 48 Monaten gehen mit ihrer Monatsrate ein.</li></ul></details>";
    }
    var dealsZiel = document.querySelector("[data-lf-deals]");
    if (dealsZiel && d.deals) {
      var mk = d.markt || {};
      dealsZiel.innerHTML = '<p class="lf-unter">Marktniveau im Gewerbeleasing heute: Elektro Faktor ' + fak(mk.ev_median) + ", Plug-in-Hybrid " + fak(mk.phev_median) +
        " (Median, Stichprobe von rund 180 Angeboten auf leasingmarkt.de, Stand " + esc(d.stand) + "). Hier steht nur, was klar darunter liegt. Bei Elektro und Plug-in-Hybrid gibt es im Suchprofil gerade keinen Ausreißer um 0,3, bei Benzinern schon. Wegen der 1-%-Versteuerung kosten sie privat aber nicht weniger als die günstigen Elektroautos.</p>" +
        '<div class="lf-deals">' + d.deals.map(function (x, i) { return deal(x, i); }).join("") + "</div>";
    }
    // Karten nach Kosten aus privater Sicht aufsteigend (Daniel, 15.10.2026); Modelle ohne Angebot ans Ende
    var privat = function (m) { return m.angebot ? rechne(m.angebot, m.antrieb, m.verbrauch).privat : Infinity; };
    var sortiert = d.modelle.slice().sort(function (p, q) { return privat(p) - privat(q); });
    var html = '<div class="lf-raster">', offen = true, quellen = [];
    sortiert.forEach(function (m) {
      var b = m.bilder || [], name = m.marke + " " + m.modell;
      html += '<article class="lf-karte" id="lf-' + esc(m.id) + '" data-lf-karte>';
      if (b.length) {
        html += '<button class="lf-bild" type="button" data-lf-gross aria-label="' + esc(name) + ' groß ansehen" style="--lf-hg: url(&quot;' + esc(b[0].klein) + '&quot;)">' +
          '<img src="' + esc(b[0].gross) + '" alt="' + esc(name) + '" loading="lazy" data-voll="' + esc(b[0].voll) + '"></button>';
        if (b.length > 1) {
          html += '<div class="lf-ansichten">' + b.map(function (x, i) {
            return '<button type="button" aria-pressed="' + (i === 0) + '" aria-label="Ansicht ' + (i + 1) + '" data-gross="' + esc(x.gross) + '" data-klein="' + esc(x.klein) + '" data-voll="' + esc(x.voll) + '">' +
              '<img src="' + esc(x.klein) + '" alt="" loading="lazy"></button>';
          }).join("") + "</div>";
        }
        b.forEach(function (x) { quellen.push({ name: name, x: x }); });
      } else {
        html += '<div class="lf-leer">Noch keine freien Fotos gefunden</div>';
      }
      html += '<div class="lf-text"><h3><small>' + esc(m.marke) + "</small>" + esc(m.modell) + "</h3>" +
        '<span class="lf-antrieb' + (m.antrieb === "E" ? " lf-antrieb--e" : "") + '">' + esc(ANTRIEB[m.antrieb] || m.antrieb) + "</span></div>" +
        (m.notiz ? '<p class="lf-notiz">' + esc(m.notiz) + "</p>" : "") +
        (m.eckdaten && (m.eckdaten.reichweite_km || m.eckdaten.kofferraum_l) ? '<p class="lf-notiz">' +
          [m.eckdaten.reichweite_km ? m.eckdaten.reichweite_km + " km " + (m.antrieb === "PHEV" ? "elektrisch" : "WLTP") : "", m.eckdaten.kofferraum_l ? m.eckdaten.kofferraum_l + " l Kofferraum" : ""].filter(Boolean).join(" · ") + "</p>" : "") +
        (m.angebot ? angebot(m.angebot, m.antrieb, m.verbrauch) : '<div class="lf-angebot lf-angebot--leer"><p class="lf-zeile">' + esc(m.bewertung || "Noch kein Angebot gesucht") + "</p></div>") +
        (m.angebot_dez ? '<details class="lf-alt"><summary>Bis 20.12. lieferbar: ' + euro(m.angebot_dez.rate_netto) + " netto · privat " + euro(rechne(m.angebot_dez, m.antrieb, m.verbrauch).privat) + "</summary>" + angebot(m.angebot_dez, m.antrieb, m.verbrauch) + "</details>" : "") +
        "</article>";
    });
    if (offen) html += "</div>";
    ziel.innerHTML = html;

    if (nachweis) {
      nachweis.innerHTML = "<details><summary>Bildnachweis – Fotos von Wikimedia Commons</summary><ul>" + quellen.map(function (q) {
        return '<li>' + esc(q.name) + ': <a href="' + esc(q.x.seite) + '" target="_blank" rel="noopener">' + esc(q.x.urheber || "unbekannt") + "</a>, " + esc(q.x.lizenz) + "</li>";
      }).join("") + "</ul></details>";
    }
  }).catch(function () { ziel.innerHTML = '<p class="lf-unter">Die Modelle konnten nicht geladen werden.</p>'; });

  // Ansicht umschalten
  ziel.addEventListener("click", function (e) {
    var t = e.target.closest(".lf-ansichten button");
    if (t) {
      var karte = t.closest("[data-lf-karte]"), img = karte.querySelector(".lf-bild img");
      img.src = t.getAttribute("data-gross"); img.setAttribute("data-voll", t.getAttribute("data-voll"));
      img.parentNode.style.setProperty("--lf-hg", 'url("' + t.getAttribute("data-klein") + '")');
      karte.querySelectorAll(".lf-ansichten button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === t)); });
      return;
    }
    var g = e.target.closest("[data-lf-gross]");
    if (g) zeigeGross(g.closest("[data-lf-karte]"));
  });

  // Großansicht
  var dlg = document.createElement("dialog");
  dlg.className = "lf-gross";
  dlg.innerHTML = '<img alt=""><div class="lf-gross-leiste"><span></span><button type="button">Schließen</button></div>';
  document.body.appendChild(dlg);
  dlg.querySelector("button").addEventListener("click", function () { dlg.close(); });
  dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
  function zeigeGross(karte) {
    var img = karte.querySelector(".lf-bild img");
    dlg.querySelector("img").src = img.getAttribute("data-voll");
    dlg.querySelector("img").alt = img.alt;
    dlg.querySelector("span").textContent = img.alt;
    dlg.showModal();
  }
})();
