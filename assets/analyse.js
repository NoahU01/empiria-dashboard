/* Analyse – „Bin ich an den richtigen Sachen dran?“
   Signale mit Zahl, jedes führt per Klick dorthin, wo es bearbeitet wird:
     Entscheidungsvorschläge · Termine ohne Vorbereitung · Mails (neu / Handlungsbedarf) · Aufgaben · Rückmeldungen · LinkedIn
   Darunter: Termine der nächsten 14 Tage mit Vorbereitungsstand (offen · läuft · vorbereitet · nicht nötig),
   Ideensprint zur Vorbereitung startbar. Pendant zur Steuerung (dort die Vorschläge). */
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
      db.from("termine").select("id, start, ende, ganztags, betreff, ort, teilnehmer, extern, postfach, projekt_id, vorbereitung, vorbereitung_notiz, abgesagt").gte("ende", JETZT.toISOString()).lte("start", bis14).order("start"),
      db.from("aufgaben").select("id, status, faellig_am, antwort_am, mail_gesendet_am, projekt_id, marke").eq("status", "offen"),
      db.from("projekte").select("id, name, marke"),
      db.from("linkedin_kennzahlen").select("stichtag, follower, kontakte, impressionen, interaktionen, profilaufrufe").eq("quelle", "profil").order("stichtag", { ascending: false }).limit(2)
    ]).then(function (r) {
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
  function kachel(link, zahl, titel, unter, ton) {
    return '<a class="an-k' + (ton ? " an-k--" + ton : "") + '" href="' + link + '"><span class="an-zahl">' + zahl + '</span><b>' + titel + "</b>" + (unter ? "<small>" + unter + "</small>" : "") + "</a>";
  }

  function signale() {
    var vor = V().filter(function (v) { return v.entscheidung !== "spaeter"; }).length;
    var bis7 = new Date(+HEUTE + 8 * 864e5);
    var offen = T().filter(function (t) { return t.vorbereitung === "offen"; });
    var offen7 = offen.filter(function (t) { return new Date(t.start) < bis7; }).length;
    var laeuft = T().filter(function (t) { return t.vorbereitung === "laeuft"; }).length;
    var morgen = iso(new Date(+HEUTE + 864e5)), sonntag = new Date(HEUTE); sonntag.setDate(sonntag.getDate() + (7 - ((sonntag.getDay() + 6) % 7)) - 1);
    var ueber = A().filter(function (a) { return a.faellig_am && a.faellig_am.slice(0, 10) < iso(HEUTE); }).length;
    var woche = A().filter(function (a) { return a.faellig_am && a.faellig_am.slice(0, 10) >= iso(HEUTE) && a.faellig_am.slice(0, 10) <= iso(sonntag); }).length;
    var rueck = A().filter(function (a) { return a.antwort_am; }).length;
    var warten = A().filter(function (a) { return a.mail_gesendet_am && !a.antwort_am; }).length;
    var m;
    if (D.mails === "laedt") m = kachel("/strategie/korrespondenz-beta.html", "…", "Mails", "werden geprüft");
    else if (D.mails === "anmelden") m = '<button type="button" class="an-k an-k--leer" data-ms><span class="an-zahl">–</span><b>Mails</b><small>mit Microsoft anmelden</small></button>';
    else m = kachel("/strategie/korrespondenz-beta.html", D.mails.handlung, "Mails mit Handlungsbedarf", D.mails.neu + " neu in den letzten 24 Stunden", D.mails.handlung ? "achtung" : "");
    return '<div class="an-signale">' +
      kachel("/strategie/steuerung.html", vor, "Entscheidungs&shy;vorschläge", "liegen auf deinem Tisch", vor ? "achtung" : "") +
      kachel("#termine", offen7, "Termine ohne Vorbereitung", "in den nächsten 7 Tagen · " + offen.length + " in 14 Tagen · " + laeuft + " in Vorbereitung", offen7 ? "achtung" : "") +
      m +
      kachel("/strategie/aufgaben.html", ueber, "Aufgaben überfällig", woche + " fällig bis Sonntag", ueber ? "achtung" : "") +
      kachel("/strategie/aufgaben.html", rueck, "Rückmeldungen eingegangen", warten + " warten noch auf Antwort") +
      (mf("empiria") ? linkedin() : "") +
      "</div>";
  }

  // LinkedIn: wöchentlich vom Mac gelesen (linkedin_abgleich.py) – Reichweite der letzten 28 Tage, Klick zur LinkedIn-Analyse
  function linkedin() {
    var j = D.linkedin[0], v = D.linkedin[1];
    if (!j) return '<div class="an-k an-k--leer"><span class="an-zahl">–</span><b>LinkedIn</b><small>noch keine Daten</small></div>';
    var f = function (n) { return n == null ? "–" : Number(n).toLocaleString("de-DE"); };
    var diff = v && v.follower != null && j.follower != null ? " (" + (j.follower - v.follower >= 0 ? "+" : "") + f(j.follower - v.follower) + ")" : "";
    var stand = new Date(j.stichtag + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "numeric" });
    return '<a class="an-k" href="https://www.linkedin.com/analytics/creator/content/" target="_blank" rel="noopener"><span class="an-zahl">' + f(j.impressionen) + "</span><b>LinkedIn-Reichweite</b><small>Impressionen in 28 Tagen · " +
      f(j.interaktionen) + " Interaktionen · " + f(j.follower) + " Follower" + diff + " · " + f(j.kontakte) + " Kontakte · Stand " + stand + "</small></a>";
  }

  function termine() {
    if (!T().length) return '<p class="an-leer">Keine Termine in den nächsten 14 Tagen.</p>';
    var tage = {};
    T().forEach(function (t) { var k = iso(new Date(t.start)); (tage[k] = tage[k] || []).push(t); });
    return Object.keys(tage).sort().map(function (k) {
      var d = new Date(k + "T12:00:00");
      return '<section class="an-tag"><h4>' + d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" }) + "</h4><ul>" + tage[k].map(function (t) {
        var p = projekt(t.projekt_id), zeit = t.ganztags ? "ganztags" : new Date(t.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
        var mit = (t.teilnehmer || []).slice(0, 3).join(", ") + ((t.teilnehmer || []).length > 3 ? " …" : "");
        return '<li class="an-t an-t--' + t.vorbereitung + '" data-t="' + t.id + '"><span class="an-zeit">' + zeit + "</span>" +
          '<span class="an-was"><b>' + esc(t.betreff || "(ohne Titel)") + "</b><small>" + [p ? esc(p.name) : "", esc(mit), esc(t.postfach)].filter(Boolean).join(" · ") + "</small>" +
            (t.vorbereitung_notiz ? '<ul class="an-notiz">' + t.vorbereitung_notiz.split("\n").filter(Boolean).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "") + "</span>" +
          '<span class="an-vorb" role="group" aria-label="Vorbereitung">' +
            '<button type="button" data-v="offen" aria-pressed="' + (t.vorbereitung === "offen") + '">offen</button>' +
            '<button type="button" data-v="laeuft" aria-pressed="' + (t.vorbereitung === "laeuft") + '">läuft</button>' +
            '<button type="button" data-v="vorbereitet" aria-pressed="' + (t.vorbereitung === "vorbereitet") + '">vorbereitet</button>' +
            '<button type="button" data-v="nicht_noetig" aria-pressed="' + (t.vorbereitung === "nicht_noetig") + '">nicht nötig</button></span></li>';
      }).join("") + "</ul></section>";
    }).join("");
  }

  function zeichnen() {
    wurzel.innerHTML = signale() +
      '<section class="an-block" id="termine"><div class="an-block-kopf"><h2 class="st4-h">Termine der nächsten 14 Tage</h2>' +
      '<button type="button" class="an-sprint" data-sprint>Ideensprint zur Vorbereitung starten</button></div>' +
      '<p class="an-hinweis" data-sprint-hinweis hidden></p>' + termine() + "</section>";
    verdrahten();
  }

  function verdrahten() {
    var ms = wurzel.querySelector("[data-ms]"); if (ms && B) ms.onclick = B.anmelden;
    wurzel.querySelectorAll(".an-t").forEach(function (li) {
      li.querySelectorAll("[data-v]").forEach(function (b) {
        b.onclick = function () {
          var v = b.getAttribute("data-v"), id = +li.getAttribute("data-t");
          li.classList.add("laedt");
          db.from("termine").update({ vorbereitung: v, von_hand: true }).eq("id", id).then(function (r) {
            li.classList.remove("laedt");
            if (r.error) { alert("Nicht gespeichert: " + r.error.message); return; }
            D.termine.forEach(function (t) { if (t.id === id) t.vorbereitung = v; });
            zeichnen();
          });
        };
      });
    });
    var sp = wurzel.querySelector("[data-sprint]"), hw = wurzel.querySelector("[data-sprint-hinweis]");
    sp.onclick = function () {
      var offen = T().filter(function (t) { return t.vorbereitung === "offen"; });
      var satz = "Ideensprint zur Terminvorbereitung starten. Offen: " + offen.map(function (t) {
        return new Date(t.start).toLocaleDateString("de-DE", { day: "numeric", month: "numeric" }) + " " + (t.betreff || ""); }).join("; ") + ".";
      db.from("sparring").insert({ modus: "Ideensprint Terminvorbereitung" }).then(function () {});
      var fertig = function () { hw.hidden = false; hw.textContent = "Angefragt – der Startsatz mit allen offenen Terminen liegt in der Zwischenablage, einfach im Chat mit Claude einfügen."; };
      if (navigator.clipboard) navigator.clipboard.writeText(satz).then(fertig, fertig); else fertig();
    };
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
