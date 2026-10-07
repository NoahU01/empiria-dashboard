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
      { frage: "Bekommt die M&S-Website ihre thematische Offenheit zurück?", warum: "Partner sieht die Superkräfte nicht mehr; Entwurf wartet auf Richtung.", projekt: "Müller&Ströbel.", bis: "Ende Oktober",
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
      { name: "MSP Digitaler Vertrieb", frage: "Vom Kontakt zum Auftrag", phase: "Bausteine", schritt: "One-Pager-Variante entscheiden, dann Prozess festlegen.", status: "blockiert", naechst: "Fr Workshop", marke: "sofortsichtbar" },
      { name: "MSP Landing Page", frage: "Die Story nach außen", phase: "Abnahme", schritt: "Abnahme am Mittwoch, Vorschau steht.", status: "laeuft", naechst: "Mi 10:00 Abnahme", marke: "sofortsichtbar" },
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

  /* Stripe – klare Karten, feine Linien, Status als Farbpunkte, alles auf einer Ebene lesbar */
  function vStripe() {
    function zeile(a, b, c, d) { return '<div class="sp-z"><span class="sp-a">' + a + '</span><span class="sp-b">' + b + '</span><span class="sp-c">' + (c || "") + "</span>" + (d || "") + "</div>"; }
    return '<div class="sp"><div class="sp-kopf"><div><p class="sp-klein">Heute</p><h2>Guten Morgen, Daniel</h2></div><div class="sp-suche">Suchen oder Befehl …<kbd>⌘K</kbd></div></div>' +
      '<div class="sp-hinweis"><span class="sp-pkt sp-pkt--rot"></span><b>Achtung</b> ' + esc(L.satz) + '<a href="#">Entscheiden →</a></div>' +
      '<div class="sp-raster"><section class="sp-karte sp-breit"><header><h3>Entscheidungen</h3><a href="#">Alle ansehen</a></header>' +
        L.entscheiden.map(function (e) { return zeile('<span class="sp-pkt sp-pkt--gelb"></span>' + esc(e.projekt), "<b>" + esc(e.frage) + "</b>", "bis " + esc(e.bis), '<button class="sp-k">Entscheiden</button>'); }).join("") + "</section>" +
      '<section class="sp-karte"><header><h3>Zur Freigabe</h3><a href="#">Alle freigeben</a></header>' +
        L.freigeben.map(function (f) { return zeile(esc(f.art), "<b>" + esc(f.was) + "</b><small>" + esc(f.worum) + "</small>", "", '<button class="sp-k sp-k--blau">Freigeben</button>'); }).join("") + "</section>" +
      '<section class="sp-karte"><header><h3>Vorbereiten</h3></header>' +
        L.vorbereiten.map(function (v) { return zeile('<span class="sp-pkt ' + (v.dringend ? "sp-pkt--rot" : "sp-pkt--grau") + '"></span>bis ' + esc(v.bis), "<b>" + esc(v.was) + "</b><small>" + esc(v.termin) + "</small>"); }).join("") + "</section>" +
      '<section class="sp-karte sp-breit"><header><h3>Projekte</h3></header><div class="sp-tab"><div class="sp-th"><span>Projekt</span><span>Status</span><span>Nächster Schritt</span><span>Nächster Termin</span></div>' +
        L.projekte.map(function (p) { return '<div class="sp-tr"><span><b>' + esc(p.name) + '</b></span><span><span class="sp-badge sp-badge--' + p.status + '">' + STATUS[p.status] + "</span></span><span>" + esc(p.schritt) + "</span><span>" + esc(p.naechst) + "</span></div>"; }).join("") + "</div></section>" +
      '<section class="sp-karte"><header><h3>Beziehungen</h3></header>' + L.beziehungen.map(function (b) { return zeile(esc(b.seit), "<b>" + esc(b.wer) + "</b><small>" + esc(b.anlass) + "</small>"); }).join("") + "</section>" +
      '<section class="sp-karte"><header><h3>Vertrieb</h3></header>' + L.vertrieb.map(function (k) { return zeile(esc(k.wann), "<b>" + esc(k.name) + "</b><small>" + esc(k.stand) + "</small>"); }).join("") + "</section>" +
      "</div></div>";
  }

  /* Linear – präzise Arbeitsfläche: Gruppen mit Statussymbolen, eine Zeile je Vorgang, Tastenkürzel */
  function vLinear() {
    var ico = { ent: '<span class="ln-i ln-i--ent"></span>', frei: '<span class="ln-i ln-i--frei"></span>', vor: '<span class="ln-i ln-i--vor"></span>' };
    function gruppe(titel, zeilen) { return '<section class="ln-g"><h3>' + titel + "</h3>" + zeilen + "</section>"; }
    function z(i, text, tag, rechts, k) { return '<div class="ln-z">' + i + '<span class="ln-t">' + text + "</span>" + (tag ? '<span class="ln-tag">' + tag + "</span>" : "") + '<span class="ln-r">' + (rechts || "") + "</span>" + (k ? "<kbd>" + k + "</kbd>" : "") + "</div>"; }
    return '<div class="ln"><aside class="ln-seite"><p class="ln-ws"><img src="/assets/empiria-logo.svg" alt="empiria"></p>' + ["Lage", "Entscheiden", "Freigeben", "Vorbereiten", "Projekte", "Kontakte"].map(function (x, i) {
        return '<a href="#"' + (i ? "" : ' class="an"') + ">" + x + "</a>"; }).join("") + '<p class="ln-ws ln-ws--2">Projekte</p>' + L.projekte.map(function (p) {
        return '<a href="#"><span class="ln-st ln-st--' + p.status + '"></span>' + esc(p.name) + "</a>"; }).join("") + "</aside>" +
      '<div class="ln-haupt"><p class="ln-lage">' + esc(L.satz) + "</p>" +
      gruppe("Entscheiden", L.entscheiden.map(function (e, i) { return z(ico.ent, esc(e.frage), esc(e.projekt), "bis " + esc(e.bis), "E " + (i + 1)); }).join("")) +
      gruppe("Freigeben", L.freigeben.map(function (f, i) { return z(ico.frei, esc(f.was) + ' <span class="ln-leise">' + esc(f.worum) + "</span>", esc(f.art), "", "F " + (i + 1)); }).join("")) +
      gruppe("Vorbereiten", L.vorbereiten.map(function (v) { return z(ico.vor, esc(v.was), "", '<span class="' + (v.dringend ? "ln-rot" : "") + '">bis ' + esc(v.bis) + "</span>"); }).join("")) +
      gruppe("Projekte", L.projekte.map(function (p) { return z('<span class="ln-st ln-st--' + p.status + '"></span>', "<b>" + esc(p.name) + '</b> <span class="ln-leise">' + esc(p.schritt) + "</span>", STATUS[p.status], esc(p.naechst)); }).join("")) +
      "</div></div>";
  }

  var V = [["v1", "Streifen", "wie Projekt SV Akademie", v1], ["v2", "Felder", "gleiche Elemente, ohne Aufklappen", v2], ["v3", "Apple", "ruhig, groß, Widgets", v3],
           ["stripe", "Stripe", "klare Karten, feine Linien", vStripe], ["linear", "Linear", "präzise Arbeitsfläche", vLinear]];
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
