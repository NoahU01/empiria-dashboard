/* Angefragte Fahrzeuge (Daniel, 22.11.2026) – Übersicht oben auf „Leasing Fahrzeug“ und Einzelseite je Fahrzeug.
   Daten: Tabelle leasing_anfragen (nur mit Anmeldung). Stand und Verlauf pflegt die stündliche Überwachung
   (~/AlwaysOn/outlook/leasing_anfragen.py); Konditionen trägt Claude per Ticket ein, sobald ein Händler antwortet.
   Kosten aus privater Sicht wie auf der übrigen Seite: 50 % der Firmenkosten + Versteuerung × 35 %, Energie bei 7.500 km. */
(function () {
  "use strict";
  var db = window.empiriaDb;
  var uebersicht = document.querySelector("[data-la-uebersicht]"), detail = document.querySelector("[data-la-detail]");
  if (!db || (!uebersicht && !detail)) return;
  var ziel = uebersicht || detail;
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); };
  var fz = function (n, st) { st = st == null ? 0 : st; return Number(n).toLocaleString("de-DE", { minimumFractionDigits: st, maximumFractionDigits: st }); };
  var euro = function (n) { return n == null ? "–" : fz(Math.round(n)) + " €"; };
  var euro2 = function (n) { return n == null ? "–" : fz(n, 2) + " €"; };
  var datum = function (d, zeit) {
    if (!d) return "–";
    var x = new Date(d);
    return x.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: zeit ? undefined : "numeric" }) +
      (zeit ? ", " + x.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr" : "");
  };
  var KM = 7500, A = { strom_kwh: 0.3, e_aufschlag: 1.18, phev_kwh_100: 17, phev_anteil_elektrisch: 0.8, verbrenner_l_100: 7, benzin_brutto: 1.938, anteil_privat_firmenkosten: 0.5, steuersatz: 0.35 };
  var STAND = {
    angefragt: ["Angefragt", "offen"], bestaetigt: ["Eingang bestätigt", "offen"], antwort: ["Antwort da – wird ausgewertet", "neu"],
    angebot: ["Angebot liegt vor", "gut"], rueckfrage: ["Rückfrage an dich", "neu"], reserviert: ["Anderweitig reserviert", "offen"], entwurf: ["Entwurf – bitte senden", "warn"]
  };
  var AUSWAHL = { offen: "noch offen", weiter: "Weiter interessant", raus: "Raus" };

  function satz(z) { return z.antrieb === "E" ? 0.0025 : z.antrieb === "PHEV" ? 0.005 : 0.01; }
  function energie(z) {
    var km = KM / 12 / 100;
    if (z.antrieb === "E") return z.verbrauch_kwh ? km * z.verbrauch_kwh * A.e_aufschlag * A.strom_kwh : null;
    var sprit = A.benzin_brutto / 1.19;
    if (z.antrieb === "PHEV") return km * (A.phev_anteil_elektrisch * A.phev_kwh_100 * A.strom_kwh + (1 - A.phev_anteil_elektrisch) * A.verbrenner_l_100 * sprit);
    return km * A.verbrenner_l_100 * sprit;
  }
  function firmaMonat(a) {
    if (a.monatskosten_netto != null) return a.monatskosten_netto;
    if (a.rate_netto == null) return null;
    return a.rate_netto + ((a.ueberfuehrung_netto || 0) + (a.anzahlung_netto || 0)) / (a.laufzeit || 36);
  }
  function rechne(z, a) {
    var f = firmaMonat(a); if (f == null) return null;
    var en = energie(z), firma = f + (en || 0);
    var r = { firma: firma, energie: en, monat: f };
    if (z.blp_brutto) { r.blp = Math.floor(z.blp_brutto / 100) * 100; r.steuer = r.blp * satz(z) * A.steuersatz; r.privat = firma * A.anteil_privat_firmenkosten + r.steuer; }
    return r;
  }
  function bestes(z) {
    var b = null;
    (z.angebote || []).forEach(function (a) {
      var r = rechne(z, a); if (!r) return;
      var w = r.privat != null ? r.privat : r.firma;
      if (!b || w < b.w || (b.a.quelle === "Inserat" && a.quelle !== "Inserat")) b = { a: a, r: r, w: w };
    });
    return b;
  }
  function klein(u) {
    if (!u) return null;
    if (/autoscout24\.net/.test(u)) return u.replace(/\/\d+x\d+\.jpg$/, "/250x188.jpg");
    if (/vtpimages\.audi\.com/.test(u)) return u.replace(/\?im=.*$/, "") + "?im=Resize,width=240,height=180";
    return u;
  }
  function ezText(z) { return /^\d/.test(z.ez || "") ? "EZ " + esc(z.ez) : esc(z.ez || ""); }
  function pflichtFehlt(z) { return Object.keys(z.pflicht || {}).filter(function (k) { return z.pflicht[k] !== "ja"; }); }
  function tageSeit(d) { return Math.floor((Date.now() - new Date(d).getTime()) / 86400000); }
  function werktageSeit(d) {
    var n = 0, x = new Date(d); x.setHours(12, 0, 0, 0); var heute = new Date(); heute.setHours(12, 0, 0, 0);
    while (x < heute) { x.setDate(x.getDate() + 1); if (x.getDay() !== 0 && x.getDay() !== 6) n++; }
    return n;
  }
  function standChip(z) {
    var s = STAND[z.stand] || [z.stand, "offen"], extra = "";
    if ((z.stand === "angefragt" || z.stand === "bestaetigt") && werktageSeit(z.gesendet_am) >= 2) { s = [s[0] + " · nachfassen", "warn"]; }
    return '<span class="la-chip la-chip--' + s[1] + '">' + esc(s[0]) + "</span>" + extra;
  }
  function auswahlChip(z) { return '<span class="la-wahl la-wahl--' + esc(z.auswahl) + '">' + esc(AUSWAHL[z.auswahl] || z.auswahl) + "</span>"; }

  db.auth.getSession().then(function (s) {
    if (!s.data.session) {
      ziel.innerHTML = '<div class="kb-hinweis"><p>Bitte einmal auf der <a href="/strategie/kontakte.html?zurueck=' + encodeURIComponent(location.pathname + location.search) + '">Kontaktseite</a> anmelden, dann erscheinen hier die angefragten Fahrzeuge.</p></div>';
      return;
    }
    fetch("/assets/leasing-fahrzeug.json?v=202611212000").then(function (r) { return r.json(); }).then(function (d) {
      Object.keys(d.annahmen || {}).forEach(function (k) { if (A[k] != null) A[k] = d.annahmen[k]; });
    }).catch(function () {}).then(laden);
  });

  function laden() {
    var abfrage = db.from("leasing_anfragen").select("*").order("reihenfolge");
    if (detail) abfrage = abfrage.eq("id", Number(new URLSearchParams(location.search).get("id")));
    abfrage.then(function (r) {
      if (r.error) { ziel.innerHTML = '<p class="la-fehler">Die Anfragen konnten nicht geladen werden: ' + esc(r.error.message) + "</p>"; return; }
      if (uebersicht) zeichneUebersicht(r.data || []);
      else if (r.data && r.data[0]) zeichneDetail(r.data[0]);
      else ziel.innerHTML = '<p class="la-fehler">Dieses Fahrzeug gibt es nicht (mehr). <a href="/strategie/leasing-fahrzeug.html">Zur Übersicht</a></p>';
    });
  }

  /* ---------- Übersicht ---------- */
  function zeichneUebersicht(alle) {
    // Vergleichszeile „Unser ID.3 heute“ (art 'bestand') steht getrennt oben und zählt nicht zu den Anfragen
    var bestand = alle.filter(function (z) { return z.art === "bestand"; });
    var liste = alle.filter(function (z) { return z.art !== "bestand"; });
    if (!liste.length) { uebersicht.innerHTML = '<p class="lf-unter">Noch keine Anfragen.</p>'; return; }
    var n = function (f) { return liste.filter(f).length; };
    var geprueft = liste.reduce(function (m, z) { return z.geprueft_am && (!m || z.geprueft_am > m) ? z.geprueft_am : m; }, null);
    var RANG = { weiter: 0, offen: 1, raus: 2 }, SR = { rueckfrage: 0, angebot: 1, antwort: 2, reserviert: 3, bestaetigt: 4, angefragt: 5, entwurf: 6 };
    // Reihenfolge (Daniel, 23.11.2026): Golf-Hybride zuerst, dann alle anderen; je Gruppe die günstigste Variante (privat) oben, „Raus“ ans Ende
    var golf = function (z) { return /golf|leon/i.test(z.modell || z.titel) && z.antrieb === "PHEV"; };  // Golf und Cupra Leon e-Hybrid (gleiche Technik)
    var guenstig = function (z) { var b = bestes(z); return b ? (b.r.privat != null ? b.r.privat : b.r.firma) : Infinity; };
    liste.sort(function (a, b) { return ((a.auswahl === "raus") - (b.auswahl === "raus")) || (golf(b) - golf(a)) || (guenstig(a) - guenstig(b)) || (a.reihenfolge - b.reihenfolge); });
    var kopf = '<div class="la-lage">' +
      '<p><b>' + n(function (z) { return z.stand !== "entwurf"; }) + "</b> angefragt</p>" +
      (n(function (z) { return z.stand === "entwurf"; }) ? "<p><b>" + n(function (z) { return z.stand === "entwurf"; }) + "</b> als Entwurf, noch senden</p>" : "") +
      "<p><b>" + n(function (z) { return z.stand === "angebot"; }) + "</b> mit Angebot</p>" +
      "<p><b>" + n(function (z) { return z.stand === "antwort" || z.stand === "rueckfrage"; }) + "</b> Antwort in Arbeit</p>" +
      "<p><b>" + n(function (z) { return z.stand === "bestaetigt"; }) + "</b> nur Eingangsbestätigung</p>" +
      (n(function (z) { return z.stand === "reserviert"; }) ? "<p><b>" + n(function (z) { return z.stand === "reserviert"; }) + "</b> anderweitig reserviert</p>" : "") +
      "<p><b>" + n(function (z) { return z.stand === "angefragt"; }) + "</b> ohne Rückmeldung</p>" +
      '<p class="la-geprueft">Postfach zuletzt geprüft: ' + esc(datum(geprueft, true)) + " · stündlich</p></div>";
    var gruppe = null;
    var zeilen = liste.map(function (z) {
      var g = z.auswahl === "raus" ? "Aussortiert" : golf(z) ? "Golf-Hybride und Cupra Leon" : "Weitere Fahrzeuge", kopfzeile = "";
      if (g !== gruppe) { gruppe = g; kopfzeile = '<tr class="la-gruppe-zeile"><td colspan="8">' + esc(g) + "</td></tr>"; }
      var b = bestes(z), fehlt = pflichtFehlt(z);
      // je Art (Leasing, 3-Wege) das günstigste Angebot: Kosten der GmbH je Monat (bei 3-Wege inkl. Anzahlung, Vorsteuer, Umsatzsteuer auf die Schlussrate)
      var jeArt = {};
      (z.angebote || []).forEach(function (a) {
        var k = a.art === "Leasing" ? "Leasing" : "3-Wege", w = firmaMonat(a);
        if (w == null) return;
        if (!jeArt[k] || w < jeArt[k].w || (jeArt[k].a.quelle === "Inserat" && a.quelle !== "Inserat")) jeArt[k] = { a: a, w: w };
      });
      var wert = function (k) { var r = rechne(z, jeArt[k].a); return r ? (r.privat != null ? r.privat : r.firma) : Infinity; };
      var reihe = ["Leasing", "3-Wege"].filter(function (k) { return jeArt[k]; }).sort(function (p, q) { return wert(p) - wert(q); });
      var ang = reihe.map(function (k) {
        var x = jeArt[k];
        return '<span class="la-angebot"><b>' + euro(x.w) + "</b> " + k + " · " + (x.a.laufzeit || "?") + "\u00a0Mon." + (x.a.quelle === "Händlerangebot" ? "" : " · laut Inserat") + "</span>";
      }).join("") || '<span class="la-leer">offen</span>';
      // je Variante die Kosten aus privater Sicht – auf gleicher Höhe wie „Monatlich netto“; die günstigere fett
      var arten = reihe;
      var pw = arten.map(function (k) { var r = rechne(z, jeArt[k].a); return { k: k, p: r && r.privat != null ? r.privat : null }; });
      var min = pw.reduce(function (m, x) { return x.p != null && (m == null || x.p < m) ? x.p : m; }, null);
      var privat = !pw.length ? '<span class="la-leer">offen</span>' : pw.map(function (x) {
        return '<span class="la-angebot la-pv' + (x.p != null && x.p === min ? " la-best" : "") + '">' + (x.p != null ? "<b>" + euro(x.p) + "</b> " : '<span class="la-leer">Liste fehlt</span> ') + x.k + "</span>";
      }).join("");
      return kopfzeile + '<tr class="la-z la-z--' + esc(z.auswahl) + '">' +
        '<td>' + (z.bild_url ? '<img class="la-nur-mobil la-daumen" src="' + esc(klein(z.bild_url)) + '" alt="" loading="lazy">' : "") + '<a href="/strategie/leasing-anfrage.html?id=' + z.id + '">' + esc(z.titel) + '</a><small class="la-unter">' + ezText(z) + " · " + fz(z.km_stand) + " km" + (z.preis_inserat ? " · " + euro(z.preis_inserat) : "") + '</small><small class="la-unter la-nur-mittel">' + esc(z.haendler) + ", " + esc(z.ort) + '</small><span class="la-nur-klein la-chips">' + standChip(z) + auswahlChip(z) + "</span></td>" +
        '<td class="la-bildzelle">' + (z.bild_url ? '<a href="/strategie/leasing-anfrage.html?id=' + z.id + '" tabindex="-1"><img src="' + esc(klein(z.bild_url)) + '" alt="" loading="lazy"></a>' : "") + "</td>" +
        '<td class="la-mehr la-breit">' + esc(z.haendler) + '<small class="la-unter">' + esc(z.ort) + (z.fahrzeit ? " · " + esc(z.fahrzeit) : "") + "</small></td>" +
        '<td class="la-stand">' + standChip(z) + '<span class="la-nur-mobil">' + auswahlChip(z) + "</span></td>" +
        '<td class="la-mittel">' + ang + "</td>" +
        "<td>" + privat + '<small class="la-unter">' + esc(z.antrieb === "E" ? "0,25\u00a0%" : z.versteuerung && /Bescheinigung/.test(z.versteuerung) ? "0,5\u00a0% mit Bescheinigung" : "0,5\u00a0%") + (z.blp_brutto && /geschätzt/.test(z.blp_quelle || "") ? " · Liste geschätzt" : "") + "</small></td>" +
        '<td class="la-mehr la-breit">' + (fehlt.length ? '<span class="la-fehlt">' + esc(fehlt.join(", ")) + " nicht aufgeführt</span>" : "✓ alle") + "</td>" +
        '<td class="la-mehr">' + auswahlChip(z) + "</td></tr>";
    }).join("");
    uebersicht.innerHTML = kopf +
      '<div class="la-tabelle"><table class="lf-vgl la-vgl la-ueb"><thead><tr><th>Fahrzeug</th><th class="la-bildzelle"><span class="la-sr">Bild</span></th><th class="la-mehr la-breit">Händler</th><th class="la-stand">Stand</th><th class="la-mittel">Monatlich netto</th><th>Privat im Monat</th><th class="la-mehr la-breit">Pflichtausstattung</th><th class="la-mehr">Auswahl</th></tr></thead><tbody>' +
      bestand.map(vergleichszeile).join("") + zeilen + "</tbody></table></div>" +
      '<details class="lf-annahmen"><summary>So läuft es weiter</summary><ul>' +
      "<li><b>Überwachung:</b> Jede Stunde prüfe ich das empiria-Postfach auf Antworten in diesen Mailverläufen und von den Händler-Adressen. Eingangsbestätigungen werden nur vermerkt.</li>" +
      "<li><b>Antwort mit Konditionen:</b> Ich trage Leasing- und Finanzierungsangebote, den Bruttolistenpreis und das Exposé ein; die Einzelseite rechnet dann die Kosten aus privater Sicht.</li>" +
      "<li><b>Nachfassen:</b> Nach zwei Werktagen ohne echte Antwort steht „nachfassen“ beim Fahrzeug.</li>" +
      "<li><b>Deine Auswahl:</b> Auf der Einzelseite „Weiter interessant“ oder „Raus“ wählen. Für jeden Plug-in-Hybrid, der weiter interessant ist, schreiben wir den Händler an: Er bestätigt die 0,5-%-Versteuerung mit der Übereinstimmungsbescheinigung (CO₂ höchstens 50 g/km oder mindestens 80 km elektrisch).</li>" +
      "<li><b>Monatlich netto</b> = nur das Fahrzeug, ohne Energie: Leasing = Rate netto + Überführung und Sonderzahlung ÷ Laufzeit; 3-Wege-Finanzierung = (Anzahlung + alle Raten − Vorsteuer aus dem Kaufpreis + Umsatzsteuer auf die Schlussrate bei Rückgabe) ÷ Laufzeit. Beim ID.3 heute ist die Wartung enthalten.</li>" +
      "<li><b>Privat im Monat</b> = 50\u00a0% von (Monatlich netto + Energie) + Bruttolistenpreis × 0,25\u00a0% (Elektro) bzw. 0,5\u00a0% (Plug-in-Hybrid) × 35\u00a0% Einkommensteuer.</li>" +
      "<li><b>Energie</b> für alle gleich bei " + fz(KM) + "\u00a0km im Jahr: Elektro mit dem Verbrauch des Modells (ADAC bzw. WLTP) plus " + Math.round((A.e_aufschlag - 1) * 100) + "\u00a0% zu " + fz(A.strom_kwh * 100) + "\u00a0ct/kWh; Plug-in-Hybrid " + Math.round(A.phev_anteil_elektrisch * 100) + "\u00a0% der Strecke elektrisch mit " + fz(A.phev_kwh_100) + "\u00a0kWh/100\u00a0km und " + Math.round((1 - A.phev_anteil_elektrisch) * 100) + "\u00a0% mit " + fz(A.verbrenner_l_100) + "\u00a0l Benzin zu " + fz(A.benzin_brutto, 2) + "\u00a0€ brutto (in der Firma netto). Die Händlerangebote selbst gelten für 10.000\u00a0km, weniger bieten VW und Škoda nicht an; Raten laut Inserat sind vom Händler noch nicht bestätigt.</li>" +
      "<li><b>Nicht enthalten:</b> Versicherung, Kfz-Steuer, Reparaturen, Wartung, Zulassungskosten, Sozialversicherung und Umsatzsteuer auf die Privatnutzung.</li></ul></details>";
  }

  function vergleichszeile(z) {
    var a = (z.angebote || [])[0], r = a ? rechne(z, a) : null;
    return '<tr class="la-heute">' +
      "<td><b>" + esc(z.titel) + '</b><small class="la-unter">' + esc(z.modell) + " · " + ezText(z) + '</small><small class="la-unter la-nur-klein">' + (a ? euro(a.monatskosten_netto) + " netto im Monat" : "") + "</small></td>" +
      '<td class="la-bildzelle"></td>' +
      '<td class="la-mehr la-breit">' + esc(z.haendler) + '<small class="la-unter">Vertrag bis 18.12.2026</small></td>' +
      '<td class="la-stand"><span class="la-chip la-chip--heute">Zum Vergleich</span></td>' +
      '<td class="la-mittel">' + (a ? '<span class="la-angebot"><b>' + euro(a.monatskosten_netto) + "</b> Leasing · inkl. Wartung</span><small class=\"la-unter\">laut Buchhaltung</small>" : "–") + "</td>" +
      "<td>" + (r && r.privat != null ? "<b>" + euro(r.privat) + "</b>" : "–") + '<small class="la-unter">0,25\u00a0% · Liste geschätzt</small></td>' +
      '<td class="la-mehr la-breit"></td>' +
      '<td class="la-mehr"></td></tr>';
  }

  /* ---------- Einzelseite ---------- */
  function zeichneDetail(z) {
    document.title = z.titel + " – Anfrage – empiria";
    var fehlt = pflichtFehlt(z);
    var h = '<p class="la-zurueck"><a href="/strategie/leasing-fahrzeug.html#angefragt">← Alle angefragten Fahrzeuge</a></p>' +
      '<div class="db-kopf"><div><p class="kicker">Angefragt bei ' + esc(z.haendler) + " · " + esc(z.ort) + '</p><h1 class="h-serif">' + esc(z.titel) + ".</h1></div></div>" +
      '<div class="la-status">' + standChip(z) + auswahlChip(z) + "</div>" +
      '<div class="la-wahlknoepfe" data-la-wahl><span>Deine Auswahl:</span>' +
      ["weiter", "raus", "offen"].map(function (w) { return '<button type="button" data-wahl="' + w + '"' + (z.auswahl === w ? ' aria-pressed="true"' : "") + ">" + esc(w === "offen" ? "Noch offen" : AUSWAHL[w]) + "</button>"; }).join("") +
      '<span class="la-meldung" data-la-meldung></span></div>';

    // Angebote
    var sortiert = (z.angebote || []).slice().sort(function (p, q) {
      var a = rechne(z, p), b = rechne(z, q);
      var w = function (r) { return r ? (r.privat != null ? r.privat : r.firma) : Infinity; };
      return w(a) - w(b);
    });
    var ang = sortiert.map(function (a) {
      var r = rechne(z, a);
      var details = [a.anzahlung != null ? "Anzahlung " + euro(a.anzahlung) : "", a.schlussrate ? "Schlussrate " + euro(a.schlussrate) : "", a.zins ? "Zins " + fz(a.zins, 2) + " %" : "", a.ueberfuehrung_netto ? "Überführung " + euro(a.ueberfuehrung_netto) + " netto" : ""].filter(Boolean).join(" · ");
      return "<tr><td>" + esc(a.art) + "<small class=\"la-unter\">" + esc(a.quelle || "") + (a.datum ? ", " + esc(datum(a.datum)) : "") + '</small><small class="la-unter la-nur-mobil">' + (a.laufzeit || "–") + "\u00a0Mon." + (a.km_jahr ? " · " + fz(a.km_jahr) + "\u00a0km/Jahr" : "") + "</small></td>" +
        '<td class="la-mehr">' + (a.laufzeit || "–") + " Mon.<small class=\"la-unter\">" + (a.km_jahr ? fz(a.km_jahr) + " km/Jahr" : "") + "</small></td>" +
        "<td>" + (a.rate_netto != null ? euro2(a.rate_netto) : "–") + (a.rate_brutto ? '<small class="la-unter">' + euro2(a.rate_brutto) + " brutto</small>" : "") + "</td>" +
        '<td class="la-mehr">' + esc(details || "–") + (a.hinweis ? '<small class="la-unter">' + esc(a.hinweis) + "</small>" : "") + "</td>" +
        '<td class="la-mehr">' + (r ? euro2(r.firma) : "–") + '<small class="la-unter">inkl. Energie</small></td>' +
        "<td><b>" + (r && r.privat != null ? euro2(r.privat) : "–") + "</b></td></tr>";
    }).join("");
    h += '<h2 class="lf-h2">Konditionen</h2>' +
      (ang ? '<div class="la-tabelle"><table class="lf-vgl la-vgl"><thead><tr><th>Art</th><th class="la-mehr">Laufzeit</th><th>Rate netto</th><th class="la-mehr">Details</th><th class="la-mehr">Firma im Monat</th><th>Privat im Monat</th></tr></thead><tbody>' + ang + "</tbody></table></div>" : "") +
      '<p class="lf-unter">' + (z.stand === "angebot" ? "Konditionen laut Händler." : "Vom Händler liegen noch keine Konditionen vor." + (ang ? " Oben stehen die Werte aus dem Inserat." : " Sobald er antwortet, stehen sie hier.")) +
      " Privat = 50 % der Firmenkosten (Rate und Energie bei 7.500 km) + Versteuerung × 35 %.</p>";

    // Steuer und Listenpreis
    var pflichtHinweis = z.antrieb === "PHEV" ? (z.bescheinigung === "bestaetigt" ? "Händler hat die 0,5 % mit Bescheinigung bestätigt." : z.bescheinigung === "angefragt" ? "Bestätigung der 0,5 % beim Händler angefragt." : z.bescheinigung === "entwurf" ? "Entwurf an den Händler liegt in Outlook – bitte senden." : z.bescheinigung === "ticket" ? "Ich bereite den Entwurf an den Händler vor." : "Bestätigung der 0,5 % mit Übereinstimmungsbescheinigung noch nicht angefragt – kommt, sobald du das Fahrzeug als „Weiter interessant“ markierst.") : "Elektroauto: 0,25 %, keine Bescheinigung nötig.";
    h += '<div class="la-raster">' +
      '<section class="la-box"><h2 class="la-h3">Steuer</h2><dl class="la-dl">' +
      "<div><dt>Bruttolistenpreis</dt><dd>" + (z.blp_brutto ? euro(z.blp_brutto) + "<small>" + esc(z.blp_quelle || "") + "</small>" : "offen – beim Händler angefragt") + "</dd></div>" +
      "<div><dt>Versteuerung</dt><dd>" + esc(z.versteuerung || "–") + "</dd></div>" +
      (z.antrieb === "PHEV" ? "<div><dt>CO₂ / elektrisch</dt><dd>" + (z.co2_g_km != null ? fz(z.co2_g_km) + " g/km" : "CO₂ offen") + " · " + (z.el_reichweite_km ? fz(z.el_reichweite_km) + " km elektrisch" : "Reichweite offen") + "</dd></div>" : "") +
      "<div><dt>Bescheinigung</dt><dd>" + esc(pflichtHinweis) + "</dd></div></dl></section>" +
      '<section class="la-box"><h2 class="la-h3">Anfrage</h2><dl class="la-dl">' +
      "<div><dt>Geschrieben an</dt><dd>" + esc(z.mail_an) + "<small>" + esc(datum(z.gesendet_am, true)) + "</small></dd></div>" +
      (z.mail_direkt ? "<div><dt>Direkte Adresse</dt><dd>" + esc(z.mail_direkt) + "<small>laut Fahrzeugbörse – fürs Nachfassen</small></dd></div>" : "") +
      (z.telefon ? "<div><dt>Telefon</dt><dd><a href=\"tel:" + esc(z.telefon.replace(/\s/g, "")) + "\">" + esc(z.telefon) + "</a></dd></div>" : "") +
      "<div><dt>Händler</dt><dd>" + esc(z.haendler) + "<small>" + esc(z.ort) + (z.fahrzeit ? " · " + esc(z.fahrzeit) + " ab Crailsheim (geschätzt)" : "") + "</small></dd></div>" +
      "<div><dt>Betreff</dt><dd>" + esc(z.betreff) + "</dd></div></dl></section></div>";

    // Fahrzeug und Ausstattung
    h += '<h2 class="lf-h2">Fahrzeug</h2><div class="la-raster">' +
      '<section class="la-box">' + (z.bild_url ? '<img class="la-bild" src="' + esc(z.bild_url) + '" alt="' + esc(z.titel) + '" loading="lazy">' : "") +
      '<dl class="la-dl"><div><dt>Erstzulassung</dt><dd>' + esc(z.ez) + "</dd></div><div><dt>Kilometerstand</dt><dd>" + fz(z.km_stand) + " km</dd></div>" +
      (z.preis_inserat ? "<div><dt>Preis laut Inserat</dt><dd>" + euro(z.preis_inserat) + "</dd></div>" : "") +
      (z.vin ? "<div><dt>Fahrgestellnummer</dt><dd>" + esc(z.vin) + "</dd></div>" : "") +
      "<div><dt>Inserat</dt><dd><a href=\"" + esc(z.inserat_url) + "\" target=\"_blank\" rel=\"noopener\">" + esc(z.quelle || "Inserat") + (z.fahrzeug_nr ? " · " + esc(z.fahrzeug_nr) : "") + " ↗</a></dd></div></dl></section>" +
      '<section class="la-box"><h2 class="la-h3">Pflichtausstattung</h2><ul class="la-pflicht">' +
      Object.keys(z.pflicht || {}).map(function (k) { var ok = z.pflicht[k] === "ja"; return '<li class="' + (ok ? "la-ok" : "la-offen") + '">' + (ok ? "✓ " : "? ") + esc(k) + (ok ? "" : " – im Inserat nicht aufgeführt, beim Händler klären") + "</li>"; }).join("") + "</ul>" +
      (fehlt.length ? "" : '<p class="la-klein">Alle Pflichtpunkte stehen im Inserat.</p>') +
      ((z.ausstattung || []).length ? '<details class="lf-annahmen"><summary>Ganze Ausstattung laut Inserat</summary>' + z.ausstattung.map(function (g) {
        return '<p class="la-gruppe">' + esc(g.name) + "</p>" + (g.punkte ? "<ul>" + g.punkte.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>" : '<p class="la-klein">' + esc(g.text) + "</p>");
      }).join("") + "</details>" : "") + "</section></div>";

    // Verlauf
    var V = { gesendet: "Gesendet", eingangsbestaetigung: "Eingangsbestätigung", antwort: "Antwort", claude: "Claude", daniel: "Deine Auswahl" };
    h += '<h2 class="lf-h2">Verlauf</h2><ol class="la-verlauf">' + (z.verlauf || []).slice().sort(function (a, b) { return String(b.datum).localeCompare(String(a.datum)); }).map(function (v) {
      return '<li class="la-v la-v--' + esc(v.art) + '"><span>' + esc(datum(v.datum, true)) + "</span><b>" + esc(V[v.art] || v.art) + "</b><p>" + esc(v.text) + "</p></li>";
    }).join("") + "</ol>" + '<p class="la-geprueft">Postfach zuletzt geprüft: ' + esc(datum(z.geprueft_am, true)) + "</p>";
    detail.innerHTML = h;

    detail.querySelector("[data-la-wahl]").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-wahl]"); if (!b) return;
      var w = b.getAttribute("data-wahl"), meldung = detail.querySelector("[data-la-meldung]");
      if (w === z.auswahl) return;
      var eintrag = { datum: new Date().toISOString(), art: "daniel", text: "Auswahl: " + (w === "offen" ? "wieder offen" : AUSWAHL[w]) };
      meldung.textContent = "Wird gespeichert …";
      db.from("leasing_anfragen").update({ auswahl: w, verlauf: (z.verlauf || []).concat([eintrag]), aktualisiert_am: new Date().toISOString() }).eq("id", z.id).then(function (r) {
        if (r.error) { meldung.textContent = "Nicht gespeichert: " + r.error.message; return; }
        z.auswahl = w; z.verlauf = (z.verlauf || []).concat([eintrag]);
        zeichneDetail(z);
        detail.querySelector("[data-la-meldung]").textContent = "Gespeichert: " + (w === "offen" ? "wieder offen" : AUSWAHL[w]) + (w === "weiter" && z.antrieb === "PHEV" ? " – ich bereite die Anfrage zur 0,5-%-Bestätigung vor." : "");
      });
    });
  }
})();
