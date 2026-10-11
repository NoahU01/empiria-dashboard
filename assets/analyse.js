/* Strategie (früher „Analyse“, Daniel 10.10.2026) – drei aufklappbare Bereiche:
     Status    – sechs Signale (kompakt), jedes führt per Klick dorthin, wo es bearbeitet wird:
                 Entscheidungsvorschläge · Termine ohne Vorbereitung · Mails · Aufgaben · Rückmeldungen · LinkedIn;
                 dazu Geburtstage der nächsten Tage (private Kontakte, Tabelle geburtstage_privat) mit Glückwunsch zum Kopieren
     Strategie – je Marke Vision, zukünftiges Geschäftsmodell, Stoßrichtungen (Tabelle marken_strategie), Abgleich mit
                 Marketing und Projekten, Empfehlungen (allein umsetzbar · muss gebaut werden · braucht Freigabe)
     Sparring starten – sechs Arten zu reden (vorher auf der Steuerung)
   Die Termine der nächsten 14 Tage stehen jetzt auf der Steuerung. */
(function () {
  "use strict";
  var db = window.empiriaDb, wurzel = document.querySelector("[data-analyse]");
  if (!db || !wurzel) return;
  var B = window.BetaMail;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  var JETZT = new Date(), HEUTE = new Date(JETZT.toDateString());
  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  var D = { mails: "laedt" };

  db.auth.getSession().then(function (s) {
    if (!s.data.session) { wurzel.innerHTML = '<div class="kb-hinweis"><p>Bitte einmal auf der <a href="/strategie/kontakte.html?zurueck=' + encodeURIComponent(location.pathname) + '">Kontaktseite</a> anmelden – dann erscheint hier die Analyse.</p></div>'; return; }
    var bis14 = new Date(+HEUTE + 15 * 864e5).toISOString();
    Promise.all([
      db.from("vorlagen").select("id, entscheidung, marke").eq("status", "offen"),
      db.from("termine").select("id, start, ende, ganztags, betreff, ort, teilnehmer, extern, postfach, projekt_id, vorbereitung, vorbereitung_notiz, abgesagt").eq("im_kalender", true).gte("ende", JETZT.toISOString()).lte("start", bis14).order("start"),
      db.from("aufgaben").select("id, status, faellig_am, antwort_am, mail_gesendet_am, projekt_id, marke").eq("status", "offen"),
      db.from("projekte").select("id, name, marke"),
      db.from("linkedin_kennzahlen").select("stichtag, follower, kontakte, impressionen, interaktionen, profilaufrufe").eq("quelle", "profil").order("stichtag", { ascending: false }).limit(2),
      db.from("geburtstage_privat").select("id, vorname, nachname, firma, tag, monat, jahr, gratuliert_jahr").eq("aktiv", true),
      db.from("marken_strategie").select("*"),
      db.from("projekte").select("id, name, marke, typ, status, prioritaet"),
      db.from("kampagnen").select("id, name, marke, status, start")
    ]).then(function (r) {
      D.geburtstage = r[5].data || []; D.strategie = r[6].data || []; D.projekteAlle = r[7].data || []; D.kampagnen = r[8].data || [];
      D.vorlagen = r[0].data || []; D.termine = (r[1].data || []).filter(function (t) { return !t.abgesagt; }); D.aufgaben = r[2].data || []; D.projekte = r[3].data || [];
      D.linkedin = r[4].data || [];
      zeichnen(); mails();
    });
  });

  function projekt(id) { return D.projekte.filter(function (p) { return p.id === id; })[0]; }
  // Markensicht (MarkeFokus): Vorlagen über ihre Marke, Aufgaben über das Projekt, Termine über das Postfach, Mails über das Konto
  function mf(m) { return !window.MarkeFokus || MarkeFokus.passt(m); }
  function V() { return D.vorlagen.filter(function (v) { return mf(v.marke); }); }
  function A() { return D.aufgaben.filter(function (a) { var p = projekt(a.projekt_id); return mf(p ? p.marke : a.marke); }); }
  function T() { return D.termine.filter(function (t) { var p = projekt(t.projekt_id); return mf(p ? p.marke : /sofort ?sichtbar/i.test(t.betreff || "") ? "sofortsichtbar" : t.postfach); }); }

  /* Status als Lage-Liste (Daniel, 10.10.2026: Aussagekraft vor Designspielerei): je Signal eine Zeile –
     Zahl, Aussage, Zusammenhang, Pfeil dorthin, wo es erledigt wird. Sortiert nach Dringlichkeit; gelb nur, was heute
     Handeln verlangt. Signale ohne Handlungsbedarf stehen gesammelt in einer leisen Zeile. */
  function signale() {
    var vor = V().filter(function (v) { return v.entscheidung !== "spaeter"; }).length;
    var bis7 = new Date(+HEUTE + 8 * 864e5), bis2 = new Date(+HEUTE + 3 * 864e5);
    var offen = T().filter(function (t) { return t.vorbereitung === "offen"; });
    var offen7 = offen.filter(function (t) { return new Date(t.start) < bis7; }).length, offen2 = offen.filter(function (t) { return new Date(t.start) < bis2; }).length;
    var sonntag = new Date(HEUTE); sonntag.setDate(sonntag.getDate() + (7 - ((sonntag.getDay() + 6) % 7)) - 1);
    var ueber = A().filter(function (a) { return a.faellig_am && a.faellig_am.slice(0, 10) < iso(HEUTE); }).length;
    var woche = A().filter(function (a) { return a.faellig_am && a.faellig_am.slice(0, 10) >= iso(HEUTE) && a.faellig_am.slice(0, 10) <= iso(sonntag); }).length;
    var rueck = A().filter(function (a) { return a.antwort_am; }).length;
    var warten = A().filter(function (a) { return a.mail_gesendet_am && !a.antwort_am; }).length;
    var z = [
      { n: ueber, jetzt: ueber > 0, t: ueber === 1 ? "Aufgabe überfällig" : "Aufgaben überfällig", k: woche ? woche + " weitere fällig bis Sonntag" : "", l: "/strategie/aufgaben.html", leer: "Aufgaben" },
      { n: offen7, jetzt: offen2 > 0, t: offen7 === 1 ? "Termin ohne Vorbereitung" : "Termine ohne Vorbereitung", k: "in den nächsten 7 Tagen" + (offen2 ? " · " + offen2 + " davon bis übermorgen" : ""), l: "/strategie/steuerung.html#termine", leer: "Terminvorbereitung" },
      { n: vor, t: vor === 1 ? "Entscheidung liegt auf deinem Tisch" : "Entscheidungen liegen auf deinem Tisch", k: "", l: "/strategie/steuerung.html#tisch", leer: "Entscheidungen" },
      D.mails === "laedt" ? { n: "…", t: "Mails werden geprüft", k: "", l: "/strategie/korrespondenz-beta.html" }
        : D.mails === "anmelden" ? { n: "–", t: "Mails", k: "mit Microsoft anmelden", ms: true }
        : { n: D.mails.handlung, t: D.mails.handlung === 1 ? "Mail mit Handlungsbedarf" : "Mails mit Handlungsbedarf", k: D.mails.neu + " neu in 24 Stunden", l: "/strategie/korrespondenz-beta.html", leer: "Mails" },
      { n: rueck, t: rueck === 1 ? "Rückmeldung eingegangen" : "Rückmeldungen eingegangen", k: warten ? warten + " warten noch auf Antwort" : "", l: "/strategie/aufgaben.html#rueckmeldungen", leer: "Rückmeldungen" }
    ];
    var aktiv = z.filter(function (x) { return !(typeof x.n === "number" && x.n === 0); }), ruhig = z.filter(function (x) { return x.n === 0; });
    function zeile(x) {
      var inner = '<span class="lg-zahl">' + x.n + '</span><span class="lg-was"><b>' + x.t + "</b>" + (x.k ? "<small>" + esc(x.k) + "</small>" : "") + '</span><span class="lg-pfeil" aria-hidden="true">→</span>';
      return x.ms ? '<button type="button" class="lg-z lg-z--leise" data-ms>' + inner + "</button>" : '<a class="lg-z' + (x.jetzt ? " lg-z--jetzt" : "") + '" href="' + x.l + '">' + inner + "</a>";
    }
    return '<div class="lg">' + aktiv.map(zeile).join("") + (mf("empiria") ? linkedin() : "") + "</div>" +
      (ruhig.length ? '<p class="lg-ruhig">Nichts offen: ' + ruhig.map(function (x) { return esc(x.leer); }).join(" · ") + "</p>" : "");
  }

  // LinkedIn: wöchentlich vom Mac gelesen (linkedin_abgleich.py) – Reichweite der letzten 28 Tage, Klick zur LinkedIn-Analyse
  function linkedin() {
    var j = D.linkedin[0], v = D.linkedin[1];
    if (!j) return "";
    var f = function (n) { return n == null ? "–" : Number(n).toLocaleString("de-DE"); };
    var diff = v && v.follower != null && j.follower != null ? " (" + (j.follower - v.follower >= 0 ? "+" : "") + f(j.follower - v.follower) + ")" : "";
    var stand = new Date(j.stichtag + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "numeric" });
    return '<a class="lg-z lg-z--info" href="https://www.linkedin.com/analytics/creator/content/" target="_blank" rel="noopener"><span class="lg-zahl">' + f(j.impressionen) + '</span><span class="lg-was"><b>LinkedIn-Impressionen in 28 Tagen</b><small>' +
      f(j.interaktionen) + " Interaktionen · " + f(j.follower) + " Follower" + diff + " · Stand " + stand + '</small></span><span class="lg-pfeil" aria-hidden="true">↗</span></a>';
  }

  /* ---------- Geburtstage (private Kontakte) ---------- */
  // Nur heute und morgen (Daniel, 10.10.2026) – eine leise Zeile; Klick auf den Namen öffnet Glückwunsch und „Gratuliert“
  function geburtstage() {
    var l = D.geburtstage.map(function (g) {
      var d = new Date(HEUTE.getFullYear(), g.monat - 1, g.tag); if (d < HEUTE) d = new Date(HEUTE.getFullYear() + 1, g.monat - 1, g.tag);
      return { g: g, d: d, t: Math.round((d - HEUTE) / 864e5) };
    }).filter(function (x) { return x.t <= 1 && x.g.gratuliert_jahr !== x.d.getFullYear(); }).sort(function (a, b) { return a.t - b.t; });
    if (!l.length) return "";
    return '<div class="gb"><p class="gb-zeile"><span class="gb-h">Geburtstag</span>' + l.map(function (x) {
      var g = x.g, n = [g.vorname, g.nachname].filter(Boolean).join(" "), alter = g.jahr ? x.d.getFullYear() - g.jahr : null;
      return '<button type="button" class="gb-name" data-gb-text="' + g.id + '">' + (x.t === 0 ? "heute" : "morgen") + ": <b>" + esc(n) + "</b>" + (alter ? " (" + alter + ")" : "") + "</button>";
    }).join("") + "</p>" + l.map(function (x) {
      var g = x.g, n = [g.vorname, g.nachname].filter(Boolean).join(" "), alter = g.jahr ? x.d.getFullYear() - g.jahr : null;
      var rund = alter && alter % 10 === 0 ? "zum " + alter + ". Geburtstag" : "zum Geburtstag";
      var txt = "Hallo " + (g.vorname || n) + ",\n\nherzlichen Glückwunsch " + rund + "! Ich wünsche Dir einen richtig schönen Tag, Gesundheit und alles Gute für das neue Lebensjahr. Lass Dich feiern!\n\nViele Grüße\nDaniel";
      return '<div class="ad-prompt gb-text" data-gb="' + g.id + '" data-jahr="' + x.d.getFullYear() + '" hidden><p class="ad-prompt-kopf"><span>' + esc(n) + ' – Anrede prüfen, selbst senden</span><span class="gb-knoepfe"><button type="button" data-prompt-kopieren>Kopieren</button><button type="button" data-gb-fertig>Gratuliert</button></span></p><pre>' + esc(txt) + "</pre></div>";
    }).join("") + "</div>";
  }

  /* ---------- Strategie je Marke ---------- */
  var MARKEN = ["empiria", "sofortsichtbar", "Müller&Ströbel."];
  var PRIO = { hoch: 0, mittel: 1, niedrig: 2 };
  function strategie() {
    var marken = MARKEN.filter(function (m) { return mf(m); });
    function daten(m) {
      var s = D.strategie.filter(function (x) { return x.marke === m; })[0] || {};
      var proj = D.projekteAlle.filter(function (p) { return (p.marke || "empiria") === m && p.status !== "abgeschlossen"; })
        .sort(function (a, b) { return (a.prioritaet ? PRIO[a.prioritaet] : 3) - (b.prioritaet ? PRIO[b.prioritaet] : 3) || a.name.localeCompare(b.name, "de"); });
      return { s: s, st: s.stossrichtungen || [], proj: proj, kamp: D.kampagnen.filter(function (k) { return (k.marke || "empiria") === m; }), leer: !s.vision && !s.geschaeftsmodell && !(s.stossrichtungen || []).length };
    }
    function projLink(p) { return '<a href="/strategie/projekte.html#p=' + p.id + '">' + esc(p.name) + "</a>"; }
    // Noch ohne Vision: je Marke eine Zeile – Schwerpunkt-Projekte und der Weg zum Zielbild (Deep Dive)
    var leer = marken.filter(function (m) { return daten(m).leer; }), voll = marken.filter(function (m) { return !daten(m).leer; });
    var h = "";
    if (leer.length) h += '<ul class="sg-zeilen">' + leer.map(function (m) {
      var d = daten(m), schwer = d.proj.filter(function (p) { return p.prioritaet === "hoch"; });
      if (!schwer.length) schwer = d.proj.slice(0, 3);
      return '<li class="sg-zeile"><b class="sg-zeile-marke">' + esc(m) + '</b><span class="sg-zeile-was"><span class="sg-zeile-status">Vision und Stoßrichtungen noch offen</span>' +
        (schwer.length ? '<small>' + (d.proj.some(function (p) { return p.prioritaet === "hoch"; }) ? "Priorität hoch: " : "Projekte: ") + schwer.map(projLink).join(" · ") + "</small>" : "") + "</span>" +
        '<button type="button" class="sg-los" data-deep="' + esc(m) + '">Deep Dive starten <i aria-hidden="true">→</i></button></li>';
    }).join("") + "</ul>";
    if (voll.length) h += '<div class="sg-marken">' + voll.map(function (m) {
      var d = daten(m);
      function feld(titel, wert) { return '<div class="sg-feld"><h5>' + titel + "</h5>" + (wert ? "<p>" + esc(wert) + "</p>" : '<p class="sg-offen">Noch offen</p>') + "</div>"; }
      return '<section class="sg-marke"><h4 class="sg-marke-h">' + esc(m) + "</h4>" + feld("Vision", d.s.vision) + feld("Zukünftiges Geschäftsmodell", d.s.geschaeftsmodell) +
        '<div class="sg-feld"><h5>Strategische Stoßrichtungen</h5>' + (d.st.length ? "<ol>" + d.st.map(function (x) { return "<li><b>" + esc(x.titel) + "</b>" + (x.beschreibung ? " – " + esc(x.beschreibung) : "") + "</li>"; }).join("") + "</ol>" : '<p class="sg-offen">Noch offen</p>') + "</div>" +
        '<div class="sg-feld"><h5>Abgleich: Projekte</h5>' + (d.proj.length ? '<ul class="sg-proj">' + d.proj.map(function (p) { return "<li>" + projLink(p) + "<small>" + esc(p.prioritaet ? "Priorität " + p.prioritaet : "Priorität offen") + "</small></li>"; }).join("") + "</ul>" : '<p class="sg-offen">Keine Projekte</p>') + "</div>" +
        '<div class="sg-feld"><h5>Abgleich: Marketing</h5>' + (d.kamp.length ? '<ul class="sg-proj">' + d.kamp.map(function (k) { return '<li><a href="/strategie/marketing.html">' + esc(k.name) + "</a><small>" + esc(k.status || "") + "</small></li>"; }).join("") + "</ul>" : '<p class="sg-offen">Keine Kampagnen</p>') + "</div></section>";
    }).join("") + "</div>" +
      '<div class="sg-empf"><h4 class="gb-h">Empfehlungen</h4><div class="sg-empf-drei">' +
        [["Kann ich allein umsetzen", "Claude setzt nach deinem Ja direkt um."], ["Muss gebaut werden", "Braucht eine Programmier- oder Gestaltungsrunde."], ["Braucht deine Freigabe", "Entscheidung, Budget oder Zugang durch dich."]].map(function (x) {
          return '<div class="sg-empf-k"><b>' + x[0] + "</b><small>" + x[1] + "</small></div>"; }).join("") + "</div></div>";
    return '<p class="sg-einl">Wohin wir wollen, wie wir dorthin kommen – und ob Marketing, Projekte und Aufgaben darauf einzahlen. Aus Vision und Stoßrichtungen leite ich die Schwerpunkte und meine Empfehlungen ab.</p>' + h;
  }

  /* ---------- Sparring (vorher auf der Steuerung) ---------- */
  var SPARRING = [
    { k: "sprint", n: "Entscheidungssprint", z: "15 Min", s: "Mehrere Entscheidungen am Stück.", r: "Kein Abschweifen. Was nicht entschieden werden kann, wird notiert und verlässt den Sprint." },
    { k: "deep", n: "Deep Dive", z: "60–90 Min", s: "Volle Tiefe zu einem Thema.", r: "Keine Randthemen. Was auftaucht und nicht dazugehört, wandert auf eine Liste für später." },
    { k: "360", n: "360°-Blick", z: "45 Min", s: "Ein Thema, alle Zusammenhänge.", r: "Keine Tiefe. Wer hier anfängt zu lösen, verliert die Übersicht." },
    { k: "ideen", n: "Ideen-Modus", z: "offen", s: "Sammeln ohne Ergebnisdruck.", r: "Kein Entscheidungsdruck. Nichts wird bewertet, solange gesammelt wird." },
    { k: "status", n: "Status-Check", z: "10 Min", s: "Abgleich über alle drei Marken.", r: "Keine Lösungen. Es wird festgestellt, nicht gearbeitet." },
    { k: "review", n: "Review", z: "20–30 Min", s: "Bewerten, was fertig ist.", r: "Keine neuen Wünsche. Beurteilt wird, was da ist, nicht was fehlt." }
  ];
  function sparring() {
    return '<div class="st4-sparring">' + SPARRING.map(function (s) {
      return '<button type="button" class="st4-spar" data-spar="' + s.k + '" title="Regel: ' + esc(s.r) + '"><span class="st4-spar-z">' + s.z + '</span><b>' + esc(s.n).replace("Entscheidungssprint", "Entscheidungs&shy;sprint") + '</b><span class="st4-spar-s">' + esc(s.s) + '</span><span class="st4-spar-los">Starten <i aria-hidden="true">→</i></span></button>';
    }).join("") + "</div>";
  }

  function zeichnen() {
    var BR = window.Bereiche;
    wurzel.innerHTML = '<div class="kg-bereiche">' +
      // Start immer: Status und Strategie offen, Sparring zu (Daniel, 11.10.2026)
      BR.html("strategie", "status", "Status", signale() + geburtstage(), "auf") +
      BR.html("strategie", "strategie", "Strategie", strategie(), "auf") +
      BR.html("strategie", "sparring", "Sparring starten", sparring(), "zu") + "</div>";
    BR.verdrahten(wurzel, "strategie");
    verdrahten();
  }

  function verdrahten() {
    var ms = wurzel.querySelector("[data-ms]"); if (ms && B) ms.onclick = B.anmelden;
    wurzel.querySelectorAll("[data-gb-text]").forEach(function (b) {
      b.onclick = function () { var t = wurzel.querySelector('.gb-text[data-gb="' + b.getAttribute("data-gb-text") + '"]'); t.hidden = !t.hidden; b.setAttribute("aria-expanded", String(!t.hidden)); };
    });
    wurzel.querySelectorAll("[data-gb-fertig]").forEach(function (b) {
      b.onclick = function () {
        var li = b.closest(".gb-text"), id = +li.getAttribute("data-gb"), jahr = +li.getAttribute("data-jahr");
        li.classList.add("laedt");
        db.from("geburtstage_privat").update({ gratuliert_jahr: jahr }).eq("id", id).then(function (r) {
          if (r.error) { li.classList.remove("laedt"); alert("Nicht gespeichert: " + r.error.message); return; }
          D.geburtstage.forEach(function (g) { if (g.id === id) g.gratuliert_jahr = jahr; }); zeichnen();
        });
      };
    });
    // Deep Dive je Marke: Startsatz in die Zwischenablage
    wurzel.querySelectorAll("[data-deep]").forEach(function (b) {
      b.onclick = function () {
        var m = b.getAttribute("data-deep"), satz = "Deep Dive Strategie " + m + " starten – Vision, zukünftiges Geschäftsmodell und strategische Stoßrichtungen erarbeiten. Regel: Keine Randthemen.";
        db.from("sparring").insert({ modus: "Deep Dive Strategie " + m }).then(function () {});
        var fertig = function () { b.innerHTML = "✓ Startsatz kopiert – im Chat einfügen"; b.disabled = true; };
        if (navigator.clipboard) navigator.clipboard.writeText(satz).then(fertig, fertig); else fertig();
      };
    });
    wurzel.querySelectorAll("[data-spar]").forEach(function (b) {
      b.onclick = function () {
        var s = SPARRING.filter(function (x) { return x.k === b.getAttribute("data-spar"); })[0];
        var satz = s.n + " starten – Regel: " + s.r;
        db.from("sparring").insert({ modus: s.n }).then(function () {});
        var fertig = function () {
          wurzel.querySelectorAll(".st4-spar--an").forEach(function (x) { if (x !== b) { x.classList.remove("st4-spar--an"); x.querySelector(".st4-spar-los").innerHTML = 'Starten <i aria-hidden="true">→</i>'; } });
          b.classList.add("st4-spar--an"); b.querySelector(".st4-spar-los").textContent = "✓ Angefragt – Startsatz ist kopiert, im Chat mit Claude einfügen.";
        };
        if (navigator.clipboard) navigator.clipboard.writeText(satz).then(fertig, fertig); else fertig();
      };
    });
  }

  function mailZahlen() {
    var d = D.mailRoh, vor24 = Date.now() - 864e5, k = function (m) { return mf(m.konto && m.konto.name); };
    return { neu: d.relevant.concat(d.nichtRelevant).filter(function (m) { return k(m) && new Date(m.receivedDateTime) > vor24; }).length, handlung: d.handlung.filter(k).length };
  }
  document.addEventListener("markefokus", function () { if (!D.vorlagen) return; if (D.mailRoh) D.mails = mailZahlen(); zeichnen(); });
  // Mails: neu in 24 h und Handlungsbedarf – nur mit Microsoft-Anmeldung (wie Korrespondenz)
  function mails() {
    if (!B) { D.mails = "anmelden"; zeichnen(); return; }
    B.start().then(function (k) {
      if (!k) { D.mails = "anmelden"; zeichnen(); return; }
      return B.laden().then(function (d) {
        var vor24 = Date.now() - 864e5;
        var neu = d.relevant.concat(d.nichtRelevant).filter(function (m) { return new Date(m.receivedDateTime) > vor24; }).length;
        D.mailRoh = d; D.mails = mailZahlen(); zeichnen();
      });
    }).catch(function () { D.mails = "anmelden"; zeichnen(); });
  }
})();
