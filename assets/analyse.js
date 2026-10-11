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
      db.from("vorlagen").select("id, entscheidung, marke, art").eq("status", "offen"),
      db.from("termine").select("id, start, ende, ganztags, betreff, ort, teilnehmer, extern, postfach, projekt_id, vorbereitung, vorbereitung_notiz, abgesagt").eq("im_kalender", true).gte("ende", JETZT.toISOString()).lte("start", bis14).order("start"),
      db.from("aufgaben").select("id, titel, art, spalte, status, faellig_am, antwort_am, mail_gesendet_am, projekt_id, marke").eq("status", "offen"),
      db.from("projekte").select("id, name, marke"),
      db.from("linkedin_kennzahlen").select("stichtag, follower, kontakte, impressionen, interaktionen, profilaufrufe").eq("quelle", "profil").order("stichtag", { ascending: false }).limit(2),
      db.from("geburtstage_privat").select("id, vorname, nachname, firma, tag, monat, jahr, gratuliert_jahr").eq("aktiv", true),
      db.from("marken_strategie").select("*"),
      db.from("projekte").select("id, name, marke, typ, status, prioritaet"),
      db.from("kampagnen").select("id, name, marke, status, start"),
      db.from("repo_stand").select("thema, datum, titel").gte("datum", new Date(Date.now() - 14 * 864e5).toISOString()).order("datum", { ascending: false }),
      db.from("vorlagen").select("id, titel, projekt_id, marke, entschieden_am, art").eq("status", "entschieden"),
      db.from("vorlagen").select("id, art, thema, titel, kern, punkte, vorschlag, link, knopf_ja, entscheidung, angelegt_am, rang").in("art", ["umsetzung", "schritt"]).eq("status", "offen").order("rang")
    ]).then(function (r) {
      D.repo = r[9].data || []; D.auftraege = (r[10].data || []).filter(function (v) { return v.art !== "umsetzung" && v.art !== "schritt"; }); D.umsetzung = r[11].data || [];
      D.geburtstage = r[5].data || []; D.strategie = r[6].data || []; D.projekteAlle = r[7].data || []; D.kampagnen = r[8].data || [];
      D.vorlagen = (r[0].data || []).filter(function (v) { return v.art !== "umsetzung" && v.art !== "schritt"; }); D.termine = (r[1].data || []).filter(function (t) { return !t.abgesagt; }); D.aufgaben = r[2].data || []; D.projekte = r[3].data || [];
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

  /* ---------- Status Ökosystem (Daniel, 11.10.2026) ----------
     Je Thema kompakt: was zuletzt umgesetzt wurde (Commits der Arbeitszweige, auch von Claude-Code-Sitzungen über Nacht;
     Tabelle repo_stand, alle 30 Minuten vom Mac) und was offen ist (Aufträge an Claude, Aufgaben der zugehörigen Projekte).
     Punkt = neu seit deinem letzten Besuch dieser Seite. */
  var THEMEN = [["empiria", "empiria"], ["sofortsichtbar", "sofortsichtbar"], ["Müller&Ströbel.", "Müller&Ströbel."], ["Dashboard", "Dashboard"], ["Projekte", "Kundenprojekte"]];
  var LETZTER = 0;
  try { LETZTER = +localStorage.getItem("oe-besuch") || 0; localStorage.setItem("oe-besuch", String(Date.now())); } catch (x) {}
  function themaVon(projektId, marke) {
    var p = D.projekteAlle.filter(function (x) { return x.id === projektId; })[0];
    if (p && p.id === 6) return "Dashboard";
    if (p && p.typ !== "intern") return "Projekte";
    return p ? (p.marke || "empiria") : (marke || "empiria");
  }
  function wannKurz(d) {
    var x = new Date(d), t = Math.floor((HEUTE - new Date(x.toDateString())) / 864e5), uhr = x.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    return t <= 0 ? "heute " + uhr : t === 1 ? "gestern " + uhr : x.toLocaleDateString("de-DE", { day: "numeric", month: "numeric" });
  }
  function kuerzen(t, n) { t = String(t || ""); return t.length > n ? t.slice(0, n).replace(/\s\S*$/, "") + " …" : t; }
  /* Strategieumsetzung (Daniel, 11.10.2026): je Thema zwei Fragen beantwortet –
     links: Was von den letzten Entwicklungen solltest du dir jetzt gezielt ansehen und mir Rückmeldung geben? (vorlagen.art = umsetzung)
     rechts: Was schlage ich als nächste Schritte vor, um in der Gesamtstrategie voranzukommen? (vorlagen.art = schritt)
     Beides kuratiert Claude; Rückmeldungen laufen wie auf der Steuerung über vorlagen (status entschieden → Claude setzt um).
     Das Protokoll der Commits (repo_stand) steht klein darunter zum Aufklappen. */
  function oekosystem() {
    var leer = !D.strategie.some(function (x) { return x.vision || (x.stossrichtungen || []).length; });
    return '<p class="oe-einl">Links, was du dir ansehen und mir zurückmelden solltest – rechts meine nächsten Schritte.' + (leer ? " Sie werden schärfer, sobald Vision und Stoßrichtungen im Bereich Strategie stehen." : "") + "</p>" +
      '<div class="oe">' + THEMEN.map(function (th) {
      var an = D.umsetzung.filter(function (v) { return v.art === "umsetzung" && v.thema === th[0] && v.entscheidung !== "spaeter"; });
      var nx = D.umsetzung.filter(function (v) { return v.art === "schritt" && v.thema === th[0] && v.entscheidung !== "spaeter"; });
      var um = D.repo.filter(function (c) { return c.thema === th[0]; }).slice(0, 5);
      function punkt(v, schritt) {
        // Zugeklappt nur die sprechende Überschrift, aufgeklappt Text, Frage und Knöpfe (Daniel, 11.10.2026)
        return '<li class="oe-p" data-v="' + v.id + '"><button type="button" class="oe-kopf" aria-expanded="false"><b>' + esc(v.titel) + '</b><span class="kb-k-pfeil" aria-hidden="true"></span></button><div class="oe-det" hidden>' +
          (v.kern ? '<span class="oe-kern">' + esc(v.kern) + "</span>" : "") +
          // Was im Einzelnen neu ist: Zeilen „Titel | Satz | Link“
          (v.punkte ? '<ul class="oe-teile">' + String(v.punkte).split("\n").filter(Boolean).map(function (z) {
            var t = z.split("|").map(function (x) { return x.trim(); });
            return "<li>" + (t[2] ? '<a href="' + esc(t[2]) + '" target="_blank" rel="noopener">' + esc(t[0]) + "</a>" : "<b>" + esc(t[0]) + "</b>") + (t[1] ? " – " + esc(t[1]) : "") + "</li>"; }).join("") + "</ul>" : "") +
          (v.vorschlag ? '<span class="oe-frage">' + esc(v.vorschlag) + "</span>" : "") +
          '<span class="oe-knoepfe">' + (v.link ? '<a class="oe-an" href="' + esc(v.link) + '" target="_blank" rel="noopener">Ansehen ↗</a>' : "") +
          '<button type="button" class="oe-ja" data-oe="ja">' + esc(schritt ? "Ja" : v.knopf_ja || "Passt") + "</button>" +
          '<button type="button" data-oe-anders>' + (schritt ? "Anders …" : "Rückmeldung …") + "</button>" +
          (schritt ? '<button type="button" data-oe="spaeter">Später</button>' : "") + "</span>" +
          '<form class="oe-form" hidden><textarea rows="3" placeholder="' + (schritt ? "Was soll stattdessen passieren?" : "Deine Rückmeldung – sprechen oder tippen") + '"></textarea><span><button type="submit">An Claude geben</button><button type="button" data-oe-zu>Abbrechen</button></span></form></div></li>';
      }
      return '<section class="oe-z"><h4 class="oe-t">' + esc(th[1]) + "</h4>" +
        '<div class="oe-sp"><p class="oe-k">Ansehen und Rückmeldung geben</p>' + (an.length ? '<ul class="oe-l">' + an.map(function (v) { return punkt(v, false); }).join("") + "</ul>" : '<p class="oe-leer">Nichts Neues zum Ansehen.</p>') +
          (um.length ? '<details class="oe-prot"><summary>Alle Änderungen</summary><ul class="oe-l">' + um.map(function (c) {
            return '<li class="oe-c" title="' + esc(c.titel) + '"><span class="oe-wann">' + wannKurz(c.datum) + "</span><span>" + esc(kuerzen(c.titel, 95)) + "</span></li>"; }).join("") + "</ul></details>" : "") + "</div>" +
        '<div class="oe-sp"><p class="oe-k">Nächste Schritte – mein Vorschlag</p>' + (nx.length ? '<ul class="oe-l">' + nx.map(function (v) { return punkt(v, true); }).join("") + "</ul>" : '<p class="oe-leer">Kein Vorschlag offen.</p>') + "</div></section>";
    }).join("") + "</div>";
  }
  function oekosystemVerdrahten() {
    wurzel.querySelectorAll(".oe-p").forEach(function (li) {
      var id = +li.getAttribute("data-v"), form = li.querySelector(".oe-form"), kopf = li.querySelector(".oe-kopf");
      kopf.onclick = function () { var auf = kopf.getAttribute("aria-expanded") !== "true"; kopf.setAttribute("aria-expanded", String(auf)); li.querySelector(".oe-det").hidden = !auf; };
      function sichern(f) {
        f.entschieden_am = new Date().toISOString(); li.classList.add("laedt");
        db.from("vorlagen").update(f).eq("id", id).then(function (r) {
          if (r.error) { li.classList.remove("laedt"); alert("Nicht gespeichert: " + r.error.message); return; }
          D.umsetzung = D.umsetzung.filter(function (v) { return v.id !== id; }); zeichnen();
        });
      }
      li.querySelectorAll("[data-oe]").forEach(function (b) {
        b.onclick = function () { var e = b.getAttribute("data-oe"); sichern(e === "spaeter" ? { entscheidung: "spaeter" } : { status: "entschieden", entscheidung: "ja" }); };
      });
      li.querySelector("[data-oe-anders]").onclick = function () { form.hidden = false; form.querySelector("textarea").focus(); };
      form.querySelector("[data-oe-zu]").onclick = function () { form.hidden = true; };
      form.onsubmit = function (ev) { ev.preventDefault(); var t = form.querySelector("textarea").value.trim(); if (t) sichern({ status: "entschieden", entscheidung: "anders", entscheidung_text: t }); };
    });
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
    /* Marke mit Inhalt als „Zug“ (Daniel, 11.10.2026 – Idee Volksfestumzug): oben Marke und Ziel in einem Satz,
       darunter die Stränge als kompakte Wagen (Titel, wer, Stand) und am Ende das Gate (schwarz, gelber Kicker, Datum).
       Stränge „nach Gate“ fahren hinter dem Gate. Alles Erklärende erst unter „Mehr anzeigen“. */
    if (voll.length) h += voll.map(function (m) {
      var d = daten(m), zugeordnet = {};
      d.st.forEach(function (x) { (x.projekte || []).forEach(function (id) { zugeordnet[id] = 1; }); });
      var vor = d.st.filter(function (x) { return !/^(nach|parallel)/i.test(x.stand || ""); }), nach = d.st.filter(function (x) { return /^nach/i.test(x.stand || ""); }),
          parallel = d.st.filter(function (x) { return /^parallel/i.test(x.stand || ""); });
      // Wer: nur, wenn nicht (nur) Daniel – das weiß er selbst
      function wer(v) { v = String(v || ""); return v === "Daniel" ? "" : v.replace(/^Daniel und /, "mit "); }
      var gate = d.s.gate_aufgabe_id ? D.aufgaben.filter(function (a) { return a.id === d.s.gate_aufgabe_id; })[0] : null;
      function wagen(x) {
        var fertig = /erreicht/i.test(x.stand || "");
        var pl = (x.projekte || []).map(function (id) { return D.projekteAlle.filter(function (p) { return p.id === id; })[0]; }).filter(Boolean);
        // Wagen: nur Titel und wer – Stand nur, wenn er etwas sagt; Klick führt ins (erste) Projekt
        var ziel = pl.length === 1 ? "/strategie/projekte.html#p=" + pl[0].id : null;
        return '<li class="zg-w' + (fertig ? " zg-w--fertig" : "") + '">' + (ziel ? '<a class="zg-a" href="' + ziel + '">' : '<span class="zg-a">') + "<b>" + esc(x.titel) + "</b>" + (wer(x.verantwortlich) ? '<span class="zg-wer">' + esc(wer(x.verantwortlich)) + "</span>" : "") +
          (fertig ? '<span class="zg-stand">✓ erreicht</span>' : x.stand ? '<span class="zg-stand">' + esc(x.stand) + "</span>" : "") + (ziel ? "</a>" : "</span>") + "</li>";
      }
      var gDatum = gate && gate.faellig_am ? new Date(gate.faellig_am.slice(0, 10) + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "numeric" }) : "Termin offen";
      var weitere = d.proj.filter(function (p) { return !zugeordnet[p.id]; });
      function feld(titel, wert) { return wert ? '<div class="sg-feld"><h5>' + titel + "</h5><p>" + esc(wert) + "</p></div>" : ""; }
      return '<section class="zg"><div class="zg-kopf"><h4 class="zg-marke">' + esc(m) + '</h4><p class="zg-ziel">' + esc(d.s.ziel_kurz || d.s.zwischenziel || "") + "</p></div>" +
        '<ol class="zg-zug">' + vor.map(wagen).join("") +
          '<li class="zg-gate"><span class="zg-gate-k">Gate</span><b>' + esc(gDatum) + "</b></li>" +
          nach.map(function (x) { return wagen(x).replace('class="zg-w', 'class="zg-w zg-w--danach'); }).join("") + "</ol>" +
        (parallel.length ? '<p class="zg-parallel">Parallel: ' + parallel.map(function (x) { return "<b>" + esc(x.titel) + "</b>"; }).join(" · ") + "</p>" : "") +
        '<details class="zg-mehr"><summary>Mehr anzeigen</summary><div class="sg-voll-zwei"><div>' + feld("Zwischenziel", d.s.zwischenziel) +
          '<div class="sg-feld"><h5>Stränge</h5><ul class="zg-st">' + d.st.map(function (x) {
            var pl = (x.projekte || []).map(function (id) { return D.projekteAlle.filter(function (p) { return p.id === id; })[0]; }).filter(Boolean);
            return "<li><b>" + esc(x.titel) + "</b> – " + esc(x.beschreibung || "") + (pl.length ? '<span class="zg-proj">' + pl.map(function (p) { return '<a href="/strategie/projekte.html#p=' + p.id + '">' + esc(p.name) + " →</a>"; }).join("") + "</span>" : "") + "</li>"; }).join("") + "</ul></div></div><div>" +
          feld("Vision", d.s.vision) + feld("Zukünftiges Geschäftsmodell", d.s.geschaeftsmodell) +
          (d.kamp.length ? '<div class="sg-feld"><h5>Marketing</h5><ul class="sg-proj">' + d.kamp.map(function (k) { return '<li><a href="/strategie/marketing.html">' + esc(k.name) + "</a><small>" + esc(k.status || "") + "</small></li>"; }).join("") + "</ul></div>" : "") +
          (weitere.length ? '<div class="sg-feld"><h5>Weitere Projekte</h5><ul class="sg-proj">' + weitere.map(function (p) { return "<li>" + projLink(p) + "<small>" + esc(p.typ === "intern" ? "intern" : "Kunde") + "</small></li>"; }).join("") + "</ul></div>" : "") +
        "</div></div></details></section>";
    }).join("");
    if (leer.length) h += '<ul class="sg-zeilen">' + leer.map(function (m) {
      var d = daten(m), schwer = d.proj.filter(function (p) { return p.prioritaet === "hoch"; });
      if (!schwer.length) schwer = d.proj.slice(0, 3);
      return '<li class="sg-zeile"><b class="sg-zeile-marke">' + esc(m) + '</b><span class="sg-zeile-was"><span class="sg-zeile-status">Vision und Stoßrichtungen noch offen</span>' +
        (schwer.length ? '<small>' + (d.proj.some(function (p) { return p.prioritaet === "hoch"; }) ? "Priorität hoch: " : "Projekte: ") + schwer.map(projLink).join(" · ") + "</small>" : "") + "</span>" +
        '<button type="button" class="sg-los" data-deep="' + esc(m) + '">Deep Dive starten <i aria-hidden="true">→</i></button></li>';
    }).join("") + "</ul>";
    return h;
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
      // Start immer: Entscheidungen und Status Ökosystem offen, Strategie und Sparring zu (Daniel, 11.10.2026)
      BR.html("strategie", "status", "Entscheidungen", signale() + geburtstage(), "auf") +
      BR.html("strategie", "oekosystem", "Strategieumsetzung", oekosystem(), "auf") +
      BR.html("strategie", "strategie", "Strategie", strategie(), "zu") +
      BR.html("strategie", "sparring", "Sparring starten", sparring(), "zu") + "</div>";
    BR.verdrahten(wurzel, "strategie");
    verdrahten(); oekosystemVerdrahten();
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
