/* Dashboard – Varianten. Alle Varianten zeigen dieselbe Lage (Beispieldaten, erfundene Namen),
   geordnet nach Unternehmenssteuerung: Was entscheide ich? Was gebe ich frei? Wo stehen die
   Projekte? Welche Beziehungen brauchen mich? Was läuft im Vertrieb? – Keine Zähl-Kennzahlen,
   jede Zeile führt zu einer Handlung. Varianten per Pille umschaltbar (#v1 … #v7). */
(function () {
  "use strict";
  var wurzel = document.querySelector("[data-dv]");
  if (!wurzel) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }

  /* ---------- Die Lage (eine Quelle für alle Varianten) ---------- */
  var L = {
    satz: "Diese Woche entscheidet sich, ob MSP mit dem neuen Vertriebsprozess startet – dafür fehlt deine Wahl der One-Pager-Variante bis Donnerstag.",
    entscheiden: [
      { frage: "Welche One-Pager-Variante geht an MSP?", warum: "Ohne Wahl kein Workshop am Freitag – Vertriebsprozess verschiebt sich um zwei Wochen.", projekt: "MSP Digitaler Vertrieb", bis: "Do",
        optionen: ["Dunkel, Startseiten-Stil", "Drei Kapitel", "Hebel-Check"] },
      { frage: "Kommt das Qualitätssiegel 2027 auf die SharePoint-Seite?", warum: "Akademie-Leitung fragt nach; passt zur Sichtbarkeit nach innen.", projekt: "SV Akademie", bis: "nächste Woche",
        optionen: ["Ja, auf die Startseite", "Nur im Bereich Qualität", "Nein"] },
      { frage: "Bekommt die M&S-Website ihre thematische Offenheit zurück?", warum: "Partner sieht die Superkräfte nicht mehr; Entwurf wartet auf Richtung.", projekt: "Müller & Ströbel", bis: "Ende Oktober",
        optionen: ["Ja, Methode vor Themen", "Nein, Schwerpunkte bleiben", "Gespräch mit Partner"] }
    ],
    freigeben: [
      { was: "Antwort an Anna Beispiel", worum: "Bestätigt: Vorbereitungstag ist im Tagessatz enthalten.", art: "Mail" },
      { was: "Antwort an Kurt Kunde", worum: "Korrigierte Rechnung mit Bestellnummer.", art: "Mail + Anhang" },
      { was: "Anfrage Ist-Zahlen an VVDE", worum: "Damit der Termin am Donnerstag Substanz hat.", art: "Mail" },
      { was: "Homepage-Mails, nächste Runde", worum: "Persönliche Mails an fünf Kunden mit Bezug zur neuen Homepage.", art: "Kampagne" }
    ],
    vorbereiten: [
      { was: "Agenda Führungskreis verschicken", termin: "Workshop Leitbild · Di 08:30, Wiesbaden", bis: "heute", dringend: true },
      { was: "Folien um KI-Säule ergänzen", termin: "SV Akademie Zwischenstand · Mo 14:00", bis: "Mo 12:00" },
      { was: "Prozessbild + Entscheidungsvorlage", termin: "MSP Vertriebsprozess · Fr 09:30", bis: "Do" }
    ],
    projekte: [
      { name: "SV Akademie", frage: "Die beste Akademie der Branche", phase: "Vision & Strategie", schritt: "Workshop Vision vorbereiten – Agenda steht, Protokoll fehlt.", status: "laeuft", naechst: "Mo 14:00 Zwischenstand", marke: "empiria" },
      { name: "SV Schadenmanagement", frage: "Leitbild für den Führungskreis", phase: "Leitbild", schritt: "Leitbilder der Abteilungen zusammenführen.", status: "dich", naechst: "Di Workshop (ganztägig)", marke: "empiria" },
      { name: "MSP Digitaler Vertrieb", frage: "Vom Kontakt zum Auftrag", phase: "Bausteine", schritt: "One-Pager-Variante entscheiden, dann Prozess festlegen.", status: "blockiert", naechst: "Fr Workshop", marke: "sofort sichtbar" },
      { name: "MSP Landing Page", frage: "Die Story nach außen", phase: "Abnahme", schritt: "Abnahme am Mittwoch, Vorschau steht.", status: "laeuft", naechst: "Mi 10:00 Abnahme", marke: "sofort sichtbar" },
      { name: "VVDE Strategie", frage: "Strategie für den Verband", phase: "Status Quo", schritt: "Ist-Zahlen fehlen – Anfrage liegt zur Freigabe.", status: "dich", naechst: "Do 11:00", marke: "empiria" }
    ],
    beziehungen: [
      { wer: "Andreas Beispiel", wo: "SV Akademie", anlass: "Sein Vorgesetzter sieht KI in der Personalentwicklung als Handlungsfeld – guter Aufhänger.", seit: "zuletzt vor 1 Tag", tun: "Im Termin Montag ansprechen" },
      { wer: "Timo Muster", wo: "SV bAV Consulting", anlass: "Viele gemeinsame Termine, aber nie direkt angesprochen. Führungskreis bAV fehlt im CRM.", seit: "zuletzt im Juli", tun: "Kurz melden" },
      { wer: "Jens Probe", wo: "Rückversicherung", anlass: "Baden-Baden steht an – Termin vor Ort vereinbaren.", seit: "zuletzt vor 3 Monaten", tun: "Termin vorschlagen" }
    ],
    vertrieb: [
      { name: "Homepage persönlich", stand: "läuft – nächste Mails liegen zur Freigabe bereit", wann: "jetzt" },
      { name: "Budgetretter", stand: "Liste ist ausgewählt, Texte fehlen noch", wann: "Anfang November" },
      { name: "Weihnachtsmail", stand: "alle Kontakte vorgesehen, Geschenk offen", wann: "Dezember" }
    ],
    status: [["Linked Helper", "aktiv", true], ["Kampagne", "läuft", true], ["kontakt@", "eine neue Anfrage", true]],
    sparring: [
      ["Entscheidungssprint", "15 Minuten, alles was bei dir liegt"], ["Deep Dive", "ein Thema richtig durchdenken"], ["360°-Blick", "ein Kunde von allen Seiten"],
      ["Statuscheck", "wo stehen die Projekte wirklich"], ["Ideen", "frei denken, ohne Agenda"], ["Review", "was lief, was lernen wir"]
    ]
  };
  var STATUS = { laeuft: "läuft", dich: "wartet auf dich", blockiert: "blockiert" };

  /* ---------- gemeinsame Bausteine ---------- */
  function knopf(t, haupt) { return '<button type="button" class="dv-k' + (haupt ? " dv-k--haupt" : "") + '">' + t + "</button>"; }

  /* V1 – Streifen (wie Projekt SV Akademie) */
  function v1() {
    var ebenen = [
      ["01", "Du entscheidest", "Was nur du lösen kannst – und was es aufhält.", true, '<div class="pj-felder">' + L.entscheiden.map(function (e, i) {
        return '<div class="pj-feld"><span class="pj-feld-kopf"><span class="pj-feld-nr">' + (i + 1) + '</span><span class="pj-feld-frage">' + esc(e.projekt) + " · bis " + esc(e.bis) + '</span></span>' +
          '<span class="pj-feld-koerper"><h3>' + esc(e.frage) + "</h3><p>" + esc(e.warum) + '</p><span class="dv-opts">' + e.optionen.map(function (o) { return knopf(esc(o)); }).join("") + "</span></span></div>";
      }).join("") + "</div>"],
      ["02", "Du gibst frei", "Vorbereitet und geprüft – wartet nur auf dein Ja.", true, '<ul class="dv-liste">' + L.freigeben.map(function (f) {
        return "<li><div><b>" + esc(f.was) + "</b><small>" + esc(f.worum) + '</small></div><span class="dv-art">' + esc(f.art) + "</span>" + knopf("Ansehen") + knopf("Freigeben", true) + "</li>"; }).join("") + "</ul>"],
      ["03", "Projekte", "Wo jedes Vorhaben steht und was als Nächstes passiert.", false, '<div class="pj-felder dv-felder5">' + L.projekte.map(function (p, i) {
        return '<a class="pj-feld" href="#"><span class="pj-feld-kopf"><span class="pj-feld-nr">' + (i + 1) + '</span><span class="pj-feld-frage">' + esc(p.frage) + '</span></span>' +
          '<span class="pj-feld-koerper"><h3>' + esc(p.name) + "</h3><p>" + esc(p.schritt) + '</p><ul class="pj-feld-liste"><li>' + esc(p.phase) + "</li><li>" + esc(p.naechst) + "</li></ul>" +
          '<span class="pj-feld-fuss"><span class="pj-marke dv-st-' + p.status + '">' + STATUS[p.status] + '</span><span class="pj-pfeil">&#8594;</span></span></span></a>';
      }).join("") + "</div>"],
      ["04", "Du bereitest vor", "Termine, die ohne dich nicht gut werden.", false, '<ul class="dv-liste">' + L.vorbereiten.map(function (v) {
        return '<li><span class="dv-bis' + (v.dringend ? " dv-rot" : "") + '">bis ' + esc(v.bis) + "</span><div><b>" + esc(v.was) + "</b><small>" + esc(v.termin) + "</small></div>" + knopf("Claude bereitet vor") + knopf("Erledigt") + "</li>"; }).join("") + "</ul>"],
      ["05", "Beziehungen", "Wer dich jetzt braucht – und womit du anknüpfst.", false, '<ul class="dv-liste">' + L.beziehungen.map(function (b) {
        return "<li><div><b>" + esc(b.wer) + " · " + esc(b.wo) + "</b><small>" + esc(b.anlass) + '</small></div><span class="dv-art">' + esc(b.seit) + "</span>" + knopf(esc(b.tun), true) + "</li>"; }).join("") + "</ul>"],
      ["06", "Vertrieb & Sichtbarkeit", "Kampagnen und was gerade nach außen läuft.", false, '<ul class="dv-liste">' + L.vertrieb.map(function (k) {
        return "<li><div><b>" + esc(k.name) + "</b><small>" + esc(k.stand) + '</small></div><span class="dv-art">' + esc(k.wann) + "</span>" + knopf("Öffnen") + "</li>"; }).join("") + "</ul>"],
      ["07", "Sparring mit Claude", "Sechs Arten, gemeinsam zu denken.", false, '<div class="dv-sparring">' + L.sparring.map(function (s) {
        return '<button type="button"><b>' + s[0] + "</b><small>" + s[1] + "</small></button>"; }).join("") + "</div>"]
    ];
    return '<div class="dv-flaeche"><p class="dv-lage">' + esc(L.satz) + '</p><div class="fl-ebenen">' + ebenen.map(function (e) {
      return '<section class="fl-ebene' + (e[3] ? " is-offen" : "") + '"><button type="button" class="fl-kopf" aria-expanded="' + e[3] + '"><span class="fl-kopf-nr">' + e[0] +
        '</span><span class="fl-kopf-text"><b>' + e[1] + "</b><small>" + e[2] + '</small></span><span class="fl-kopf-pfeil" aria-hidden="true"></span></button><div class="fl-koerper">' + e[4] + "</div></section>";
    }).join("") + "</div>" + statusZeile() + "</div>";
  }

  /* V2 – Felder (gleiche Elemente, ohne Aufklappen) */
  function v2() {
    return '<div class="dv-flaeche"><p class="dv-lage">' + esc(L.satz) + "</p>" +
      '<div class="dv-v2-oben">' +
      feld("1", "Du entscheidest", L.entscheiden.map(function (e) { return "<li><b>" + esc(e.frage) + "</b><small>" + esc(e.projekt) + " · bis " + esc(e.bis) + "</small></li>"; }).join(""), "Entscheiden") +
      feld("2", "Du gibst frei", L.freigeben.map(function (f) { return "<li><b>" + esc(f.was) + "</b><small>" + esc(f.worum) + "</small></li>"; }).join(""), "Alle durchgehen") +
      feld("3", "Du bereitest vor", L.vorbereiten.map(function (v) { return "<li><b>" + esc(v.was) + '</b><small class="' + (v.dringend ? "dv-rot" : "") + '">bis ' + esc(v.bis) + " · " + esc(v.termin) + "</small></li>"; }).join(""), "Vorbereiten") +
      '</div><h2 class="dv-h">Projekte</h2><div class="dv-v2-proj">' + L.projekte.map(function (p) {
        return '<a class="dv-proj" href="#"><span class="dv-proj-kopf"><b>' + esc(p.name) + '</b><span class="dv-st dv-st-' + p.status + '">' + STATUS[p.status] + "</span></span>" +
          "<p>" + esc(p.schritt) + "</p><small>" + esc(p.phase) + " · " + esc(p.naechst) + "</small></a>"; }).join("") + "</div>" +
      '<div class="dv-v2-unten">' + feld("4", "Beziehungen", L.beziehungen.map(function (b) { return "<li><b>" + esc(b.wer) + " · " + esc(b.wo) + "</b><small>" + esc(b.anlass) + "</small></li>"; }).join(""), "Kontakte") +
      feld("5", "Vertrieb", L.vertrieb.map(function (k) { return "<li><b>" + esc(k.name) + " · " + esc(k.wann) + "</b><small>" + esc(k.stand) + "</small></li>"; }).join(""), "Kampagnen") + "</div>" + statusZeile() + "</div>";
  }
  function feld(nr, titel, li, aktion) {
    return '<div class="pj-feld dv-feld"><span class="pj-feld-kopf"><span class="pj-feld-nr">' + nr + '</span><span class="pj-feld-frage">' + titel + '</span></span><span class="pj-feld-koerper"><ul class="dv-fl">' + li +
      '</ul><span class="pj-feld-fuss"><span class="pj-marke">' + aktion + '</span><span class="pj-pfeil">&#8594;</span></span></span></div>';
  }
  function statusZeile() {
    return '<p class="dv-status">' + L.status.map(function (s) { return '<span><i class="' + (s[2] ? "an" : "") + '"></i>' + s[0] + ": " + s[1] + "</span>"; }).join("") + "</p>";
  }

  /* V3 – Apple: ruhig, groß, Widgets in Kacheln unterschiedlicher Größe */
  function v3() {
    var d = new Date(), tag = d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
    return '<div class="ap"><p class="ap-datum">' + tag + '</p><h2 class="ap-titel">Guten Morgen, Daniel.</h2><p class="ap-satz">' + esc(L.satz) + "</p>" +
      '<div class="ap-raster">' +
      '<section class="ap-w ap-w--gross ap-w--dunkel"><p class="ap-label">Entscheidung</p><h3>' + esc(L.entscheiden[0].frage) + "</h3><p>" + esc(L.entscheiden[0].warum) + '</p><div class="ap-opts">' +
        L.entscheiden[0].optionen.map(function (o) { return "<button>" + esc(o) + "</button>"; }).join("") + "</div></section>" +
      '<section class="ap-w"><p class="ap-label">Freigeben</p><ul>' + L.freigeben.slice(0, 3).map(function (f) { return "<li><b>" + esc(f.was) + "</b><span>" + esc(f.worum) + "</span></li>"; }).join("") + '</ul><button class="ap-mehr">Alle freigeben</button></section>' +
      '<section class="ap-w"><p class="ap-label">Heute vorbereiten</p><h3>' + esc(L.vorbereiten[0].was) + "</h3><p>" + esc(L.vorbereiten[0].termin) + '</p><button class="ap-mehr">Claude bereitet vor</button></section>' +
      '<section class="ap-w ap-w--breit"><p class="ap-label">Projekte</p><div class="ap-proj">' + L.projekte.map(function (p) {
        return '<div><span class="ap-ring ap-ring--' + p.status + '"></span><b>' + esc(p.name) + "</b><span>" + esc(p.schritt) + "</span></div>"; }).join("") + "</div></section>" +
      '<section class="ap-w"><p class="ap-label">Jemand wartet auf dich</p><h3>' + esc(L.beziehungen[0].wer) + "</h3><p>" + esc(L.beziehungen[0].anlass) + '</p><button class="ap-mehr">' + esc(L.beziehungen[0].tun) + "</button></section>" +
      '<section class="ap-w"><p class="ap-label">Weitere Entscheidungen</p><ul>' + L.entscheiden.slice(1).map(function (e) { return "<li><b>" + esc(e.frage) + "</b><span>" + esc(e.projekt) + "</span></li>"; }).join("") + "</ul></section>" +
      "</div></div>";
  }

  /* V4 – Tesla: dunkel, eine klare Mitte, große Bedienflächen */
  function v4() {
    var e = L.entscheiden[0];
    return '<div class="te"><div class="te-oben"><span>empiria</span><span>' + L.status.map(function (s) { return '<i class="te-pkt"></i>' + s[0]; }).join(" ") + "</span></div>" +
      '<div class="te-mitte"><p class="te-label">Jetzt</p><h2>' + esc(e.frage) + "</h2><p>" + esc(e.warum) + '</p><div class="te-opts">' + e.optionen.map(function (o, i) {
        return '<button class="' + (i === 0 ? "te-an" : "") + '">' + esc(o) + "</button>"; }).join("") + "</div></div>" +
      '<div class="te-leiste">' +
      '<div><p class="te-label">Freigeben</p>' + L.freigeben.slice(0, 3).map(function (f) { return "<button>" + esc(f.was) + "</button>"; }).join("") + "</div>" +
      '<div><p class="te-label">Vorbereiten</p>' + L.vorbereiten.map(function (v) { return '<button class="' + (v.dringend ? "te-rot" : "") + '">' + esc(v.was) + "<small>bis " + esc(v.bis) + "</small></button>"; }).join("") + "</div>" +
      '<div><p class="te-label">Projekte</p>' + L.projekte.map(function (p) { return '<button><span class="te-st te-st-' + p.status + '"></span>' + esc(p.name) + "<small>" + STATUS[p.status] + "</small></button>"; }).join("") + "</div>" +
      "</div></div>";
  }

  /* V5 – Meta: Feed – was passiert ist, was es bedeutet, was jetzt zu tun ist */
  function v5() {
    var feed = [
      ["Entscheidung", L.entscheiden[0].projekt, L.entscheiden[0].frage, L.entscheiden[0].warum, L.entscheiden[0].optionen],
      ["Antwort liegt bereit", "Korrespondenz", L.freigeben[0].was, L.freigeben[0].worum, ["Freigeben", "Anders …"]],
      ["Termin morgen", "SV Schadenmanagement", L.vorbereiten[0].was, L.vorbereiten[0].termin, ["Claude bereitet vor", "Erledigt"]],
      ["Gelegenheit", L.beziehungen[0].wo, L.beziehungen[0].wer, L.beziehungen[0].anlass, [L.beziehungen[0].tun]],
      ["Projekt blockiert", "MSP Digitaler Vertrieb", L.projekte[2].schritt, "Hängt an der Entscheidung oben.", ["Zum Projekt"]],
      ["Kampagne", "Vertrieb", L.vertrieb[0].name, L.vertrieb[0].stand, ["Ansehen"]]
    ];
    return '<div class="mt"><aside class="mt-seite"><p class="mt-ich">Daniel Ströbel</p>' + ["Lage", "Entscheidungen", "Freigaben", "Projekte", "Kontakte", "Sparring"].map(function (x, i) {
        return '<a href="#" class="' + (i ? "" : "an") + '">' + x + "</a>"; }).join("") + '</aside><div class="mt-feed">' + feed.map(function (f) {
        return '<article class="mt-post"><p class="mt-kopf"><b>' + esc(f[0]) + "</b> · " + esc(f[1]) + "</p><h3>" + esc(f[2]) + "</h3><p>" + esc(f[3]) + '</p><div class="mt-akt">' +
          f[4].map(function (a, i) { return '<button class="' + (i ? "" : "an") + '">' + esc(a) + "</button>"; }).join("") + "</div></article>"; }).join("") +
      '</div><aside class="mt-rechts"><p class="mt-label">Heute</p>' + L.vorbereiten.map(function (v) { return "<p><b>" + esc(v.termin.split(" · ")[1] || "") + "</b> " + esc(v.termin.split(" · ")[0]) + "</p>"; }).join("") +
      '<p class="mt-label">Sparring</p>' + L.sparring.slice(0, 3).map(function (s) { return '<button class="mt-sp">' + s[0] + "</button>"; }).join("") + "</aside></div>";
  }

  /* V6 – Briefing (aus Entwürfe II, reduziert): lesen wie ein Memo, handeln in der Zeile */
  function v6() {
    function abs(t, items) { return '<section class="br-abs"><h3>' + t + "</h3>" + items + "</section>"; }
    return '<div class="br"><p class="br-gruss">Guten Morgen, Daniel.</p><p class="br-lage">' + esc(L.satz) + "</p>" +
      abs("Was nur du entscheiden kannst", L.entscheiden.map(function (e) { return '<p class="br-z"><b>' + esc(e.frage) + "</b> " + esc(e.warum) + ' <span class="br-akt">' + e.optionen.map(function (o) { return knopf(esc(o)); }).join("") + "</span></p>"; }).join("")) +
      abs("Was fertig auf dich wartet", L.freigeben.map(function (f) { return '<p class="br-z"><b>' + esc(f.was) + ".</b> " + esc(f.worum) + ' <span class="br-akt">' + knopf("Freigeben", true) + "</span></p>"; }).join("")) +
      abs("Was du vorbereiten solltest", L.vorbereiten.map(function (v) { return '<p class="br-z"><b>' + esc(v.was) + "</b> – " + esc(v.termin) + ", bis " + esc(v.bis) + '. <span class="br-akt">' + knopf("Claude bereitet vor") + "</span></p>"; }).join("")) +
      abs("Wo die Projekte stehen", L.projekte.map(function (p) { return '<p class="br-z"><b>' + esc(p.name) + "</b> " + (p.status !== "laeuft" ? '<span class="dv-st dv-st-' + p.status + '">' + STATUS[p.status] + "</span> " : "") + esc(p.schritt) + "</p>"; }).join("")) +
      abs("Wer dich braucht", L.beziehungen.map(function (b) { return '<p class="br-z"><b>' + esc(b.wer) + "</b> (" + esc(b.wo) + "): " + esc(b.anlass) + ' <span class="br-akt">' + knopf(esc(b.tun)) + "</span></p>"; }).join("")) +
      "</div>";
  }

  /* V7 – Leitwand: Projekte als Spalten, darunter was quer liegt (Stripe/Linear-Ruhe, CD-frei) */
  function v7() {
    return '<div class="lw"><p class="lw-lage">' + esc(L.satz) + '</p><div class="lw-spalten">' + L.projekte.map(function (p) {
      var ent = L.entscheiden.filter(function (e) { return e.projekt === p.name; });
      var vor = L.vorbereiten.filter(function (v) { return v.termin.toLowerCase().indexOf(p.name.split(" ")[0].toLowerCase()) > -1; });
      return '<section class="lw-spalte lw-' + p.status + '"><header><b>' + esc(p.name) + "</b><span>" + STATUS[p.status] + "</span></header>" +
        '<p class="lw-schritt">' + esc(p.schritt) + "</p>" +
        (ent.length ? '<div class="lw-karte lw-karte--ent"><small>Entscheidung</small>' + esc(ent[0].frage) + "</div>" : "") +
        vor.map(function (v) { return '<div class="lw-karte"><small>Vorbereiten · bis ' + esc(v.bis) + "</small>" + esc(v.was) + "</div>"; }).join("") +
        '<p class="lw-naechst">' + esc(p.naechst) + "</p></section>";
    }).join("") + '</div><div class="lw-quer"><section><h3>Freigeben</h3>' + L.freigeben.map(function (f) { return "<p><b>" + esc(f.was) + "</b><span>" + esc(f.art) + "</span></p>"; }).join("") +
      '</section><section><h3>Beziehungen</h3>' + L.beziehungen.map(function (b) { return "<p><b>" + esc(b.wer) + "</b><span>" + esc(b.tun) + "</span></p>"; }).join("") +
      '</section><section><h3>Vertrieb</h3>' + L.vertrieb.map(function (k) { return "<p><b>" + esc(k.name) + "</b><span>" + esc(k.wann) + "</span></p>"; }).join("") + "</section></div></div>";
  }

  var V = [["v1", "Streifen", "wie Projekt SV Akademie", v1], ["v2", "Felder", "gleiche Elemente, ohne Aufklappen", v2], ["v3", "Apple", "ruhig, groß, Widgets", v3],
           ["v4", "Tesla", "dunkel, eine klare Mitte", v4], ["v5", "Meta", "Feed: passiert → tun", v5], ["v6", "Briefing", "lesen wie ein Memo", v6], ["v7", "Leitwand", "Projekte als Spalten", v7]];
  var nav = document.querySelector("[data-dv-nav]");
  function zeigen() {
    var h = location.hash.replace("#", ""), v = V.filter(function (x) { return x[0] === h; })[0] || V[0];
    nav.innerHTML = V.map(function (x) { return '<a href="#' + x[0] + '"' + (x === v ? ' aria-current="page"' : "") + "><b>" + x[1] + "</b><small>" + x[2] + "</small></a>"; }).join("");
    wurzel.className = "dv-raum dv-" + v[0];
    wurzel.innerHTML = v[3]();
    wurzel.querySelectorAll(".fl-kopf").forEach(function (k) {
      k.addEventListener("click", function () { var e = k.parentNode, auf = !e.classList.contains("is-offen"); e.classList.toggle("is-offen", auf); k.setAttribute("aria-expanded", String(auf)); });
    });
  }
  window.addEventListener("hashchange", zeigen);
  zeigen();
})();
